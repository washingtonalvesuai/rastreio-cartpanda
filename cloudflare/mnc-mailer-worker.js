
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
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+esc(title)+'</title></head><body style="background:#0c1521;color:#e5fff1;font:18px/1.7 Arial,sans-serif;padding:25px"><main style="max-width:540px;margin:55px auto;padding:30px;border:1px solid #285844;border-radius:20px;background:#172838"><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p><a style="display:inline-block;background:#8beac1;color:#133c2d;border-radius:10px;padding:12px 19px;text-decoration:none;font-weight:bold" href="'+BASE+'">Open My App</a></main></body></html>';
 return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}
function layout(title,body,buttonText,buttonUrl,footer){
 const template="<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\">\n<style>@media(max-width:620px){.inner{padding:27px 22px!important}.brand{padding:24px 22px!important}.hero-title{font-size:29px!important;line-height:1.2!important}.hero-text{font-size:16px!important}.btn{display:block!important;text-align:center!important}.shell{width:100%!important}}</style></head>\n<body style=\"margin:0;padding:0;background:#f0f3f0;font-family:Arial,Helvetica,sans-serif;color:#263a34;\">\n<div style=\"display:none;max-height:0;overflow:hidden;opacity:0\">{{PREHEADER}}</div>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"border-collapse:collapse;background:#f0f3f0\"><tr><td align=\"center\" style=\"padding:40px 14px 44px\">\n<table role=\"presentation\" class=\"shell\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:100%;border-collapse:separate;overflow:hidden;border-radius:23px;border:1px solid #dce5df;box-shadow:0 12px 46px rgba(14,32,26,.09);background:#ffffff\">\n<tr><td style=\"height:7px;background:#45c294;font-size:1px;line-height:1px\">&nbsp;</td></tr>\n<tr><td class=\"brand\" style=\"background:#0d1922;padding:32px 40px\">\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td valign=\"middle\" style=\"padding-right:13px\"><span style=\"display:inline-block;width:43px;height:43px;line-height:43px;text-align:center;background:#94e9c4;color:#123628;border-radius:12px;font-size:23px;font-weight:800\">M</span></td><td valign=\"middle\"><div style=\"font-size:19px;font-weight:800;letter-spacing:.2px;color:#ffffff\">My Natural Care</div><div style=\"margin-top:3px;color:#b4d7c9;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase\">Wellness, made personal</div></td></tr></table>\n</td></tr>\n<tr><td class=\"inner\" style=\"padding:43px 42px 35px\">\n<div style=\"display:inline-block;border-radius:99px;padding:8px 13px;background:#e5f6ed;color:#176f52;font-size:11px;font-weight:800;letter-spacing:1.9px;text-transform:uppercase\">{{EYEBROW}}</div>\n<h1 class=\"hero-title\" style=\"margin:22px 0 16px;font-size:35px;line-height:1.18;letter-spacing:-1px;font-weight:800;color:#112a24\">{{TITLE}}</h1>\n<div style=\"width:45px;height:3px;background:#43be8e;border-radius:20px;margin-bottom:26px\"></div>\n<div class=\"hero-text\" style=\"font-size:17px;line-height:1.75;color:#41574f\">{{BODY}}</div>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:30px 0 30px\"><tr><td bgcolor=\"#176b50\" style=\"background:#176b50;border-radius:11px\"><a class=\"btn\" href=\"{{URL}}\" style=\"display:inline-block;padding:17px 26px;font-size:16px;font-weight:800;text-decoration:none;color:#ffffff;border-radius:11px;letter-spacing:.1px\">{{BUTTON}} &nbsp;→</a></td></tr></table>\n<div style=\"border-top:1px solid #e5ebe6;padding-top:20px;font-size:13px;line-height:1.7;color:#708077\">Need a hand? Our team is here to help.<br><a style=\"color:#166f52;font-weight:700;text-decoration:none\" href=\"mailto:support@mynaturalcare.app\">support@mynaturalcare.app</a></div>\n</td></tr>\n<tr><td class=\"inner\" style=\"padding:22px 42px 27px;background:#f7faf7;border-top:1px solid #e8eee9\"><p style=\"margin:0 0 7px;font-size:12px;color:#52665c;font-weight:800;letter-spacing:1.2px\">MY NATURAL CARE</p><div style=\"font-size:12px;line-height:1.75;color:#708077\">{{FOOTER}}</div><div style=\"font-size:11px;line-height:1.6;color:#87958b;margin-top:13px\">Practical guidance, not medical advice. Follow the directions on your product label and consult a healthcare professional for personal health concerns.</div></td></tr>\n</table><div style=\"padding-top:22px;color:#95a39a;font-size:12px;text-align:center\">© 2026 My Natural Care · All rights reserved.</div>\n</td></tr></table></body></html>";
 const isShipping=/shipped|order is on its way|shipment/i.test(title);
 const preheader=isShipping?"Your order has an update. Track its journey in the app.":"A little guidance for your daily care routine.";
 return template.replaceAll("{{TITLE}}",esc(title)).replaceAll("{{BODY}}",body)
  .replaceAll("{{BUTTON}}",esc(buttonText)).replaceAll("{{URL}}",esc(buttonUrl))
  .replaceAll("{{FOOTER}}",footer||"You are receiving this email as part of your My Natural Care order experience.")
  .replaceAll("{{EYEBROW}}",isShipping?"ORDER & DELIVERY":"YOUR WELLNESS JOURNEY")
  .replaceAll("{{PREHEADER}}",preheader);
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
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe from care emails</title></head>'+
 '<body style="background:#0d1922;color:#e7fff5;font:18px/1.65 Arial,sans-serif;padding:22px"><main style="max-width:520px;margin:50px auto;padding:30px;background:#172a32;border:1px solid #2e5b4c;border-radius:18px">'+
 '<div style="color:#8ee4bb;font-size:13px;letter-spacing:2px;font-weight:700">MY NATURAL CARE</div><h1>Stop receiving care emails?</h1><p>You will no longer receive the three-part wellness email series. Order and shipping notifications are not affected.</p>'+
 '<form method="POST" action="'+esc(url)+'"><button type="submit" style="padding:17px 24px;background:#8fe8c0;color:#123a2e;border:0;border-radius:12px;font-size:17px;font-weight:bold">Confirm Unsubscribe</button></form></main></body></html>';
}
async function unsubscribe(req,env){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return page("Invalid link","Check the link in the email you received.");
 const row=await env.DB.prepare("SELECT email FROM subscriptions WHERE unsubscribe_hash=?").bind(await hash(token)).first();
 if(!row)return page("Invalid or already used link","If you already unsubscribed, no further action is needed.");
 if(req.method==="GET")return new Response(unsubscribeConfirmation(token),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 await env.DB.prepare("UPDATE subscriptions SET active=0,unsubscribe_hash=NULL WHERE email=? AND unsubscribe_hash=?").bind(row.email,await hash(token)).run();
 return page("Care Emails Unsubscribed","Your care email series has been turned off. You can still track your order in the app.");
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
 const subject="Your order is on its way 📦",text="Your order"+(number?" #"+number:"")+" has shipped. Track its progress in the My Natural Care app: "+BASE;
 try{
  await send(env,email,subject,"<p>Good news! Your order"+(number?" <b>#"+esc(number)+"</b>":"")+" has shipped.</p><p>View your latest tracking information directly in the app.</p>",text,"shipping",key,"Track My Order",BASE);
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
  {
    "subject": "Your wellness journey starts with one small step",
    "action": "Explore My Wellness Guide",
    "body": "<p style=\"margin:0 0 19px\">A thoughtful routine begins with the little things. There is no need to change everything overnight.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:14px\">THREE SIMPLE WAYS TO START</div><p style=\"margin:0 0 12px\"><b style=\"color:#183b2c\">01 &nbsp; Nourish yourself.</b><br>Choose a balanced meal that works for you.</p><p style=\"margin:0 0 12px\"><b style=\"color:#183b2c\">02 &nbsp; Check your feet.</b><br>Look for any changes in your skin, particularly if sensation is reduced.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">03 &nbsp; Make room for rest.</b><br>Create a calming moment before bedtime.</p></div><p style=\"margin:0\">In your My Natural Care app, the <b>Wellness</b> guide shows you how, while the <b>Care</b> tab helps you track your daily habits.</p>",
    "text": "Your wellness journey starts with small steps. Explore the Wellness guide, choose a balanced meal, check your feet and build a calming bedtime routine. Open: https://mynaturalcare.app"
  },
  {
    "subject": "A little movement can fit into your day",
    "action": "Discover At-Home Movement",
    "body": "<p style=\"margin:0 0 19px\">Taking care of yourself can be simple and comfortable. Your Wellness guide includes gentle, chair-based movement ideas for home.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:13px\">A GENTLE MOMENT OF MOVEMENT</div><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">01 &nbsp; Sit comfortably.</b><br>Choose a stable chair with back support.</p><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">02 &nbsp; Start slowly.</b><br>Try easy arm and shoulder movements if appropriate for you.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">03 &nbsp; Rest when needed.</b><br>Keep movements gentle and within your limits.</p></div><p style=\"margin:0;font-size:14px;color:#61756a\"><b>Safety first:</b> Skip activities that cause pain or are not recommended for you. If you have wounds, severe numbness, instability, or new weakness, ask a healthcare professional before exercising.</p>",
    "text": "Your Wellness guide includes easy, chair-based movement ideas. Only perform exercises appropriate for your health and stop if symptoms develop. Visit: https://mynaturalcare.app"
  },
  {
    "subject": "Every small habit is worth celebrating",
    "action": "Review My Care Progress",
    "body": "<p style=\"margin:0 0 19px\">Progress does not have to mean perfection. What matters most is finding practical habits you can return to, one day at a time.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:13px\">YOUR PERSONAL CHECK-IN</div><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">Daily Care.</b><br>Mark the self-care habits you completed today.</p><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">Your Care Score.</b><br>Take the short check-in when it becomes available.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">Your Wellness Guide.</b><br>Return to the step-by-step instructions whenever you need them.</p></div><p style=\"margin:0;font-size:14px;color:#61756a\">Your care score reflects habit consistency, not nerve recovery. Always follow your product label and healthcare advice.</p>",
    "text": "Every small care habit matters. Check your daily habits and care score in My Natural Care and explore the Wellness guide: https://mynaturalcare.app"
  }
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
    'This is part of the three-email wellness series following your order. <a href="'+esc(url)+'" style="color:#176b50;text-decoration:underline">Unsubscribe from wellness emails</a>.',
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
