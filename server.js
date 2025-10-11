import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;
const API_BASE = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;
const auth = { Authorization: `Bearer ${CARTPANDA_TOKEN}` };

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

// 🔹 Endpoint principal: buscar por e-mail
app.get("/api/order-by-email", async (req, res) => {
  try {
    const { email, debug } = req.query;
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });

    const wanted = norm(email);
    const r = await fetch(`${API_BASE}/orders`, { headers: auth });
    if (!r.ok) return res.status(r.status).json({ error: "Erro ao buscar pedidos." });

    const data = await r.json();
    const orders = Array.isArray(data) ? data : data?.data || [];

    // filtra pedidos pelo e-mail
    const matches = orders.filter((o) => extractEmails(o).includes(wanted));
    if (matches.length === 0) {
      return res.status(404).json({ error: "Nenhum pedido encontrado para este e-mail." });
    }

    // pega o pedido mais recente
    const lastOrder = matches[0];

    const response = {
      email: wanted,
      total_pedidos: matches.length,
      order_id: lastOrder.id ?? lastOrder.number,
      number: lastOrder.number ?? null,
      financial_status: lastOrder.financial_status || null,
      fulfillment_status: lastOrder.fulfillment_status || null,
      tracking: buildTracking(lastOrder),
    };

    if (debug === "1") {
      response.emails_encontrados = extractEmails(lastOrder);
    }

    return res.json(response);
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e) });
  }
});

app.listen(3000, () => console.log("API de rastreio por e-mail ativa na porta 3000"));
