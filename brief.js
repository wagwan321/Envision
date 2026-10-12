(() => {
  'use strict';
  const root = document.documentElement;
  const dialog = document.getElementById('brief-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const nameLabel = document.getElementById('brief-name');
  const progress = document.getElementById('brief-progress');
  const questionPanel = document.getElementById('brief-question-panel');
  const summaryPanel = document.getElementById('brief-summary-panel');
  const count = document.getElementById('brief-count');
  const heading = document.getElementById('brief-question');
  const hint = document.getElementById('brief-hint');
  const optionList = document.getElementById('brief-options');
  const answerList = document.getElementById('brief-answers');
  const back = document.getElementById('brief-back');
  const next = document.getElementById('brief-next');

  // Options are [label, detail?]. An exclusive option clears the others in a multi-choice question.
  const timeline = { key:'timeline', label:'Timeline', question:'When would you like to get started?', options:[['As soon as possible'],['In the next 1–3 months'],['In 3–6 months'],['Just exploring for now']] };
  const nothingYet = ['Nothing yet','We’d like help with all of it.'];
  const services = {
    web: { name:'Website', type:'Website or e-commerce', option:['A website or online store','Turn visitors into customers.'], questions:[
      { key:'kind', label:'Type of website', question:'What kind of website do you need?', options:[['A new website','For a new business, or one that has never had a site.'],['A redesign','Your current site feels dated or isn’t working for you.'],['An online store','Sell products and take payments online.'],['A landing page','One focused page for a launch, campaign, or event.']] },
      { key:'goals', label:'It should help us', question:'What should it help you do?', multi:true, options:[['Bring in enquiries'],['Sell products online'],['Take bookings or appointments'],['Show what we do and build trust']] },
      { key:'ready', label:'We already have', question:'What do you already have?', multi:true, exclusive:3, options:[['A logo and brand colours'],['Written content'],['Photos or video'],nothingYet] }
    ] },
    software: { name:'Software', type:'Custom software', option:['Custom software','Dashboards, portals, and tools for your team.'], questions:[
      { key:'kind', label:'What we need', question:'What would you like to build?', options:[['A dashboard','See your numbers and your work in one place.'],['A customer portal','Let clients log in, check progress, and manage things themselves.'],['A booking or ordering system','Take bookings, orders, or requests without the back-and-forth.'],['Something else','A tool that doesn’t exist yet, or doesn’t fit you yet.']] },
      { key:'users', label:'Who will use it', question:'Who will use it?', multi:true, options:[['Our team'],['Our customers'],['Partners or suppliers'],['The public']] },
      { key:'today', label:'How it’s done today', question:'How do you handle this today?', multi:true, exclusive:3, options:[['Spreadsheets'],['Email and paper'],['Software that doesn’t quite fit'],['We don’t do it yet']] }
    ] },
    ai: { name:'AI & automation', type:'AI or automation', option:['AI and automation','Take repetitive tasks off your hands.'], questions:[
      { key:'tasks', label:'Tasks to take off our plate', question:'What would you like to spend less time on?', multi:true, options:[['Answering customer messages','Sorting enquiries and preparing replies.'],['Typing the same information twice','Moving details between forms, tools, and spreadsheets.'],['Finding answers in documents','Searching files and policies for the right detail.'],['Writing reports and summaries','Turning notes and numbers into updates.']] },
      { key:'where', label:'Where the work happens', question:'Where does that work happen today?', multi:true, options:[['Email'],['Spreadsheets and documents'],['Business software or a CRM'],['Chat apps like WhatsApp or Slack']] },
      { key:'hours', label:'Time it takes each week', question:'Roughly how much time does it take each week?', options:[['Under 2 hours'],['2–5 hours'],['5–10 hours'],['More than 10 hours']] }
    ] },
    video: { name:'Video & virtual tours', type:'Video or virtual tour', option:['Video or a virtual tour','Give customers a closer look.'], questions:[
      { key:'kind', label:'What we’d like', question:'What would you like to create?', options:[['A brand or product film','Show what you make and why it matters.'],['An explainer or animation','Make something complex easy to understand.'],['A virtual tour','Let people explore a space before they visit.'],['Short clips for social media','Quick, eye-catching videos for your channels.']] },
      { key:'channels', label:'Where people will see it', question:'Where will people watch it?', multi:true, options:[['On our website'],['Social media'],['Ads'],['Presentations and events']] },
      { key:'ready', label:'We already have', question:'What do you already have?', multi:true, exclusive:3, options:[['A script or key message'],['Footage or photos'],['A space or product ready to film'],nothingYet] }
    ] }
  };
  const serviceKeys = Object.keys(services);
  const picker = { key:'service', label:'Service', question:'What can we help you with?', options:serviceKeys.map(key => services[key].option) };

  let service = null;
  let usePicker = true;
  let step = 0;
  let reviewing = false;
  const answers = {};
  let returnFocus = null;
  let advanceTimer = 0;
  let animations = [];

  const flow = () => service ? [...(usePicker ? [picker] : []), ...services[service].questions, timeline] : [picker];
  const chosen = question => {
    if (question === picker) return service ? [serviceKeys.indexOf(service)] : [];
    return answers[service]?.[question.key] ?? [];
  };
  const describe = question => chosen(question).map(index => question.options[index][0]).join(', ');

  function select(question, index) {
    if (question === picker) {
      service = serviceKeys[index];
      return;
    }
    const store = answers[service] ??= {};
    let picked = store[question.key] ?? [];
    if (!question.multi) picked = [index];
    else if (picked.includes(index)) picked = picked.filter(item => item !== index);
    else if (index === question.exclusive) picked = [index];
    else picked = [...picked.filter(item => item !== question.exclusive), index].sort();
    store[question.key] = picked;
  }

  function renderOptions(question) {
    const picked = chosen(question);
    optionList.dataset.multi = String(Boolean(question.multi));
    optionList.replaceChildren(...question.options.map(([label, detail], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'brief-option';
      button.setAttribute('aria-pressed', String(picked.includes(index)));
      const key = document.createElement('span');
      key.className = 'brief-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = String.fromCharCode(65 + index);
      const copy = document.createElement('span');
      copy.className = 'brief-option-copy';
      const title = document.createElement('strong');
      title.textContent = label;
      copy.append(title);
      if (detail) {
        const small = document.createElement('small');
        small.textContent = detail;
        copy.append(small);
      }
      const check = document.createElement('span');
      check.className = 'brief-check';
      check.setAttribute('aria-hidden', 'true');
      button.append(key, copy, check);
      button.addEventListener('click', () => choose(question, index));
      return button;
    }));
  }

  function choose(question, index) {
    clearTimeout(advanceTimer);
    select(question, index);
    const picked = chosen(question);
    [...optionList.children].forEach((option, i) => option.setAttribute('aria-pressed', String(picked.includes(i))));
    updateFooter();
    // A single answer moves straight on; multiple answers wait for Next.
    if (!question.multi) advanceTimer = setTimeout(() => go(step + 1), motion.matches ? 0 : 280);
  }

  function renderSummary() {
    const rows = flow().filter(question => question !== picker);
    const serviceRow = document.createElement('div');
    // A different service brings new questions, so that change walks through them.
    serviceRow.append(term('Service'), detail(services[service].name), change(() => { usePicker = true; go(0); }, 'service'));
    answerList.replaceChildren(serviceRow, ...rows.map(question => {
      const row = document.createElement('div');
      row.append(term(question.label), detail(describe(question)), change(() => { reviewing = true; go(flow().indexOf(question)); }, question.label.toLowerCase()));
      return row;
    }));
  }
  function term(text) { const dt = document.createElement('dt'); dt.textContent = text; return dt; }
  function detail(text) { const dd = document.createElement('dd'); dd.textContent = text; return dd; }
  function change(action, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brief-change';
    button.textContent = 'Change';
    button.setAttribute('aria-label', `Change ${name}`);
    button.addEventListener('click', action);
    return button;
  }

  function updateFooter() {
    const questions = flow();
    const onSummary = step >= questions.length;
    back.hidden = step === 0;
    let label = 'Next';
    let arrow = '→';
    let ready = true;
    if (onSummary) { label = 'Add to my enquiry'; arrow = '↗'; }
    else {
      ready = chosen(questions[step]).length > 0;
      if (reviewing || (step === questions.length - 1 && service)) label = 'Review my brief';
    }
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = arrow;
    next.replaceChildren(document.createTextNode(label), icon);
    next.disabled = !ready;
  }

  function go(index) {
    clearTimeout(advanceTimer);
    animations.forEach(animation => animation.cancel());
    animations = [];
    const questions = flow();
    // Changing one answer from the summary returns there instead of walking the rest again.
    if (reviewing && index > step) index = questions.length;
    step = Math.max(0, Math.min(index, questions.length));
    const onSummary = step === questions.length;
    if (onSummary) reviewing = false;
    nameLabel.textContent = service && questions[step] !== picker ? `${services[service].name} brief` : 'Project brief';
    // The service picker only counts as a question when the visitor did not arrive from a card.
    const total = (usePicker ? 1 : 0) + services.web.questions.length + 1;
    progress.style.transform = `scaleX(${onSummary ? 1 : step / total})`;
    questionPanel.hidden = onSummary;
    summaryPanel.hidden = !onSummary;
    let panel = summaryPanel;
    if (onSummary) renderSummary();
    else {
      const question = questions[step];
      panel = questionPanel;
      count.textContent = `QUESTION ${step + 1} OF ${total}`;
      heading.textContent = question.question;
      hint.textContent = question.multi ? 'Choose all that apply.' : 'Choose one.';
      renderOptions(question);
    }
    dialog.setAttribute('aria-labelledby', onSummary ? 'brief-summary-title' : 'brief-question');
    updateFooter();
    document.getElementById('brief-stage').scrollTo({ top:0, behavior:'instant' });
    if (!motion.matches && typeof panel.animate === 'function') {
      animations.push(panel.animate([{ opacity:0, transform:'translateY(14px)' }, { opacity:1, transform:'none' }], { duration:420, easing:'cubic-bezier(.2,.75,.2,1)' }));
      panel.querySelectorAll('.brief-option,.brief-answers>div').forEach((item, i) => animations.push(item.animate(
        [{ opacity:0, transform:'translateY(10px)' }, { opacity:1, transform:'none' }],
        { duration:380, delay:60 + i * 45, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards' }
      )));
    }
    panel.querySelector('h2').focus({ preventScroll:true });
  }

  function openBrief(key, trigger) {
    if (dialog.open || document.querySelector('dialog[open]')) return;
    if (key && services[key]) { service = key; usePicker = false; }
    else usePicker = true;
    reviewing = false;
    // A trigger inside another dialog (quick navigation) has already closed with it.
    returnFocus = trigger && !trigger.closest('dialog') ? trigger : document.activeElement;
    dialog.showModal();
    root.classList.add('brief-open');
    document.dispatchEvent(new CustomEvent('envision:brief-visibility', { detail:{ open:true } }));
    go(0);
  }

  function sendBrief() {
    const questions = flow().filter(question => question !== picker);
    const brief = [
      `Project brief: ${services[service].name}`,
      ...questions.map(question => `${question.label}: ${describe(question)}`),
      '', 'A little more about my business: '
    ].join('\n');
    returnFocus = null;
    dialog.close();
    document.dispatchEvent(new CustomEvent('envision:enquiry', { detail:{ type:services[service].type, brief } }));
  }

  dialog.addEventListener('close', () => {
    clearTimeout(advanceTimer);
    animations.forEach(animation => animation.cancel());
    animations = [];
    root.classList.remove('brief-open');
    document.dispatchEvent(new CustomEvent('envision:brief-visibility', { detail:{ open:false } }));
    if (returnFocus && returnFocus !== document.body && returnFocus.isConnected) returnFocus.focus({ preventScroll:true });
    returnFocus = null;
  });
  dialog.querySelector('[data-brief-close]').addEventListener('click', () => dialog.close());
  back.addEventListener('click', () => { if (step > 0) go(step - 1); });
  next.addEventListener('click', () => {
    if (next.disabled) return;
    if (step >= flow().length) sendBrief();
    else go(step + 1);
  });
  // Letter keys pick the matching answer, as shown on each option.
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || questionPanel.hidden || event.key.length !== 1) return;
    const option = optionList.children[event.key.toUpperCase().charCodeAt(0) - 65];
    if (option) { event.preventDefault(); option.click(); option.focus(); }
  });
  // Service cards, the hero, the dock, and quick navigation all open the brief. Without
  // script, each trigger is an ordinary link to the services or contact section.
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-brief]');
    if (!trigger || dialog.contains(trigger)) return;
    event.preventDefault();
    openBrief(trigger.dataset.brief, trigger);
  });
  window.addEventListener('pagehide', () => { returnFocus = null; if (dialog.open) dialog.close(); });
  motion.addEventListener('change', () => { if (motion.matches) dialog.getAnimations({ subtree:true }).forEach(animation => animation.finish()); });
})();
