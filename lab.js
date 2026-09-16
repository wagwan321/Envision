(() => {
  'use strict';
  const root = document.documentElement;
  const dialog = document.getElementById('possibility-dialog');
  const section = document.getElementById('studio-lab');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const next = document.getElementById('lab-next');
  const back = document.getElementById('lab-back');
  const hint = document.getElementById('lab-choice-hint');
  const panels = [...dialog.querySelectorAll('[data-step]')];
  const steps = [...dialog.querySelectorAll('.lab-steps li')];
  const minutes = document.getElementById('lab-minutes');
  const frequency = document.getElementById('lab-frequency');
  const reduction = document.getElementById('lab-reduction');
  const directions = {
    web: { name:'A standout website', type:'Website or e-commerce', action:'Explore my website', meaning:'A clearer website could answer questions, guide enquiries, or make ordering easier.', tasks:[['Answering the same questions','The answers your customers need, again and again.'],['Handling orders manually','Messages, order details, and back-and-forth.'],['Following up enquiries','Helping interested visitors take the next step.']] },
    software: { name:'Smarter software', type:'Custom software', action:'Find my flow', meaning:'A tool built around your workflow could give your team more time for work that matters.', tasks:[['Moving data between tools','Copying, pasting, checking, and doing it all again.'],['Building reports by hand','Gathering numbers before you can act on them.'],['Chasing team updates','Finding the latest status across scattered places.']] },
    ai: { name:'A little AI magic', type:'AI or automation', action:'Explore the possibilities', meaning:'Thoughtful automation could take a repeatable task off your plate, with your team in control.', tasks:[['Sorting incoming messages','Reading, routing, and preparing the next response.'],['Entering repetitive data','Turning the same information into another record.'],['Finding the right information','Searching documents for answers your team needs.']] },
    video: { name:'A story in motion', type:'Video or virtual tour', action:'Bring my story to life', meaning:'A useful film or virtual tour could help people understand your offering before a conversation.', tasks:[['Repeating product demos','Explaining the same features on every call.'],['Giving introductory tours','Showing the same space to every new visitor.'],['Explaining what you offer','Helping people picture the value of your work.']] }
  };
  let step = 0;
  let direction = null;
  let taskIndex = null;
  let returnFocus = null;
  let countFrame = 0;
  let activeTransition;
  let sceneAnimations = [];
  let suppressAutoUntil = 0;
  let scrollIntentUntil = 0;
  let scrollFrame = 0;
  let previousScroll = scrollY;
  let autoSeen = false;
  try { autoSeen = sessionStorage.getItem('envision-lab-seen') === 'yes'; } catch (_) {}
  const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits:1 });
  const format = number => numberFormat.format(number);
  function values() {
    const annual = Number(minutes.value) * Number(frequency.value) * 52 / 60;
    return { annual, saved:annual * Number(reduction.value) / 100 };
  }
  function updateNumbers() {
    const { annual } = values();
    document.getElementById('baseline-hours').value = format(annual);
    document.getElementById('baseline-days').textContent = format(annual / 8);
    document.getElementById('lab-minutes-label').value = `${minutes.value} min`;
    document.getElementById('lab-frequency-label').value = `${frequency.value} ${frequency.value === '1' ? 'time' : 'times'}`;
    document.getElementById('lab-reduction-label').value = `${reduction.value}%`;
    minutes.setAttribute('aria-valuetext', `${minutes.value} minutes per task`);
    frequency.setAttribute('aria-valuetext', `${frequency.value} times per week`);
    reduction.setAttribute('aria-valuetext', `${reduction.value} percent scenario reduction`);
    [minutes,frequency,reduction].forEach(input => input.style.setProperty('--fill', `${(input.value-input.min)/(input.max-input.min)*100}%`));
  }
  [minutes,frequency,reduction].forEach(input => input.addEventListener('input', updateNumbers));

  function setNext(text, disabled) {
    next.replaceChildren(document.createTextNode(text));
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true'); next.append(arrow);
    next.disabled = disabled;
  }
  function updateControls() {
    back.hidden = step === 0;
    steps.forEach((item,index) => {
      item.classList.toggle('is-complete', index < step);
      if(index === step) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current');
    });
    if(step === 0) {
      setNext(direction ? directions[direction].action : 'Choose your direction', !direction);
      hint.textContent = direction ? `${directions[direction].name}. Let’s see where it could take you.` : 'Choose a direction to begin.';
    } else if(step === 1) {
      setNext('See what it adds up to', taskIndex === null);
      hint.textContent = taskIndex === null ? 'Choose one everyday task to explore.' : 'One small part of your day. A bigger opportunity.';
    } else if(step === 2) {
      setNext('Reveal my possibility', false);
      hint.textContent = 'Adjust the estimates, then reveal your scenario.';
    } else {
      setNext('Make this my next chapter', false);
      hint.textContent = 'Your choices become the start of a conversation.';
    }
  }
  function renderTasks() {
    const container = document.getElementById('friction-options');
    container.replaceChildren(...directions[direction].tasks.map(([title,description],index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'friction-choice';
      button.setAttribute('aria-pressed', String(taskIndex === index));
      const number = document.createElement('span'); number.textContent = `0${index + 1}`;
      const copy = document.createElement('span'); const heading = document.createElement('strong'); heading.textContent = title;
      const detail = document.createElement('small'); detail.textContent = description; copy.append(heading,detail);
      const arrow = document.createElement('b'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
      button.append(number,copy,arrow);
      button.addEventListener('click', () => {
        taskIndex = index;
        [...container.children].forEach((choice,i) => choice.setAttribute('aria-pressed', String(i === index)));
        updateControls();
      });
      return button;
    }));
    document.getElementById('chosen-direction').textContent = directions[direction].name.toUpperCase();
  }
  dialog.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
    if(direction !== button.dataset.direction) taskIndex = null;
    direction = button.dataset.direction;
    dialog.dataset.direction = direction;
    dialog.querySelector('.direction-gallery').classList.add('has-choice');
    dialog.querySelectorAll('[data-direction]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    updateControls();
  }));

  function renderResult() {
    const { annual, saved } = values();
    const days = format(saved / 8);
    document.getElementById('result-summary').textContent = `${format(saved)} hours a year. That’s ${days} eight-hour working days you could recover.`;
    document.getElementById('result-meaning').textContent = directions[direction].meaning;
    document.getElementById('result-baseline').textContent = `${format(annual)} h / year`;
    document.getElementById('result-reduction').textContent = `${reduction.value}%`;
    document.getElementById('result-recovered').textContent = `${format(saved)} h / year`;
    const counter = document.getElementById('result-animated');
    cancelAnimationFrame(countFrame);
    if(motion.matches) { counter.textContent = format(saved); return; }
    const started = performance.now();
    let lastPaint = 0;
    let lastText = '';
    function count(time) {
      const progress = Math.min(1, (time-started)/1400);
      // A numeric readout needs fewer paints than the surrounding motion.
      if(time-lastPaint >= 32 || progress === 1) {
        const text = format(saved * (1-Math.pow(1-progress,3)));
        if(text !== lastText) { counter.textContent = text; lastText = text; }
        lastPaint = time;
      }
      if(progress < 1 && dialog.open) countFrame = requestAnimationFrame(count);
    }
    counter.textContent = '0';
    countFrame = requestAnimationFrame(count);
  }
  function showStep(index, focus = true) {
    step = index;
    cancelAnimationFrame(countFrame);
    if(activeTransition) activeTransition.cancel();
    sceneAnimations.forEach(animation => animation.cancel());
    sceneAnimations = [];
    panels.forEach((panel,i) => { panel.hidden = i !== step; });
    const panel = panels[step];
    dialog.dataset.step = String(step);
    if(step === 1) renderTasks();
    if(step === 2) document.getElementById('measured-task').textContent = directions[direction].tasks[taskIndex][0].toUpperCase();
    if(step === 3) renderResult();
    updateControls();
    dialog.setAttribute('aria-labelledby', panel.getAttribute('aria-labelledby'));
    dialog.scrollTo({ top:0, behavior:'instant' });
    document.getElementById('lab-stage').scrollTo({top:0, behavior:'instant'});
    if(!motion.matches && typeof panel.animate === 'function') {
      activeTransition = panel.animate([
        {opacity:0, transform:'translateY(18px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration:500, easing:'cubic-bezier(.2,.75,.2,1)'});
      if(step === 0) panel.querySelectorAll('.artifact').forEach((object,i) => sceneAnimations.push(object.animate([
        {opacity:0, transform:'translateY(24px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration:700, delay:i*60, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards'})));
      if(step === 1) panel.querySelectorAll('.friction-choice').forEach((choice,i) => sceneAnimations.push(choice.animate([
        {opacity:0, transform:'translateX(30px)'}, {opacity:1, transform:'translateX(0)'}
      ], {duration:500, delay:60+i*70, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards'})));
      if(step === 3) panel.querySelectorAll('.result-orbit>i').forEach((ring,i) => sceneAnimations.push(ring.animate([
        {opacity:0, rotate:`${-25-i*15}deg`}, {opacity:1, rotate:'0deg'}
      ], {duration:1000+i*120, easing:'cubic-bezier(.2,.75,.2,1)'})));
    }
    if(focus) panel.querySelector('h2').focus({preventScroll:true});
  }
  function markSeen() {
    autoSeen = true;
    try { sessionStorage.setItem('envision-lab-seen','yes'); } catch (_) {}
  }
  function openLab() {
    if(dialog.open) return;
    if(document.querySelector('dialog[open]')) return;
    markSeen();
    returnFocus = document.activeElement;
    dialog.showModal();
    root.classList.add('lab-open');
    document.dispatchEvent(new CustomEvent('envision:lab-visibility',{detail:{open:true}}));
    showStep(step);
  }
  function closeLab(explore = false) {
    if(!dialog.open) return;
    dialog.close();
    if(explore) {
      const target = document.getElementById('work');
      target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
      target.scrollIntoView({behavior:motion.matches ? 'instant' : 'smooth'});
    }
  }
  dialog.addEventListener('close', () => {
    root.classList.remove('lab-open');
    document.dispatchEvent(new CustomEvent('envision:lab-visibility',{detail:{open:false}}));
    cancelAnimationFrame(countFrame);
    if(activeTransition) activeTransition.cancel();
    sceneAnimations.forEach(animation => animation.cancel());
    sceneAnimations = [];
    if(returnFocus && returnFocus !== document.body && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
  });
  // Native Escape closes the modal. Explicit exits also move past the lab.
  dialog.querySelectorAll('[data-lab-close]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); returnFocus = null; closeLab(true); }));
  back.addEventListener('click', () => { if(step > 0) showStep(step-1); });
  next.addEventListener('click', () => {
    if(next.disabled) return;
    if(step < 3) { showStep(step+1); return; }
    const { annual, saved } = values();
    const choice = directions[direction];
    const brief = [
      `I’d like to explore: ${choice.name}.`,
      `The task I want to improve: ${choice.tasks[taskIndex][0]}.`,
      `My estimate: ${minutes.value} minutes per task, ${frequency.value} ${frequency.value === '1' ? 'time' : 'times'} per week.`,
      `Current time spent: ${format(annual)} hours a year (52 weeks).`,
      `Scenario to investigate: ${reduction.value}% less time, potentially ${format(saved)} hours recovered a year.`,
      'These are my estimates, not a guaranteed outcome.', '', 'A little about my business: '
    ].join('\n');
    returnFocus = null;
    closeLab();
    document.dispatchEvent(new CustomEvent('envision:enquiry', {detail:{type:choice.type,brief}}));
  });
  document.querySelectorAll('[data-lab-open]').forEach(button => { button.disabled = false; button.addEventListener('click',openLab); });
  // Honor deliberate navigation past the lab, including smooth-scrolling anchors.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if(!link || dialog.contains(link)) return;
    if(link.getAttribute('href') === '#studio-lab') {
      event.preventDefault();
      requestAnimationFrame(openLab);
    } else suppressAutoUntil = performance.now()+2200;
  });
  function onScroll() {
    scrollFrame = 0;
    const movingDown = scrollY > previousScroll;
    previousScroll = scrollY;
    if(autoSeen || !movingDown || performance.now()>scrollIntentUntil || performance.now()<suppressAutoUntil || root.classList.contains('intro-pending') || document.querySelector('dialog[open]')) return;
    const bounds = section.getBoundingClientRect();
    if(bounds.top <= innerHeight*.25 && bounds.bottom >= innerHeight*.55) openLab();
  }
  // Scroll restoration and programmatic navigation are not an invitation to take focus.
  // Wheel, touch, keyboard, and scrollbar gestures arm the arrival for a short window.
  function armArrival() { scrollIntentUntil = performance.now()+1800; }
  window.addEventListener('wheel', event => { if(event.deltaY>0) armArrival(); }, {passive:true});
  let touchY = null;
  window.addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY ?? null; }, {passive:true});
  window.addEventListener('touchmove', event => {
    const y = event.touches[0]?.clientY;
    if(touchY !== null && y < touchY) armArrival();
    touchY = y ?? null;
  }, {passive:true});
  window.addEventListener('touchend', () => { touchY = null; }, {passive:true});
  window.addEventListener('pointerdown', event => {
    if(event.clientX >= root.clientWidth-18) armArrival();
  }, {passive:true});
  document.addEventListener('keydown', event => {
    const editing = event.target instanceof Element && (event.target.matches('input,textarea,select,button') || event.target.isContentEditable);
    if(!editing && !event.ctrlKey && !event.metaKey && ['ArrowDown','PageDown',' '].includes(event.key)) armArrival();
  });
  window.addEventListener('scroll', () => { if(!autoSeen && !scrollFrame) scrollFrame = requestAnimationFrame(onScroll); }, {passive:true});
  window.addEventListener('pagehide', () => { returnFocus = null; closeLab(); });
  motion.addEventListener('change', () => {
    if(motion.matches) {
      dialog.getAnimations({subtree:true}).forEach(animation => animation.cancel());
      cancelAnimationFrame(countFrame);
      if(step === 3) document.getElementById('result-animated').textContent = format(values().saved);
    }
  });
  updateNumbers();
  updateControls();
})();
