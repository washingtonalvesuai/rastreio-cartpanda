
/* My Natural Care: instant order welcome, three 72-hour care emails and shipping notices. */
/* Paid orders eligible for the care campaign also receive their welcome email.
 * The per-order Resend/D1 idempotency key prevents resending prior confirmations. */
const BASE="https://mynaturalcare.app",FROM="My Natural Care <support@mynaturalcare.app>";
const PRODUCT_IMAGE="https://d2ol7oe51mr4n9.cloudfront.net/user_3KhyJDRjQ2czt2OYXQAA1zUvwjc/cbbe1d07-49c8-4491-8acb-dcb218af12b3.webp";
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
 const template="<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\">\n<style>@media(max-width:620px){.inner{padding:27px 22px!important}.brand{padding:24px 22px!important}.hero-title{font-size:29px!important;line-height:1.2!important}.hero-text{font-size:16px!important}.btn{display:block!important;text-align:center!important}.shell{width:100%!important}}</style></head>\n<body style=\"margin:0;padding:0;background:#f0f3f0;font-family:Arial,Helvetica,sans-serif;color:#263a34;\">\n<div style=\"display:none;max-height:0;overflow:hidden;opacity:0\">{{PREHEADER}}</div>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"border-collapse:collapse;background:#f0f3f0\"><tr><td align=\"center\" style=\"padding:40px 14px 44px\">\n<table role=\"presentation\" class=\"shell\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:100%;border-collapse:separate;overflow:hidden;border-radius:23px;border:1px solid #dce5df;box-shadow:0 12px 46px rgba(14,32,26,.09);background:#ffffff\">\n<tr><td style=\"height:7px;background:#45c294;font-size:1px;line-height:1px\">&nbsp;</td></tr>\n<tr><td class=\"brand\" style=\"background:#0d1922;padding:32px 40px\">\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td valign=\"middle\" style=\"padding-right:13px\"><span style=\"display:inline-block;width:43px;height:43px;line-height:43px;text-align:center;background:#94e9c4;color:#123628;border-radius:12px;font-size:23px;font-weight:800\">M</span></td><td valign=\"middle\"><div style=\"font-size:19px;font-weight:800;letter-spacing:.2px;color:#ffffff\">My Natural Care</div><div style=\"margin-top:3px;color:#b4d7c9;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase\">Wellness, made personal</div></td></tr></table>\n</td></tr>\n<tr><td style=\"padding:22px 40px;background:#f5faf8\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td width=\"128\" valign=\"middle\"><img src=\"{{PRODUCT_IMAGE}}\" width=\"112\" height=\"112\" alt=\"NervLief Advanced Nerve Support bottles\" style=\"display:block;border:0;max-width:112px;width:100%;height:auto\"></td><td valign=\"middle\" style=\"padding-left:12px;color:#153f32\"><div style=\"font-weight:800;font-size:21px;letter-spacing:.2px\">NervLief</div><div style=\"font-size:13px;line-height:1.55;color:#637971;margin-top:4px\">Advanced Nerve Support</div><div style=\"font-size:11px;color:#25896d;margin-top:6px;font-weight:700;letter-spacing:1px\">YOUR PRODUCT</div></td></tr></table></td></tr>\n<tr><td class=\"inner\" style=\"padding:43px 42px 35px\">\n<div style=\"display:inline-block;border-radius:99px;padding:8px 13px;background:#e5f6ed;color:#176f52;font-size:11px;font-weight:800;letter-spacing:1.9px;text-transform:uppercase\">{{EYEBROW}}</div>\n<h1 class=\"hero-title\" style=\"margin:22px 0 16px;font-size:35px;line-height:1.18;letter-spacing:-1px;font-weight:800;color:#112a24\">{{TITLE}}</h1>\n<div style=\"width:45px;height:3px;background:#43be8e;border-radius:20px;margin-bottom:26px\"></div>\n<div class=\"hero-text\" style=\"font-size:17px;line-height:1.75;color:#41574f\">{{BODY}}</div>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:30px 0 30px\"><tr><td bgcolor=\"#176b50\" style=\"background:#176b50;border-radius:11px\"><a class=\"btn\" href=\"{{URL}}\" style=\"display:inline-block;padding:17px 26px;font-size:16px;font-weight:800;text-decoration:none;color:#ffffff;border-radius:11px;letter-spacing:.1px\">{{BUTTON}} &nbsp;→</a></td></tr></table>\n<div style=\"border-top:1px solid #e5ebe6;padding-top:20px;font-size:13px;line-height:1.7;color:#708077\">Questions about NervLief? Our My Natural Care support team is here to help.<br><a style=\"color:#166f52;font-weight:700;text-decoration:none\" href=\"mailto:support@mynaturalcare.app\">support@mynaturalcare.app</a></div>\n</td></tr>\n<tr><td class=\"inner\" style=\"padding:22px 42px 27px;background:#f7faf7;border-top:1px solid #e8eee9\"><p style=\"margin:0 0 7px;font-size:12px;color:#52665c;font-weight:800;letter-spacing:1.2px\">MY NATURAL CARE</p><div style=\"font-size:12px;line-height:1.75;color:#708077\">{{FOOTER}}</div><div style=\"font-size:11px;line-height:1.6;color:#87958b;margin-top:13px\">Practical guidance, not medical advice. Follow the directions on your product label and consult a healthcare professional for personal health concerns.</div></td></tr>\n</table><div style=\"padding-top:22px;color:#95a39a;font-size:12px;text-align:center\">© 2026 My Natural Care · All rights reserved.</div>\n</td></tr></table></body></html>";
 const isShipping=/shipped|order is on its way|shipment/i.test(title);
 const isWelcome=/thank you for your(?: nervlief)? order|thanks for your order/i.test(title);
 const preheader=isShipping?"Your NervLief order has an update. Track its journey in the My Natural Care app.":isWelcome?"Thank you for choosing NervLief. Your order has been confirmed.":"Helpful guidance for your NervLief daily care routine.";
 return template.replaceAll("{{TITLE}}",esc(title)).replaceAll("{{BODY}}",body)
  .replaceAll("{{BUTTON}}",esc(buttonText)).replaceAll("{{URL}}",esc(buttonUrl))
  .replaceAll("{{PRODUCT_IMAGE}}",PRODUCT_IMAGE)
  .replaceAll("{{FOOTER}}",footer||"You are receiving this email as part of your My Natural Care order experience.")
  .replaceAll("{{EYEBROW}}",isShipping?"ORDER & DELIVERY":isWelcome?"YOUR ORDER IS CONFIRMED":"YOUR WELLNESS JOURNEY")
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
async function sendWelcome(env,id,email,number,now,productName){
 const key="welcome-v1-"+id;
 const prev=await env.DB.prepare("SELECT state FROM dispatches WHERE delivery_key=?").bind(key).first();
 if(prev?.state==="sent")return 0;
 await env.DB.prepare("INSERT OR IGNORE INTO dispatches(delivery_key,email,kind,state,created_at) VALUES(?,?,'welcome','pending',?)").bind(key,email,now).run();
 const subject="Thank you for your NervLief order — Welcome to My Natural Care";
 const product=String(productName||"NervLief").slice(0,100);
 const safeProduct=/NervLief/i.test(product)?product:"NervLief";
 const safeNumber=number?" <strong>#"+esc(number)+"</strong>":"";
 const body='<p style="margin:0 0 18px">Thank you for choosing <strong>My Natural Care</strong>. We are happy to have you here!</p>'+
 '<div style="padding:22px;background:#f1f8f4;border:1px solid #deeee4;border-radius:14px;margin-bottom:20px">'+
 '<p style="margin:0 0 8px;color:#206448;font-size:12px;font-weight:800;letter-spacing:1.4px">ORDER CONFIRMED</p>'+
 '<p style="margin:0;color:#274d3b;font-size:17px">Your payment has been confirmed.'+(number?" Order"+safeNumber+".":"")+'</p></div>'+
 '<p style="margin:0 0 18px"><strong>Your product:</strong> '+esc(safeProduct)+'</p>'+'<p style="margin:0 0 18px">Your My Natural Care companion app brings together your order information and practical wellness guidance in one place.</p>'+
 '<p style="margin:0 0 18px"><strong>Getting started is simple:</strong> Open the app, use the same email address you entered at checkout, and explore your order and care guide.</p>'+
 '<p style="margin:0">Over the coming days, we will also share a few useful care tips by email. We are here if you need help.</p>';
 const text="Thank you for choosing My Natural Care! Your payment has been confirmed."+(number?" Order #"+number+".":"")+" Product: "+safeProduct+"."+
 "\n\nOpen your companion app at "+BASE+" using the same email address you used at checkout. You can view your order and helpful wellness guidance in one place.\n\nNeed assistance? support@mynaturalcare.app";
 try{
  await send(env,email,subject,body,text,"welcome",key,"Open My Natural Care",BASE);
  await env.DB.prepare("UPDATE dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
  return 1;
 }catch(e){
  await env.DB.prepare("UPDATE dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,160),key).run();
  console.error("Order welcome dispatch failed",String(e).slice(0,110));
  return 0;
 }
}
async function order(env,item,now){
 const id=String(item.id||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100),email=clean(item.email),status=clean(item.status);
 if(!id||!valid(email)||!["preparing","shipped","partially_shipped","delivered"].includes(status))return 0;
 const number=String(item.number||"").slice(0,80);
 const backfillEligible=Number(number)>=4&&Number(number)<=11&&/^(2026-11-20|2026-11-21)/.test(String(item.created_at||""));
 const productName=String(item.product_name||"NervLief").slice(0,100);
 const purchasedAt=Date.parse(String(item.created_at||""));
 const campaignStart=Date.parse(String(env.CAMPAIGN_START||""));
 const eligibleForCare=Number.isFinite(purchasedAt)&&purchasedAt<=now&&((Number.isFinite(campaignStart)&&purchasedAt>=campaignStart)||backfillEligible);
 if(eligibleForCare)await autoEnroll(env,email,purchasedAt);
 const eligibleForWelcome=eligibleForCare;
 const welcomeSent=eligibleForWelcome?await sendWelcome(env,id,email,number,now,productName):0;
 const prev=await env.DB.prepare("SELECT status,eligible_for_shipping,shipping_sent_at FROM orders WHERE order_id=?").bind(id).first();
 if(!prev){await env.DB.prepare("INSERT OR IGNORE INTO orders(order_id,email,order_number,status,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?)").bind(id,email,number,status,now,now).run();return welcomeSent}
 const eligible=prev.eligible_for_shipping||prev.status==="preparing"&&["shipped","partially_shipped"].includes(status);
 await env.DB.prepare("UPDATE orders SET email=?,order_number=?,status=?,last_seen_at=?,eligible_for_shipping=? WHERE order_id=?").bind(email,number,status,now,eligible?1:0,id).run();
 if(!eligible||prev.shipping_sent_at)return welcomeSent;
 const key="ship-"+id,dispatch=await env.DB.prepare("SELECT state FROM dispatches WHERE delivery_key=?").bind(key).first();
 if(dispatch?.state==="sent"){await env.DB.prepare("UPDATE orders SET shipping_sent_at=? WHERE order_id=?").bind(now,id).run();return welcomeSent}
 await env.DB.prepare("INSERT OR IGNORE INTO dispatches(delivery_key,email,kind,state,created_at) VALUES(?,?,'shipping','pending',?)").bind(key,email,now).run();
 const subject="Your NervLief order is on its way 📦",text="Your NervLief order"+(number?" #"+number:"")+" has shipped. Track its progress in the My Natural Care app: "+BASE;
 try{
  await send(env,email,subject,"<p>Good news! Your <strong>NervLief</strong> order"+(number?" <b>#"+esc(number)+"</b>":"")+" has shipped.</p><p>See your NervLief product information and view the latest tracking details directly in the My Natural Care app.</p>",text,"shipping",key,"Track My NervLief Order",BASE);
  await env.DB.prepare("UPDATE dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
  await env.DB.prepare("UPDATE orders SET shipping_sent_at=? WHERE order_id=?").bind(now,id).run();
  return welcomeSent+1;
 }catch(e){await env.DB.prepare("UPDATE dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,160),key).run();console.error("Shipping dispatch failed",String(e).slice(0,110));return welcomeSent}
}
async function scanShipping(env,now,targetId=null,maxPages=20){
 const origin=String(env.RENDER_ORIGIN||"https://rastreio-cartpanda.onrender.com").replace(/\/$/,"");
 let count=0,sent=0;
 for(let pageNum=1;pageNum<=maxPages;pageNum++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try{
   const r=await fetch(origin+"/api/internal/email-orders?page="+pageNum,{headers:{Authorization:"Bearer "+env.INTERNAL_TOKEN},signal:controller.signal});
   if(!r.ok)throw Error("Snapshot HTTP "+r.status);
   response=await r.json();
  }finally{clearTimeout(timer)}
  if(!Array.isArray(response.orders))throw Error("Snapshot format");
  for(const item of response.orders){
   if(targetId&&String(item.id)!==targetId)continue;
   count++;sent+=await order(env,item,now);
   if(targetId)return {count,sent};
  }
  if(!response.hasMore)break;
 }
 return {count,sent};
}

const CARE_SEQUENCE=[
  {
    "subject": "NervLief Care Guide: Start with one small step",
    "action": "Explore My Wellness Guide",
    "body": "<p style=\"margin:0 0 19px\">Your NervLief care journey begins with the little things. There is no need to change everything overnight.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:14px\">THREE SIMPLE WAYS TO START</div><p style=\"margin:0 0 12px\"><b style=\"color:#183b2c\">01 &nbsp; Nourish yourself.</b><br>Choose a balanced meal that works for you.</p><p style=\"margin:0 0 12px\"><b style=\"color:#183b2c\">02 &nbsp; Check your feet.</b><br>Look for any changes in your skin, particularly if sensation is reduced.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">03 &nbsp; Make room for rest.</b><br>Create a calming moment before bedtime.</p></div><p style=\"margin:0\">In your My Natural Care app, the <b>Wellness</b> guide shows you how, while the <b>Care</b> tab helps you track your daily habits.</p>",
    "text": "NervLief Care Guide: Your wellness journey starts with small steps. Explore the My Natural Care Wellness guide, choose a balanced meal, check your feet and build a calming bedtime routine. Open: https://mynaturalcare.app"
  },
  {
    "subject": "NervLief Care Guide: Gentle movement for your day",
    "action": "Discover At-Home Movement",
    "body": "<p style=\"margin:0 0 19px\">Alongside your NervLief routine, taking care of yourself can be simple and comfortable. Your My Natural Care Wellness guide includes gentle, chair-based movement ideas for home.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:13px\">A GENTLE MOMENT OF MOVEMENT</div><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">01 &nbsp; Sit comfortably.</b><br>Choose a stable chair with back support.</p><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">02 &nbsp; Start slowly.</b><br>Try easy arm and shoulder movements if appropriate for you.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">03 &nbsp; Rest when needed.</b><br>Keep movements gentle and within your limits.</p></div><p style=\"margin:0;font-size:14px;color:#61756a\"><b>Safety first:</b> Skip activities that cause pain or are not recommended for you. If you have wounds, severe numbness, instability, or new weakness, ask a healthcare professional before exercising.</p>",
    "text": "NervLief Care Guide: Your My Natural Care Wellness guide includes easy, chair-based movement ideas. Only perform exercises appropriate for your health and stop if symptoms develop. Visit: https://mynaturalcare.app"
  },
  {
    "subject": "NervLief Care Guide: Every small habit counts",
    "action": "Review My Care Progress",
    "body": "<p style=\"margin:0 0 19px\">Your NervLief wellness journey does not have to mean perfection. What matters most is finding practical habits you can return to, one day at a time.</p><div style=\"padding:23px 22px;background:#f3f8f4;border:1px solid #deeee2;border-radius:15px;margin-bottom:20px\"><div style=\"font-size:12px;color:#1f7f5b;font-weight:800;letter-spacing:1.4px;margin-bottom:13px\">YOUR PERSONAL CHECK-IN</div><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">Daily Care.</b><br>Mark the self-care habits you completed today.</p><p style=\"margin:0 0 11px\"><b style=\"color:#183b2c\">Your Care Score.</b><br>Take the short check-in when it becomes available.</p><p style=\"margin:0\"><b style=\"color:#183b2c\">Your Wellness Guide.</b><br>Return to the step-by-step instructions whenever you need them.</p></div><p style=\"margin:0;font-size:14px;color:#61756a\">Your care score reflects habit consistency, not nerve recovery. Always follow your NervLief product label and advice from your healthcare professional.</p>",
    "text": "NervLief Care Guide: Every small care habit matters. Check your daily habits and care score in My Natural Care and explore the Wellness guide: https://mynaturalcare.app"
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
   await send(env,email,details.subject,details.body,details.text+"\n\nUnsubscribe from wellness emails: "+url,"care",key,details.action,BASE,
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

/* Abandoned-cart recovery (Cartpanda -> protected webhook -> D1 -> Resend).
 * FAIL CLOSED: never send until RECOVERY_ENABLED=true, RECOVERY_MAILING_ADDRESS
 * is set, and the store's native recovery messages are disabled.
 */
const RECOVERY_DELAYS_MS=[3600000,12*3600000,24*3600000];
const RECOVERY_SUBJECTS=[
 "Your NervLief checkout is ready when you are",
 "Still thinking about NervLief?",
 "A final reminder about your NervLief checkout"
];
const RECOVERY_BODIES=[
 '<p>You were looking at <strong>NervLief</strong> and did not finish checking out. No rush — you can return to your checkout with the link below.</p><p>If you have any questions before placing your order, our support team is happy to help.</p>',
 '<p>We know it is important to feel comfortable before making a purchase. If you are still considering <strong>NervLief</strong>, you can return to your checkout and review your choices.</p><p>Need help with ordering, shipping or product information? Our support team is here for you.</p>',
 '<p>This is our last reminder about your unfinished <strong>NervLief</strong> checkout. If you would still like to proceed, use the link below to review the order details and finish when ready.</p><p>If you have already placed an order, you can disregard this email. We will not send further reminders for this checkout.</p>'
];
function recoveryUrl(link,env){
 try{
  const u=new URL(String(link||""));
  if(u.protocol!=="https:"||u.username||u.password||u.href.length>2000)return null;
  const host=u.hostname.toLowerCase();
  const allowed=["cartpanda.com","cartpanda.com.br","mycartpanda.com","nervlief.com","mynaturalcare.app"]
   .concat(String(env.RECOVERY_ALLOWED_HOSTS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean));
  return allowed.some(d=>host===d||host.endsWith("."+d))?u.href:null;
 }catch{return null}
}
function getRecoveryInfo(payload){
 const p=payload&&typeof payload==="object"?payload:{};
 const candidates=[p.checkout,p.abandoned_checkout,p.abandoned_cart,p.cart,p.data?.checkout,p.data?.abandoned_checkout,p.data?.cart,p.data,p];
 const x=candidates.find(o=>o&&typeof o==="object"&&!Array.isArray(o)&&
   (o.email||o.email_address||o.customer?.email||o.customer_email||o.billing_address?.email))||p;
 const email=clean(x.email||x.email_address||x.customer?.email||x.customer_email||x.billing_address?.email||p.email||p.customer?.email);
 const id=String(x.id||x.checkout_id||x.abandoned_checkout_id||x.cart_id||x.token||p.id||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100);
 const link=x.recovery_url||x.abandoned_checkout_url||x.checkout_recovery_url||x.recovery_link||
 x.checkout_url||x.cart_url||x.url||x.checkout?.recovery_url||p.recovery_url||p.checkout_url||"";
 const rawDate=x.created_at||x.abandoned_at||x.updated_at||p.created_at||"";
 const opted=x.buyer_accepts_marketing??x.customer?.accepts_marketing??x.accepts_marketing;
 return {email,id,link,rawDate,marketingDenied:opted===false||opted===0||opted==="false"||opted==="0"};
}
async function receiveAbandonedCheckout(req,env){
 const token=new URL(req.url).searchParams.get("key")||"";
 const secret=String(env.RECOVERY_WEBHOOK_KEY||"");
 if(!secret||token.length!==secret.length||(await hash(token))!==(await hash(secret)))return j({error:"Unauthorized"},401);
 if(Number(req.headers.get("content-length")||0)>32768)return j({error:"Payload too large"},413);
 let payload;
 try{
  const raw=await req.text();
  if(raw.length>32768)return j({error:"Payload too large"},413);
  payload=JSON.parse(raw);
 }catch{return j({error:"Invalid JSON"},400)}
 const info=getRecoveryInfo(payload);
 if(!valid(info.email)||info.marketingDenied)return j({ok:true,ignored:"no valid or eligible contact"});
 const checkout=recoveryUrl(info.link,env);
 if(!checkout)return j({ok:false,error:"A valid Cartpanda recovery checkout URL is required"},422);
 const cartId=info.id||"u"+(await hash(info.email+"|"+checkout)).slice(0,50);
 const now=Date.now();
 let abandoned=Date.parse(String(info.rawDate||""));
 if(!Number.isFinite(abandoned)||abandoned>now+60000||abandoned<now-7*DAY)abandoned=now;
 const optoutHash=await hash("recovery:optout:v1:"+info.email+":"+env.INTERNAL_TOKEN);
 const isOpted=await env.DB.prepare("SELECT 1 AS yes FROM recovery_optouts WHERE email=?").bind(info.email).first();
 const state=isOpted?"opted_out":"pending";
 await env.DB.prepare("INSERT INTO recovery_carts(cart_id,email,checkout_url,abandoned_at,received_at,updated_at,step,status,unsubscribe_hash) VALUES(?,?,?,?,?,?,0,?,?) ON CONFLICT(cart_id) DO UPDATE SET updated_at=excluded.updated_at,checkout_url=excluded.checkout_url,status=CASE WHEN recovery_carts.status IN ('opted_out','paid','completed') THEN recovery_carts.status ELSE excluded.status END")
  .bind(cartId,info.email,checkout,abandoned,now,now,state,optoutHash).run();
 return j({ok:true,received:true,recovery_active:env.RECOVERY_ENABLED==="true"});
}
async function paidEmailsForRecovery(env){
 const origin=String(env.RENDER_ORIGIN||"https://rastreio-cartpanda.onrender.com").replace(/\/$/,"");
 const list=[];
 for(let page=1;page<=20;page++){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  let d;
  try{
   const r=await fetch(origin+"/api/internal/email-orders?page="+page,{headers:{"Authorization":"Bearer "+env.INTERNAL_TOKEN},signal:controller.signal});
   if(!r.ok)throw Error("Paid order check HTTP "+r.status);
   d=await r.json();
  }finally{clearTimeout(timeout)}
  if(!Array.isArray(d.orders))throw Error("Paid order check unavailable");
  for(const x of d.orders){const at=Date.parse(String(x.created_at||""));if(valid(clean(x.email))&&Number.isFinite(at))list.push({email:clean(x.email),time:at})}
  if(!d.hasMore)break;
  if(page===20)throw Error("Paid order history incomplete");
 }
 return list;
}
function recoveryUnsubscribePage(token,finished=false){
 const href=BASE+"/_mail/recovery-unsubscribe?token="+encodeURIComponent(token);
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NervLief Cart Reminder Preferences</title></head>'+
 '<body style="background:#10212b;color:#eef8f0;font:17px/1.6 Arial,sans-serif"><main style="max-width:530px;margin:10vh auto;padding:28px;background:#1a3431;border-radius:17px">'+
 '<h1>NervLief Cart Reminders</h1>'+(finished?'<p>You will no longer receive NervLief abandoned checkout reminders.</p>':
 '<p>Would you like to stop receiving checkout reminder emails from My Natural Care?</p><form action="'+esc(href)+'" method="POST"><button type="submit" style="background:#83eac0;border:0;border-radius:11px;padding:15px 22px;font-size:17px">Unsubscribe</button></form>')+
 '</main></body></html>';
}
async function recoveryUnsubscribe(req,env){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[0-9a-f]{64}$/.test(token))return j({error:"Invalid link"},400);
 const tokenHash=await hash(token);
 const row=await env.DB.prepare("SELECT email FROM recovery_carts WHERE unsubscribe_hash=? LIMIT 1").bind(tokenHash).first();
 if(!row)return j({error:"Invalid or expired link"},404);
 if(req.method==="POST"){
  const now=Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO recovery_optouts(email,created_at) VALUES(?,?)").bind(row.email,now).run();
  await env.DB.prepare("UPDATE recovery_carts SET status='opted_out',updated_at=? WHERE email=? AND status='pending'").bind(now,row.email).run();
 }
 return new Response(recoveryUnsubscribePage(token,req.method==="POST"),{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
async function scanAbandonedRecovery(env,now){
 // Avoid duplicate flows while Cartpanda native notifications are enabled.
 if(env.RECOVERY_ENABLED!=="true")return {active:false,sent:0};
 if(!env.RECOVERY_MAILING_ADDRESS||!env.RECOVERY_WEBHOOK_KEY)throw Error("Recovery not configured; mailing address or webhook secret missing");
 const due=await env.DB.prepare("SELECT cart_id,email,checkout_url,abandoned_at,step,unsubscribe_hash FROM recovery_carts WHERE status='pending' AND step<3 AND abandoned_at<=? ORDER BY abandoned_at ASC LIMIT 40").bind(now-RECOVERY_DELAYS_MS[0]).all();
 const rows=due.results||[];
 if(!rows.length)return {active:true,sent:0};
 // Fail closed: only send while the verified paid-order API is accessible.
 const buyers=await paidEmailsForRecovery(env);
 let sent=0;
 for(const row of rows){
  const next=Number(row.step)+1;
  if(next<1||next>3||row.abandoned_at+RECOVERY_DELAYS_MS[next-1]>now)continue;
  const opted=await env.DB.prepare("SELECT 1 AS yes FROM recovery_optouts WHERE email=?").bind(row.email).first();
  if(opted){await env.DB.prepare("UPDATE recovery_carts SET status='opted_out' WHERE cart_id=?").bind(row.cart_id).run();continue}
  // A paid purchase within two days before the abandoned checkout or after it
  // is safer to treat as converted than to send another sales reminder.
  if(buyers.some(p=>p.email===row.email&&p.time>=row.abandoned_at-2*DAY)){
   await env.DB.prepare("UPDATE recovery_carts SET status='paid',updated_at=? WHERE cart_id=?").bind(now,row.cart_id).run();
   continue;
  }
  const key="recovery-v1-"+(await hash(row.cart_id)).slice(0,36)+"-"+next;
  const existing=await env.DB.prepare("SELECT state FROM recovery_dispatches WHERE delivery_key=?").bind(key).first();
  if(existing?.state==="sent"){
   await env.DB.prepare("UPDATE recovery_carts SET step=?,last_sent_at=?,status=? WHERE cart_id=? AND step<?")
    .bind(next,now,next===3?"completed":"pending",row.cart_id,next).run();
   continue;
  }
  await env.DB.prepare("INSERT OR IGNORE INTO recovery_dispatches(delivery_key,cart_id,step,state,created_at) VALUES(?,?,?,'pending',?)").bind(key,row.cart_id,next,now).run();
  const token=await hash("recovery:optout:v1:"+row.email+":"+env.INTERNAL_TOKEN);
  const unsub=BASE+"/_mail/recovery-unsubscribe?token="+token;
  const footer='<p style="margin:0 0 8px">You received this email because you started a NervLief checkout. <a href="'+esc(unsub)+'" style="color:#176b50;text-decoration:underline">Unsubscribe from cart reminders</a>.</p>'+
   '<p style="margin:0">My Natural Care · '+esc(env.RECOVERY_MAILING_ADDRESS)+'</p>';
  const plain=RECOVERY_SUBJECTS[next-1]+"\n\n"+RECOVERY_BODIES[next-1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()+
   "\n\nComplete your NervLief checkout: "+row.checkout_url+"\n\nQuestions: support@mynaturalcare.app\nMy Natural Care · "+env.RECOVERY_MAILING_ADDRESS+
   "\n\nUnsubscribe from cart reminders: "+unsub;
  try{
   await send(env,row.email,RECOVERY_SUBJECTS[next-1],RECOVERY_BODIES[next-1],plain,"cart_recovery",key,"Complete My Order",row.checkout_url,footer,
    {"List-Unsubscribe":"<"+unsub+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"});
   await env.DB.prepare("UPDATE recovery_dispatches SET state='sent',sent_at=?,last_error=NULL WHERE delivery_key=?").bind(now,key).run();
   await env.DB.prepare("UPDATE recovery_carts SET step=?,last_sent_at=?,updated_at=?,status=?,last_error=NULL WHERE cart_id=?").bind(next,now,now,next===3?"completed":"pending",row.cart_id).run();
   sent++;
  }catch(e){
   await env.DB.prepare("UPDATE recovery_dispatches SET last_error=? WHERE delivery_key=?").bind(String(e).slice(0,140),key).run();
   await env.DB.prepare("UPDATE recovery_carts SET last_error=? WHERE cart_id=?").bind(String(e).slice(0,140),row.cart_id).run();
   console.error("Recovery email failure",String(e).slice(0,80));
  }
 }
 return {active:true,sent};
}

async function cron(env){
 const now=Date.now(),started=await env.DB.prepare("INSERT INTO job_runs(started_at) VALUES (?)").bind(now).run(),id=started.meta.last_row_id;
 try{
  const ship=await scanShipping(env,now),care=await scanReminders(env,Date.now()),recovery=await scanAbandonedRecovery(env,Date.now());
  await env.DB.prepare("UPDATE job_runs SET finished_at=?,processed=?,sent=?,result='ok' WHERE id=?").bind(Date.now(),ship.count,ship.sent+care+recovery.sent,id).run();
  console.log("Scan completed: "+ship.count+" orders, "+ship.sent+" transactional emails, "+care+" reminders, "+recovery.sent+" recoveries");
 }catch(e){
  await env.DB.prepare("UPDATE job_runs SET finished_at=?,result=? WHERE id=?").bind(Date.now(),String(e).slice(0,140),id).run();
  console.error("Scan failed",String(e).slice(0,150));
 }
 await env.DB.prepare("DELETE FROM confirmations WHERE expires_at<?").bind(Date.now()).run();
 await env.DB.prepare("DELETE FROM job_runs WHERE started_at<?").bind(Date.now()-90*DAY).run();
}
async function quickWelcomeScan(env){
 try{
  const result=await scanShipping(env,Date.now(),null,1);
  if(result.sent)console.log("Recent order scan sent "+result.sent+" transactional email(s)");
 }catch(e){console.error("Recent order scan unavailable",String(e).slice(0,120))}
}
export default {
 async fetch(req,env){
  const p=new URL(req.url).pathname;
  if(p==="/_mail/health"&&req.method==="GET")return j({ok:true,ready:Boolean(env.DB&&env.INTERNAL_TOKEN&&env.RESEND_API_KEY&&env.CAMPAIGN_START),welcome_ready:Boolean(env.WEBHOOK_TOKEN)});
  if(p==="/_mail/cartpanda-paid"&&req.method==="POST"){
   const given=new URL(req.url).searchParams.get("key")||"";
   if(!env.WEBHOOK_TOKEN||given.length!==env.WEBHOOK_TOKEN.length||(await hash(given))!==(await hash(env.WEBHOOK_TOKEN)))return j({error:"Unauthorized"},401);
   if(Number(req.headers.get("content-length")||0)>65536)return j({error:"Too large"},413);
   let raw;try{raw=await req.text();if(raw.length>65536)return j({error:"Too large"},413)}catch{return j({error:"Bad request"},400)}
   let payload;try{payload=JSON.parse(raw)}catch{return j({error:"Invalid JSON"},400)}
   const id=String(payload?.order?.id||"");
   if(payload?.event!=="order.paid"||!/^[0-9]{1,25}$/.test(id))return j({error:"Invalid event"},400);
   try{const result=await scanShipping(env,Date.now(),id);return j({ok:true,verified:result.count>0});}
   catch(e){console.error("Paid webhook verification failed",String(e).slice(0,130));return j({error:"Verification temporarily unavailable"},503)}
  }
  if(p==="/_mail/abandoned-cart"&&req.method==="POST")return receiveAbandonedCheckout(req,env);
  if(p==="/_mail/recovery-unsubscribe"&&["GET","POST"].includes(req.method))return recoveryUnsubscribe(req,env);
  if(p==="/_mail/recovery-health"&&req.method==="GET")return j({ready:Boolean(env.DB&&env.RECOVERY_WEBHOOK_KEY&&env.RECOVERY_MAILING_ADDRESS),enabled:env.RECOVERY_ENABLED==="true"});
  if(p==="/_mail/unsubscribe"&&["GET","POST"].includes(req.method))return unsubscribe(req,env);
  return j({error:"Not found"},404);
 },
 scheduled(event,env,ctx){ctx.waitUntil(event.cron==='* * * * *'?quickWelcomeScan(env):cron(env))}
};
