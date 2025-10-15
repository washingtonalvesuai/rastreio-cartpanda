// server.js — NervLief6 / CartPanda
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { Readable } from "stream";

dotenv.config();

const app = express();
app.use(express.json());

// ====== CONFIG ======
const { CARTPANDA_SHOP_SLUG, CARTPANDA_TOKEN, PORT } = process.env;
const API_BASE = `https://accounts.cartpanda.com/api/${CARTPANDA_SHOP_SLUG}`;
const AUTH = { Authorization: `Bearer ${CARTPANDA_TOKEN}` };
const SERVER_PORT = Number(PORT || 3000);

// CORS (autorize seu domínio)
const ALLOWED_ORIGINS = [
  "https://nervlief6.com",
  "https://www.nervlief6.com",
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// JSON identado quando visto no navegador
app.set("json spaces", 2);

// ====== UTILS ======
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
  if (obj?.orders?.data && Array.isArray(obj.orders.data)) return obj.orders.data; // formato comum da CartPanda
  if (obj?.orders && Array.isArray(obj.orders)) return obj.orders;
  if (obj?.data && Array.isArray(obj.data)) return obj.data;
  return [];
}

async function httpJson(url) {
  const r = await fetch(url, { headers: AUTH });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

/** Busca por ID/number com fallbacks */
async function fetchOrderByAnyId(idOrNumber) {
  try {
    const data = await httpJson(`${API_BASE}/orders/${encodeURIComponent(idOrNumber)}`);
    return unwrapOrder(data);
  } catch (_) {}

  for (const alt of [
    `${API_BASE}/orders?number=${encodeURIComponent(idOrNumber)}`,
    `${API_BASE}/orders?search=${encodeURIComponent(idOrNumber)}`
  ]) {
    try {
      const data = await httpJson(alt);
      const arr = unwrapOrdersList(data);
      if (arr.length) return arr[0];
    } catch (_) {}
  }

  throw new Error(`Pedido não encontrado: ${idOrNumber}`);
}

/** Lista por e-mail, com filtros e paginação completa se necessário */
async function listOrdersRobust(email) {
  const results = [];

  for (const q of [
    `${API_BASE}/orders?search=${encodeURIComponent(email)}`,
    `${API_BASE}/orders?email=${encodeURIComponent(email)}`
  ]) {
    try {
      const data = await httpJson(q);
      const arr = unwrapOrdersList(data);
      if (arr.length) results.push(...arr);
    } catch (_) {}
  }

  if (results.length === 0) {
    const first = await httpJson(`${API_BASE}/orders?page=1`);
    const firstPageItems = unwrapOrdersList(first);
    results.push(...firstPageItems);

    const lastPage =
      (first?.orders && typeof first.orders.last_page === "number")
        ? first.orders.last_page
        : 1;

    for (let page = 2; page <= lastPage; page++) {
      try {
        const data = await httpJson(`${API_BASE}/orders?page=${page}`);
        const arr = unwrapOrdersList(data);
        if (!arr.length) break;
        results.push(...arr);
      } catch (_) {
        break;
      }
    }
  }

  return results;
}

// ====== Friendly status (EN) usado na página pública ======
function friendlyStatus(raw) {
  if (!raw) return "Preparing for shipment";
  const m = {
    "unfulfilled": "Preparing for shipment",
    "fulfilled": "Shipped",
    "fully fulfilled": "Delivered",
    "partially fulfilled": "Partially shipped",
    "processing": "Processing",
    "paid": "Payment confirmed",
    "pending": "Pending confirmation",
    "null": "Preparing for shipment",
  };
  const k = String(raw).toLowerCase();
  return m[k] || raw;
}

// ====== Versão PT-BR (para planilha) ======
function friendlyStatusPt(raw) {
  if (!raw) return "Preparando para envio";
  const m = {
    "unfulfilled": "Preparando para envio",
    "fulfilled": "Enviado",
    "fully fulfilled": "Entregue",
    "partially fulfilled": "Parcialmente enviado",
    "processing": "Processando",
    "paid": "Pagamento confirmado",
    "pending": "Aguardando confirmação",
    "null": "Preparando para envio",
  };
  const k = String(raw).toLowerCase();
  return m[k] || raw;
}

// ====== VALIDADORES DE RASTREIO (auditoria) ======
function detectCarrierByNumber(n) {
  const s = String(n || "").trim();
  const sUp = s.toUpperCase();

  if (/^1Z[0-9A-Z]{16}$/.test(sUp)) return "UPS";             // UPS
  if (/^[0-9]{20,22}$/.test(s)) return "USPS";                // USPS (20–22 dígitos)
  if (/^(\d{12}|\d{15}|\d{20})$/.test(s)) return "FedEx";     // FedEx (heurística)
  if (/^[A-Z]{2}\d{9}BR$/.test(sUp)) return "Correios";       // Correios (BR)

  return null;
}
function normalizeCarrier(c) {
  if (!c) return null;
  const x = String(c).trim().toLowerCase();
  if (x.includes("usps")) return "USPS";
  if (x.includes("ups")) return "UPS";
  if (x.includes("fedex")) return "FedEx";
  if (x.includes("correios") || x.includes("brazil post")) return "Correios";
  if (x.includes("dhl")) return "DHL";
  return c;
}
async function checkTrackingUrl(url) {
  if (!url) return { ok: false, status: 0, note: "missing_url" };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    let r = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!r.ok || r.status === 405 || r.status === 403) {
      r = await fetch(url, { method: "GET", signal: controller.signal });
    }
    clearTimeout(t);
    return { ok: r.ok, status: r.status || 0 };
  } catch {
    clearTimeout(t);
    return { ok: false, status: 0, note: "fetch_error" };
  }
}
function isDeliveredLike(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s.includes("delivered") || s.includes("delivered scan") || s === "fully fulfilled";
}

// ====== DEEP CHECK (baixa a página e procura mensagens/estados) ======
async function fetchTextWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await r.text();
    clearTimeout(t);
    return { ok: r.ok, status: r.status || 0, text };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, text: "" };
  }
}
const normTxt = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

function parseCarrierText(carrier, htmlText) {
  const t = normTxt(htmlText);
  const res = { pageValid: true, detectedStatus: null };

  if (!t) { res.pageValid = false; return res; }

  switch (carrier) {
    case "DHL": // DHL eCommerce / Globalmail
      if (t.includes("no results found") || t.includes("no tracking results") || t.includes("not found")) {
        res.pageValid = false; break;
      }
      if (t.includes("delivered")) res.detectedStatus = "Delivered";
      else if (t.includes("in transit")) res.detectedStatus = "In Transit";
      else if (t.includes("processed")) res.detectedStatus = "Processed";
      else if (t.includes("pre-transit")) res.detectedStatus = "Pre-Transit";
      break;

    case "USPS":
      if (t.includes("could not locate the tracking information") || t.includes("label created, not yet in system")) {
        res.pageValid = false; break;
      }
      if (t.includes("delivered")) res.detectedStatus = "Delivered";
      else if (t.includes("out for delivery")) res.detectedStatus = "Out for Delivery";
      else if (t.includes("in transit")) res.detectedStatus = "In Transit";
      else if (t.includes("pre-shipment")) res.detectedStatus = "Pre-Shipment";
      break;

    case "UPS":
      if (t.includes("we could not locate the shipment details") || t.includes("unable to track the shipment")) {
        res.pageValid = false; break;
      }
      if (t.includes("delivered")) res.detectedStatus = "Delivered";
      else if (t.includes("in transit")) res.detectedStatus = "In Transit";
      break;

    case "FedEx":
      if (t.includes("no information available") || t.includes("not found") || t.includes("unable to retrieve tracking information")) {
        res.pageValid = false; break;
      }
      if (t.includes("delivered")) res.detectedStatus = "Delivered";
      else if (t.includes("in transit")) res.detectedStatus = "In Transit";
      break;

    default:
      if (t.includes("no results") || t.includes("not found")) res.pageValid = false;
  }

  return res;
}

async function deepTrackingCheck(carrier, url) {
  const fetchRes = await fetchTextWithTimeout(url, 12000);
  if (!fetchRes.ok) return { pageValid: false, detectedStatus: null, httpStatus: fetchRes.status };
  const parsed = parseCarrierText(carrier, fetchRes.text);
  return { ...parsed, httpStatus: fetchRes.status };
}

// ====== CSV (EN/PT) ======
const ynPt = (v) => (v ? "Sim" : "Não");
function rowsToCsvLocalized(rows, lang = "en") {
  const isPt = lang === "ptbr";
  const headersEn = [
    "order_id","number","created_at","customer_email",
    "fulfillment_status_raw","fulfillment_status_friendly",
    "tracking_number","carrier_detected","carrier_claimed","carrier_mismatch",
    "tracking_url","tracking_url_ok","tracking_url_status",
    "tracking_page_valid","tracking_detected_status","status_conflict",
    "delivered_like"
  ];
  const headersPt = [
    "ID do pedido","Número","Criado em","E-mail do cliente",
    "Status (original)","Status (amigável)",
    "Código de rastreio","Transportadora detectada","Transportadora informada","Transportadora não confere",
    "URL de rastreio","URL OK","HTTP da URL",
    "Página de rastreio válida","Status detectado na página","Conflito de status",
    "Parece entregue"
  ];
  const headers = isPt ? headersPt : headersEn;
  const keyOrder = [
    "order_id","number","created_at","customer_email",
    "fulfillment_status_raw","fulfillment_status_friendly",
    "tracking_number","carrier_detected","carrier_claimed","carrier_mismatch",
    "tracking_url","tracking_url_ok","tracking_url_status",
    "tracking_page_valid","tracking_detected_status","status_conflict",
    "delivered_like"
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [headers.join(",")];
  for (const r of rows) {
    const out = keyOrder.map((k) => {
      let v = r[k];
      if (isPt && (k === "tracking_url_ok" || k === "carrier_mismatch" || k === "status_conflict" || k === "tracking_page_valid" || k === "delivered_like")) {
        v = ynPt(!!v);
      }
      return esc(v);
    });
    lines.push(out.join(","));
  }
  return lines.join("\n");
}

// ====== LISTAGEM COMPLETA (auditoria) ======
async function listAllOrdersPaged() {
  const all = [];
  const first = await httpJson(`${API_BASE}/orders?page=1`);
  const firstItems = unwrapOrdersList(first);
  all.push(...firstItems);
  const lastPage = (first?.orders && typeof first.orders.last_page === "number") ? first.orders.last_page : 1;
  for (let p = 2; p <= lastPage; p++) {
    try {
      const data = await httpJson(`${API_BASE}/orders?page=${p}`);
      const arr = unwrapOrdersList(data);
      if (!arr.length) break;
      all.push(...arr);
    } catch {
      break;
    }
  }
  return all;
}

async function auditOrder(order, lang = "en", deep = false) {
  const issues = [];
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
  if (!fulfillments.length) issues.push("missing_fulfillment");

  const rows = [];
  for (const f of fulfillments.length ? fulfillments : [null]) {
    const tracking_number = f?.tracking_number || f?.tracking_no || null;
    const tracking_company = normalizeCarrier(f?.tracking_company || order?.tracking_company || null);
    const tracking_url = f?.tracking_url || null;
    const detected = detectCarrierByNumber(tracking_number);
    const carrier_mismatch = detected && tracking_company && detected !== tracking_company;

    if (!tracking_number) issues.push("missing_tracking_number");
    if (tracking_number && !detected && !tracking_company) issues.push("unknown_carrier_pattern");

    // check URL (HEAD/GET)
    let urlCheck = { ok: false, status: 0 };
    if (tracking_url) {
      urlCheck = await checkTrackingUrl(tracking_url);
      if (!urlCheck.ok) issues.push("tracking_url_not_ok");
    } else {
      issues.push("missing_tracking_url");
    }

    // deep check
    let pageValid = null;
    let detectedStatus = null;
    if (deep && tracking_url) {
      const deepRes = await deepTrackingCheck(tracking_company || detected || "", tracking_url);
      pageValid = deepRes.pageValid;
      detectedStatus = deepRes.detectedStatus;
      if (pageValid === false) issues.push("tracking_page_invalid");
    }

    const rawStatus = order.fulfillment_status || f?.status || null;
    const friendly = (lang === "ptbr") ? friendlyStatusPt(rawStatus) : friendlyStatus(rawStatus);

    // conflito: loja diz entregue, página inválida / não entregue
    let status_conflict = false;
    const deliveredLike = isDeliveredLike(rawStatus);
    if (deep && deliveredLike && pageValid === false) status_conflict = true;
    if (deep && deliveredLike && detectedStatus && !/delivered/i.test(detectedStatus)) status_conflict = true;
    if (status_conflict) issues.push("status_conflict");

    rows.push({
      order_id: order.id ?? null,
      number: order.number ?? null,
      created_at: order.created_at ?? null,
      customer_email: (order.customer?.email || order.email || order.contact_email || "").toLowerCase(),
      fulfillment_status_raw: rawStatus,
      fulfillment_status_friendly: friendly,
      tracking_number: tracking_number || "",
      carrier_detected: detected || "",
      carrier_claimed: tracking_company || "",
      carrier_mismatch: !!carrier_mismatch,
      tracking_url: tracking_url || "",
      tracking_url_ok: urlCheck.ok,
      tracking_url_status: urlCheck.status,
      tracking_page_valid: pageValid,
      tracking_detected_status: detectedStatus,
      status_conflict,
      delivered_like: deliveredLike,
    });
  }

  return { rows, issues: [...new Set(issues)] };
}

// ====== ROTAS PÚBLICAS ======

// A) Página: buscar último pedido por e-mail
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

// B) Diagnósticos
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
app.get("/api/_diag/orders_shape", async (req, res) => {
  try {
    const r = await fetch(`${API_BASE}/orders?page=1`, { headers: AUTH });
    if (!r.ok) return res.status(r.status).json({ ok: false, status: r.status });
    const data = await r.json();
    const orders = unwrapOrdersList(data);
    const first = orders[0] || null;
    res.json({
      ok: true,
      detected_list_len: Array.isArray(orders) ? orders.length : 0,
      top_level_shape: Array.isArray(data) ? { type: "array", length: data.length } : { type: "object", keys: Object.keys(data || {}) },
      first_order_keys: first ? Object.keys(first) : [],
    });
  } catch (e) {
    res.status(500).json({ error: "shape_failed", detail: String(e) });
  }
});

// ====== ROTA DE AUDITORIA EM MASSA ======
app.get("/api/audit-shipments", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 0);                 // 0 = tudo
    const download = String(req.query.download || "").toLowerCase() === "csv";
    const lang = String(req.query.lang || "en").toLowerCase();  // en | ptbr
    const deep = String(req.query.deep || "0") === "1";         // deep check

    const orders = await listAllOrdersPaged();
    const scoped = limit > 0 ? orders.slice(0, limit) : orders;

    const rows = [];
    const summary = {
      total_orders_scanned: scoped.length,
      with_issues: 0,
      issue_counts: {}
    };

    for (const o of scoped) {
      const audit = await auditOrder(o, lang, deep);
      rows.push(...audit.rows);
      if (audit.issues.length) {
        summary.with_issues++;
        for (const k of audit.issues) {
          summary.issue_counts[k] = (summary.issue_counts[k] || 0) + 1;
        }
      }
    }

    if (download) {
      const csv = rowsToCsvLocalized(rows, lang);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      const fname = lang === "ptbr" ? "auditoria_envios.csv" : "shipment_audit.csv";
      res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
      return Readable.from([csv]).pipe(res);
    }

    return res.json({
      summary,
      sample: rows.slice(0, 20),
      note:
        lang === "ptbr"
          ? "Use ?download=csv&lang=ptbr para baixar o relatório completo. Acrescente deep=1 para verificação profunda."
          : "Use ?download=csv to download the full report. Add deep=1 for deep verification."
    });
  } catch (e) {
    return res.status(500).json({ error: "audit_failed", detail: String(e?.message || e) });
  }
});

// ==== ROTA STREAMING: CSV linha a linha (evita timeout 502) ====
app.get("/api/audit-shipments-stream", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 0);                 // 0 = tudo
    const lang = String(req.query.lang || "en").toLowerCase();  // en | ptbr
    const deep = String(req.query.deep || "0") === "1";         // deep check
    const isPt = lang === "ptbr";

    const headersEn = [
      "order_id","number","created_at","customer_email",
      "fulfillment_status_raw","fulfillment_status_friendly",
      "tracking_number","carrier_detected","carrier_claimed","carrier_mismatch",
      "tracking_url","tracking_url_ok","tracking_url_status",
      "tracking_page_valid","tracking_detected_status","status_conflict",
      "delivered_like"
    ];
    const headersPt = [
      "ID do pedido","Número","Criado em","E-mail do cliente",
      "Status (original)","Status (amigável)",
      "Código de rastreio","Transportadora detectada","Transportadora informada","Transportadora não confere",
      "URL de rastreio","URL OK","HTTP da URL",
      "Página de rastreio válida","Status detectado na página","Conflito de status",
      "Parece entregue"
    ];
    const keyOrder = [
      "order_id","number","created_at","customer_email",
      "fulfillment_status_raw","fulfillment_status_friendly",
      "tracking_number","carrier_detected","carrier_claimed","carrier_mismatch",
      "tracking_url","tracking_url_ok","tracking_url_status",
      "tracking_page_valid","tracking_detected_status","status_conflict",
      "delivered_like"
    ];
    const ynPtLoc = (v) => (v ? "Sim" : "Não");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    const fname = isPt ? "auditoria_envios_stream.csv" : "shipment_audit_stream.csv";
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.setHeader("Transfer-Encoding", "chunked");

    res.write((isPt ? headersPt : headersEn).join(",") + "\n");

    const ordersAll = await listAllOrdersPaged();
    const scoped = limit > 0 ? ordersAll.slice(0, limit) : ordersAll;

    for (const o of scoped) {
      const audit = await auditOrder(o, lang, deep);
      for (const r of audit.rows) {
        const out = keyOrder.map((k) => {
          let v = r[k];
          if (isPt && (k === "tracking_url_ok" || k === "carrier_mismatch" || k === "status_conflict" || k === "tracking_page_valid" || k === "delivered_like")) {
            v = ynPtLoc(!!v);
          }
          return esc(v);
        }).join(",");
        res.write(out + "\n");
      }
      if (typeof res.flush === "function") { try { res.flush(); } catch(_){} }
    }

    res.end();
  } catch (e) {
    try {
      res.write(`\n"ERRO","${String(e?.message || e).replace(/"/g,'""')}"\n`);
    } catch(_) {}
    res.end();
  }
});

// ====== START ======
app.listen(SERVER_PORT, () => {
  console.log(`✅ API ativa na porta ${SERVER_PORT}`);
});
