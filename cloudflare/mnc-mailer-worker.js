
/* My Natural Care: Three 72-hour post-purchase care emails and transactional shipment notices. */
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

/* Care emails are automatically attached to paid orders placed after CAMPAIGN_START.
 * Customers can unsubscribe from the three-message onboarding sequence.
 * A prior opt-out stays respected on future purchases.
 */
async function autoEnroll(env,email,purchasedAt){
 const token=await hash("optout:v2:"+email+":"+env.INTERNAL_TOKEN);
 const tokenHash=await hash(token);
 await env.DB.prepare("INSERT OR IGNORE INTO subscriptions(email,active,confirmed_at,last_reminder_at,unsubscribe_hash,created_at,care_sent_count) VALUES (?,1,NULL,NULL,?,?,0)")
  .bind(email,tokenHash,purchasedAt).run();
}
function unsubscribeConfirmation(token){
 const url=BASE+"/_mail/unsubscribe?token="+token;
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Cancelar lembretes</title></head>'+
 '<body style="background:#0c1521;color:#e6fff3;font:18px/1.65 Arial,sans-serif;padding:22px"><main style="max-width:510px;margin:50px auto;padding:27px;background:#172838;border:1px solid #285844;border-radius:18px">'+
 '<h1>Cancelar lembretes de cuidados?</h1><p>Você deixará de receber os e-mails periódicos. Os avisos do seu pedido continuarão disponíveis.</p>'+
 '<form method="POST" action="'+esc(url)+'"><button type="submit" style="padding:16px 23px;background:#9ef1c9;color:#153c2e;border:0;border-radius:12px;font-size:18px;font-weight:bold">Confirmar cancelamento</button></form></main></body></html>';
}
async function unsubscribe(req,env){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return page("Link inválido","Confira o link do e-mail que você recebeu.");
 const row=await env.DB.prepare("SELECT email FROM subscriptions WHERE unsubscribe_hash=?").bind(await hash(token)).first();
 if(!row)return page("Link inválido ou já utilizado","Se você já cancelou, não precisa fazer mais nada.");
 if(req.method==="GET")return new Response(unsubscribeConfirmation(token),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 await env.DB.prepare("UPDATE subscriptions SET active=0,unsubscribe_hash=NULL WHERE email=? AND unsubscribe_hash=?").bind(row.email,await hash(token)).run();
 return page("Lembretes cancelados","Os e-mails periódicos foram desativados. Você continuará podendo acompanhar o pedido pelo aplicativo.");
}
async function order(env,item,now){
 const id=String(item.id||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100),email=clean(item.email),status=clean(item.status);
 if(!id||!valid(email)||!["preparing","shipped","partially_shipped","delivered"].includes(status))return 0;
 const number=String(item.number||"").slice(0,80);
 const purchasedAt=Date.parse(String(item.created_at||""));
 const campaignStart=Date.parse(String(env.CAMPAIGN_START||""));
 const eligibleForCare=Number.isFinite(purchasedAt)&&Number.isFinite(campaignStart)&&purchasedAt>=campaignStart&&purchasedAt<=now;
 if(eligibleForCare)await autoEnroll(env,email,purchasedAt);
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

const CARE_SEQUENCE=[
 {subject:"Seu primeiro passo: cuide de você hoje 💚",action:"Comece com três hábitos simples",body:"<p>Hoje é um bom dia para separar alguns minutos para você.</p><p>Confira seus cuidados no My Natural Care: escolha uma refeição equilibrada, observe seus pés e organize um horário para descansar.</p><p>Você encontra as orientações completas no livro de Bem-estar.</p>",text:"Dê seu primeiro passo: acompanhe seus cuidados e encontre o livro de Bem-estar em "+BASE},
 {subject:"Academia em casa: movimentos leves para o dia 🪑",action:"Conhecer a Academia em Casa",body:"<p>Que tal conhecer as atividades da Academia em Casa?</p><p>O manual ensina movimentos simples sentados, cuidados com o ambiente e maneiras de criar uma rotina segura.</p><p>Pratique somente movimentos adequados para sua condição. Quem tem feridas, instabilidade ou fraqueza deve pedir orientação profissional antes.</p>",text:"Conheça os movimentos leves e seguros no manual de Bem-estar: "+BASE},
 {subject:"Como estão seus cuidados? Confira sua evolução 🌿",action:"Ver meus cuidados e progresso",body:"<p>Pequenas atitudes podem se tornar bons hábitos.</p><p>Abra a aba Cuidados para conferir suas marcações, registrar as cápsulas conforme o rótulo e preencher a avaliação quando estiver disponível.</p><p>O livro de Bem-estar continua lá para ajudar sempre que você precisar.</p>",text:"Confira suas marcações, o score e o livro de Bem-estar em "+BASE}
];
async function scanReminders(env,now){
 const due=now-INTERVAL;
 const r=await env.DB.prepare("SELECT email,created_at,last_reminder_at,care_sent_count FROM subscriptions WHERE active=1 AND care_sent_count<3 AND COALESCE(last_reminder_at,created_at)<=? ORDER BY COALESCE(last_reminder_at,created_at) ASC LIMIT 60").bind(due).all();
 let sent=0;
 for(const row of r.results||[]){
  const step=Number(row.care_sent_count||0)+1;
  if(step<1||step>3)continue;
  const email=row.email,details=CARE_SEQUENCE[step-1];
  const key="care-v2-"+(await hash(email)).slice(0,30)+"-"+step;
  const existing=await env.DB.prepare("SELECT state FROM dispatches WHERE delivery_key=?").bind(key).first();
  if(existing?.state==="sent"){
   await env.DB.prepare("UPDATE subscriptions SET care_sent_count=?,last_reminder_at=COALESCE(last_reminder_at,?) WHERE email=? AND active=1 AND care_sent_count<?").bind(step,now,email,step).run();
   continue;
  }
  const token=await hash("optout:v2:"+email+":"+env.INTERNAL_TOKEN);
  const url=BASE+"/_mail/unsubscribe?token="+token;
  await env.DB.prepare("INSERT OR IGNORE INTO dispatches(delivery_key,email,kind,state,created_at) VALUES(?,?,'care','pending',?)").bind(key,email,now).run();
  try{
   await send(env,email,details.subject,details.body,details.text+"\n\nCancelar estes lembretes: "+url,"care",key,details.action,BASE,
    'Você recebe esta sequência de 3 e-mails de orientação após sua compra. <a href="'+esc(url)+'" style="color:#167b58">Não quero mais receber lembretes</a>.',
    {"List-Unsubscribe":"<"+url+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"});
   await env.DB.prepare("UPDATE dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
   await env.DB.prepare("UPDATE subscriptions SET care_sent_count=?,last_reminder_at=? WHERE email=? AND active=1 AND care_sent_count<?").bind(step,now,email,step).run();
   sent++;
  }catch(e){
   await env.DB.prepare("UPDATE dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,150),key).run();
   console.error("Care sequence email failed",step,String(e).slice(0,110));
  }
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
  if(p==="/_mail/health"&&req.method==="GET")return j({ok:true,ready:Boolean(env.DB&&env.INTERNAL_TOKEN&&env.RESEND_API_KEY&&env.CAMPAIGN_START)});
  if(p==="/_mail/unsubscribe"&&["GET","POST"].includes(req.method))return unsubscribe(req,env);
  return j({error:"Not found"},404);
 },
 scheduled(event,env,ctx){ctx.waitUntil(cron(env))}
};
