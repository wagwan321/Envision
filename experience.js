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

  function finishIntro(immediate = false) {
    if (!root.classList.contains('intro-pending')) return;
    clearTimeout(introTimer);
    clearTimeout(exitTimer);
    clearTimeout(window.envisionIntroFallback);
    const leave = () => {
      root.classList.remove('intro-pending');
      loader.classList.remove('is-leaving');
      loader.setAttribute('aria-hidden', 'true');
      try { sessionStorage.setItem('envision-intro', 'seen'); } catch (_) {}
      if (replayTarget) { replayTarget.focus({ preventScroll:true }); replayTarget = null; }
    };
    if (immediate || reducedMotion.matches) leave();
    else { loader.classList.add('is-leaving'); exitTimer = setTimeout(leave, 650); }
  }

  function startIntro(replay = false) {
    if (!replay && !root.classList.contains('intro-pending')) return;
    clearTimeout(window.envisionIntroFallback);
    clearTimeout(introTimer);
    clearTimeout(exitTimer);
    root.classList.add('intro-pending');
    loader.classList.remove('is-leaving');
    loader.setAttribute('aria-hidden', 'false');
    introStarted = performance.now();
    const run = ++introRun;
    let completed = 0;
    const labels = ['Connecting the dots', 'Finding our form', 'Bringing it together', 'Ready when you are'];
    const update = () => {
      if (run !== introRun) return;
      const progress = Math.round(completed / 3 * 100);
      document.getElementById('loader-progress').style.transform = `scaleX(${progress / 100})`;
      document.getElementById('loader-count').textContent = String(progress).padStart(2, '0');
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
      if (completed === gates.length) {
        clearTimeout(introTimer);
        introTimer = setTimeout(() => finishIntro(), Math.max(0, 1500 - (performance.now() - introStarted)));
      }
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

  const directions = {
    web: { title:'An experience worth clicking.', description:'A focused website or store, built around your brand and the action you want visitors to take.', tags:['Strategy', 'Design', 'Development'], type:'Website or e-commerce', brief:'I’d like to create a website or online store. My business is…\n\nThe main thing I want visitors to do is…' },
    software: { title:'Your workflow. Without the friction.', description:'A portal, dashboard, or custom tool that puts your team’s everyday work in one clear place.', tags:['Workflow mapping', 'Product design', 'Engineering'], type:'Custom software', brief:'I’d like a custom tool for my business. My team currently uses…\n\nThe workflow we want to improve is…' },
    ai: { title:'More human time. Less busywork.', description:'Start with one repetitive task. Explore where a thoughtful AI assistant or automation could help.', tags:['Workflow audit', 'Automation', 'Human oversight'], type:'AI or automation', brief:'I’d like to explore AI or automation. The repetitive task we spend time on is…\n\nOur current process is…' },
    video: { title:'Make them stop. Then look closer.', description:'A product film, motion story, or virtual tour that gives people a new way to experience your business.', tags:['Creative direction', 'Motion', 'Immersive experiences'], type:'Video or virtual tour', brief:'I’d like a video or virtual tour. The product, space, or story I want to share is…\n\nThe audience I want to reach is…' }
  };
  let direction = 'web';
  document.querySelectorAll('[name="project-direction"]').forEach(radio => radio.addEventListener('change', () => {
    direction = radio.value;
    const choice = directions[direction];
    document.getElementById('brief-title').textContent = choice.title;
    document.getElementById('brief-description').textContent = choice.description;
    document.getElementById('brief-tags').replaceChildren(...choice.tags.map(text => {
      const tag = document.createElement('span'); tag.textContent = text; return tag;
    }));
    document.getElementById('brief-feedback').textContent = 'Your selection becomes the start of your enquiry.';
  }));

  const form = document.getElementById('contact-form');
  let lastGeneratedBrief = '';
  function prepareEnquiry(type, brief) {
    const message = form.elements.namedItem('message');
    const hasOwnMessage = message.value.trim() && message.value !== lastGeneratedBrief;
    // Respect a visitor’s own draft; only replace text generated by this widget.
    if (!hasOwnMessage) {
      message.value = brief;
      message.setCustomValidity('');
      lastGeneratedBrief = brief;
      form.elements.namedItem('type').value = type;
    }
    const feedback = hasOwnMessage ? 'Your existing enquiry has been kept. Add any new details before sending.' : 'Your starting point is ready below. Add your details and make it yours.';
    document.getElementById('brief-feedback').textContent = feedback;
    document.getElementById('form-status').textContent = feedback;
    document.getElementById('contact').scrollIntoView({ behavior:reducedMotion.matches ? 'instant' : 'smooth' });
    form.elements.namedItem('name').focus({ preventScroll:true });
  }
  document.getElementById('use-brief').addEventListener('click', () => prepareEnquiry(directions[direction].type, directions[direction].brief));

  const minutes = document.getElementById('task-minutes');
  const frequency = document.getElementById('task-frequency');
  function updateSavings() {
    const hours = Number(minutes.value) * Number(frequency.value) * 52 / 60;
    document.getElementById('savings-hours').value = Math.round(hours).toLocaleString('en');
    document.getElementById('minutes-label').value = `${minutes.value} min`;
    document.getElementById('frequency-label').value = `${frequency.value} ${frequency.value === '1' ? 'time' : 'times'}`;
    minutes.setAttribute('aria-valuetext', `${minutes.value} minutes per task`);
    frequency.setAttribute('aria-valuetext', `${frequency.value} times per week`);
    [minutes, frequency].forEach(input => input.style.setProperty('--range-fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`));
    document.querySelectorAll('.time-bars>span').forEach((bar, index) => {
      const growth = Math.min(1, hours / 2080);
      bar.style.setProperty('--bar-height', `${18 + ((index + 1) / 20) * (35 + growth * 47)}%`);
    });
  }
  minutes.addEventListener('input', updateSavings);
  frequency.addEventListener('input', updateSavings);
  updateSavings();
  document.getElementById('discuss-automation').addEventListener('click', event => {
    event.preventDefault();
    prepareEnquiry('AI or automation', `I’d like to explore automating a task that takes about ${minutes.value} minutes, ${frequency.value} ${frequency.value === '1' ? 'time' : 'times'} per week.\n\nThe task is…\n\nOur current process is…`);
  });

  const palettes = [...document.querySelectorAll('.palette-options button')];
  palettes.forEach(button => button.addEventListener('click', () => {
    document.getElementById('palette-preview').dataset.palette = button.dataset.palette;
    palettes.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  }));

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
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !editing) {
      event.preventDefault();
      if (dialog.open) dialog.close(); else openCommands();
    }
  });

  const dock = document.querySelector('.studio-dock');
  let dockFrame;
  function updateDock() {
    dockFrame = null;
    const contactTop = document.getElementById('contact').getBoundingClientRect().top;
    const labBounds = document.getElementById('studio-lab').getBoundingClientRect();
    const exploringLab = labBounds.top < innerHeight * .7 && labBounds.bottom > innerHeight * .2;
    dock.classList.toggle('is-visible', scrollY > innerHeight * .45 && contactTop > innerHeight * .65 && !exploringLab);
  }
  function scheduleDock() { if (!dockFrame) dockFrame = requestAnimationFrame(updateDock); }
  window.addEventListener('scroll', scheduleDock, { passive:true });
  window.addEventListener('resize', scheduleDock, { passive:true });
  window.addEventListener('pageshow', scheduleDock);
  updateDock();
})();
