import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;

// normaliza e-mail
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id, email, debug } = req.query;
    if (!order_id || !email) {
      return res.status(400).json({ error: "Informe order_id e email." });
    }

    const url = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}/orders/${encodeURIComponent(order_id)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${CARTPANDA_TOKEN}` } });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "Erro ao consultar a Cartpanda.", detail: text });
    }

    const order = await r.json();

    // coletar possíveis campos de e-mail que a API possa usar
    const candidates = [
      order?.customer?.email,
      order?.email,
      order?.contact_email,
      order?.client_details?.email,
      order?.shipping_address?.email,
      order?.billing_address?.email
    ].filter(Boolean);

    // primeiro e-mail válido encontrado
    const orderEmail = normEmail(candidates[0]);
    const inputEmail = normEmail(email);

    if (orderEmail && orderEmail !== inputEmail) {
      // modo debug: mostra todos os e-mails encontrados para conferência
      if (debug === "1") {
        return res.status(403).json({
          error: "E-mail não confere com o pedido.",
          debug_emails_found: candidates.map(normEmail),
          debug_input_email: inputEmail
        });
      }
      return res.status(403).json({ error: "E-mail não confere com o pedido." });
    }

    // Fulfillments / tracking
    const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
    const last = fulfillments[fulfillments.length - 1] || null;

    const tracking = last ? {
      status: last.status || order.fulfillment_status || null,
      tracking_number: last.tracking_number || last.tracking_no || null,
      tracking_company: last.tracking_company || null,
      tracking_url: last.tracking_url || null,
    } : null;

    const payload = {
      order_id: order.id ?? order.number ?? order_id,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking
    };

    // em modo debug, inclua o e-mail detectado
    if (debug === "1") {
      payload.debug_emails_found = candidates.map(normEmail);
      payload.debug_input_email = inputEmail;
    }

    return res.json(payload);

  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e) });
  }
});

app.listen(3000, () => console.log("API de rastreio na porta 3000"));
