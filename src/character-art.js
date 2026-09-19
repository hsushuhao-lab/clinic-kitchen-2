/* Approved original pixels at native crop resolution. Presentation only.
   No self-mutating image observers, new poses, new mechanics or remote dependencies. */
(function () {
  'use strict';
  const sources = {
    speed: 'assets/ui/doctor-speed-bust.webp',
    heat: 'assets/ui/doctor-heat-bust.webp',
    strategy: 'assets/ui/doctor-strategy-bust.webp',
    patient: 'assets/ui/patient-office-bust.webp'
  };
  const images = Object.fromEntries(Object.entries(sources).map(([id,src]) => {
    const image = new Image(); image.src = src; return [id,image];
  }));
  const names = {speed:'DR. SPEED',heat:'DR. HEAT',strategy:'DR. STRATEGY'};
  function presentDialog(badge) {
    const content = document.getElementById('dialogContent');
    const windowEl = content.closest('.dialog-window');
    const clinical = !!badge && (badge.startsWith('CLINIC EMR') || badge.startsWith('PATIENT DINING'));
    windowEl.classList.toggle('has-character-art', clinical);
    // showDialog replaces the previous content first, so one presentation per dialog.
    if (!clinical || content.querySelector('.consultation-portraits')) return;
    const id = window.CKShift?.snapshot().doctorId || 'speed';
    const portrait = document.createElement('aside');
    portrait.className = 'consultation-portraits';
    portrait.setAttribute('aria-label','目前醫師與病人');
    for (const [key,name] of [[id,names[id]],['patient','上班族病人']]) {
      const figure=document.createElement('figure');
      const img=document.createElement('img');
      img.src=sources[key];img.alt=name+'，核准人物原稿半身插畫';
      const caption=document.createElement('figcaption');caption.textContent=name;
      figure.append(img,caption);portrait.append(figure);
    }
    const conversation=document.createElement('div');conversation.className='consultation-copy';
    while(content.firstChild) conversation.append(content.firstChild);
    content.append(portrait,conversation);
  }
  window.CKCharacterArt = {
    image: id => images[id],
    ready: () => Object.values(images).every(im => im.complete && im.naturalWidth>0),
    presentDialog
  };
  // Only the engine owns [hidden]. Rendering here never writes that attribute.
  const dialog = document.getElementById('dialogModal');
  new MutationObserver(() => {
    if (!dialog.hidden) presentDialog(document.getElementById('dialogBadge').textContent);
  }).observe(dialog, {attributes:true, attributeFilter:['hidden']});
})();
