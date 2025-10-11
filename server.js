import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;
const API_BASE = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;
const authHeader = { Authorization: `Bearer ${CARTPANDA_TOKEN}` };

const norm = (s) => String(s || "").trim().toLowerCase();

/** Busca 1 pedido por ID interno OU tenta fallback por número */
async function fetchOrderByAnyId(idOrNumber) {
  // 1) tenta pelo ID direto
  let r = await fetch(`${API_BASE}/orders/${encodeURIComponent(idOrNumber)}`, { headers: authHeader });
  if (r.ok) return r.json();

  // 2) tenta alguns fallbacks por número/busca (se a API aceitar)
  for (const alt of [
    `${API_BASE}/orders?number=${encodeURIComponent(idOrNumber)}`,
    `${API_BASE}/orders?search=${encodeURIComponent(idOrNumber)}`
  ]) {
    try {
      const r2 = await fetch(alt, { headers: authHeader });
      if (!r2.ok) continue;
      const data = await r2.json();
      if (data && !Array.isArray(data)) return data;
      if (Array.isArray(data) && data.length) return data[0];
    } catch (_) {}
  }

  throw new Error(`Pedido não encontrado: ${idOrNumber}`);
}

/** Lista pedidos recentes (página única) */
async function listRecentOrders() {
  // Se sua loja tiver MUITOS pedidos, depois a gente pagina (page=2,3...) e/ou usa webhooks + cache local.
  const r = await fetch(`${API_BASE}/orders`, { headers: authHeader });
  if (!r.ok) throw new Error(`Erro ao listar pedidos: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.data || []); // cobre variações do formato
}

/** Extrai e-mails de um objeto de pedido (em qualquer campo comum) */
function extractEmails(order) {
  return [
    order?.customer?.email,
    order?.email,
    order?.contact_email,
    order?.client_details?.email,
    order?.shipping_address?.email,
    order?.billing_address?.email
  ].filter(Boolean).map(norm);
}

/** Monta resposta de tracking */
function buildTracking(order) {
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
  const last = fulfillments[fulfillments.length - 1] || null;

  return last ? {
    status: last.status || order.fulfillment_status || null,
    tracking_number: last.tracking_number || last.tracking_no || null,
    tracking_company: last.tracking_company || null,
    tracking_url: last.tracking_url || null,
  } : null;
}

/** Rota já existente: confere e-mail + um pedido específico */
app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id, email, debug, bypass_email } = req.query;
    if (!order_id || !email) return res.status(400).json({ error: "Informe order_id e email." });

    const order = await fetchOrderByAnyId(order_id);
    const emails = extractEmails(order);
    const match = emails.includes(norm(email));

    if (!match && bypass_email !== "1") {
      const payload = { error: "E-mail não confere com o pedido." };
      if (debug === "1") Object.assign(payload, { debug_emails_found: emails, debug_input_email: norm(email) });
      return res.status(403).json(payload);
    }

    return res.json({
      order_id: order.id ?? order.number ?? order_id,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking: buildTracking(order),
      ...(debug === "1" ? { debug_emails_found: emails, debug_input_email: norm(email) } : {})
    });
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

/** NOVA: lista pedidos recentes e FILTRA por e-mail */
app.get("/api/orders-by-email", async (req, res) => {
  try {
    const { email, debug } = req.query;
    if (!email) return res.status(400).json({ error: "Informe email." });

    const wanted = norm(email);
    const orders = await listRecentOrders();

    const matches = orders.filter(o => extractEmails(o).includes(wanted))
      .map(o => ({
        order_id: o.id ?? o.number,
        number: o.number ?? null,
        created_at: o.created_at ?? null,
        financial_status: o.financial_status ?? null,
        fulfillment_status: o.fulfillment_status ?? null,
        tracking: buildTracking(o)
      }));

    const payload = { email: wanted, count: matches.length, orders: matches };

    if (debug === "1") {
      payload.sample_source = Array.isArray(orders) ? `orders(length=${orders.length})` : typeof orders;
    }

    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

/** NOVA: se souber o número (#558), valida e já retorna status+tracking por e-mail */
app.get("/api/find-and-status", async (req, res) => {
  try {
    const { email, number, debug } = req.query;
    if (!email || !number) return res.status(400).json({ error: "Informe email e number." });

    const wanted = norm(email);

    // 1) tente achar o pedido por número
    const order = await fetchOrderByAnyId(number);

    // 2) cheque se pertence ao e-mail
    const emails = extractEmails(order);
    const match = emails.includes(wanted);

    if (!match) {
      const payload = { error: "Nenhum pedido desse número com esse e-mail." };
      if (debug === "1") Object.assign(payload, { debug_emails_found: emails, debug_input_email: wanted });
      return res.status(404).json(payload);
    }

    return res.json({
      order_id: order.id ?? order.number ?? number,
      number: order.number ?? null,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking: buildTracking(order),
      ...(debug === "1" ? { debug_emails_found: emails, debug_input_email: wanted } : {})
    });
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

app.listen(3000, () => console.log("API de rastreio na porta 3000"));
