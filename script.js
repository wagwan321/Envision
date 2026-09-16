(() => {
  'use strict';
  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const heroSizeQuery = window.matchMedia('(min-height: 700px)');
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.hero-stage');
  const orbit = document.querySelector('.orbit-art');
  const heroLink = document.querySelector('.hero-opening a');
  const progressBar = document.getElementById('reading-progress');
  const nav = document.getElementById('site-navigation');
  const menu = document.getElementById('menu-toggle');
  const header = document.getElementById('topbar');
  const navLinks = [...nav.querySelectorAll('[data-section]')];
  const sections = navLinks.map(link => document.getElementById(link.dataset.section));
  const clamp = value => Math.max(0, Math.min(1, value));
  let frame = 0;
  let layoutDirty = true;
  let geometry;
  let lastHeroProgress = -1;
  let lastActive = null;
  let labActive = false;

  function invalidateLayout() { layoutDirty = true; schedule(); }
  function measureLayout() {
    const y = window.scrollY;
    geometry = {
      viewport:window.innerHeight,
      heroTop:hero.getBoundingClientRect().top+y,
      heroHeight:hero.offsetHeight,
      stageHeight:stage.offsetHeight,
      sectionTops:sections.map(section => section.getBoundingClientRect().top+y),
      total:root.scrollHeight-window.innerHeight
    };
    layoutDirty = false;
  }

  // Native scrolling drives the scene in both directions, without wheel interception.
  function render() {
    frame = 0;
    if(labActive) return;
    if(layoutDirty) measureLayout();
    const y = window.scrollY;
    const { viewport, heroTop, heroHeight, stageHeight, sectionTops, total } = geometry;
    const reduced = motionQuery.matches;
    const progress = reduced || !heroSizeQuery.matches ? 0 : clamp((y-heroTop) / Math.max(1, heroHeight-stageHeight));
    if(progress !== lastHeroProgress) {
      lastHeroProgress = progress;
      stage.style.setProperty('--opening-opacity', 1 - clamp(progress / .43));
      stage.style.setProperty('--opening-y', `${-progress * 100}px`);
      stage.style.setProperty('--resolution-opacity', clamp((progress - .46) / .23));
      stage.style.setProperty('--resolution-y', `${(1 - clamp((progress - .48) / .4)) * 45}px`);
      stage.style.setProperty('--art-y', `${progress * 28}%`);
      stage.style.setProperty('--art-scale', 1 - progress * .28);
      orbit.style.setProperty('--orbit-turn', `${progress * 150}deg`);
      stage.style.setProperty('--art-opacity', 1 - clamp((progress - .36) / .4) * .82);
      // Invisible links should not intercept clicks or keyboard focus.
      heroLink.tabIndex = progress > .43 ? -1 : 0;
      heroLink.style.pointerEvents = progress > .43 ? 'none' : 'auto';
    }
    progressBar.style.transform = `scaleX(${total > 0 ? clamp(y / total) : 0})`;
    header.classList.toggle('is-scrolled', y > 20);
    let active = '';
    sectionTops.forEach((top, index) => {
      if (top-y < viewport * .45) active = sections[index].id;
    });
    if(active !== lastActive) {
      lastActive = active;
      navLinks.forEach(link => {
        if (link.dataset.section === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }
  function schedule() {
    if (!labActive && !frame) frame = requestAnimationFrame(render);
  }
  root.classList.add('motion-ready');
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidateLayout, { passive: true });
  window.addEventListener('pageshow', invalidateLayout);
  motionQuery.addEventListener('change', invalidateLayout);
  heroSizeQuery.addEventListener('change', invalidateLayout);
  if ('ResizeObserver' in window) new ResizeObserver(invalidateLayout).observe(document.body);
  if (document.fonts) document.fonts.ready.then(invalidateLayout);

  const reveals = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08 });
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(element => element.classList.add('is-visible'));

  // Each decorative demo plays once per viewport entry, then rests in its final state.
  // Leaving the viewport removes its animations; the fallback artwork stays visible.
  const demos = new Map([...document.querySelectorAll('.service-demo')].map(element => [element, false]));
  function syncDemoMotion() {
    demos.forEach((visible, element) => {
      element.classList.toggle('demo-playing', visible && !motionQuery.matches && !document.hidden && !labActive);
    });
  }
  if ('IntersectionObserver' in window) {
    const demoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => demos.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= .18));
      syncDemoMotion();
    }, { threshold:[0, .18] });
    demos.forEach((visible, element) => demoObserver.observe(element));
  }
  motionQuery.addEventListener('change', syncDemoMotion);
  document.addEventListener('visibilitychange', syncDemoMotion);
  document.addEventListener('envision:lab-visibility', event => {
    labActive = event.detail.open;
    if(labActive) { cancelAnimationFrame(frame); frame = 0; }
    else invalidateLayout();
    syncDemoMotion();
  });

  document.querySelectorAll('.service-card').forEach(card => {
    let pointerFrame = 0;
    let x = 0;
    let y = 0;
    function resetPointer() {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      card.classList.remove('has-pointer');
      card.style.setProperty('--pointer-x', '0px');
      card.style.setProperty('--pointer-y', '0px');
    }
    card.addEventListener('pointermove', event => {
      if (motionQuery.matches || event.pointerType !== 'mouse') {
        resetPointer();
        return;
      }
      card.classList.add('has-pointer');
      const rect = card.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width - .5) * 8;
      y = ((event.clientY - rect.top) / rect.height - .5) * 6;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        card.style.setProperty('--pointer-x', `${x.toFixed(2)}px`);
        card.style.setProperty('--pointer-y', `${y.toFixed(2)}px`);
      });
    }, { passive:true });
    card.addEventListener('pointerleave', resetPointer);
    card.addEventListener('pointercancel', resetPointer);
    window.addEventListener('blur', resetPointer);
    motionQuery.addEventListener('change', resetPointer);
  });

  function closeMenu(restoreFocus = false) {
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    if (restoreFocus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  header.addEventListener('focusout', event => {
    if (!header.contains(event.relatedTarget)) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', () => closeMenu());
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });

  const form = document.getElementById('contact-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = form.elements.namedItem('name');
    const message = form.elements.namedItem('message');
    [name, message].forEach(field => {
      field.setCustomValidity(field.value.trim() ? '' : 'Please enter a value.');
    });
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = `Project enquiry from ${String(data.get('name')).trim()}`;
    const body = [
      `Name: ${String(data.get('name')).trim()}`,
      `Email: ${data.get('email')}`,
      `Project: ${data.get('type')}`,
      '', String(data.get('message')).trim()
    ].join('\n');
    document.getElementById('form-status').textContent = 'Your email draft is ready to open. If no app opens, email envision.startup@gmail.com directly. Your details remain here.';
    window.location.href = `mailto:envision.startup@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  });
  document.getElementById('year').textContent = new Date().getFullYear();
  schedule();
})();
