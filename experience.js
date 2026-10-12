(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = document.getElementById('site-loader');
  const status = document.getElementById('loader-status');
  let introTimer;
  let exitTimer;
  let introStarted = performance.now();
  let replayTarget = null;
  let introRun = 0;
  let progressFrame = 0;
  let displayedProgress = 0;
  const progressTrack = document.getElementById('loader-progress');
  const progressCount = document.getElementById('loader-count');

  function animateProgress(target, run) {
    cancelAnimationFrame(progressFrame);
    const from = displayedProgress;
    let started = null;
    let preparationFrames = 2;
    let lastNumber = Math.floor(from);
    function paint(now) {
      if(run !== introRun || !root.classList.contains('intro-pending')) return;
      // Let the newly visible overlay paint before starting the numeric timeline.
      if(!reducedMotion.matches && preparationFrames-- > 0) {
        progressFrame = requestAnimationFrame(paint);
        return;
      }
      if(started === null) started = now;
      const elapsed = reducedMotion.matches ? 1 : Math.min(1, (now-started)/650);
      displayedProgress = from+(target-from)*(1-Math.pow(1-elapsed,3));
      progressTrack.style.transform = `scaleX(${displayedProgress/100})`;
      const number = Math.floor(displayedProgress);
      if(number !== lastNumber) { progressCount.textContent = String(number).padStart(2,'0'); lastNumber = number; }
      if(elapsed < 1) progressFrame = requestAnimationFrame(paint);
      else {
        progressFrame = 0;
        if(target === 100) {
          clearTimeout(introTimer);
          introTimer = setTimeout(() => finishIntro(), Math.max(180,1500-(performance.now()-introStarted)));
        }
      }
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
      root.classList.remove('intro-pending');
      loader.classList.remove('is-leaving');
      loader.setAttribute('aria-hidden', 'true');
      document.dispatchEvent(new CustomEvent('envision:intro-visibility',{detail:{open:false}}));
      try { sessionStorage.setItem('envision-intro', 'seen'); } catch (_) {}
      if (replayTarget) { replayTarget.focus({ preventScroll:true }); replayTarget = null; }
    };
    if (immediate || reducedMotion.matches) leave();
    else { loader.classList.add('is-leaving'); exitTimer = setTimeout(leave, 600); }
  }

  function startIntro(replay = false) {
    if (!replay && !root.classList.contains('intro-pending')) return;
    clearTimeout(window.envisionIntroFallback);
    clearTimeout(introTimer);
    clearTimeout(exitTimer);
    cancelAnimationFrame(progressFrame);
    root.classList.add('intro-pending');
    loader.classList.remove('is-leaving');
    loader.setAttribute('aria-hidden', 'false');
    document.dispatchEvent(new CustomEvent('envision:intro-visibility',{detail:{open:true}}));
    displayedProgress = 0;
    progressTrack.style.transform = 'scaleX(0)';
    progressCount.textContent = '00';
    introStarted = performance.now();
    const run = ++introRun;
    let completed = 0;
    const labels = ['Connecting the dots', 'Finding our form', 'Bringing it together', 'Ready when you are'];
    const update = () => {
      if (run !== introRun) return;
      const progress = Math.round(completed / 3 * 100);
      animateProgress(progress, run);
      status.textContent = labels[completed];
    };
    update();
    // Three real readiness gates; the counter is not an invented download estimate.
    const logo = loader.querySelector('img');
    const gates = [Promise.resolve(), document.fonts ? document.fonts.ready : Promise.resolve(), logo.decode ? logo.decode().catch(() => {}) : Promise.resolve()];
    gates.forEach(gate => Promise.resolve(gate).catch(() => {}).then(() => {
      if (run !== introRun || !root.classList.contains('intro-pending')) return;
      completed += 1;
      update();
    }));
    introTimer = setTimeout(() => finishIntro(), 3200);
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
    if(!dockGeometry) dockGeometry = {contactTop:document.getElementById('contact').getBoundingClientRect().top+scrollY, height:innerHeight};
    const {contactTop,height} = dockGeometry;
    dock.classList.toggle('is-visible', scrollY > height*.45 && contactTop-scrollY > height*.65);
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
