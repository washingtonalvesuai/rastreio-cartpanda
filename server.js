// --- DIAGNÓSTICO BRUTO: ver exatamente o que a API retorna --- //
app.get("/api/_diag/orders_raw", async (req, res) => {
  try {
    const page = req.query.page || "1";
    const r = await fetch(`${API_BASE}/orders?page=${encodeURIComponent(page)}`, { headers: AUTH });
    const text = await r.text();
    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get("content-type"),
      sample: text.slice(0, 2000), // primeiros 2000 chars
    });
  } catch (e) {
    res.status(500).json({ error: "diag_failed", detail: String(e) });
  }
});

app.get("/api/_diag/orders_shape", async (req, res) => {
  try {
    const r = await fetch(`${API_BASE}/orders?page=1`, { headers: AUTH });
    if (!r.ok) return res.status(r.status).json({ ok: false, status: r.status, hint: "Falha ao acessar /orders" });
    const data = await r.json();
    const shape = Array.isArray(data)
      ? { type: "array", length: data.length, keys: data[0] ? Object.keys(data[0]) : [] }
      : { type: "object", keys: Object.keys(data), samples: {} };
    // tenta detectar caminhos comuns
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    const first = orders[0] || null;
    res.json({
      ok: true,
      detected_list_len: Array.isArray(orders) ? orders.length : 0,
      top_level_shape: shape,
      first_order_keys: first ? Object.keys(first) : [],
    });
  } catch (e) {
    res.status(500).json({ error: "shape_failed", detail: String(e) });
  }
});
