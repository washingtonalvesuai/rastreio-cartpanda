const CACHE='mnc-shell-homecare-v15';
const ASSETS=['/','/manifest.webmanifest','/assets/icon-192.png','/assets/icon-512.png','/assets/apple-touch-icon.png','/assets/logo.svg','/assets/light-theme.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).pathname.startsWith('/api/'))return;
if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put('/',clone))}return response}).catch(()=>caches.match('/')));return;}
event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&response.type==='basic'){const clone=response.clone();caches.open(CACHE).then(c=>c.put(request,clone))}return response})));});