/* Mareblu install / offline enhancement; independent of journal storage. */
(function(){
  let deferredPrompt=null;
  function showHint(){
    const standalone=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
    if(standalone)return;
    const isApple=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const mobile=/Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
    const message=isApple ? 'En Safari: Compartir → Añadir a pantalla de inicio.' : mobile ? 'En el menú del navegador: Instalar aplicación o Añadir a pantalla de inicio.' : 'En Chrome o Edge: menú del navegador → Instalar Mareblu Trading Journal (o icono instalar junto a la dirección).';
    alert(message+'\n\nImportante: tus datos se guardan localmente en este navegador. Hacé un backup antes de cambiar de dispositivo o navegador.');
  }
  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();deferredPrompt=event;
    const btn=document.getElementById('mbInstallBtn');if(btn)btn.title='Instalar Mareblu como aplicación';
  });
  window.addEventListener('appinstalled',function(){deferredPrompt=null;const btn=document.getElementById('mbInstallBtn');if(btn)btn.hidden=true;});
  document.addEventListener('DOMContentLoaded',function(){
    const header=document.querySelector('.header-right');
    if(header&&!document.getElementById('mbInstallBtn')&&!window.matchMedia('(display-mode: standalone)').matches){
      const btn=document.createElement('button');btn.id='mbInstallBtn';btn.className='hdr-btn mb-install-btn';btn.textContent='⬇ Instalar app';
      btn.title='Instalar en PC o celular';btn.onclick=async function(){
        if(deferredPrompt){const prompt=deferredPrompt;deferredPrompt=null;try{await prompt.prompt();await prompt.userChoice;}catch(e){showHint();}}
        else showHint();
      };header.appendChild(btn);
    }
  });
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
    window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(function(err){console.warn('Mareblu: modo offline no disponible',err);});});
  }
})();
