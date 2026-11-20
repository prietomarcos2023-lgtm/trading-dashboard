/* Mareblu offline shell. Does not read or cache trades/localStorage. */
const CACHE='mareblu-pwa-shell-v1';
const SHELL=['./','./index.html','./styles.css','./script.js','./pwa.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mareblu-pwa-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  const url=new URL(req.url);
  if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  // Prefer latest deployed content online; fallback to offline cache only for known files.
  event.respondWith(fetch(req).then(response=>{
    if(response.ok && response.type==='basic'){
      const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    if(req.mode==='navigate')return (await caches.match('./index.html')) || Response.error();
    return Response.error();
  }));
});
