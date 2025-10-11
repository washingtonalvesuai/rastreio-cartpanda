import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN } = process.env;

// Normaliza e-mail
const normEmail = (v) => String(v || "").trim().toLowerCase();

// Tenta buscar pedido por ID (padrão) e, se falhar, tenta fallback por número
async function fetchOrderByAnyId(idOrNumber) {
  const base = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;

  // 1) Tenta por ID direto
  {
    const r = await fetch(`${base}/orders/${encodeURIComponent(idOrNumber)}`, {
      headers: { Authorization: `Bearer ${CARTPANDA_TOKEN}` },
    });
    if (r.ok) return r.json();
    // guarda texto pra diagnóstico
    const text = await r.text().catch(() => "");
    // se não for 404, já retorna erro
    if (r.status !== 404) throw new Error(`Erro Cartpanda (orders/{id}): ${r.status} ${text}`);
  }

  // 2) Fallback por número de pedido (algumas lojas usam number diferente do id interno)
  // Tentamos endpoints alternativos comuns; se não existir, ignore (não é fatal).
  for (const alt of [
    `${base}/orders/number/${encodeURIComponent(idOrNumber)}`,
    `${base}/orders?number=${encodeURIComponent(idOrNumber)}`,
    `${base}/orders?search=${encodeURIComponent(idOrNumber)}`
  ]) {
    try {
      const r2 = await fetch(alt, { headers: { Authorization: `Bearer ${CARTPANDA_TOKEN}` } });
      if (r2.ok) {
        const data = await r2.json();
        // Se a resposta já for um objeto de pedido, retorna direto.
        if (data && !Array.isArray(data)) return data;
        // Se vier lista, tenta pegar o primeiro que bate
        if (Array.isArray(data) && data.length > 0) return data[0];
      }
    } catch (_) { /* segue o baile */ }
  }

  throw new Error(`Pedido não encontrado por id/number: ${idOrNumber}`);
}

app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id, email, debug, bypass_email } = req.query;
    if (!order_id || !email) {
      return res.status(400).json({ error: "Informe order_id e email." });
    }

    // Busca pedido (por ID e com fallback por número)
    const order = await fetchOrderByAnyId(order_id);

    // Coleta TODOS os e-mails possíveis
    const emailCandidatesRaw = [
      order?.customer?.email,
      order?.email,
      order?.contact_email,
      order?.client_details?.email,
      order?.shipping_address?.email,
      order?.billing_address?.email
    ].filter(Boolean);

    const emailCandidates = emailCandidatesRaw.map(normEmail);
    const inputEmail = normEmail(email);

    // Modo debug: SEMPRE mostra os e-mails que achou
    const debugBlock = (payload = {}) => {
      if (debug === "1") {
        payload.debug_emails_found = emailCandidates;
        payload.debug_input_email = inputEmail;
        payload.debug_order_keys = Object.keys(order || {});
      }
      return payload;
    };

    // Se não quiser travar por e-mail, use bypass_email=1 (só para teste!)
    if (bypass_email === "1") {
      // segue sem checar email
    } else {
      // Garante que algum e-mail do pedido bate com o informado
      const matches = emailCandidates.includes(inputEmail);
      if (!matches) {
        return res.status(403).json(
          debugBlock({ error: "E-mail não confere com o pedido." })
        );
      }
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

    const resp = {
      order_id: order.id ?? order.number ?? order_id,
      financial_status: order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      tracking
    };

    return res.json(debugBlock(resp));

  } catch (e) {
    return res.status(500).json({ error: "Falha interna.", detail: String(e?.message || e) });
  }
});

app.listen(3000, () => console.log("API de rastreio na porta 3000"));
