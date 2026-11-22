(() => {
'use strict';
// Smooth scrolling for mouse wheels and trackpads, so the film glides the same way on every desktop.
// Touch screens keep their own native momentum. Same-page links glide with the same feel.
if (!window.Lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
const lenis = new Lenis({ lerp:.085, wheelMultiplier:.9, smoothWheel:true });
window.envisionLenis = lenis;
const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
requestAnimationFrame(raf);
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.matches('[data-brief],.skip-link')) return;
  const id = link.getAttribute('href').slice(1), target = id && document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  lenis.scrollTo(target, { offset:-(parseFloat(getComputedStyle(target).scrollMarginTop) || 0), duration:1.5 });
  history.pushState(null, '', '#' + id);
});
// While the project brief is open, the page behind it stays still.
document.addEventListener('envision:brief-visibility', event => { if (event.detail.open) lenis.stop(); else lenis.start(); });
})();
