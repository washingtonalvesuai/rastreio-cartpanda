import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;
const API_BASE = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;
const AUTH = { Authorization: `Bearer ${CARTPANDA_TOKEN}` };

const norm = (s) => String(s || "").trim().toLowerCase();

function extractEmails(order) {
  return [
    order?.customer?.email,
    order?.email,
    order?.contact_email,
    order?.client_details?.email,
    order?.shipping_address?.email,
    order?.billing_address?.email,
  ].filter(Boolean).map(norm);
}

function unwrapOrder(obj) {
  // Alguns endpoints retornam { order: {...} }
  if (obj && obj.order && typeof obj.order === "object") return obj.order;
  return obj;
}

function unwrapOrdersList(obj) {
  // Tenta diferentes formatos: {orders: []}, {data: []}, [] direto
  if (Array.isArray(obj)) return obj;
  if (obj?.orders && Array.isArray(obj.orders)) return obj.orders;
  if (obj?.data && Array.isArray(obj.data)) return obj.data;
  return [];
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

async function httpJson(url) {
  const r = await fetch(url, { headers: AUTH });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(()=>'')}`);
  return r.json();
}

// Lista pedidos tentando: filtro por search/email e depois paginação
async function listOrdersRobust(email) {
  const results = [];

  // 1) Tenta server-side filtering (se a API suportar)
  for (const q of [
    `${API_BASE}/orders?search=${encodeURIComponent(email)}`,
    `${API_BASE}/orders?email=${encodeURIComponent(email)}`,
  ]) {
    try {
      const data = await httpJson(q);
      const arr = unwrapOrdersList(data);
      if (arr.length) results.push(...arr);
    } catch {}
  }

  // 2) Se ainda vazio, paginação básica (varre 1..5)
  if (results.length === 0) {
    for (let page = 1; page <= 5; page++) {
      try {
        const data = await httpJson(`${API_BASE}/orders?page=${page}`);
        const arr = unwrapOrdersList(data);
        if (!arr.length) break; // sem mais páginas úteis
        results.push(...arr);
      } catch {
        break;
      }
    }
  }

  return results;
}

// 🔹 Endpoint principal: buscar por e-mail (último pedido + tracking)
app.get("/api/order-by-email", async (req, res) => {
  try {
    const { email, debug } = req.query;
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });
    const wanted = norm(email);

    const orders = await listOrdersRobust(email);
    // filtra no backend garantindo normalização
    const matches = orders.filter((o) => extractEmails(o).includes(wanted));

    if (!matches.length) {
      const payload = { error: "Nenhum pedido encontrado para este e-mail." };
      if (debug === "1") Object.assign(payload, { debug_scanned: orders.length });
      return res.status(404).json(payload);
    }

    // Considera o mais recente (assumindo que a API já devolve ordenado desc)
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

// (mantém a app viva)
app.listen(3000, () => console.log("API de rastreio por e-mail ativa na porta 3000"));
