import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// === Config ===
const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN, PORT } = process.env;
const API_BASE = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;
const AUTH = { Authorization: `Bearer ${CARTPANDA_TOKEN}` };
const SERVER_PORT = Number(PORT || 3000);

// === Utils ===
const norm = (s) => String(s || "").trim().toLowerCase();

function extractEmails(order) {
  return [
    order?.customer?.email,
    order?.email,
    order?.contact_email,
    order?.client_details?.email,
    order?.shipping_address?.email,
    order?.billing_address?.email,
  ]
    .filter(Boolean)
    .map(norm);
}

function buildTracking(order) {
  const f = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
  const last = f[f.length - 1] || null;
  return last
    ? {
        status: last.status || order.fulfillment_status || null,
        tracking_number: last.tracking_number || last.tracking_no || null,
        tracking_company: last.tracking_company || null,
        tracking_url: last.tracking_url || null,
      }
    : null;
}

function unwrapOrder(obj) {
  if (obj && obj.order && typeof obj.order === "object") return obj.order;
  return obj;
}

function unwrapOrdersList(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj?.orders && Array.isArray(obj.orders)) return obj.orders;
  if (obj?.data && Array.isArray(obj.data)) return obj.data;
  return [];
}

async function httpJson(url) {
  const r = await fetch(url, { headers: AUTH });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

/** Busca um pedido por ID e tenta alguns fallbacks por número */
async function fetchOrderByAnyId(idOrNumber) {
  // 1) por ID direto
  try {
    const data = await httpJson(`${API_BASE}/orders/${encodeURIComponent(idOrNumber)}`);
    return unwrapOrder(data);
  } catch (e) {
    // segue pros fallbacks
  }

  // 2) por number/search (se a API suportar)
  for (const alt of [
    `${API_BASE}/orders?number=${encodeURIComponent(idOrNumber)}`,
    `${API_BASE}/orders?search=${encodeURIComponent(idOrNumber)}`,
  ]) {
    try {
      const data = await httpJson(alt);
      const arr = unwrapOrdersList(data);
      if (arr.length) return arr[0];
    } catch (e) {}
  }

  throw new Error(`Pedido não encontrado: ${idOrNumber}`);
}

/** Lista pedidos tentando search/email e depois paginação 1..5 */
async function listOrdersRobust(email) {
  const results = [];

  // 1) filtros no servidor (se disponíveis)
  for (const q of [
    `${API_BASE}/orders?search=${encodeURIComponent(email)}`,
    `${API_BASE}/orders?email=${encodeURIComponent(email)}`,
  ]) {
    try {
      const data = await httpJson(q);
      const arr = unwrapOrdersList(data);
      if (arr.length) results.push(...arr);
    } catch (e) {}
  }

  // 2) paginação simples
  if (results.length === 0) {
    for (let page = 1; page <= 5; page++) {
      try {
        const data = await httpJson(`${API_BASE}/orders?page=${page}`);
        const arr = unwrapOrdersList(data);
        if (!arr.length) break;
        results.push(...arr);
      } catch (e) {
        break;
      }
    }
  }

  return results;
}

// === Rotas ===

// A) Status por order_id + e-mail (mantemos)
app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id, email, debug, bypass_email } = req.query;
    if (!order_id || !email) return res.status(400).json({ error: "Informe order_id e email." });

    const order = await fetchOrderByAnyId(order_id);
    const emails = extractEmails(order);
    const input = norm(email);
    const matches = emails.includes(input);

    if (!matches && bypass_email !== "1") {
      const payload = { error: "E-mail não confere com o pedido." };
      if (debug === "1") Object.assign(payload, { debug_emails_found: emails, debug_input_email: input, debug_order_keys: Object.keys(order || {}) });
      return res.status(403).json(payload);
    }

    return res.json({
      order_id: order.id ?? order.number ?? order_id,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking: buildTracking(order),
      ...(debug === "1" ? { debug_emails_found: emails, debug_input_email: input } : {})
    });
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

// B) Somente por e-mail — pega o pedido mais recente desse e-mail
app.get("/api/order-by-email", async (req, res) => {
  try {
    const { email, debug } = req.query;
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });

    const wanted = norm(email);
    const orders = await listOrdersRobust(email);
    const matches = orders.filter((o) => extractEmails(o).includes(wanted));

    if (!matches.length) {
      const payload = { error: "Nenhum pedido encontrado para este e-mail." };
      if (debug === "1") payload.debug_scanned = orders.length;
      return res.status(404).json(payload);
    }

    const lastOrder = unwrapOrder(matches[0]);

    const resp = {
      email: wanted,
      total_pedidos: matches.length,
      order_id: lastOrder.id ?? lastOrder.number ?? null,
      number: lastOrder.number ?? null,
      financial_status: lastOrder.financial_status || null,
      fulfillment_status: lastOrder.fulfillment_status || null,
      tracking: buildTracking(lastOrder),
    };

    if (debug === "1") {
      resp.debug_scanned = orders.length;
      resp.debug_emails_encontrados = extractEmails(lastOrder);
      resp.debug_keys = Object.keys(lastOrder || {});
    }

    return res.json(resp);
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

// C) Diagnóstico bruto (pra ver a resposta da API)
app.get("/api/_diag/orders_raw", async (req, res) => {
  try {
    const page = req.query.page || "1";
    const r = await fetch(`${API_BASE}/orders?page=${encodeURIComponent(page)}`, { headers: AUTH });
    const text = await r.text();
    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      sample: text.slice(0, 2000),
    });
  } catch (e) {
    res.status(500).json({ error: "diag_failed", detail: String(e) });
  }
});

// D) Diagnóstico de formato (chaves)
app.get("/api/_diag/orders_shape", async (req, res) => {
  try {
    const r = await fetch(`${API_BASE}/orders?page=1`, { headers: AUTH });
    if (!r.ok) return res.status(r.status).json({ ok: false, status: r.status, hint: "Falha ao acessar /orders" });
    const data = await r.json();
    const orders = unwrapOrdersList(data);
    const first = orders[0] || null;

    const topShape = Array.isArray(data)
      ? { type: "array", length: data.length }
      : { type: "object", keys: Object.keys(data || {}) };

    res.json({
      ok: true,
      detected_list_len: Array.isArray(orders) ? orders.length : 0,
      top_level_shape: topShape,
      first_order_keys: first ? Object.keys(first) : [],
    });
  } catch (e) {
    res.status(500).json({ error: "shape_failed", detail: String(e) });
  }
});

// === Start ===
app.listen(SERVER_PORT, () => {
  console.log(`API ativa na porta ${SERVER_PORT}`);
});
