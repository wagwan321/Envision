(() => {
  'use strict';
  const root = document.documentElement;
  const dialog = document.getElementById('brief-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const byId = id => document.getElementById(id);
  const nameLabel = byId('brief-name');
  const stepList = byId('brief-steps');
  const questionPanel = byId('brief-question-panel');
  const summaryPanel = byId('brief-summary-panel');
  const count = byId('brief-count');
  const numeral = byId('brief-numeral');
  const heading = byId('brief-question');
  const summaryTitle = byId('brief-summary-title');
  const hint = byId('brief-hint');
  const tip = byId('brief-tip');
  const optionList = byId('brief-options');
  const answerList = byId('brief-answers');
  const back = byId('brief-back');
  const next = byId('brief-next');
  const stageWrap = byId('stage-wrap');
  const previewWindow = byId('preview-window');
  const toasts = byId('stage-toasts');
  const preview = byId('brief-insight');
  const canvas = byId('preview-canvas');
  const announce = byId('insight-announce');
  const glow = dialog.querySelector('.brief-glow');
  const fields = Object.fromEntries([...preview.querySelectorAll('[data-insight]')].map(element => [element.dataset.insight, element]));

  // Line icons for answers and for the pieces in the live preview (24px grid, drawn with strokes).
  const icons = {
    browser:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
    grid:'<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
    sparkle:'<path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2"/>',
    play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
    newPage:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    bag:'<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.3-.6-2.1 0-.8.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-4.9-4-8.8-9-8.8z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
    text:'<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    chart:'<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    puzzle:'<path d="M10 3h4v3.2a1.8 1.8 0 1 0 3.6 0V3H21v7h-2.8a1.8 1.8 0 1 0 0 3.6H21V21h-7v-2.8a1.8 1.8 0 1 0-3.6 0V21H3v-7h2.8a1.8 1.8 0 1 0 0-3.6H3V3z"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    heart:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    sprout:'<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2.5-5-6.5-5 0 4 2.5 5 6.5 5z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    chat:'<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.6A8 8 0 1 1 21 12z"/>',
    keyboard:'<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    report:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 17v-3M12 17v-5M15 17v-2"/>',
    database:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    camera:'<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>',
    bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    cube:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9"/>',
    phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    megaphone:'<path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6"/>',
    screen:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    pen:'<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    home:'<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    range:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M7 15h10"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    check:'<path d="M4.5 12.5 9.5 17.5 19.5 7"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;

  // Options are [label, detail, icon]. An exclusive option clears the others in a multi-choice question.
  const hoursOptions = [['Under 2 hours', null, 'clock'], ['2–5 hours', null, 'clock'], ['5–10 hours', null, 'clock'], ['More than 10 hours', null, 'clock']];
  const timeline = { key:'timeline', label:'Timeline', question:'When would you like to get started?', options:[['As soon as possible', null, 'bolt'], ['In the next 1–3 months', null, 'calendar'], ['In 3–6 months', null, 'range'], ['Just exploring for now', null, 'compass']] };
  const nothingYet = ['Nothing yet', 'We’d like help with all of it.', 'help'];
  const services = {
    web: { name:'Website', type:'Website or e-commerce', option:['A website or online store', 'Turn visitors into customers.', 'browser'], questions:[
      { key:'kind', label:'Type of website', question:'What kind of website do you need?', options:[['A new website', 'For a new business, or one that has never had a site.', 'newPage'], ['A redesign', 'Your current site feels dated or isn’t working for you.', 'refresh'], ['An online store', 'Sell products and take payments online.', 'bag'], ['A landing page', 'One focused page for a launch, campaign, or event.', 'target']] },
      { key:'goals', label:'It should help us', question:'What should it help you do?', multi:true, options:[['Bring in enquiries', null, 'mail'], ['Sell products online', null, 'bag'], ['Take bookings or appointments', null, 'calendar'], ['Show what we do and build trust', null, 'star']] },
      { key:'ready', label:'We already have', question:'What do you already have?', multi:true, exclusive:3, options:[['A logo and brand colours', null, 'palette'], ['Written content', null, 'text'], ['Photos or video', null, 'image'], nothingYet] }
    ] },
    software: { name:'Software', type:'Custom software', option:['Custom software', 'Dashboards, portals, and tools for your team.', 'grid'], questions:[
      { key:'kind', label:'What we need', question:'What would you like to build?', options:[['A dashboard', 'See your numbers and your work in one place.', 'chart'], ['A customer portal', 'Let clients log in, check progress, and manage things themselves.', 'user'], ['A booking or ordering system', 'Take bookings, orders, or requests without the back-and-forth.', 'calendar'], ['Something else', 'A tool that doesn’t exist yet, or doesn’t fit you yet.', 'puzzle']] },
      { key:'users', label:'Who will use it', question:'Who will use it?', multi:true, options:[['Our team', null, 'users'], ['Our customers', null, 'heart'], ['Partners or suppliers', null, 'link'], ['The public', null, 'globe']] },
      { key:'today', label:'How it’s done today', question:'How do you handle this today?', multi:true, exclusive:3, options:[['Spreadsheets', null, 'table'], ['Email and paper', null, 'file'], ['Software that doesn’t quite fit', null, 'puzzle'], ['We don’t do it yet', null, 'sprout']] },
      { key:'hours', label:'Time it takes each week', question:'Roughly how many hours a week go into this today?', options:hoursOptions }
    ] },
    ai: { name:'AI & automation', type:'AI or automation', option:['AI and automation', 'Take repetitive tasks off your hands.', 'sparkle'], questions:[
      { key:'tasks', label:'Tasks to take off our plate', question:'What would you like to spend less time on?', multi:true, options:[['Answering customer messages', 'Sorting enquiries and preparing replies.', 'chat'], ['Typing the same information twice', 'Moving details between forms, tools, and spreadsheets.', 'keyboard'], ['Finding answers in documents', 'Searching files and policies for the right detail.', 'search'], ['Writing reports and summaries', 'Turning notes and numbers into updates.', 'report']] },
      { key:'where', label:'Where the work happens', question:'Where does that work happen today?', multi:true, options:[['Email', null, 'mail'], ['Spreadsheets and documents', null, 'table'], ['Business software or a CRM', null, 'database'], ['Chat apps like WhatsApp or Slack', null, 'chat']] },
      { key:'hours', label:'Time it takes each week', question:'Roughly how much time does it take each week?', options:hoursOptions }
    ] },
    video: { name:'Video & virtual tours', type:'Video or virtual tour', option:['Video or a virtual tour', 'Give customers a closer look.', 'play'], questions:[
      { key:'kind', label:'What we’d like', question:'What would you like to create?', options:[['A brand or product film', 'Show what you make and why it matters.', 'camera'], ['An explainer or animation', 'Make something complex easy to understand.', 'bulb'], ['A virtual tour', 'Let people explore a space before they visit.', 'cube'], ['Short clips for social media', 'Quick, eye-catching videos for your channels.', 'phone']] },
      { key:'channels', label:'Where people will see it', question:'Where will people watch it?', multi:true, options:[['On our website', null, 'browser'], ['Social media', null, 'heart'], ['Ads', null, 'megaphone'], ['Presentations and events', null, 'screen']] },
      { key:'ready', label:'We already have', question:'What do you already have?', multi:true, exclusive:3, options:[['A script or key message', null, 'pen'], ['Footage or photos', null, 'image'], ['A space or product ready to film', null, 'home'], nothingYet] }
    ] }
  };
  const serviceKeys = Object.keys(services);
  const picker = { key:'service', label:'Service', question:'What can we help you with?', options:serviceKeys.map(key => services[key].option) };

  let service = null;
  let usePicker = true;
  let step = 0;
  let reviewing = false;
  let wasSummary = false;
  const answers = {};
  let returnFocus = null;
  let advanceTimer = 0;
  let animations = [];
  let announceTimer = 0;
  let lastEstimate = '';
  let builtFor = null;
  const frames = new WeakMap();

  const flow = () => service ? [...(usePicker ? [picker] : []), ...services[service].questions, timeline] : [picker];
  const chosen = question => {
    if (question === picker) return service ? [serviceKeys.indexOf(service)] : [];
    return answers[service]?.[question.key] ?? [];
  };
  const describe = question => chosen(question).map(index => question.options[index][0]).join(', ');
  const escapeHtml = text => text.replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[char]);

  // Rough planning ranges for the live estimate. They are a guide, not a quote; adjust them
  // here as the studio's real timelines settle.
  const hoursPerWeek = [1.5, 3.5, 7.5, 12];
  const startsIn = [1, 4, 12, null];
  const monthYear = new Intl.DateTimeFormat('en', { month:'long', year:'numeric' });
  function estimate(key) {
    const store = answers[key] ?? {};
    const picked = question => store[question] ?? [];
    const has = (question, index) => picked(question).includes(index);
    const answered = question => picked(question).length > 0;
    const blocks = [];
    let readiness = 0;
    let weeks = null;
    let share = null;
    const addWeeks = (low, high) => { if (weeks) { weeks[0] += low; weeks[1] += high; } };
    if (key === 'web') {
      const kind = picked('kind')[0];
      if (kind !== undefined) {
        readiness += 20;
        weeks = [[4, 6], [4, 6], [6, 9], [1, 2]][kind].slice();
        blocks.push(...[['Homepage', 'About & services'], ['Homepage', 'Homepage refresh', 'Content move'], ['Homepage', 'Product pages', 'Checkout'], ['One focused page']][kind]);
      }
      if (answered('goals')) readiness += 10;
      if (has('goals', 0)) blocks.push('Enquiry form');
      if (has('goals', 1)) { blocks.push('Checkout'); if (kind !== 2) addWeeks(2, 3); }
      if (has('goals', 2)) { blocks.push('Booking calendar'); addWeeks(1, 1); }
      if (has('goals', 3)) blocks.push('Story & reviews');
      if (has('ready', 3)) { readiness += 5; blocks.push('Logo & brand', 'Copywriting', 'Photography'); addWeeks(1, 2); }
      else if (answered('ready')) {
        readiness += (has('ready', 0) ? 20 : 0) + (has('ready', 1) ? 20 : 0) + (has('ready', 2) ? 20 : 0);
        if (!has('ready', 0)) blocks.push('Logo & brand');
        if (!has('ready', 1)) blocks.push('Copywriting');
        if (!has('ready', 2)) blocks.push('Photography');
      }
    } else if (key === 'software') {
      const kind = picked('kind')[0];
      if (kind !== undefined) {
        readiness += 25;
        weeks = [[5, 8], [8, 12], [6, 10], [6, 12]][kind].slice();
        blocks.push(...[['Live dashboard', 'Reports'], ['Client login', 'Client area'], ['Booking flow', 'Order manager'], ['Custom tool']][kind]);
      }
      if (answered('users')) { readiness += 15; addWeeks(picked('users').length - 1, picked('users').length - 1); }
      ['Team accounts', 'Customer accounts', 'Partner access', 'Public pages'].forEach((label, index) => { if (has('users', index)) blocks.push(label); });
      if (has('today', 3)) readiness += 10;
      else if (answered('today')) readiness += Math.min(30, picked('today').length * 15);
      ['Spreadsheet import', 'Digital forms', 'Connect your tools'].forEach((label, index) => { if (has('today', index)) blocks.push(label); });
      if (answered('hours')) readiness += 15;
      share = [.4, .6];
    } else if (key === 'ai') {
      const tasks = picked('tasks').length;
      if (tasks) {
        readiness += tasks <= 2 ? 35 : 25;
        weeks = [2 + (tasks - 1), 3 + (tasks - 1) * 2];
      }
      ['Reply assistant', 'Data sync', 'Document search', 'Report writer'].forEach((label, index) => { if (has('tasks', index)) blocks.push(label); });
      if (answered('where')) { readiness += 25; if (picked('where').length > 2) addWeeks(1, 1); }
      ['Email connection', 'Sheets & docs', 'CRM connection', 'WhatsApp & Slack'].forEach((label, index) => { if (has('where', index)) blocks.push(label); });
      if (answered('hours')) readiness += 25;
      share = [.5, .7];
    } else if (key === 'video') {
      const kind = picked('kind')[0];
      if (kind !== undefined) {
        readiness += 20;
        weeks = [[3, 5], [3, 4], [1, 2], [1, 2]][kind].slice();
        blocks.push(...[['Script', 'Filming', 'Edit & colour'], ['Script', 'Storyboard', 'Animation'], ['360° capture', 'Tour build'], ['Filming', 'Short edits']][kind]);
      }
      if (answered('channels')) { readiness += 15; if (picked('channels').length > 2) addWeeks(1, 1); }
      ['Website cut 16:9', 'Vertical cuts 9:16', 'Ad versions', 'Presentation cut'].forEach((label, index) => { if (has('channels', index)) blocks.push(label); });
      if (has('ready', 3)) { readiness += 5; blocks.push('Scriptwriting'); addWeeks(1, 2); }
      else if (answered('ready')) readiness += (has('ready', 0) ? 20 : 0) + (has('ready', 1) ? 20 : 0) + (has('ready', 2) ? 15 : 0);
    }
    let launch = null;
    if (answered('timeline')) {
      readiness += 10;
      const start = startsIn[picked('timeline')[0]];
      launch = start === null ? 'When you’re ready' : weeks ? `Around ${monthYear.format(new Date(Date.now() + (start + weeks[1]) * 7 * 864e5))}` : null;
    }
    // Time back: today's hours, and what is left if the new tool takes on a typical share of it.
    let time = null;
    if (share && answered('hours')) {
      const now = hoursPerWeek[picked('hours')[0]];
      time = { now, after:[now * (1 - share[1]), now * (1 - share[0])], yearly:share.map(part => Math.round(now * part * 46 / 5) * 5) };
    }
    return { readiness:Math.min(100, readiness), weeks, launch, blocks:[...new Set(blocks)], time };
  }

  // Numbers count to their new value instead of jumping.
  function tween(element, to, format) {
    const targets = [].concat(to);
    const from = element.dataset.value ? element.dataset.value.split(',').map(Number) : targets.map(() => 0);
    element.dataset.value = targets.join(',');
    cancelAnimationFrame(frames.get(element));
    const paint = values => { element.textContent = values.map(format).join('–'); };
    if (motion.matches || from.length !== targets.length) { paint(targets); return; }
    const started = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - started) / 650);
      const eased = 1 - Math.pow(1 - t, 3);
      paint(targets.map((target, i) => from[i] + (target - from[i]) * eased));
      if (t < 1) frames.set(element, requestAnimationFrame(tick));
    };
    frames.set(element, requestAnimationFrame(tick));
  }
  const halves = value => (Math.round(value * 2) / 2).toString();

  // The live preview: each service's project, drawn in a small window, gains a piece for every
  // block the answers add. Pieces are tagged with data-part and switched on and off.
  const piece = (label, icon, art = '') => `<div class="mock-part" data-part="${label}"><span class="mp-icon">${svg(icon)}</span><b class="mp-label">${label}</b>${art}</div>`;
  const lines = '<span class="art-lines"><i></i><i></i></span>';
  const tag = text => `<em class="mock-tag">${text}</em>`;
  const canvases = {
    web:() => `<div class="mock mock-site">
      <div class="ms-nav"><span class="ms-logo" data-part="Logo & brand">${tag('We design it')}</span><span class="ms-links"><i></i><i></i><i></i></span><span class="ms-cart" data-part="Checkout">${svg('bag')}<b>2</b></span></div>
      <div class="ms-hero" data-part="hero"><div class="ms-copy" data-part="Copywriting"><b></b><b></b><i></i><i></i><span></span>${tag('We write it')}</div><div class="ms-art" data-part="Photography">${svg('image')}${tag('We shoot it')}</div></div>
      ${piece('About & services', 'grid', '<span class="art-tiles"><i></i><i></i><i></i></span>')}
      ${piece('Homepage refresh', 'refresh', '<span class="art-swap"><i></i><s>→</s><i></i></span>')}
      ${piece('Content move', 'file', lines)}
      ${piece('Product pages', 'bag', '<span class="art-products"><i></i><i></i><i></i><i></i></span>')}
      ${piece('Checkout', 'bag', '<span class="art-checkout"><i></i><s></s></span>')}
      ${piece('Enquiry form', 'mail', '<span class="art-form"><i></i><i></i><s></s></span>')}
      ${piece('Booking calendar', 'calendar', `<span class="art-calendar">${'<i></i>'.repeat(14)}</span>`)}
      ${piece('Story & reviews', 'star', '<span class="art-stars">★★★★★</span>')}
    </div>`,
    software:() => `<div class="mock mock-app">
      <div class="ma-side"><span class="ma-mark"></span>${['Live dashboard:chart', 'Reports:report', 'Client login:user', 'Client area:users', 'Booking flow:calendar', 'Order manager:table', 'Custom tool:puzzle'].map(item => { const [label, icon] = item.split(':'); return `<span class="ma-item" data-part="${label}">${svg(icon)}</span>`; }).join('')}</div>
      <div class="ma-main">
        <div class="ma-top"><i class="ma-search"></i><span class="ma-users"><b data-part="Team accounts">T</b><b data-part="Customer accounts">C</b><b data-part="Partner access">P</b><b data-part="Public pages">${svg('globe')}</b></span></div>
        ${piece('Live dashboard', 'chart', '<span class="art-kpis"><i></i><i></i><i></i></span><span class="art-bars"><i style="--h:.45"></i><i style="--h:.7"></i><i style="--h:.55"></i><i style="--h:.9"></i><i style="--h:.75"></i><i style="--h:1"></i></span>')}
        ${piece('Reports', 'report', lines)}
        ${piece('Client login', 'user', '<span class="art-form"><i></i><i></i><s></s></span>')}
        ${piece('Client area', 'users', '<span class="art-progress"><i style="--w:.8"></i><i style="--w:.45"></i></span>')}
        ${piece('Booking flow', 'calendar', `<span class="art-calendar">${'<i></i>'.repeat(14)}</span>`)}
        ${piece('Order manager', 'table', '<span class="art-rows"><i></i><i></i><i></i></span>')}
        ${piece('Custom tool', 'puzzle', '<span class="art-tiles"><i></i><i></i><i></i></span>')}
        ${piece('Spreadsheet import', 'table', lines)}
        ${piece('Digital forms', 'file', '<span class="art-form"><i></i><i></i><s></s></span>')}
        ${piece('Connect your tools', 'link', '<span class="art-plugs"><i></i><i></i><i></i></span>')}
      </div>
    </div>`,
    ai:() => `<div class="mock mock-flow">
      <div class="mf-col mf-in">${['Email connection:mail', 'Sheets & docs:table', 'CRM connection:database', 'WhatsApp & Slack:chat'].map(item => { const [label, icon] = item.split(':'); return `<span class="mf-node" data-part="${label}">${svg(icon)}<b>${label}</b></span>`; }).join('')}</div>
      <div class="mf-core" data-part="core"><i class="mf-packet"></i><i class="mf-packet is-late"></i><i class="mf-packet is-out"></i><i class="mf-packet is-out is-late"></i><span>${svg('sparkle')}</span><small>Your assistant</small></div>
      <div class="mf-col mf-out">${['Reply assistant:chat', 'Data sync:refresh', 'Document search:search', 'Report writer:report'].map(item => { const [label, icon] = item.split(':'); return `<span class="mf-node" data-part="${label}">${svg(icon)}<b>${label}</b></span>`; }).join('')}</div>
    </div>`,
    video:() => `<div class="mock mock-video">
      <div class="mv-player" data-part="player"><i class="mv-sun"></i><i class="mv-hill"></i><span class="mv-play">${svg('play')}</span><span class="mv-bar"><i></i></span></div>
      <div class="mv-steps">${['Scriptwriting:pen', 'Script:pen', 'Storyboard:grid', '360° capture:cube', 'Filming:camera', 'Animation:sparkle', 'Tour build:cube', 'Edit & colour:palette', 'Short edits:phone'].map(item => { const [label, icon] = item.split(':'); return `<span class="mv-step" data-part="${label}">${svg(icon)}${label}</span>`; }).join('')}</div>
      <div class="mv-formats">${[['Website cut 16:9', 'wide', 'Website'], ['Vertical cuts 9:16', 'tall', 'Social'], ['Ad versions', 'square', 'Ads'], ['Presentation cut', 'wide', 'Slides']].map(([label, shape, caption]) => `<span class="mv-format" data-part="${label}"><i class="is-${shape}"></i>${caption}</span>`).join('')}</div>
    </div>`
  };

  function renderParts(result, fresh) {
    if (builtFor !== service) {
      canvas.innerHTML = canvases[service]();
      canvas.dataset.canvas = service;
      builtFor = service;
      fresh = true;
    }
    const on = new Set(result.blocks);
    if (result.weeks) { on.add('hero'); on.add('core'); on.add('player'); }
    canvas.classList.toggle('is-landing', on.has('One focused page'));
    let newest = null;
    const added = new Set();
    canvas.querySelectorAll('[data-part]').forEach(part => {
      const active = on.has(part.dataset.part);
      if (active && !part.classList.contains('is-on') && !fresh) { newest = part; added.add(partNames[part.dataset.part] ?? part.dataset.part); }
      part.classList.toggle('is-on', active);
    });
    announcePieces([...added]);
    // Keep the newest piece in view and give it a brief highlight.
    const mock = canvas.firstElementChild;
    if (mock && (mock.classList.contains('mock-site') || mock.classList.contains('mock-app'))) {
      const scrollable = Math.max(0, mock.scrollHeight - canvas.clientHeight);
      let offset = Number(mock.dataset.offset || 0);
      if (newest && newest.closest('.mock-part')) {
        const bottom = newest.offsetTop + newest.offsetHeight + 12;
        if (bottom - offset > canvas.clientHeight || newest.offsetTop < offset) offset = Math.min(scrollable, Math.max(0, bottom - canvas.clientHeight));
      }
      offset = Math.min(offset, scrollable);
      mock.dataset.offset = String(offset);
      mock.style.transform = `translate3d(0,${-offset}px,0)`;
    }
    if (newest && !motion.matches) {
      newest.classList.remove('is-fresh');
      void newest.offsetWidth;
      newest.classList.add('is-fresh');
    }
  }

  // New pieces float up beside the window as they are added.
  const partNames = { hero:'Homepage', core:'Your assistant', player:'Main film' };
  function announcePieces(labels) {
    if (motion.matches || !labels.length) return;
    labels.slice(0, 4).forEach((label, index) => {
      const chip = document.createElement('span');
      chip.className = 'stage-toast';
      chip.textContent = `+ ${label}`;
      chip.style.animationDelay = `${index * 160}ms`;
      chip.addEventListener('animationend', () => chip.remove());
      toasts.append(chip);
    });
  }

  // Before a service is chosen, the stage shows each kind of project in turn. Pointing at a
  // service shows that one.
  const showcaseParts = {
    web:['hero', 'Logo & brand', 'Copywriting', 'Photography', 'About & services', 'Product pages', 'Checkout', 'Booking calendar', 'Story & reviews'],
    software:['Live dashboard', 'Reports', 'Client login', 'Order manager', 'Team accounts', 'Customer accounts', 'Partner access', 'Connect your tools'],
    ai:['core', 'Email connection', 'Sheets & docs', 'CRM connection', 'Reply assistant', 'Data sync', 'Report writer'],
    video:['player', 'Script', 'Filming', 'Edit & colour', 'Website cut 16:9', 'Vertical cuts 9:16', 'Ad versions']
  };
  const showcaseTitles = { web:'Websites & stores', software:'Custom software', ai:'AI & automation', video:'Video & virtual tours' };
  let showcaseKey = null;
  let showcaseTimer = 0;
  let showcaseHeld = false;
  function showcase(key) {
    if (showcaseKey === key && canvas.dataset.canvas === key && builtFor === null) return;
    showcaseKey = key;
    builtFor = null;
    canvas.innerHTML = canvases[key]();
    canvas.dataset.canvas = key;
    canvas.classList.remove('is-landing');
    preview.dataset.tint = key;
    fields.title.textContent = showcaseTitles[key];
    const on = new Set(showcaseParts[key]);
    canvas.querySelectorAll('[data-part]').forEach(part => part.classList.toggle('is-on', on.has(part.dataset.part)));
    if (motion.matches) return;
    canvas.animate([{ opacity:0, transform:'scale(.97)' }, { opacity:1, transform:'none' }], { duration:450, easing:'cubic-bezier(.2,.75,.2,1)' });
    // Long pages glide down, as if someone were scrolling through them.
    const mock = canvas.firstElementChild;
    const overflow = mock.scrollHeight - canvas.clientHeight;
    if (overflow > 20) mock.animate([{ transform:'none' }, { transform:`translate3d(0,${-overflow}px,0)` }], { duration:2200, delay:700, easing:'cubic-bezier(.45,0,.2,1)', fill:'forwards' });
  }
  function startShowcase() {
    if (showcaseTimer) return;
    showcaseHeld = false;
    showcase(showcaseKey ?? 'web');
    if (!motion.matches) showcaseTimer = setInterval(() => {
      if (!showcaseHeld) showcase(serviceKeys[(serviceKeys.indexOf(showcaseKey) + 1) % serviceKeys.length]);
    }, 3200);
  }
  function stopShowcase() { clearInterval(showcaseTimer); showcaseTimer = 0; }

  function renderPreview(fresh = false) {
    const onPicker = !service || flow()[step] === picker;
    preview.classList.toggle('is-showroom', onPicker);
    if (onPicker) { startShowcase(); return; }
    stopShowcase();
    const result = estimate(service);
    preview.dataset.tint = service;
    fields.title.textContent = { web:'Your website', software:'Your software', ai:'Your automation', video:'Your video' }[service];
    preview.style.setProperty('--p', result.readiness);
    tween(fields.readiness, result.readiness, value => Math.round(value));
    if (result.weeks) tween(fields.weeks, result.weeks, value => Math.round(value));
    else { delete fields.weeks.dataset.value; fields.weeks.textContent = '–'; }
    fields.launch.textContent = result.launch ?? (result.weeks ? 'Pick a start date' : '–');
    fields.time.hidden = !result.time;
    if (result.time) {
      fields.now.textContent = `${halves(result.time.now)} h`;
      fields.after.textContent = `${halves(result.time.after[0])}–${halves(result.time.after[1])} h`;
      fields.after.parentElement.querySelector('i').style.setProperty('--w', (result.time.after[1] / result.time.now).toFixed(3));
      tween(fields.yearly, result.time.yearly, value => Math.round(value / 5) * 5);
    }
    renderParts(result, fresh);
    // A soft glow tells the visitor the estimate just changed.
    const signature = JSON.stringify(result);
    if (signature !== lastEstimate) {
      if (lastEstimate && !motion.matches) { preview.classList.remove('is-updating'); void preview.offsetWidth; preview.classList.add('is-updating'); }
      lastEstimate = signature;
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        announce.textContent = [`Estimate updated: ${result.readiness} percent ready`, result.weeks && `${result.weeks[0]} to ${result.weeks[1]} weeks`, result.time && `about ${result.time.yearly[0]} to ${result.time.yearly[1]} hours a year back`].filter(Boolean).join(', ') + '.';
      }, 800);
    }
  }

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
    optionList.replaceChildren(...question.options.map(([label, detail, icon], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'brief-option';
      button.setAttribute('aria-pressed', String(picked.includes(index)));
      button.innerHTML = `<span class="brief-icon" aria-hidden="true">${svg(icon)}</span><span class="brief-key" aria-hidden="true"><b>${String.fromCharCode(65 + index)}</b>${svg('check')}</span><span class="brief-option-copy"><strong></strong>${detail ? '<small></small>' : ''}</span>`;
      button.querySelector('strong').textContent = label;
      if (detail) button.querySelector('small').textContent = detail;
      if (question === picker) {
        const hold = () => { showcaseHeld = true; showcase(serviceKeys[index]); };
        const release = () => { showcaseHeld = false; };
        button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hold(); });
        button.addEventListener('pointerleave', release);
        button.addEventListener('focus', hold);
        button.addEventListener('blur', release);
      }
      // A ripple spreads from where the answer was clicked, or from its centre by keyboard.
      button.addEventListener('click', event => {
        const box = button.getBoundingClientRect();
        const pointer = event.detail > 0;
        button.style.setProperty('--rx', `${pointer ? event.clientX - box.left : box.width / 2}px`);
        button.style.setProperty('--ry', `${pointer ? event.clientY - box.top : box.height / 2}px`);
        choose(question, index);
      });
      return button;
    }));
  }

  function choose(question, index) {
    clearTimeout(advanceTimer);
    select(question, index);
    if (question === picker) { showcaseHeld = true; showcase(service); }
    const picked = chosen(question);
    [...optionList.children].forEach((option, i) => option.setAttribute('aria-pressed', String(picked.includes(i))));
    const option = optionList.children[index];
    if (picked.includes(index) && !motion.matches) { option.classList.remove('is-picking'); void option.offsetWidth; option.classList.add('is-picking'); }
    updateFooter();
    renderSteps();
    renderPreview();
    // A single answer moves straight on; multiple answers wait for Next.
    if (!question.multi) advanceTimer = setTimeout(() => go(step + 1), motion.matches ? 0 : 420);
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
    tip.hidden = onSummary;
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

  // The step tracker: one dot per question and a final one for the brief, joined by a line that fills.
  function renderSteps() {
    const questions = flow();
    const total = service ? questions.length : 5;
    // The dots are kept between steps so their changes animate.
    if (stepList.children.length !== total + 1) {
      stepList.innerHTML = [...Array(total).keys()].map(index => `<li><span>${index + 1}</span>${svg('check')}</li>`).join('') + `<li class="is-finish">${svg('star')}</li>`;
    }
    [...stepList.children].forEach((item, index) => {
      const finish = index === total;
      item.classList.toggle('is-done', index < step || (finish && step >= total));
      item.classList.toggle('is-current', index === step);
      item.classList.toggle('is-answered', index === step && !finish && chosen(questions[index] ?? picker).length > 0);
    });
    stepList.style.setProperty('--progress', Math.min(1, step / total).toFixed(3));
  }

  // Headlines arrive word by word.
  function reveal(element, text) {
    element.innerHTML = text.split(' ').map((word, index) => `<span class="word"><span style="--i:${index}">${escapeHtml(word)}</span></span>`).join(' ');
  }

  function celebrate() {
    if (motion.matches) return;
    const box = preview.querySelector('.insight-ring').getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const colours = ['#1d6b4a', '#46c991', '#8ef0c4', '#d9c38a', '#161613', '#f1efe9'];
    for (let i = 0; i < 34; i++) {
      const bit = document.createElement('i');
      bit.className = 'brief-confetti';
      bit.style.cssText = `left:${x}px;top:${y}px;background:${colours[i % colours.length]};${i % 3 === 0 ? 'border-radius:50%;width:8px;height:8px;' : ''}`;
      dialog.append(bit);
      const angle = Math.random() * Math.PI * 2;
      const distance = 110 + Math.random() * 260;
      bit.animate([
        { transform:'translate(-50%,-50%) rotate(0deg)', opacity:1 },
        { transform:`translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance + 140}px)) rotate(${Math.random() * 720 - 360}deg)`, opacity:0 }
      ], { duration:1200 + Math.random() * 800, easing:'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => bit.remove();
    }
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
    const total = service ? questions.length : 5;
    dialog.dataset.service = service && questions[step] !== picker ? service : '';
    questionPanel.hidden = onSummary;
    summaryPanel.hidden = !onSummary;
    let panel = summaryPanel;
    if (onSummary) { renderSummary(); reveal(summaryTitle, 'Here’s where we’ll start.'); }
    else {
      const question = questions[step];
      panel = questionPanel;
      count.textContent = `QUESTION ${step + 1} OF ${total}`;
      numeral.textContent = String(step + 1).padStart(2, '0');
      numeral.classList.remove('is-entering'); void numeral.offsetWidth; numeral.classList.add('is-entering');
      reveal(heading, question.question);
      hint.textContent = question.multi ? 'Choose all that apply.' : 'Choose one.';
      renderOptions(question);
    }
    dialog.setAttribute('aria-labelledby', onSummary ? 'brief-summary-title' : 'brief-question');
    updateFooter();
    renderSteps();
    renderPreview();
    preview.classList.toggle('is-final', onSummary);
    byId('insight-title').textContent = onSummary ? 'YOUR PROJECT' : 'LIVE PREVIEW';
    byId('brief-stage').scrollTo({ top:0, behavior:'instant' });
    if (!motion.matches && typeof panel.animate === 'function') {
      animations.push(panel.animate([{ opacity:0, transform:'translateY(14px)' }, { opacity:1, transform:'none' }], { duration:420, easing:'cubic-bezier(.2,.75,.2,1)' }));
      panel.querySelectorAll('.brief-option,.brief-answers>div').forEach((item, i) => animations.push(item.animate(
        [{ opacity:0, transform:'translateY(16px) scale(.98)' }, { opacity:1, transform:'none' }],
        { duration:480, delay:180 + i * 70, easing:'cubic-bezier(.2,.75,.25,1.15)', fill:'backwards' }
      )));
    }
    if (onSummary && !wasSummary) setTimeout(celebrate, 350);
    wasSummary = onSummary;
    panel.querySelector('h2').focus({ preventScroll:true });
  }

  function openBrief(key, trigger) {
    if (dialog.open || document.querySelector('dialog[open]')) return;
    if (key && services[key]) { service = key; usePicker = false; }
    else usePicker = true;
    reviewing = false;
    wasSummary = false;
    // Each opening starts the preview fresh, so numbers count up and pieces build from nothing.
    lastEstimate = '';
    builtFor = null;
    showcaseKey = null;
    toasts.replaceChildren();
    preview.classList.remove('is-updating', 'is-final');
    Object.values(fields).forEach(element => { delete element.dataset.value; });
    // A trigger inside another dialog (quick navigation) has already closed with it.
    returnFocus = trigger && !trigger.closest('dialog') ? trigger : document.activeElement;
    dialog.showModal();
    root.classList.add('brief-open');
    document.dispatchEvent(new CustomEvent('envision:brief-visibility', { detail:{ open:true } }));
    go(0);
  }

  function sendBrief() {
    const questions = flow().filter(question => question !== picker);
    const result = estimate(service);
    const guide = [result.weeks && `${result.weeks[0]}–${result.weeks[1]} weeks`, result.time && `about ${result.time.yearly[0]}–${result.time.yearly[1]} hours a year back`].filter(Boolean).join(', ');
    const brief = [
      `Project brief: ${services[service].name}`,
      ...questions.map(question => `${question.label}: ${describe(question)}`),
      ...(guide ? [`Rough guide from the brief: ${guide}`] : []),
      '', 'A little more about my business: '
    ].join('\n');
    returnFocus = null;
    dialog.close();
    document.dispatchEvent(new CustomEvent('envision:enquiry', { detail:{ type:services[service].type, brief } }));
  }

  // A soft light follows the pointer around the page.
  let glowFrame = 0;
  let glowAt = null;
  dialog.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    glowAt = [event.clientX, event.clientY];
    if (!glowFrame) glowFrame = requestAnimationFrame(() => {
      glowFrame = 0;
      glow.style.transform = `translate3d(${glowAt[0]}px,${glowAt[1]}px,0)`;
    });
  }, { passive:true });

  dialog.addEventListener('close', () => {
    clearTimeout(advanceTimer);
    stopShowcase();
    animations.forEach(animation => animation.cancel());
    animations = [];
    dialog.querySelectorAll('.brief-confetti').forEach(bit => bit.remove());
    root.classList.remove('brief-open');
    document.dispatchEvent(new CustomEvent('envision:brief-visibility', { detail:{ open:false } }));
    if (returnFocus && returnFocus !== document.body && returnFocus.isConnected) returnFocus.focus({ preventScroll:true });
    returnFocus = null;
  });
  dialog.querySelector('[data-brief-close]').addEventListener('click', () => dialog.close());
  back.addEventListener('click', () => { if (step > 0) go(step - 1); });
  // The window is drawn at one size and scaled to fill whatever room the stage has.
  new ResizeObserver(() => {
    const scale = Math.min(stageWrap.clientWidth / previewWindow.offsetWidth, stageWrap.clientHeight / previewWindow.offsetHeight, 1.35);
    previewWindow.style.setProperty('--scale', Math.max(.25, scale || 1).toFixed(3));
  }).observe(stageWrap);
  // On a desktop the window tilts gently towards the pointer.
  let tiltFrame = 0;
  preview.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const box = preview.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      previewWindow.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
      previewWindow.style.setProperty('--tilt-y', `${(x * 8).toFixed(2)}deg`);
    });
  }, { passive:true });
  preview.addEventListener('pointerleave', () => {
    cancelAnimationFrame(tiltFrame);
    previewWindow.style.setProperty('--tilt-x', '0deg');
    previewWindow.style.setProperty('--tilt-y', '0deg');
  });
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
