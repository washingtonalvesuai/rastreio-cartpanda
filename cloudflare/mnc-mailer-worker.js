
/* My Natural Care: D1-based order notification and opt-in care email scheduler. */
const BASE="https://mynaturalcare.app",FROM="My Natural Care <support@mynaturalcare.app>";
const DAY=86400000,INTERVAL=3*DAY;
const clean=v=>String(v||"").trim().toLowerCase();
const valid=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const j=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const random=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return [...b].map(n=>n.toString(16).padStart(2,"0")).join("")};
async function hash(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,"0")).join("")}
function page(title,description){
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+esc(title)+'</title></head><body style="background:#0c1521;color:#e5fff1;font:18px/1.7 Arial,sans-serif;padding:25px"><main style="max-width:540px;margin:55px auto;padding:30px;border:1px solid #285844;border-radius:20px;background:#172838"><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p><a style="display:inline-block;background:#8beac1;color:#133c2d;border-radius:10px;padding:12px 19px;text-decoration:none;font-weight:bold" href="'+BASE+'">Abrir aplicativo</a></main></body></html>';
 return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}
function layout(title,body,buttonText,buttonUrl,footer){
 return '<!doctype html><html lang="pt-BR"><body style="background:#f2f7f3;padding:22px;font-family:Arial,sans-serif;color:#244135"><main style="max-width:570px;margin:auto;background:white;border-radius:20px;padding:30px"><div style="font-weight:bold;letter-spacing:2px;color:#168157">MY NATURAL CARE</div><h1 style="font-size:26px">'+esc(title)+'</h1><div style="font-size:18px;line-height:1.7">'+body+'</div><p><a href="'+esc(buttonUrl)+'" style="display:inline-block;background:#167b58;color:white;padding:16px 24px;font-weight:bold;border-radius:12px;text-decoration:none">'+esc(buttonText)+'</a></p><div style="margin-top:26px;border-top:1px solid #dde9dd;padding-top:17px;font-size:13px;color:#597064">'+(footer||'Mensagem do My Natural Care.')+'</div></main></body></html>';
}
async function send(env,email,subject,body,text,kind,key,button,url,footer,headers){
 if(!env.RESEND_API_KEY)throw Error("Sender not configured");
 const r=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":key},
  body:JSON.stringify({from:FROM,to:[email],subject,text,html:layout(subject,body,button,url,footer),headers:headers||{}})
 });
 if(!r.ok)throw Error("Resend "+r.status+" "+(await r.text()).slice(0,100));
}
async function subscribe(req,env){
 if(!env.INTERNAL_TOKEN||req.headers.get("Authorization")!=="Bearer "+env.INTERNAL_TOKEN)return j({error:"Unauthorized"},401);
 let body;try{body=await req.json()}catch{return j({error:"Invalid JSON"},400)}
 const email=clean(body.email);
 if(!valid(email))return j({error:"Invalid email"},400);
 const now=Date.now();
 const current=await env.DB.prepare("SELECT active,last_request_at FROM subscriptions WHERE email=?").bind(email).first();
 if(current?.active===1||current?.last_request_at&&now-current.last_request_at<12*3600000)return j({ok:true});
 const token=random(),digest=await hash(token),link=BASE+"/_mail/confirm?token="+token;
 await env.DB.prepare("INSERT INTO subscriptions(email,active,last_request_at,created_at) VALUES (?,0,?,?) ON CONFLICT(email) DO UPDATE SET last_request_at=excluded.last_request_at").bind(email,now,now).run();
 await env.DB.prepare("DELETE FROM confirmations WHERE email=?").bind(email).run();
 await env.DB.prepare("INSERT INTO confirmations(token_hash,email,expires_at,created_at) VALUES (?,?,?,?)").bind(digest,email,now+2*DAY,now).run();
 try{
  const subject="Confirme seus lembretes de cuidados 💚",message="Você solicitou lembretes de autocuidado a cada 3 dias. Confirme seu e-mail para ativar. Se não solicitou, ignore esta mensagem.";
  await send(env,email,subject,"<p>"+message+"</p><p>O link expira em 48 horas.</p>",message+"\n"+link,"optin","optin-"+digest.slice(0,50),"Confirmar lembretes",link);
  return j({ok:true});
 }catch(e){console.error("Confirmation send failed",String(e).slice(0,120));return j({error:"Temporary delivery issue"},503)}
}
async function confirm(req,env){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return page("Link inválido","Solicite uma nova confirmação pelo aplicativo.");
 const row=await env.DB.prepare("SELECT email,expires_at FROM confirmations WHERE token_hash=?").bind(await hash(token)).first();
 if(!row||row.expires_at<Date.now())return page("Link expirado","Solicite um novo e-mail de confirmação pelo aplicativo.");
 const now=Date.now();
 await env.DB.prepare("UPDATE subscriptions SET active=1,confirmed_at=?,last_reminder_at=NULL,unsubscribe_hash=NULL WHERE email=?").bind(now,row.email).run();
 await env.DB.prepare("DELETE FROM confirmations WHERE email=?").bind(row.email).run();
 return page("Lembretes ativados!","Você receberá um lembrete a cada 3 dias e poderá cancelar pelos links dos e-mails.");
}
async function unsubscribe(req,env){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return page("Link inválido","Confira o link de cancelamento do e-mail.");
 await env.DB.prepare("UPDATE subscriptions SET active=0,unsubscribe_hash=NULL WHERE unsubscribe_hash=?").bind(await hash(token)).run();
 return page("Lembretes cancelados","Você não receberá novos lembretes. Avisos transacionais sobre seus pedidos continuam disponíveis.");
}
async function order(env,item,now){
 const id=String(item.id||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100),email=clean(item.email),status=clean(item.status);
 if(!id||!valid(email)||!["preparing","shipped","partially_shipped","delivered"].includes(status))return 0;
 const number=String(item.number||"").slice(0,80);
 const prev=await env.DB.prepare("SELECT status,eligible_for_shipping,shipping_sent_at FROM orders WHERE order_id=?").bind(id).first();
 if(!prev){await env.DB.prepare("INSERT OR IGNORE INTO orders(order_id,email,order_number,status,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?)").bind(id,email,number,status,now,now).run();return 0}
 const eligible=prev.eligible_for_shipping||prev.status==="preparing"&&["shipped","partially_shipped"].includes(status);
 await env.DB.prepare("UPDATE orders SET email=?,order_number=?,status=?,last_seen_at=?,eligible_for_shipping=? WHERE order_id=?").bind(email,number,status,now,eligible?1:0,id).run();
 if(!eligible||prev.shipping_sent_at)return 0;
 const key="ship-"+id,dispatch=await env.DB.prepare("SELECT state FROM dispatches WHERE delivery_key=?").bind(key).first();
 if(dispatch?.state==="sent"){await env.DB.prepare("UPDATE orders SET shipping_sent_at=? WHERE order_id=?").bind(now,id).run();return 0}
 await env.DB.prepare("INSERT OR IGNORE INTO dispatches(delivery_key,email,kind,state,created_at) VALUES(?,?,'shipping','pending',?)").bind(key,email,now).run();
 const subject="Seu pedido foi enviado! 📦",text="Seu pedido"+(number?" #"+number:"")+" foi enviado. Acompanhe o rastreamento em "+BASE;
 try{
  await send(env,email,subject,"<p>Ótima notícia! Seu pedido"+(number?" <b>#"+esc(number)+"</b>":"")+" foi enviado.</p><p>Consulte o rastreamento diretamente no aplicativo.</p>",text,"shipping",key,"Acompanhar meu pedido",BASE);
  await env.DB.prepare("UPDATE dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
  await env.DB.prepare("UPDATE orders SET shipping_sent_at=? WHERE order_id=?").bind(now,id).run();
  return 1;
 }catch(e){await env.DB.prepare("UPDATE dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,160),key).run();console.error("Shipping dispatch failed",String(e).slice(0,110));return 0}
}
async function scanShipping(env,now){
 const origin=String(env.RENDER_ORIGIN||"https://rastreio-cartpanda.onrender.com").replace(/\/$/,"");
 let count=0,sent=0;
 for(let pageNum=1;pageNum<=20;pageNum++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try{
   const r=await fetch(origin+"/api/internal/email-orders?page="+pageNum,{headers:{Authorization:"Bearer "+env.INTERNAL_TOKEN},signal:controller.signal});
   if(!r.ok)throw Error("Snapshot HTTP "+r.status);
   response=await r.json();
  }finally{clearTimeout(timer)}
  if(!Array.isArray(response.orders))throw Error("Snapshot format");
  for(const item of response.orders){count++;sent+=await order(env,item,now)}
  if(!response.hasMore)break;
 }
 return {count,sent};
}
async function scanReminders(env,now){
 const r=await env.DB.prepare("SELECT email,confirmed_at,last_reminder_at FROM subscriptions WHERE active=1 AND confirmed_at IS NOT NULL AND COALESCE(last_reminder_at,confirmed_at)<=? LIMIT 75").bind(now-INTERVAL).all();
 let sent=0;
 for(const row of r.results||[]){
  const start=Number(row.last_reminder_at||row.confirmed_at),key="care-"+(await hash(row.email)).slice(0,30)+"-"+start;
  const prev=await env.DB.prepare("SELECT state FROM dispatches WHERE delivery_key=?").bind(key).first();
  if(prev?.state==="sent"){await env.DB.prepare("UPDATE subscriptions SET last_reminder_at=? WHERE email=?").bind(now,row.email).run();continue}
  const token=await hash("unsub:"+row.email+":"+row.confirmed_at+":"+env.INTERNAL_TOKEN),optout=BASE+"/_mail/unsubscribe?token="+token;
  await env.DB.prepare("INSERT OR IGNORE INTO dispatches(delivery_key,email,kind,state,created_at) VALUES(?,?,'care','pending',?)").bind(key,row.email,now).run();
  const subject="Seu momento de cuidar de você chegou 💚",message="Acesse o My Natural Care para acompanhar seus cuidados de hoje e, quando estiver disponível, atualizar sua avaliação.";
  try{
   await send(env,row.email,subject,"<p>"+message+"</p><p>Cuide de você no seu próprio ritmo.</p>",message+"\nAcesse: "+BASE+"\nCancelar: "+optout,"care",key,"Acessar meus cuidados",BASE,'Lembrete solicitado por você. <a href="'+esc(optout)+'" style="color:#167b58">Cancelar lembretes</a>.',{"List-Unsubscribe":"<"+optout+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"});
   await env.DB.prepare("UPDATE subscriptions SET last_reminder_at=?,unsubscribe_hash=? WHERE email=? AND active=1").bind(now,await hash(token),row.email).run();
   await env.DB.prepare("UPDATE dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
   sent++;
  }catch(e){await env.DB.prepare("UPDATE dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,150),key).run();console.error("Care dispatch failed",String(e).slice(0,110))}
 }
 return sent;
}
async function cron(env){
 const now=Date.now(),started=await env.DB.prepare("INSERT INTO job_runs(started_at) VALUES (?)").bind(now).run(),id=started.meta.last_row_id;
 try{
  const ship=await scanShipping(env,now),care=await scanReminders(env,Date.now());
  await env.DB.prepare("UPDATE job_runs SET finished_at=?,processed=?,sent=?,result='ok' WHERE id=?").bind(Date.now(),ship.count,ship.sent+care,id).run();
  console.log("Scan completed: "+ship.count+" orders, "+ship.sent+" shipments, "+care+" reminders");
 }catch(e){
  await env.DB.prepare("UPDATE job_runs SET finished_at=?,result=? WHERE id=?").bind(Date.now(),String(e).slice(0,140),id).run();
  console.error("Scan failed",String(e).slice(0,150));
 }
 await env.DB.prepare("DELETE FROM confirmations WHERE expires_at<?").bind(Date.now()).run();
 await env.DB.prepare("DELETE FROM job_runs WHERE started_at<?").bind(Date.now()-90*DAY).run();
}
export default {
 async fetch(req,env){
  const p=new URL(req.url).pathname;
  if(p==="/_mail/health"&&req.method==="GET")return j({ok:true});
  if(p==="/_mail/subscribe"&&req.method==="POST")return subscribe(req,env);
  if(p==="/_mail/confirm"&&req.method==="GET")return confirm(req,env);
  if(p==="/_mail/unsubscribe"&&["GET","POST"].includes(req.method))return unsubscribe(req,env);
  return j({error:"Not found"},404);
 },
 scheduled(event,env,ctx){ctx.waitUntil(cron(env))}
};
