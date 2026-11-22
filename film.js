(() => {
'use strict';
// The home page opens on the planet. Scrolling dives down to a map of every client. Hovering a client
// opens a small window at its pin with a live preview; clicking dives in: the pin opens into the
// place (their own footage, or a 3D world built from their own products), then the website we built
// flies in and lands. From there: back to all clients, or straight on to the next one through a
// window that opens onto the map again. Below the map, the page carries on to the services.
//
// Smoothness rules this file keeps to: every motion eases in and out of its neighbours, windows open
// with a soft edge, the map is redrawn only when its camera moves, images are decoded and footage
// started before they show.
const film = document.querySelector('.film');
if (!film) return;
const stage = film.querySelector('.film-stage'), layersBox = film.querySelector('.film-layers'), capsBox = film.querySelector('.film-caps');
const mapWrap = film.querySelector('.film-map'), cv = mapWrap.querySelector('.map-base'), ctx = cv.getContext('2d');
const ov = mapWrap.querySelector('.map-pins'), octx = ov.getContext('2d'), atmo = mapWrap.querySelector('.map-atmo');
const fx = film.querySelector('.film-fx'), fxc = fx.getContext('2d');
const hub = film.querySelector('.film-hub'), cardsBox = hub.querySelector('.hub-cards'), chipsBox = hub.querySelector('.hub-chips');
const introEls = [...film.querySelectorAll('[data-film-intro]')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), narrowQ = matchMedia('(max-width: 860px)'), fineQ = matchMedia('(hover: hover) and (pointer: fine)');
const STATIC = reduce.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (s, a, b) => clamp((s - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const outCubic = t => 1 - Math.pow(1 - t, 3), outQuart = t => 1 - Math.pow(1 - t, 4);
const lerp = (a, b, t) => a + (b - a) * t;
const grow = (u, a, b) => a * Math.pow(b / a, u);
const pad = n => String(n).padStart(2, '0');
const A = p => 'assets/film/' + p;

// Clients, their real locations, and only facts true of each shipped site. `tag` places the name
// beside the pin on the map (side and a small vertical nudge where pins sit close together).
const T = [
  { name:'The Leisure Club', place:'Dik El-Mehdi, Lebanon', lon:35.6503, lat:33.9131, url:'https://leisure-nu.vercel.app', bar:'leisure-nu.vercel.app', site:'leisure', tag:['r', 15],
    line:'A family country club: fitness, pools, Leisure Island, events and memberships, in one calm website.', facts:['15 pages', '3 languages', '43 weekly classes'],
    scene:{ video:A('leisure-drone') } },
  { name:'Enfantillage', place:'Mazraat Yachouh, Lebanon', lon:35.6745, lat:33.9405, bar:'Enfantillage · toy store', site:'enf', tag:['r', -15],
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', facts:['592 toys', '6 age groups', '5 ways to browse'],
    scene:{ world:'enf' } },
  { name:'Noma Living', place:'Hamra, Beirut', lon:35.4801, lat:33.8959, bar:'Noma Living · student studios', site:'noma', tag:['l', 4],
    line:'Furnished student studios next to LAU, with a 3D walk-through we rendered in Blender.', facts:['3D walk-through', 'Day and night', '3 studio types'],
    scene:{ video:A('noma-walk') } },
  { name:'First Nutrition', place:'Amman, Jordan', lon:35.9105, lat:31.9626, url:'https://first-nutrition.vercel.app', bar:'first-nutrition.vercel.app', site:'fn', tag:['r', 0],
    line:'An official supplement store in English and Arabic, with orders sent on WhatsApp.', facts:['69 products', '21 brands', 'English and Arabic'],
    scene:{ world:'fn' } }
];

// The two worlds, built from each store's own products. Sizes are heights in px at arm's length;
// x is sideways from the path, z is distance along it. Items without y stand on the ground.
const WORLDS = {
  enf:{ tile:360, end:6200, hero:{ src:'enf-tillo', z:7000, h:520 }, particles:'confetti', items:[
    { src:'enf-00', x:-540, z:700, h:300 }, { src:'enf-04', x:580, z:1150, h:430 }, { src:'enf-03', x:250, z:1500, y:-.24, h:190, float:1 },
    { src:'enf-06', x:-660, z:1750, h:470 }, { src:'enf-05', x:610, z:2250, h:230 }, { src:'enf-01', x:-500, z:2750, h:370 },
    { src:'enf-10', x:540, z:3250, h:270 }, { src:'enf-08', x:-230, z:3500, y:-.27, h:200, float:1 }, { src:'enf-09', x:-620, z:3800, h:430 },
    { src:'enf-07', x:520, z:4300, h:330 }, { src:'enf-02', x:-540, z:4800, h:270 }, { src:'enf-11', x:580, z:5300, h:310 } ] },
  fn:{ tile:360, end:6200, hero:{ src:'fn-02', z:7000, h:620 }, particles:'powder', items:[
    { src:'fn-04', x:-580, z:800, h:520 }, { src:'fn-00', x:620, z:1300, h:480 }, { src:'fn-scoop', x:300, z:1650, y:-.22, h:190, float:1, spin:1 },
    { src:'fn-03', x:-640, z:1900, h:560 }, { src:'fn-06', x:-280, z:2300, y:-.26, h:230, float:1, spin:1 }, { src:'fn-01', x:580, z:2500, h:540 },
    { src:'fn-05', x:-560, z:3100, h:500 }, { src:'fn-powder', x:-260, z:3450, y:-.28, h:170, float:1, spin:1 }, { src:'fn-07', x:620, z:3700, h:520 },
    { src:'fn-lid', x:300, z:4050, y:-.2, h:140, float:1, spin:1 }, { src:'fn-08', x:-600, z:4300, h:500 }, { src:'fn-10', x:580, z:4900, h:480 } ] }
};
const CONFETTI = ['#ff7aa8', '#ffd166', '#6ec6ff', '#8fe3b0', '#b39dff', '#ff9f68'];

// ---- Scroll: the dive from the planet to the map of clients, then the map holds ----
const HUB_IN = 1.55, END = 2.9;
film.style.setProperty('--film-screens', String(END + 1));
const KDEEP = 2400;
// The dive into a client, in seconds after the click (or after the window from the last site opens).
const D = { center:1, zoom:1.7, portal:[.45, 1.7], world:[.45, 5.6], cap1:[1.2, 1.7, 4.9, 5.2], fly:[4.9, 5.45], backdrop:[5.15, 5.8], cap2:[5.4, 5.9], landed:5.5, slides:6.4 };

// ---- Build: per client, the place and the website; the chooser; the captions ----
const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const scenes = [], sites = [], caps = [], cards = [], chips = [];
T.forEach((t, i) => {
  // the place
  const el = h('div', 'film-layer film-scene ' + (t.scene.video ? 'is-video' : 'is-world is-' + t.scene.world)), content = h('div', 'film-content');
  const sc = { i, el, content, imgs:[] };
  if (t.scene.video) {
    const poster = h('img', 'film-poster'); poster.alt = ''; poster.decoding = 'async';
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    content.append(poster, v); el.appendChild(content); sc.video = v; sc.poster = poster;
  } else {
    const def = WORLDS[t.scene.world], world = h('div', 'fly-world');
    el.appendChild(h('div', 'w-sky'));
    const ground = h('div', 'w-ground'); world.appendChild(ground);
    const add = (src, d) => { const f = h('figure', 'w-item'), im = h('img'); im.alt = ''; im.dataset.src = A(src + '.webp'); im.decoding = 'async'; f.appendChild(im); world.appendChild(f); sc.imgs.push(im); return { el:f, ...d }; };
    // a second pass of the same products further along, mirrored, so the path is lined all the way
    const all = def.items.concat(def.items.filter(d => !d.float).map(d => ({ ...d, x:-d.x * 1.08, z:d.z + 2650 })).filter(d => d.z < 6500));
    const items = all.map((d, k) => add(d.src, { ...d, k }));
    const hero = add(def.hero.src, { ...def.hero, x:0, k:99 });
    // particles: confetti in toy land, protein powder in the protein world
    const parts = [];
    let seed = t.scene.world === 'enf' ? 7 : 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const count = def.particles === 'confetti' ? 34 : 30;
    for (let k = 0; k < count; k++) {
      let p;
      if (def.particles === 'confetti') { p = h('i', 'w-confetti'); p.style.background = CONFETTI[k % CONFETTI.length]; const s = 9 + rnd() * 9; p.style.width = s + 'px'; p.style.height = (rnd() < .5 ? s : s * .45) + 'px'; if (rnd() < .35) p.style.borderRadius = '50%'; }
      else if (k % 3 === 0) { p = h('img', 'w-puff'); p.alt = ''; p.dataset.src = A('fn-puff.webp'); sc.imgs.push(p); p.style.width = (180 + rnd() * 180) + 'px'; }
      else { p = h('i', 'w-speck'); const s = 3 + rnd() * 5; p.style.width = p.style.height = s + 'px'; }
      world.appendChild(p);
      parts.push({ el:p, x:rnd() * 2 - 1, y:rnd(), z:rnd() * 4200, r:rnd() * 360, sp:(rnd() - .5) * .3 });
    }
    content.appendChild(world); el.appendChild(content);
    Object.assign(sc, { def, ground, items, hero, parts });
  }
  layersBox.appendChild(el); scenes.push(sc);
  // the website: a browser window over a beige backdrop that fades in once the window has landed
  const sel = h('div', 'film-layer film-site'), backdrop = h('div', 'site-backdrop'), sContent = h('div', 'film-content'), win = h('div', 'site-window');
  win.innerHTML = `<div class="site-bar"><i></i><i></i><i></i><span>${t.bar}</span></div><div class="site-screens"></div>`;
  const shots = [0, 1, 2].map(k => { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.dataset.src = A(`site-${t.site}-${k}.webp`); win.lastChild.appendChild(im); return im; });
  sContent.appendChild(win); sel.append(backdrop, sContent); layersBox.appendChild(sel);
  sites.push({ i, el:sel, backdrop, content:sContent, win, shots, imgs:shots, site:true });
  // captions: the place, then what we built, with the way on
  const next = T[(i + 1) % T.length];
  const cap = h('div', 'film-cap');
  cap.innerHTML = `<div class="cap-page cap-scene"><p class="cap-num">${pad(i + 1)} / ${pad(T.length)} · ${t.place}</p><p class="cap-name">${t.name}</p><p class="cap-line">${t.line}</p></div>` +
    `<div class="cap-page cap-site"><p class="cap-num">The website we built</p><p class="cap-name">${t.name}</p><ul class="cap-facts">${t.facts.map(f => `<li>${f}</li>`).join('')}</ul>` +
    `${t.url ? `<a class="cap-link" href="${t.url}" target="_blank" rel="noopener">Visit the live site <span aria-hidden="true">↗</span></a>` : ''}` +
    `<div class="cap-actions"><button type="button" class="cap-back"><span aria-hidden="true">←</span> All clients</button><button type="button" class="cap-next">Next: ${next.name} <span aria-hidden="true">→</span></button></div></div>`;
  capsBox.appendChild(cap);
  caps.push({ scene:cap.children[0], site:cap.children[1] });
  cap.querySelector('.cap-back').addEventListener('click', () => exitDive());
  cap.querySelector('.cap-next').addEventListener('click', () => { if (dive && !dive.exitAt) startDive((i + 1) % T.length, 'site'); });
  // the chooser: a card per client, and a name tag beside each pin on the map
  const card = h('button', 'hub-card'); card.type = 'button'; card.setAttribute('aria-label', `Dive into ${t.name}, ${t.place}`);
  card.innerHTML = `<img src="${A(`card-${t.site}.webp`)}" alt="" loading="lazy" decoding="async"><span><b>${t.name}</b><i>${t.place}</i></span>`;
  cardsBox.appendChild(card); cards.push(card);
  const chip = h('button', 'hub-chip' + (t.tag[0] === 'l' ? ' is-left' : '')); chip.type = 'button'; chip.tabIndex = -1; chip.setAttribute('aria-hidden', 'true');
  chip.innerHTML = `<span>${t.name}</span>`;
  chipsBox.appendChild(chip); chips.push(chip);
  for (const elx of [card, chip]) {
    elx.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover(i); });
    elx.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hover(null); });
    elx.addEventListener('click', () => startDive(i, 'hub'));
  }
  card.addEventListener('focus', () => { if (fineQ.matches) hover(i); });
  card.addEventListener('blur', () => hover(null));
});

// ---- Map data and library, served from the site ----
const script = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
const json = f => fetch(f).then(r => r.json());
let projection = null, path = null, grat = null, levels = [], lastKey = '';
script('assets/vendor/d3-array.min.js').then(() => script('assets/vendor/d3-geo.min.js')).then(() => {
  // A light graticule: every 15 degrees, sampled every 5, which is plenty at globe size.
  projection = d3.geoOrthographic().clipAngle(90).precision(0);
  path = d3.geoPath(projection, ctx); grat = d3.geoGraticule().step([15, 15]).precision(5)();
  // Four levels of detail: a simplified world for the planet, then finer outlines as we close in.
  return json('assets/geo/world-tiny.json').then(tiny => {
    levels = [tiny, tiny, tiny, tiny]; lastKey = ''; kick();
    return json('assets/geo/world-low.json').then(low => {
      levels[1] = levels[2] = levels[3] = low; lastKey = ''; kick();
      return json('assets/geo/region-mid.json').then(mid => {
        const ids = new Set(mid.map(f => f.id)); levels[2] = low.filter(f => !ids.has(f.id)).concat(mid); levels[3] = levels[2]; lastKey = ''; kick();
        return json('assets/geo/levant-high.json').then(high => { const near = new Set(high.map(f => f.id)); levels[3] = levels[2].filter(f => !near.has(f.id)).concat(high); lastKey = ''; kick(); });
      });
    });
  });
}).catch(() => {});

// ---- Size and layout ----
let W = 0, H = 0, DPR = 1, MDPR = 1, base = 1, filmTop = 0, stageH = 1, sx = 1, sh = 1;
const win = { x:0, y:0, w:0, h:0, cx:0, cy:0 };
let HUB = { lon:35.7, lat:33, k:14, ox:0, oy:0 };
function measure() { filmTop = film.getBoundingClientRect().top + scrollY; stageH = stage.offsetHeight || innerHeight; }
function size() {
  measure();
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (!r.width || (r.width === W && r.height === H && dpr === DPR)) return;
  W = r.width; H = r.height; DPR = dpr; base = Math.min(W, H) * .44;
  // The map is soft line work, so it draws at no more than 1.5x; pins and text stay sharp.
  MDPR = Math.min(DPR, 1.5);
  cv.width = Math.round(W * MDPR); cv.height = Math.round(H * MDPR); ctx.setTransform(MDPR, 0, 0, MDPR, 0, 0);
  for (const [c, g] of [[ov, octx], [fx, fxc]]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
  // The browser window: beside the caption on wide screens, above it on phones.
  if (narrowQ.matches) { win.w = W - 32; win.x = 16; win.y = Math.max(84, H * .11); win.h = clamp(H - win.y - 330, win.w / 1.6 + 28, win.w * 1.4); }
  else { win.w = Math.min(W * .6, (H - 200) * 1.6); win.h = win.w / 1.6 + 34; win.x = W - win.w - Math.max(24, W * .05); win.y = (H - win.h) / 2 + 22; }
  win.cx = win.x + win.w / 2; win.cy = win.y + win.h / 2;
  for (const l of sites) Object.assign(l.win.style, { left:win.x + 'px', top:win.y + 'px', width:win.w + 'px', height:win.h + 'px' });
  // Worlds scale with the screen so phones see the same scene, smaller.
  sx = clamp(W / 1440, .3, 1); sh = clamp(Math.min(W * 1.4, H) / 900, .55, 1);
  for (const l of scenes) if (l.items) for (const it of [...l.items, l.hero]) it.el.firstChild.style.height = (it.h * sh).toFixed(0) + 'px';
  for (const c of chips) c._w = c.offsetWidth;
  fitHub(); lastKey = ''; kick();
}
// The map of clients: every pin in view, between the heading and the cards.
function fitHub() {
  const lons = T.map(t => t.lon), lats = T.map(t => t.lat), cLat = (Math.min(...lats) + Math.max(...lats)) / 2, cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const top = narrowQ.matches ? 210 : 230, bottom = H - (narrowQ.matches ? 190 : 215);
  const spanLat = Math.max(.6, Math.max(...lats) - Math.min(...lats)) + .7, spanLon = Math.max(.6, (Math.max(...lons) - Math.min(...lons)) * Math.cos(cLat * Math.PI / 180)) + .7;
  const ppd = Math.min((bottom - top) * .78 / spanLat, W * .6 / spanLon);
  HUB = { lon:cLon, lat:cLat, k:clamp(ppd / (base * Math.PI / 180), 3, 80), ox:narrowQ.matches ? 0 : W * .04, oy:(top + bottom) / 2 - H / 2 };
}
new ResizeObserver(size).observe(stage);
new ResizeObserver(measure).observe(document.body);

// ---- Map cameras ----
const HOMEV = () => narrowQ.matches ? { lon:30, lat:22, k:1, ox:0, oy:0 } : { lon:26, lat:22, k:.75, ox:0, oy:.13 * H };
let idle = 0;
function mixCam(a, b, e, ez = e) {
  const [lon, lat] = d3.geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(e);
  return { lon, lat, k:Math.exp(lerp(Math.log(a.k), Math.log(b.k), ez)), ox:lerp(a.ox, b.ox, e), oy:lerp(a.oy, b.oy, e) };
}
// planet -> map of clients
function scrollCam(s) {
  const hv = HOMEV(), from = { ...hv, lon:hv.lon - idle };
  return mixCam(from, HUB, smooth(seg(s, .25, 1.3)), smoother(seg(s, .35, HUB_IN)));
}
// leaning toward a client while it is previewed
function leanCam(c, i, a) {
  if (!a) return c;
  const t = T[i];
  return mixCam(c, { lon:lerp(c.lon, t.lon, .35), lat:lerp(c.lat, t.lat, .35), k:c.k * 1.55, ox:c.ox, oy:c.oy }, a);
}
function setProj(c) { projection.rotate([-c.lon, -c.lat]).scale(base * c.k).translate([W / 2 + c.ox, H / 2 + c.oy]); }
const levelList = k => levels[k > 24 ? 3 : k > 6 ? 2 : k > 1.6 ? 1 : 0] || [];
function visible(f, c) {
  const reach = Math.asin(clamp((Math.hypot(W, H) / 2 + Math.hypot(c.ox, c.oy)) / (base * c.k))) + .02;
  return d3.geoDistance(f.c, [c.lon, c.lat]) - f.r < reach;
}
// how close to start the trip between two clients, so both fit on screen
const pairK = (a, b) => clamp(.36 * Math.min(W, H) / (base * Math.max(1e-6, d3.geoDistance([T[a].lon, T[a].lat], [T[b].lon, T[b].lat]))), 6, 700);

// ---- Drawing the map ----
const GREEN = '29,107,74', DEEP = '13,70,48', CLIENT_COUNTRY = { 422:1, 400:1 };
const CITIES = [['Beirut', 35.5018, 33.8938], ['Tripoli', 35.8497, 34.4367], ['Sidon', 35.3729, 33.5571], ['Byblos', 35.6511, 34.1236], ['Jounieh', 35.6178, 33.9808], ['Zahle', 35.9019, 33.8463],
  ['Damascus', 36.2765, 33.5138], ['Amman', 35.9284, 31.9454], ['Zarqa', 36.088, 32.0728], ['Irbid', 35.85, 32.5556], ['Haifa', 34.9896, 32.794]];
const GRID = [1, .5, .2, .1, .05, .02, .01, .005, .002, .001, .0005, .0002];
function drawMap(c, cities) {
  const g = ctx, R = base * c.k; g.clearRect(0, 0, W, H);
  g.beginPath(); path({ type:'Sphere' }); g.fillStyle = '#f7f2e9'; g.fill();
  if (c.k < 60) { g.lineWidth = 1; g.strokeStyle = `rgba(${GREEN},.09)`; g.beginPath(); path(grat); g.stroke(); }
  const shown = levelList(c.k).filter(f => visible(f, c));
  g.beginPath(); for (const f of shown) path(f.g);
  g.fillStyle = '#e3e6d6'; g.fill(); g.lineWidth = c.k > 24 ? 1.2 : .7; g.strokeStyle = `rgba(${GREEN},.42)`; g.stroke();
  g.beginPath(); for (const f of shown) if (CLIENT_COUNTRY[f.id]) path(f.g);
  g.fillStyle = `rgba(70,201,145,${c.k > 60 ? .12 : .3})`; g.fill(); g.lineWidth = 1.6; g.strokeStyle = `rgba(${GREEN},.85)`; g.stroke();
  if (R < Math.max(W, H) * 3) { g.lineWidth = 1.2; g.strokeStyle = `rgba(${GREEN},.45)`; g.beginPath(); path({ type:'Sphere' }); g.stroke(); }
  // Close in, a fine survey grid keeps the dive moving once the coast has gone off screen.
  if (c.k > 120) {
    const ppd = base * c.k * Math.PI / 180, cosL = Math.cos(c.lat * Math.PI / 180), cx = W / 2 + c.ox, cy = H / 2 + c.oy, fade = clamp((c.k - 120) / 400);
    g.lineWidth = 1;
    for (const st of GRID) {
      const px = st * ppd, a = smooth(seg(px, 34, 110)) * (1 - smooth(seg(px, 340, 900))) * fade;
      if (a < .02) continue;
      g.strokeStyle = `rgba(${GREEN},${(.11 * a).toFixed(3)})`; g.beginPath();
      const lon0 = Math.floor((c.lon - (cx + 40) / (px * cosL) * st) / st) * st;
      for (let lon = lon0; (lon - c.lon) * ppd * cosL + cx < W + 40; lon += st) { const x = cx + (lon - c.lon) * ppd * cosL; g.moveTo(x, 0); g.lineTo(x, H); }
      const lat0 = Math.floor((c.lat - (H - cy + 40) / px * st) / st) * st;
      for (let lat = lat0; cy - (lat - c.lat) * ppd > -40; lat += st) { const y = cy - (lat - c.lat) * ppd; g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
    }
  }
  const cityA = cities * clamp((c.k - 10) / 14) * (1 - clamp((c.k - 900) / 600));
  if (cityA > 0) for (const [n, lon, lat] of CITIES) {
    if (d3.geoDistance([lon, lat], [c.lon, c.lat]) > 1.2) continue;
    const p = projection([lon, lat]); if (!p) continue;
    g.fillStyle = `rgba(${DEEP},${(.45 * cityA).toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], 2.2, 0, 7); g.fill();
    g.font = '500 11px "Space Grotesk", sans-serif'; g.fillText(n, p[0] + 6, p[1] + 4);
  }
}
// The glow around the planet is a CSS gradient moved by the GPU, not repainted.
let atmoKey = '';
function placeAtmo(c) {
  const R = base * c.k, show = R < Math.max(W, H) * 2.2, key = show ? `${(W / 2 + c.ox).toFixed(1)},${(H / 2 + c.oy).toFixed(1)},${R.toFixed(1)}` : 'off';
  if (key === atmoKey) return; atmoKey = key;
  atmo.style.visibility = show ? 'visible' : 'hidden';
  if (show) atmo.style.transform = `translate(${(W / 2 + c.ox - 100).toFixed(1)}px,${(H / 2 + c.oy - 100).toFixed(1)}px) scale(${(R * 1.14 / 100).toFixed(4)})`;
}
// pins; the client being visited or previewed pulses; optionally the route between two clients
function drawPins(c, focus, route, now, labels) {
  const g = octx; g.clearRect(0, 0, W, H);
  if (route) {
    const [a, b, pr] = route;
    if (pr > 0) {
      const ip = d3.geoInterpolate([T[a].lon, T[a].lat], [T[b].lon, T[b].lat]);
      g.beginPath(); for (let q = 0; q <= 40; q++) { const p = projection(ip(pr * q / 40)); if (p) q ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.setLineDash([6, 7]); g.lineWidth = 2; g.strokeStyle = `rgba(${GREEN},.7)`; g.stroke(); g.setLineDash([]);
    }
  }
  T.forEach((t, i) => {
    if (d3.geoDistance([t.lon, t.lat], [c.lon, c.lat]) > 1.45) return;
    const p = projection([t.lon, t.lat]); if (!p) return;
    const cur = i === focus, pulse = (now * .0009 + i * .25) % 1;
    if (cur || focus == null) { g.strokeStyle = `rgba(${GREEN},${(.5 * (1 - pulse)).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 6 + pulse * 18, 0, 7); g.stroke(); }
    g.fillStyle = cur ? `rgb(${DEEP})` : `rgb(${GREEN})`; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(p[0], p[1], cur ? 7 : 5, 0, 7); g.fill(); g.stroke();
    if (labels && c.k > 30) {
      g.fillStyle = cur ? `rgb(${DEEP})` : `rgba(${DEEP},.7)`; g.font = (cur ? '600 14px' : '500 12px') + ' "Space Grotesk", sans-serif'; g.fillText(t.name, p[0] + 13, p[1] + 4);
      if (cur) { g.fillStyle = `rgba(${DEEP},.6)`; g.font = '500 11px "Space Grotesk", sans-serif'; g.fillText(t.place, p[0] + 13, p[1] + 19); }
    }
  });
}

// ---- Windows: a circle with a soft, feathered edge ----
const cover = (x, y) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 90;
const feather = r => Math.min(70, 2 + r * .28);
function mask(el, x, y, r) {
  let v = '';
  if (r != null) { const f = feather(r); v = `radial-gradient(circle ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px,#000 ${Math.max(0, r - f).toFixed(1)}px,transparent ${r.toFixed(1)}px)`; }
  if (el._m === v) return; el._m = v; el.style.webkitMaskImage = v; el.style.maskImage = v;
}
// a fine ring ties a small window to its pin, then melts away as it grows
function ring(x, y, r, keep = 0) {
  const a = Math.max(keep, 1 - smooth(seg(r, 30, 140))); if (a <= 0) return;
  const rr = Math.max(4, r - feather(r) * .5);
  fxc.beginPath(); fxc.arc(x, y, rr, 0, 7); fxc.lineWidth = 3; fxc.strokeStyle = `rgba(255,255,255,${(.95 * a).toFixed(3)})`; fxc.stroke();
  fxc.beginPath(); fxc.arc(x, y, rr + 2.5, 0, 7); fxc.lineWidth = 1.5; fxc.strokeStyle = `rgba(${GREEN},${(.85 * a).toFixed(3)})`; fxc.stroke();
}

// ---- Loading just before a client is needed ----
// AV1 is smaller and sharper, but only worth it where the device decodes it in hardware.
let av1 = false;
try {
  navigator.mediaCapabilities.decodingInfo({ type:'file', video:{ contentType:'video/mp4; codecs="av01.0.08M.08"', width:1920, height:1080, bitrate:4500000, framerate:30 } })
    .then(r => { av1 = !!(r.supported && r.powerEfficient && r.smooth); }).catch(() => {});
} catch {}
function load(l) {
  if (!l || l.loaded) return; l.loaded = true;
  const phone = narrowQ.matches && l.site;
  for (const im of l.imgs) if (im.dataset.src) {
    im.src = phone ? im.dataset.src.replace(/-(\d)\.webp$/, '-m$1.webp') : im.dataset.src; delete im.dataset.src;
    if (im.decode) im.decode().catch(() => {});
  }
  if (l.video) {
    const src = T[l.i].scene.video + (W / H < .9 ? '-tall' : '');
    l.poster.src = src + '.webp'; l.video.src = src + (av1 ? '.av1.mp4' : '.mp4'); l.video.preload = 'auto';
  }
}
function play(l, on) {
  if (!l.video || on === !!l.playing) return; l.playing = on;
  if (on) { load(l); try { l.video.currentTime = 0; } catch {} const p = l.video.play(); if (p) p.catch(() => {}); }
  else l.video.pause();
}

// ---- The 3D worlds ----
const GW = 5000;
function renderWorld(l, camZ, now, live) {
  const def = l.def, gy = H * .3;
  // The ground slides toward us by whole tiles, so its pattern never jumps. Its near edge always
  // stays in front of the eye (just below the bottom of the screen), or the browser flips it away.
  css(l.ground, 'transform', `translate3d(${-GW / 2}px,${gy.toFixed(1)}px,${(380 + ((camZ % def.tile) + def.tile) % def.tile).toFixed(1)}px) rotateX(-90deg)`);
  const place = (it, x, y, ze, rot) => {
    const a = (1 - smooth(seg(ze, 300, 650))) * smooth(seg(ze, -5600, -4300));
    if (a < .01) { if (it.vis !== false) { it.vis = false; it.el.style.visibility = 'hidden'; } return; }
    if (it.vis !== true) { it.vis = true; it.el.style.visibility = 'visible'; }
    it.el.style.opacity = a < .999 ? a.toFixed(3) : '';
    it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${ze.toFixed(1)}px) translate(-50%,-50%)${rot ? ` rotate(${rot.toFixed(1)}deg)` : ''}`;
  };
  const tt = now / 1000;
  for (const it of [...l.items, l.hero]) {
    const hgt = it.h * sh;
    let y = it.y != null ? it.y * H : gy - hgt / 2, rot = 0;
    if (it.float) y += Math.sin(tt * 1.3 + it.k) * 14 * sh;
    if (it.spin) rot = (tt * 22 + it.k * 40) % 360; else if (it.float) rot = Math.sin(tt * .9 + it.k) * 8;
    place(it, it.x * sx, y, camZ - it.z, rot);
  }
  if (!live) return;
  const R = 4200;
  for (const p of l.parts) {
    const ze = ((camZ - p.z) % R + R) % R - R + 620;
    const y = (p.y * .75 - .5) * H + Math.sin(tt * .8 + p.r) * 10;
    const rot = def.particles === 'confetti' ? (p.r + tt * 90 * (p.sp > 0 ? 1 : -1)) % 360 : 0;
    place(p, p.x * W * .7, y, ze, rot);
  }
}

// ---- Small helpers for style writes and fading text ----
const css = (el, k, v) => { if (el['_' + k] === v) return; el['_' + k] = v; el.style[k] = v; };
function setOp(el, a, dy) {
  a = Math.round(a * 1000) / 1000;
  if (el._a === a) return; el._a = a;
  el.style.opacity = a; el.style.visibility = a > .01 ? 'visible' : 'hidden';
  el.style.transform = a < 1 ? `translateY(${((1 - a) * dy).toFixed(1)}px)` : '';
  el.style.pointerEvents = a > .6 ? '' : 'none';
}

// ---- State: hover previews and dives ----
const pv = { target:null, i:null, amt:0, leave:0 };
function hover(i) {
  if (i == null) { clearTimeout(pv.leave); pv.leave = setTimeout(() => { pv.target = null; kick(); }, 140); return; }
  clearTimeout(pv.leave); pv.target = i; load(scenes[i]); kick();
}
let dive = null, lastCam = null, lastPin = [0, 0], lastBubble = 6, warm = null;
const lenis = () => window.envisionLenis;
function lock(on) {
  document.documentElement.classList.toggle('film-diving', on);
  const l = lenis(); if (l) on ? l.stop() : l.start();
}
function startDive(i, from) {
  if (STATIC || !projection) return;
  if (dive && dive.exitAt) finishExit();
  const now = performance.now();
  if (from === 'site' && dive) {
    const prev = dive.i;
    dive = { i, from, prev, t0:now, T0:1, cam0:{ lon:T[prev].lon, lat:T[prev].lat, k:pairK(prev, i), ox:win.cx - W / 2, oy:win.cy - H / 2 }, r0:6, c0:.6 };
  } else {
    if (dive) return;
    const previewing = pv.i === i && pv.amt > .05;
    dive = { i, from:'hub', t0:now, T0:0, cam0:lastCam || { ...HUB }, r0:previewing ? lastBubble : 6, c0:previewing ? .66 : .6, wz:previewing ? scenes[i].wz || 0 : 0 };
  }
  load(scenes[i]); load(sites[i]);
  pv.target = null;
  lock(true); kick();
}
function exitDive(instant) {
  if (!dive || dive.exitAt) return;
  dive.exitAt = performance.now() - (instant ? 1000 : 0);
  if (instant) finishExit(); kick();
}
function finishExit() {
  for (const l of [...scenes, ...sites]) { l.el.classList.remove('on'); l.on = false; mask(l.el, 0, 0, null); css(l.el, 'opacity', ''); play(l, false); }
  for (const c of caps) { setOp(c.scene, 0, 16); setOp(c.site, 0, 16); }
  css(mapWrap, 'transform', ''); dive = null; lock(false);
}
// wheel, swipe and keys while inside a client: forward hurries the dive along, and once the website
// has landed it returns to the map, so the page never feels stuck.
let wheelAcc = 0, wheelGate = 0;
function nudge(dir) {
  if (!dive || dive.exitAt) return;
  const now = performance.now(), t = (now - dive.t0) / 1000 - dive.T0;
  if (now < wheelGate) return;
  if (dir < 0) { exitDive(); wheelGate = now + 900; return; }
  if (t < D.landed) { dive.t0 -= Math.min(700, (D.landed - t) * 1000); wheelGate = now + 220; }
  else { exitDive(); wheelGate = now + 900; }
}
addEventListener('wheel', e => {
  if (!dive) return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 60) { nudge(Math.sign(wheelAcc)); wheelAcc = 0; }
}, { passive:false, capture:true });
let touchY = null;
addEventListener('touchstart', e => { if (dive) touchY = e.touches[0].clientY; }, { passive:true });
addEventListener('touchmove', e => { if (dive) e.preventDefault(); }, { passive:false });
addEventListener('touchend', e => { if (dive && touchY != null) { const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY); if (Math.abs(dy) > 40) nudge(Math.sign(dy)); } touchY = null; }, { passive:true });
addEventListener('keydown', e => {
  if (!dive || e.defaultPrevented || document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') { e.preventDefault(); exitDive(); }
  else if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); nudge(1); }
  else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); nudge(-1); }
});
// a link elsewhere on the page closes the client first, so the page can scroll to it
document.addEventListener('click', e => { if (dive && e.target.closest('a[href^="#"]')) exitDive(true); }, true);

// ---- One frame ----
function render(s, now, dt) {
  if (!W) return;
  fxc.clearRect(0, 0, W, H);
  const show = new Map();              // layer -> z
  let cam = null, mapZ = 1, focus = null, route = null, labels = true, mapMask = null, cities = 1;
  const hubA = smooth(seg(s, 1.15, HUB_IN)), ready = !!projection && levels.length > 0;
  // fade of the chooser while a client is open
  let diveA = 0;
  if (!dive) {
    // previews: one at a time; switching shrinks the old window before the new one opens
    const want = hubA > .97 ? pv.target : null;
    if (want !== pv.i && pv.amt < .04) pv.i = want;
    const goal = pv.i != null && want === pv.i ? 1 : 0;
    pv.amt += (goal - pv.amt) * (1 - Math.exp(-dt / 150)); if (Math.abs(goal - pv.amt) < .002) pv.amt = goal;
    cam = ready ? leanCam(scrollCam(s), pv.i ?? 0, pv.i != null ? smooth(pv.amt) : 0) : null;
    focus = pv.i; labels = false;
  } else {
    const t = (now - dive.t0) / 1000, T0 = dive.T0, u = t - T0, i = dive.i;
    diveA = dive.exitAt ? 1 - smooth(seg(now - dive.exitAt, 0, 700)) : smooth(seg(t, 0, .35));
    if (dive.exitAt) {
      // back to the map: the client fades away while the map pulls back into place
      const e = smooth(seg(now - dive.exitAt, 0, 700));
      cam = scrollCam(s); labels = false;
      css(mapWrap, 'transform', `scale(${(1 + .22 * (1 - e)).toFixed(4)})`);
      for (const l of [scenes[i], sites[i]]) if (l.on) { show.set(l, l === sites[i] ? 3 : 2); css(l.el, 'opacity', (1 - e).toFixed(3)); }
      if (e >= 1) { finishExit(); return render(s, now, dt); }
      setOp(caps[i].scene, 0, 16); setOp(caps[i].site, Math.min(caps[i].site._a || 0, 1 - e), 16);
    } else {
      // the map: from wherever it was, on to the pin and down into it
      const c0 = dive.cam0, pinCam = { lon:T[i].lon, lat:T[i].lat, k:KDEEP, ox:0, oy:0 };
      const pc = dive.from === 'site' ? smooth(seg(t, .15, T0 + D.center)) : smooth(seg(t, 0, D.center));
      const zc = dive.from === 'site' ? smoother(seg(t, .2, T0 + D.zoom)) : smoother(seg(t, 0, D.zoom));
      const oc = dive.from === 'site' ? smooth(seg(t, .5, T0 + .6)) : smooth(seg(t, 0, .9));
      const [lon, lat] = d3.geoInterpolate([c0.lon, c0.lat], [pinCam.lon, pinCam.lat])(pc);
      cam = { lon, lat, k:Math.exp(lerp(Math.log(c0.k), Math.log(KDEEP), zc)), ox:lerp(c0.ox, 0, oc), oy:lerp(c0.oy, 0, oc) };
      focus = i; cities = 0;
      if (dive.from === 'site') {
        route = [dive.prev, i, smooth(seg(t, .1, T0 + .9))];
        // the last website stays underneath until the map window has filled the screen
        if (u < 0) {
          const ps = sites[dive.prev], uu = seg(t, 0, T0), k = Math.exp(.32 * uu * uu);
          show.set(ps, 1); mapZ = 2;
          css(ps.content, 'transform', `translate(${(win.cx - win.cx * k).toFixed(2)}px,${(win.cy - win.cy * k).toFixed(2)}px) scale(${k.toFixed(4)})`);
          mapMask = [win.cx, win.cy, grow(uu, 6, cover(win.cx, win.cy))];
          setOp(caps[dive.prev].site, 1 - smooth(seg(t, 0, .35)), 16);
        } else if (caps[dive.prev].site._a) setOp(caps[dive.prev].site, 0, 16);
      }
      const sc = scenes[i], st = sites[i];
      const sceneOn = (u >= D.portal[0] || (dive.from === 'hub' && dive.r0 > 6)) && u < D.backdrop[1] + .05;
      if (sceneOn) show.set(sc, mapZ + 1);
      if (u >= D.fly[0]) show.set(st, mapZ + 2);
      dive.u = u;
    }
  }
  // ---- the map ----
  const mapNeeded = !dive || dive.exitAt || dive.u < D.portal[1] + .05;
  mapWrap.classList.toggle('on', !!mapNeeded);
  if (mapNeeded && ready && cam) {
    css(mapWrap, 'zIndex', String(mapZ));
    setProj(cam); lastCam = cam;
    const key = `${cam.lon.toFixed(5)},${cam.lat.toFixed(5)},${cam.k.toFixed(3)},${cam.ox.toFixed(1)},${cam.oy.toFixed(1)},${W},${H},${levels[3].length},${levels[1].length},${cities}`;
    if (key !== lastKey) { lastKey = key; drawMap(cam, cities); }
    placeAtmo(cam); drawPins(cam, focus, route, now, labels && dive && !dive.exitAt);
    if (mapMask) { mask(mapWrap, ...mapMask); ring(...mapMask); } else mask(mapWrap, 0, 0, null);
    const fi = dive && !dive.exitAt ? dive.i : pv.i;
    if (fi != null) { const p = projection([T[fi].lon, T[fi].lat]); if (p) lastPin = p; }
  }
  // ---- warming up: once the map is in view, each world is loaded and drawn once, almost invisibly,
  // so the first dive into it starts without a hitch (phones have no hover to do this for them) ----
  if (!dive && hubA > .9 && !warm) { warm = scenes.filter(l => l.items); for (const l of [...scenes.filter(x => x.items), ...sites]) load(l); }
  if (!dive && warm && warm.length && pv.i == null) {
    const l = warm[0];
    l.warmed = (l.warmed || 0) + 1;
    if (l.warmed > 4) warm.shift();
    else { show.set(l, 70); css(l.el, 'opacity', '0.01'); renderWorld(l, 400, now, true); }
  }
  // ---- the previewed client, in a small window at its pin ----
  if (!dive && pv.i != null && pv.amt > .01) {
    const l = scenes[pv.i], r = pv.amt * Math.min(W, H) * (narrowQ.matches ? .2 : .16);
    show.set(l, 2); lastBubble = r;
    mask(l.el, lastPin[0], lastPin[1], r); ring(lastPin[0], lastPin[1], r, .9 * smooth(pv.amt));
    css(l.content, 'transform', `scale(${(.6 + .06 * pv.amt).toFixed(4)})`);
    if (l.items) { l.wz = 160 + Math.sin(now / 1800) * 110; renderWorld(l, l.wz, now, true); }
  }
  // ---- inside a client ----
  if (dive && !dive.exitAt) {
    const i = dive.i, u = dive.u, sc = scenes[i], st = sites[i];
    if (show.has(sc)) {
      if (u < D.portal[1]) {
        const uu = seg(u, D.portal[0], D.portal[1]), R = cover(lastPin[0], lastPin[1]), r = grow(smooth(uu) * .35 + uu * .65, Math.max(6, dive.r0), R);
        mask(sc.el, lastPin[0], lastPin[1], r); ring(lastPin[0], lastPin[1], r);
      } else mask(sc.el, 0, 0, null);
      // one long push that is quick as the window opens and slows as we settle; it reaches full size
      // just as the window fills the screen, so no edge of the footage ever shows
      const x = seg(u, D.portal[0], D.world[1]), e = (1 - Math.exp(-7 * x)) / (1 - Math.exp(-7));
      const c = Math.exp(lerp(Math.log(dive.c0), Math.log(sc.items ? 1.04 : 1.18), e));
      css(sc.content, 'transform', `scale(${c.toFixed(4)})`);
      if (sc.items) {
        const wu = seg(u, D.portal[0], D.world[1]), z0 = dive.wz || 0;
        renderWorld(sc, lerp(z0, sc.def.end, outCubic(wu) * .55 + wu * .45), now, true);
      }
    }
    if (show.has(st)) {
      // the website flies in from the middle of the place and lands in its spot, then the page
      // around it fades to beige; its transform maps the window's final box onto where it is now
      const fu = seg(u, D.fly[0], D.fly[1]), e = outCubic(fu), k = Math.exp(lerp(Math.log(.14), 0, e));
      const cx = lerp(W / 2, win.cx, e), cy = lerp(H / 2, win.cy, e);
      css(st.content, 'transform', `translate(${(cx - win.cx * k).toFixed(2)}px,${(cy - win.cy * k).toFixed(2)}px) scale(${k.toFixed(4)})`);
      css(st.content, 'opacity', String(Math.round(smooth(seg(fu, 0, .22)) * 1000) / 1000));
      css(st.backdrop, 'opacity', String(Math.round(smooth(seg(u, D.backdrop[0], D.backdrop[1])) * 1000) / 1000));
      // three screens of the site, one after another, sliding up as if scrolling down the page
      const n = Math.max(0, (u - D.slides) / 2.8), step = Math.floor(n), f = smooth(seg(n - step, 0, .28)), cur = step % 3, nxt = (step + 1) % 3;
      st.shots.forEach((im, k2) => {
        const y = k2 === cur ? -100 * f : k2 === nxt ? 100 * (1 - f) : 100;
        css(im, 'transform', y ? `translateY(${y.toFixed(1)}%)` : '');
      });
    }
    const c1 = D.cap1;
    setOp(caps[i].scene, smooth(seg(u, c1[0], c1[1])) * (1 - smooth(seg(u, c1[2], c1[3]))), 16);
    setOp(caps[i].site, smooth(seg(u, D.cap2[0], D.cap2[1])), 16);
  }
  // ---- apply which layers show, and in what order ----
  for (const l of [...scenes, ...sites]) {
    const z = show.get(l), on = z != null;
    if (on !== !!l.on) { l.on = on; l.el.classList.toggle('on', on); if (!on) { mask(l.el, 0, 0, null); css(l.el, 'opacity', ''); } }
    if (on) css(l.el, 'zIndex', String(z));
    if (!l.site) play(l, on);
  }
  // ---- words and the chooser ----
  const ia = dive ? 0 : 1 - smooth(seg(s, .04, .45));
  for (const el of introEls) setOp(el, ia, -30);
  const ha = hubA * (1 - diveA);
  setOp(hub, ha, 18);
  hub.classList.toggle('is-previewing', pv.i != null && pv.amt > .2);
  cards.forEach((c, k) => c.classList.toggle('is-on', pv.i === k && pv.amt > .2));
  if (ha > .01 && projection && cam) {
    T.forEach((t, k) => {
      const p = projection([t.lon, t.lat]), ch = chips[k];
      if (!p) return;
      const x = t.tag[0] === 'l' ? p[0] - 13 - (ch._w || 0) : p[0] + 13, y = p[1] - 14 + t.tag[1];
      css(ch, 'transform', `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`);
      ch.classList.toggle('is-on', pv.i === k && pv.amt > .2);
    });
  }
}

// ---- Scroll ----
// The page scroll is already smooth (Lenis on desktop, native momentum on touch), so the film
// follows it directly. Only a sudden jump, like a key press or a link, is eased here.
let sT = 0, sC = 0, raf = 0, lastNow = 0, onScreen = true, tick = 0;
// ?perf in the address records how long each frame takes to draw, for testing.
const PERF = /[?&]perf(&|$)/.test(location.search) ? (window.__filmPerf = []) : null;
function frame(now) {
  raf = 0;
  const dt = Math.min(64, now - (lastNow || now)); lastNow = now;
  sT = STATIC ? 0 : clamp((scrollY - filmTop) / stageH, 0, END);
  const d = sT - sC;
  if (Math.abs(d) < .2 || Math.abs(d) > 3) sC = sT; else sC += d * (1 - Math.exp(-dt / 90));
  if (!STATIC && sC < .02 && !dive) {
    idle = (idle + dt * .0035) % 360;
    // resting at the top, the planet turns slowly enough that 30 frames a second look the same
    if (sT === sC && (tick++ & 1)) { if (onScreen) raf = requestAnimationFrame(frame); return; }
  }
  if (PERF) { const t0 = performance.now(); render(sC, now, dt); PERF.push([sC, performance.now() - t0]); } else render(sC, now, dt);
  if ((onScreen || dive) && !STATIC) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf && (onScreen || STATIC || dive)) raf = requestAnimationFrame(frame); }
if (STATIC) {
  film.classList.add('is-static');
  film.querySelectorAll('.film-list img[data-src]').forEach(im => { im.src = im.dataset.src; });
}
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { lastNow = 0; kick(); } }).observe(film);
addEventListener('scroll', kick, { passive:true });
// The first footage loads early, so a first preview or dive starts at once.
addEventListener('load', () => { measure(); setTimeout(() => { if (!STATIC) load(scenes[0]); }, 1200); });
size(); kick();
})();
