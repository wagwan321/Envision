(() => {
  'use strict';
  const shot = document.getElementById('case-leisure-shot');
  if (!shot) return;
  const buttons = [...document.querySelectorAll('[data-case-lang]')];
  const versions = {
    en: { src:'assets/work/leisure-en.webp', alt:'The Leisure Club homepage in English, headlined “More than a club.”' },
    ar: { src:'assets/work/leisure-ar.webp', alt:'The Leisure Club homepage in Arabic, laid out right to left and headlined “أكثر من مجرد نادٍ.”' },
    fr: { src:'assets/work/leisure-fr.webp', alt:'The Leisure Club homepage in French, headlined “Plus qu’un club.”' }
  };
  let preloaded = false;
  // The other languages load only once someone shows interest in switching.
  function preload() {
    if (preloaded) return;
    preloaded = true;
    Object.values(versions).forEach(({ src }) => { const image = new Image(); image.src = src; });
  }
  function show(lang) {
    const version = versions[lang];
    if (!version || shot.getAttribute('src') === version.src) return;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.caseLang === lang)));
    shot.classList.add('is-swapping');
    const next = new Image();
    next.onload = next.onerror = () => {
      shot.src = version.src;
      shot.alt = version.alt;
      shot.classList.remove('is-swapping');
    };
    next.src = version.src;
  }
  buttons.forEach(button => {
    button.addEventListener('pointerenter', preload, { once:true });
    button.addEventListener('focus', preload, { once:true });
    button.addEventListener('click', () => show(button.dataset.caseLang));
  });
})();
