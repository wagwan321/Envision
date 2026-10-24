(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = document.getElementById('site-loader');
  const status = document.getElementById('loader-status');
  let introTimer;
  let exitTimer;
  let replayTarget = null;
  let introRun = 0;
  let progressFrame = 0;
  const progressTrack = document.getElementById('loader-progress');
  const progressCount = document.getElementById('loader-count');
  const labels = [[0, 'Connecting the dots'], [30, 'Finding our form'], [62, 'Bringing it together'], [92, 'Ready when you are']];
  const countDuration = 1300;
  const exitDuration = 800;
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // The count is paced, not a download estimate. Each frame advances it by at most 34ms, so a
  // slow frame pauses the count instead of making it jump, and it waits just short of 100 until
  // the fonts and the logo are ready.
  function runCount(run, ready) {
    let elapsed = reducedMotion.matches ? countDuration : 0;
    let last = null;
    let shown = '';
    let label = '';
    function paint(now) {
      if (run !== introRun || !root.classList.contains('intro-pending')) return;
      if (last !== null) elapsed += Math.min(34, now - last);
      last = now;
      if (!ready()) elapsed = Math.min(elapsed, countDuration * .9);
      const linear = Math.min(1, elapsed / countDuration);
      const progress = easeInOut(linear) * 100;
      progressTrack.style.transform = `scaleX(${progress / 100})`;
      const number = String(Math.floor(progress)).padStart(2, '0');
      if (number !== shown) { progressCount.textContent = number; shown = number; }
      const next = labels.filter(([from]) => progress >= from).pop()[1];
      if (next !== label) { status.textContent = next; label = next; }
      if (linear < 1) progressFrame = requestAnimationFrame(paint);
      else { progressFrame = 0; root.classList.add('intro-releasing'); introTimer = setTimeout(() => finishIntro(), 240); }
    }
    progressFrame = requestAnimationFrame(paint);
  }

  function finishIntro(immediate = false) {
    if (!root.classList.contains('intro-pending')) return;
    if (!immediate && loader.classList.contains('is-leaving')) return;
    introRun += 1;
    cancelAnimationFrame(progressFrame);
    clearTimeout(introTimer);
    clearTimeout(exitTimer);
    clearTimeout(window.envisionIntroFallback);
    const leave = () => {
      root.classList.remove('intro-pending', 'intro-releasing');
      loader.classList.remove('is-leaving');
      loader.setAttribute('aria-hidden', 'true');
      document.dispatchEvent(new CustomEvent('envision:intro-visibility',{detail:{open:false}}));
      try { sessionStorage.setItem('envision-intro', 'seen'); } catch (_) {}
      if (replayTarget) { replayTarget.focus({ preventScroll:true }); replayTarget = null; }
    };
    if (immediate || reducedMotion.matches) leave();
    else { loader.classList.add('is-leaving'); exitTimer = setTimeout(leave, exitDuration + 20); }
  }

  function startIntro(replay = false) {
    if (!replay && !root.classList.contains('intro-pending')) return;
    clearTimeout(window.envisionIntroFallback);
    clearTimeout(introTimer);
    clearTimeout(exitTimer);
    cancelAnimationFrame(progressFrame);
    root.classList.remove('intro-releasing');
    root.classList.add('intro-pending');
    loader.classList.remove('is-leaving');
    loader.setAttribute('aria-hidden', 'false');
    document.dispatchEvent(new CustomEvent('envision:intro-visibility',{detail:{open:true}}));
    progressTrack.style.transform = 'scaleX(0)';
    progressCount.textContent = '00';
    status.textContent = labels[0][1];
    const run = ++introRun;
    const begun = performance.now();
    let assetsReady = false;
    const logo = loader.querySelector('img');
    Promise.all([document.fonts ? document.fonts.ready : null, logo.decode ? logo.decode().catch(() => {}) : null])
      .catch(() => {}).then(() => { assetsReady = true; });
    // A slow font never holds the intro for long.
    runCount(run, () => assetsReady || performance.now() - begun > 2600);
    if (replay) document.getElementById('skip-intro').focus({ preventScroll:true });
  }

  document.getElementById('skip-intro').addEventListener('click', () => finishIntro(true));
  document.querySelectorAll('[data-replay-intro]').forEach(button => button.addEventListener('click', () => {
    replayTarget = button;
    startIntro(true);
  }));
  document.addEventListener('focusin', event => {
    if (root.classList.contains('intro-pending') && !loader.contains(event.target)) finishIntro(true);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finishIntro(true); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finishIntro(true); });
  window.addEventListener('pagehide', () => finishIntro(true));
  startIntro();

  const form = document.getElementById('contact-form');
  let lastGeneratedBrief = '';
  document.addEventListener('envision:enquiry', event => {
    const message = form.elements.namedItem('message');
    const hasOwnMessage = message.value.trim() && message.value !== lastGeneratedBrief;
    if (!hasOwnMessage) {
      message.value = event.detail.brief;
      message.rows = Math.min(10, event.detail.brief.split('\n').length + 1);
      message.setCustomValidity('');
      lastGeneratedBrief = event.detail.brief;
      form.elements.namedItem('type').value = event.detail.type;
    }
    document.getElementById('form-status').textContent = hasOwnMessage
      ? 'Your existing message has been kept. Add your brief to it if you would like.'
      : 'Your brief has been added to your message. Add your name and email, then send it.';
    document.dispatchEvent(new CustomEvent('envision:prime-layout'));
    document.getElementById('contact').scrollIntoView({ behavior:reducedMotion.matches ? 'instant' : 'smooth' });
    form.elements.namedItem('name').focus({ preventScroll:true });
  });

  const dialog = document.getElementById('command-dialog');
  const search = document.getElementById('command-search');
  const commands = [...dialog.querySelectorAll('.command-links a')];
  let commandTrigger;
  function filterCommands() {
    const query = search.value.trim().toLowerCase();
    commands.forEach(link => { link.hidden = !link.textContent.toLowerCase().includes(query); });
    dialog.querySelector('.command-empty').hidden = commands.some(link => !link.hidden);
  }
  function openCommands() {
    finishIntro(true);
    if (dialog.open) return;
    commandTrigger = document.activeElement;
    search.value = '';
    filterCommands();
    dialog.showModal();
    search.focus();
  }
  document.getElementById('open-command').addEventListener('click', openCommands);
  document.getElementById('close-command').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (commandTrigger) commandTrigger.focus({ preventScroll:true }); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  commands.forEach(link => link.addEventListener('click', () => {
    commandTrigger = null;
    dialog.close();
    const target = document.querySelector(link.getAttribute('href'));
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll:true });
  }));
  search.addEventListener('input', filterCommands);
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); commands.find(link => !link.hidden)?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); commands.find(link => !link.hidden)?.click(); }
  });
  document.addEventListener('keydown', event => {
    const editing = event.target instanceof Element && (event.target.matches('input,textarea,select') || event.target.isContentEditable);
    if (document.getElementById('brief-dialog')?.open) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !editing) {
      event.preventDefault();
      if (dialog.open) dialog.close(); else openCommands();
    }
  });

  const dock = document.querySelector('.studio-dock');
  let dockFrame;
  let dockGeometry;
  let dockHiddenByBrief = false;
  function updateDock() {
    dockFrame = null;
    if(dockHiddenByBrief) return;
    if(!dockGeometry) {
      const clients = document.querySelector('.clients')?.getBoundingClientRect();
      dockGeometry = {contactTop:document.getElementById('contact').getBoundingClientRect().top+scrollY, clientsTop:clients ? clients.top+scrollY : 0, clientsBottom:clients ? clients.bottom+scrollY : 0, height:innerHeight};
    }
    const {contactTop,clientsTop,clientsBottom,height} = dockGeometry;
    // The client slideshow has its own controls along the bottom, so the dock steps aside for it.
    const previewing = clientsTop-scrollY < height*.85 && clientsBottom-scrollY > height*.15;
    dock.classList.toggle('is-visible', scrollY > height*.45 && contactTop-scrollY > height*.65 && !previewing);
  }
  function scheduleDock() { if (!dockHiddenByBrief && !dockFrame) dockFrame = requestAnimationFrame(updateDock); }
  function invalidateDock() { dockGeometry = null; scheduleDock(); }
  window.addEventListener('scroll', scheduleDock, { passive:true });
  window.addEventListener('resize', invalidateDock, { passive:true });
  window.addEventListener('pageshow', invalidateDock);
  if('ResizeObserver' in window) new ResizeObserver(invalidateDock).observe(document.body);
  if(document.fonts) document.fonts.ready.then(invalidateDock);
  document.addEventListener('envision:brief-visibility', event => {
    dockHiddenByBrief = event.detail.open;
    if(dockHiddenByBrief) { cancelAnimationFrame(dockFrame); dockFrame = null; }
    else invalidateDock();
  });
  updateDock();
})();
