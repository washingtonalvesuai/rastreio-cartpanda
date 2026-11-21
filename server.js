// NervLief Customer Care — Cartpanda tracking API (DRAFT, NOT DEPLOYED)
// Email-only access is not proof of identity. Return only minimum tracking data.
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({limit:"4kb"}));

const PORT = Number(process.env.PORT || 3000);
const SHOP = String(process.env.CARTPANDA_SHOP_SLUG || "").trim();
const TOKEN = String(process.env.CARTPANDA_TOKEN || "").trim();
const API_BASE = "https://accounts.cartpanda.com/api/" + encodeURIComponent(SHOP);
const ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://www.nervlief.com,https://nervlief.com")
  .split(",").map(s => s.trim()).filter(Boolean);
const MAX_SCAN_PAGES = Math.max(1,Math.min(100,
  Number(process.env.MAX_SCAN_PAGES || 20) || 20));

app.use(cors({
  origin(origin, cb) {
    if (!origin || ORIGINS.includes(origin)) return cb(null,true);
    return cb(null,false);
  },
  methods:["POST","OPTIONS"], allowedHeaders:["Content-Type"],maxAge:3600
}));
app.use((req,res,next) => {
  res.set("Cache-Control","no-store, max-age=0");
  res.set("X-Content-Type-Options","nosniff");
  res.set("Referrer-Policy","no-referrer");
  res.set("X-Robots-Tag","noindex, nofollow");
  next();
});

// In-process throttling: additional edge/WAF rate limiting is required.
const hits=new Map();
const WINDOW_MS=10*60*1000;
function rateLimit(req,res,next) {
  const key=req.ip||"unknown", now=Date.now(), record=hits.get(key);
  if (!record || now-record.start>=WINDOW_MS) {
    hits.set(key,{start:now,count:1});return next();
  }
  if (record.count>=8) {
    res.set("Retry-After",String(Math.ceil((WINDOW_MS-(now-record.start))/1000)));
    return res.status(429).json({error:"Too many attempts. Please try again later."});
  }
  record.count++;next();
}
setInterval(()=>{
  const now=Date.now();
  for(const [key,record] of hits) if(now-record.start>WINDOW_MS) hits.delete(key);
},WINDOW_MS).unref();

const norm=s=>String(s||"").trim().toLowerCase();
function emails(o) {
  return [o?.customer?.email,o?.email,o?.contact_email,
    o?.client_details?.email,o?.shipping_address?.email,
    o?.billing_address?.email].filter(Boolean).map(norm);
}
function ordersList(data) {
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.orders?.data)) return data.orders.data;
  if(Array.isArray(data?.orders)) return data.orders;
  if(Array.isArray(data?.data)) return data.data;
  return [];
}
function isPaid(o) {
  // Cartpanda returns numeric payment_status=3 for a paid order.
  // Keep explicit text statuses for API variations; do not infer payment from fulfillment.
  const s=norm(o?.financial_status??o?.payment_status);
  const test=String(o?.test??"0")==="1"||String(o?.is_cartx_test??"0")==="1";
  return (s==="3"||s==="paid"||s==="partially_refunded")&&!test;
}
function safeUrl(value) {
  try {
    const u=new URL(String(value||""));
    return u.protocol==="https:"&&!u.username&&!u.password?u.toString():null;
  } catch {return null;}
}
function trackingFrom(o) {
  const f=Array.isArray(o?.fulfillments)?o.fulfillments:[];
  const selected=[...f].reverse().find(x=>
    x?.tracking_number||x?.tracking_no||x?.tracking_url)||
    f[f.length-1]||{};
  return {
    tracking_number:String(selected.tracking_number||
      selected.tracking_no||o?.tracking_number||o?.tracking_no||"").slice(0,90)||null,
    tracking_company:String(selected.tracking_company||
      o?.tracking_company||"").slice(0,90)||null,
    tracking_url:safeUrl(selected.tracking_url||o?.tracking_url)
  };
}
function statusFor(o,t) {
  const s=norm(o?.fulfillment_status);
  if(s==="delivered") return "delivered";
  if(s==="fulfilled"||s==="fully fulfilled") return "shipped";
  if(s==="partially fulfilled") return "partially_shipped";
  return t.tracking_number||t.tracking_url?"shipped":"preparing";
}
async function cartpandaJson(url) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8500);
  try {
    const r=await fetch(url,{
      headers:{Authorization:"Bearer "+TOKEN,Accept:"application/json"},
      signal:controller.signal
    });
    if(!r.ok) throw new Error("Cartpanda response "+r.status);
    return await r.json();
  } finally {clearTimeout(timer);}
}
async function findPaidOrder(email) {
  const candidates=new Map();
  let searchWorked=false;
  for(const key of ["search","email"]) {
    try {
      const raw=await cartpandaJson(API_BASE+"/orders?"+key+"="+encodeURIComponent(email));
      searchWorked=true;
      for(const o of ordersList(raw))
        if(emails(o).includes(email)&&isPaid(o))
          candidates.set(String(o.id??o.number),o);
    } catch(e) {console.error("Search unavailable:",e.message);}
  }
  if(candidates.size===0) {
    for(let page=1;page<=MAX_SCAN_PAGES;page++) {
      let raw;
      try {raw=await cartpandaJson(API_BASE+"/orders?page="+page);}
      catch(e) {
        console.error("Pagination unavailable:",e.message);
        if(!searchWorked&&page===1) throw e;
        break;
      }
      const items=ordersList(raw);
      if(!items.length) break;
      for(const o of items)
        if(emails(o).includes(email)&&isPaid(o))
          candidates.set(String(o.id??o.number),o);
      if(candidates.size) break;
      const lastPage=raw?.orders?.last_page;
      if(typeof lastPage==="number"&&page>=lastPage) break;
    }
  }
  return [...candidates.values()].sort((a,b)=>
    (Date.parse(b.created_at||0)||0)-(Date.parse(a.created_at||0)||0))[0]||null;
}

// Internal snapshot for the private scheduled email Worker. Never expose this to browsers.
const MAIL_TOKEN=String(process.env.MNC_MAIL_INTERNAL_TOKEN||"");
console.log("[mail] Private event connection: "+(MAIL_TOKEN?"configured":"not configured"));
function authorizedMailer(req){
 const provided=String(req.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!MAIL_TOKEN||provided.length!==MAIL_TOKEN.length)return false;
 return crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(MAIL_TOKEN));
}
app.get("/api/mail-status",(_,res)=>res.json({mailer_ready:Boolean(MAIL_TOKEN),integration_version:"three-care-emails"}));
app.get("/api/internal/email-orders",async(req,res)=>{
 if(!authorizedMailer(req))return res.status(401).json({error:"Unauthorized"});
 if(!SHOP||!TOKEN)return res.status(503).json({error:"Orders API is not configured"});
 const page=Math.min(MAX_SCAN_PAGES,Math.max(1,Math.floor(Number(req.query.page)||1)));
 try{
  const raw=await cartpandaJson(API_BASE+"/orders?page="+page);
  const all=ordersList(raw);
  const orders=all.filter(isPaid).map(order=>{
   const email=emails(order).find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
   if(!email)return null;
   const id=String(order.id||order.order_id||"").slice(0,90);
   if(!id)return null;
   return {id,email,number:String(order.number||order.order_number||"").slice(0,75),status:statusFor(order,trackingFrom(order)),created_at:String(order.created_at||order.date_created||"").slice(0,50)};
  }).filter(Boolean);
  console.info("[mail] snapshot page="+page+" found="+all.length+" paid="+all.filter(isPaid).length+" usable="+orders.length);
  const lastPage=Number(raw?.orders?.last_page||raw?.last_page)||null;
  const hasMore=page<MAX_SCAN_PAGES&&all.length>0&&(lastPage===null||page<lastPage);
  return res.json({orders,hasMore});
 }catch(e){
  console.error("[mail] Cartpanda snapshot failed",e.message);
  return res.status(503).json({error:"Shipping status snapshot unavailable"});
 }
});

// Requests for recurring reminders are verified against a paid order, then
// a confirmation link must be opened by the actual email owner.
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "public"), { index: "index.html", maxAge: "1h" }));
app.get("/health",(_,res)=>res.json({
  ok:true,configured:Boolean(SHOP&&TOKEN)
}));

// ONLY public customer lookup. No raw-order exports, audit or debug endpoints.
app.post("/api/order-by-email",rateLimit,async(req,res)=>{
  const email=norm(req.body?.email);
  if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:"Please enter a valid email address."});
  if(!SHOP||!TOKEN)
    return res.status(503).json({error:"Tracking is temporarily unavailable."});
  try {
    const order=await findPaidOrder(email);
    if(!order)
      return res.status(404).json({error:"We could not find a paid order for this email."});
    const tracking=trackingFrom(order);
    return res.json({
      number:String(order.number||order.order_number||"").slice(0,70),
      status:statusFor(order,tracking),tracking
    });
  } catch(e) {
    console.error("Lookup unavailable:",e.message);
    return res.status(503).json({
      error:"Tracking is temporarily unavailable. Please try again later."
    });
  }
});
app.use((req,res)=>res.status(404).json({error:"Not found."}));
async function checkCartpandaAuthOnStart() {
  if (!SHOP || !TOKEN) {
    console.error("[startup] Cartpanda configuration missing.");
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    // Validate authorization only. Do not log order content or credentials.
    const r = await fetch(API_BASE + "/orders?page=1", {
      headers: { Authorization: "Bearer " + TOKEN, Accept: "application/json" },
      signal: controller.signal
    });
    if (r.ok) console.log("[startup] Cartpanda orders API access confirmed for " + SHOP);
    else console.error("[startup] Cartpanda orders API access rejected: HTTP " + r.status);
  } catch (e) {
    console.error("[startup] Cartpanda connectivity check failed:", e.message);
  } finally {
    clearTimeout(timer);
  }
}
app.listen(PORT, () => {
  console.log("My Natural Care API listening on port " + PORT);
  void checkCartpandaAuthOnStart();
});
