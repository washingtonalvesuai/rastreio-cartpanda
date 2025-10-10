import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;

app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id, email } = req.query;
    if (!order_id || !email) return res.status(400).json({ error: "Informe order_id e email." });

    const url = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}/orders/${encodeURIComponent(order_id)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${CARTPANDA_TOKEN}` } });
    if (!r.ok) return res.status(r.status).json({ error: "Erro ao consultar a Cartpanda." });

    const order = await r.json();

    const orderEmail =
      order?.customer?.email ||
      order?.shipping_address?.email ||
      order?.billing_address?.email || "";

    if (orderEmail.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).json({ error: "E-mail não confere com o pedido." });
    }

    const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
    const last = fulfillments[fulfillments.length - 1] || null;

    const tracking = last ? {
      status: last.status || order.fulfillment_status || null,
      tracking_number: last.tracking_number || last.tracking_no || null,
      tracking_company: last.tracking_company || null,
      tracking_url: last.tracking_url || null,
    } : null;

    return res.json({
      order_id: order.id,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking
    });
  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e) });
  }
});

app.listen(3000, () => console.log("API de rastreio na porta 3000"));
