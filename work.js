(() => {
  'use strict';
  const clients = document.querySelector('.clients');
  if (!clients) return;
  const devices = clients.querySelector('.clients-devices');
  const screens = [...clients.querySelectorAll('.mac-window-screen .client-shot')];
  const phones = [...clients.querySelectorAll('.iphone-screen .client-shot')];
  const slides = [...clients.querySelectorAll('.client')];
  const dots = [...clients.querySelectorAll('[data-go]')];
  const toggle = clients.querySelector('.clients-toggle');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let inView = false;
  let userPaused = false;

  // The slideshow runs on its own; it only rests while off screen, in a hidden tab, or when paused.
  function sync() {
    clients.classList.toggle('is-static', motion.matches);
    clients.classList.toggle('is-paused', userPaused || !inView || document.hidden);
  }
  function show(index) {
    current = (index + slides.length) % slides.length;
    clients.dataset.active = String(current);
    slides.forEach((slide, i) => { slide.classList.toggle('is-active', i === current); slide.inert = i !== current; });
    screens.forEach((image, i) => { image.classList.toggle('is-active', i === current); image.setAttribute('aria-hidden', String(i !== current)); });
    phones.forEach((image, i) => image.classList.toggle('is-active', i === current));
    dots.forEach((dot, i) => { if (i === current) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
  }

  // When the active dot finishes filling, move to the next project.
  clients.querySelector('.clients-dots').addEventListener('animationend', event => {
    if (event.animationName === 'clients-fill') show(current + 1);
  });
  dots.forEach(dot => dot.addEventListener('click', () => show(Number(dot.dataset.go))));
  clients.addEventListener('keydown', event => {
    if (!event.target.closest('.clients-controls')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); dots[current].focus(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); dots[current].focus(); }
  });
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggle.setAttribute('aria-label', userPaused ? 'Play the slideshow' : 'Pause the slideshow');
    sync();
  });

  // Swipe or drag sideways across the devices to change project.
  let start = null;
  devices.addEventListener('pointerdown', event => { start = [event.clientX, event.clientY]; });
  devices.addEventListener('pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0];
    const dy = event.clientY - start[1];
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) show(current + (dx < 0 ? 1 : -1));
  });
  devices.addEventListener('pointercancel', () => { start = null; });
  devices.addEventListener('dragstart', event => event.preventDefault());

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting && entry.intersectionRatio >= .3; sync(); }, { threshold:[0, .3, .6] }).observe(clients);
  } else inView = true;
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  show(0);
  sync();
})();
