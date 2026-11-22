(() => {
'use strict';
// The home page is one film driven by the scroll. It opens on the planet and dives to each client in
// turn: the pin opens into the place (their own footage, or a 3D world built from their own
// products), the website we built flies in and lands, then a window in that website opens onto the
// map and the camera flies on to the next client. After the last one the planet comes back.
//
// A chapter bar stays on screen with every client. It shows where the film is, previews a client on
// hover, and on click glides straight there: the scene pulls back into the map and the camera flies
// to that client, without ever locking the page.
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
const chapBox = film.querySelector('.film-chapters'), chapList = chapBox.querySelector('ol');
const introEls = [...film.querySelectorAll('[data-film-intro]')], outroEl = film.querySelector('.film-outro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), narrowQ = matchMedia('(max-width: 860px)');
const STATIC = reduce.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (s, a, b) => clamp((s - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const outCubic = t => 1 - Math.pow(1 - t, 3);
const outExpo = (t, k = 7) => (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
const lerp = (a, b, t) => a + (b - a) * t;
const grow = (u, a, b) => a * Math.pow(b / a, u);
const pad = n => String(n).padStart(2, '0');
const A = p => 'assets/film/' + p;

// Clients, their real locations, and only facts true of each shipped site.
const T = [
  { name:'The Leisure Club', short:'Leisure Club', place:'Dik El-Mehdi, Lebanon', lon:35.6503, lat:33.9131, url:'https://leisure-nu.vercel.app', bar:'leisure-nu.vercel.app', site:'leisure',
    line:'A family country club: fitness, pools, Leisure Island, events and memberships, in one calm website.', facts:['15 pages', '3 languages', '43 weekly classes'],
    scene:{ video:A('leisure-drone') } },
  { name:'Enfantillage', short:'Enfantillage', place:'Mazraat Yachouh, Lebanon', lon:35.6745, lat:33.9405, bar:'Enfantillage · toy store', site:'enf',
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', facts:['592 toys', '6 age groups', '5 ways to browse'],
    scene:{ world:'enf' } },
  { name:'Noma Living', short:'Noma Living', place:'Hamra, Beirut', lon:35.4801, lat:33.8959, bar:'Noma Living · student studios', site:'noma',
    line:'Furnished student studios next to LAU, with a 3D walk-through we rendered in Blender.', facts:['3D walk-through', 'Day and night', '3 studio types'],
    scene:{ video:A('noma-walk') } },
  { name:'First Nutrition', short:'First Nutrition', place:'Amman, Jordan', lon:35.9105, lat:31.9626, url:'https://first-nutrition.vercel.app', bar:'first-nutrition.vercel.app', site:'fn',
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

// ---- Timeline, in screens of scroll ----
// Each client: the map window opens out of the last website, the camera flies and dives to the pin,
// the pin opens into the place, the website flies in and lands. Amman is further, so its flight
// gets a little more room.
const PER = 3, EXTRA = [0, 0, 0, .4];
const B = []; let o = 1;
T.forEach((t, i) => { const x = EXTRA[i]; B.push({ o, x, mapA:o - .2, mapB:o + .45, sceneA:o + 1 + x, sceneB:o + 1.6 + x, siteA:o + 2.05 + x, siteB:o + 2.5 + x }); o += PER + x; });
const G = { a:o - .2, b:o + .7 };
const END = G.b + .6;
film.style.setProperty('--film-screens', String(END + 1));
const KDEEP = 2400;
// where each chapter starts, and where a click on it lands: the camera over the client's pin, just
// before the pin opens
const chapStart = i => i ? B[i].mapA : .5;
const chapLand = i => i ? B[i].o + .75 + B[i].x * .6 : 1.35;

// ---- Build the layers: map, then for each client the place and the website ----
const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const L = [{ kind:'map', m:0, a:-1e9, b:-1e9 }];
const caps = [], chaps = [];
T.forEach((t, i) => {
  if (i) L.push({ kind:'map', m:i, a:B[i].mapA, b:B[i].mapB });
  // the place
  const el = h('div', 'film-layer film-scene ' + (t.scene.video ? 'is-video' : 'is-world is-' + t.scene.world)), content = h('div', 'film-content');
  const sc = { kind:'scene', i, a:B[i].sceneA, b:B[i].sceneB, el, content, imgs:[] };
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
  layersBox.appendChild(el); L.push(sc);
  // the website: a browser window over a beige backdrop that fades in once the window has landed
  const sel = h('div', 'film-layer film-site'), backdrop = h('div', 'site-backdrop'), sContent = h('div', 'film-content'), win = h('div', 'site-window');
  win.innerHTML = `<div class="site-bar"><i></i><i></i><i></i><span>${t.bar}</span></div><div class="site-screens"></div>`;
  const shots = [0, 1, 2].map(k => { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.dataset.src = A(`site-${t.site}-${k}.webp`); win.lastChild.appendChild(im); return im; });
  sContent.appendChild(win); sel.append(backdrop, sContent); layersBox.appendChild(sel);
  L.push({ kind:'site', i, a:B[i].siteA, b:B[i].siteB, el:sel, backdrop, content:sContent, win, shots, imgs:shots, site:true });
  // captions: the place, then what we built
  const cap = h('div', 'film-cap');
  cap.innerHTML = `<div class="cap-page cap-scene"><p class="cap-num">${pad(i + 1)} / ${pad(T.length)} · ${t.place}</p><p class="cap-name">${t.name}</p><p class="cap-line">${t.line}</p></div>` +
    `<div class="cap-page cap-site"><p class="cap-num">The website we built</p><p class="cap-name">${t.name}</p><ul class="cap-facts">${t.facts.map(f => `<li>${f}</li>`).join('')}</ul>` +
    `${t.url ? `<a class="cap-link" href="${t.url}" target="_blank" rel="noopener">Visit the live site <span aria-hidden="true">↗</span></a>` : ''}</div>`;
  capsBox.appendChild(cap);
  caps.push({ scene:cap.children[0], site:cap.children[1] });
  // the chapter bar: the name, a track that fills as the chapter plays, and a preview card on hover
  const li = h('li'), btn = h('button', 'chap'); btn.type = 'button';
  btn.innerHTML = `<span class="chap-name">${t.short}</span><span class="chap-track"><i></i></span>` +
    `<span class="chap-tip" aria-hidden="true"><img src="${A(`card-${t.site}.webp`)}" alt="" loading="lazy" decoding="async"><b>${t.name}</b><em>${t.place}</em></span>`;
  btn.setAttribute('aria-label', `Go to ${t.name}, ${t.place}`);
  btn.addEventListener('click', () => jumpTo(i));
  btn.addEventListener('pointerenter', () => { load(L.find(l => l.kind === 'scene' && l.i === i)); });
  li.appendChild(btn); chapList.appendChild(li);
  chaps.push({ btn, fill:btn.querySelector('.chap-track i') });
});
L.push({ kind:'globe', m:4, a:G.a, b:G.b });
L.forEach((l, j) => { l.j = j; l.next = L[j + 1] || null; if (l.el) l.el.style.zIndex = j + 1; });
// A layer shows from the moment its window opens until the next one covers the screen.
L.forEach(l => { l.end = !l.next ? Infinity : l.next.kind === 'globe' ? G.b + .02 : l.next.b; });

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
  if (narrowQ.matches) { win.w = W - 32; win.x = 16; win.y = Math.max(84, H * .11); win.h = clamp(H - win.y - 380, win.w / 1.6 + 28, win.w * 1.4); }
  else { win.w = Math.min(W * .58, (H - 230) * 1.6); win.h = win.w / 1.6 + 34; win.x = W - win.w - Math.max(24, W * .05); win.y = (H - win.h) / 2 + 6; }
  win.cx = win.x + win.w / 2; win.cy = win.y + win.h / 2;
  for (const l of L) if (l.site) Object.assign(l.win.style, { left:win.x + 'px', top:win.y + 'px', width:win.w + 'px', height:win.h + 'px' });
  // Worlds scale with the screen so phones see the same scene, smaller.
  sx = clamp(W / 1440, .3, 1); sh = clamp(Math.min(W * 1.4, H) / 900, .55, 1);
  for (const l of L) if (l.items) for (const it of [...l.items, l.hero]) it.el.firstChild.style.height = (it.h * sh).toFixed(0) + 'px';
  lastKey = ''; kick();
}
new ResizeObserver(size).observe(stage);
new ResizeObserver(measure).observe(document.body);

// ---- The map camera, as a function of the scroll ----
const HOMEV = () => narrowQ.matches ? { lon:30, lat:22, k:1, oy:0 } : { lon:26, lat:22, k:.75, oy:.13 };
let idle = 0;
const pairK = (a, b) => clamp(.36 * Math.min(W, H) / (base * Math.max(1e-6, d3.geoDistance([T[a].lon, T[a].lat], [T[b].lon, T[b].lat]))), 6, 700);
function camFor(m, s) {
  const hv = HOMEV();
  if (m === 0) {
    // The camera turns toward Lebanon first, then dives, so the pin never drifts off screen.
    const t = T[0], pc = smooth(seg(s, .25, 1.45)), zc = smoother(seg(s, .4, B[0].sceneB));
    const [lon, lat] = d3.geoInterpolate([hv.lon - idle, hv.lat], [t.lon, t.lat])(pc);
    return { lon, lat, k:Math.exp(lerp(Math.log(hv.k), Math.log(KDEEP), zc)), ox:0, oy:hv.oy * H * (1 - smooth(seg(s, .3, 1.5))) };
  }
  if (m === 4) {
    // The planet comes back, out of the last website, and settles where the film began.
    const u = seg(s, G.a, G.b), e = smooth(u), back = 1 - e;
    const [lon, lat] = d3.geoInterpolate([35.8, 32.6], [hv.lon, hv.lat])(e);
    return { lon, lat, k:Math.exp(lerp(Math.log(.03), Math.log(hv.k), outCubic(u))), ox:(win.cx - W / 2) * back, oy:(win.cy - H / 2) * back + hv.oy * H * e };
  }
  const b = B[m], p = T[m - 1], t = T[m];
  const pc = smooth(seg(s, b.o, b.o + 1 + b.x)), zc = smoother(seg(s, b.mapA, b.sceneB)), away = 1 - smooth(seg(s, b.mapB - .3, b.mapB + .5));
  const [lon, lat] = d3.geoInterpolate([p.lon, p.lat], [t.lon, t.lat])(pc);
  return { lon, lat, k:Math.exp(lerp(Math.log(pairK(m - 1, m)), Math.log(KDEEP), zc)), ox:(win.cx - W / 2) * away, oy:(win.cy - H / 2) * away };
}
function setProj(c) { projection.rotate([-c.lon, -c.lat]).scale(base * c.k).translate([W / 2 + c.ox, H / 2 + c.oy]); }
const levelList = k => levels[k > 24 ? 3 : k > 6 ? 2 : k > 1.6 ? 1 : 0] || [];
function visible(f, c) {
  const reach = Math.asin(clamp((Math.hypot(W, H) / 2 + Math.hypot(c.ox, c.oy)) / (base * c.k))) + .02;
  return d3.geoDistance(f.c, [c.lon, c.lat]) - f.r < reach;
}

// ---- Drawing the map ----
const GREEN = '29,107,74', DEEP = '13,70,48', CLIENT_COUNTRY = { 422:1, 400:1 };
const CITIES = [['Beirut', 35.5018, 33.8938], ['Tripoli', 35.8497, 34.4367], ['Sidon', 35.3729, 33.5571], ['Byblos', 35.6511, 34.1236], ['Jounieh', 35.6178, 33.9808], ['Zahle', 35.9019, 33.8463],
  ['Damascus', 36.2765, 33.5138], ['Amman', 35.9284, 31.9454], ['Zarqa', 36.088, 32.0728], ['Irbid', 35.85, 32.5556], ['Haifa', 34.9896, 32.794]];
const GRID = [1, .5, .2, .1, .05, .02, .01, .005, .002, .001, .0005, .0002];
function drawMap(c) {
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
  const cityA = clamp((c.k - 10) / 14) * (1 - clamp((c.k - 900) / 600));
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
// pins; the client being visited pulses (focus -1: all of them); optionally the route between two clients
function drawPins(c, focus, route, now) {
  const g = octx; g.clearRect(0, 0, W, H);
  if (route && route[2] > 0) {
    const [a, b, pr] = route, ip = d3.geoInterpolate([T[a].lon, T[a].lat], [T[b].lon, T[b].lat]);
    g.beginPath(); for (let q = 0; q <= 40; q++) { const p = projection(ip(pr * q / 40)); if (p) q ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    g.setLineDash([6, 7]); g.lineWidth = 2; g.strokeStyle = `rgba(${GREEN},.7)`; g.stroke(); g.setLineDash([]);
  }
  const labels = c.k > 30 && focus !== -1;
  T.forEach((t, i) => {
    if (d3.geoDistance([t.lon, t.lat], [c.lon, c.lat]) > 1.45) return;
    const p = projection([t.lon, t.lat]); if (!p) return;
    const cur = i === focus || focus === -1, pulse = (now * .0009 + i * .25) % 1;
    if (cur) { g.strokeStyle = `rgba(${GREEN},${(.5 * (1 - pulse)).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 6 + pulse * 18, 0, 7); g.stroke(); }
    g.fillStyle = i === focus ? `rgb(${DEEP})` : `rgb(${GREEN})`; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(p[0], p[1], i === focus ? 7 : 5, 0, 7); g.fill(); g.stroke();
    if (labels) {
      g.fillStyle = i === focus ? `rgb(${DEEP})` : `rgba(${DEEP},.7)`; g.font = (i === focus ? '600 14px' : '500 12px') + ' "Space Grotesk", sans-serif'; g.fillText(t.name, p[0] + 13, p[1] + 4);
      if (i === focus) { g.fillStyle = `rgba(${DEEP},.6)`; g.font = '500 11px "Space Grotesk", sans-serif'; g.fillText(t.place, p[0] + 13, p[1] + 19); }
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
function ring(x, y, r) {
  const a = 1 - smooth(seg(r, 30, 140)); if (a <= 0) return;
  const rr = Math.max(4, r - feather(r) * .5);
  fxc.beginPath(); fxc.arc(x, y, rr, 0, 7); fxc.lineWidth = 3; fxc.strokeStyle = `rgba(255,255,255,${(.95 * a).toFixed(3)})`; fxc.stroke();
  fxc.beginPath(); fxc.arc(x, y, rr + 2.5, 0, 7); fxc.lineWidth = 1.5; fxc.strokeStyle = `rgba(${GREEN},${(.85 * a).toFixed(3)})`; fxc.stroke();
}

// ---- Loading as the film approaches each layer ----
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
function renderWorld(l, camZ, now) {
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
    let y = it.y != null ? it.y * H : gy - it.h * sh / 2, rot = 0;
    if (it.float) y += Math.sin(tt * 1.3 + it.k) * 14 * sh;
    if (it.spin) rot = (tt * 22 + it.k * 40) % 360; else if (it.float) rot = Math.sin(tt * .9 + it.k) * 8;
    place(it, it.x * sx, y, camZ - it.z, rot);
  }
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

// ---- Gliding to a chapter ----
// The scene pulls back into the map (a window opening from the middle), the camera flies to the
// chosen client with a little hop if it is far, and the page lands at that chapter, where the film
// shows exactly the same map. Then the visitor simply keeps scrolling.
let jump = null, lastCam = null, snap = false, topIsMap = true;
const lenis = () => window.envisionLenis;
function setScroll(s) {
  const y = filmTop + s * stageH, l = lenis();
  if (l) l.scrollTo(y, { immediate:true, force:true }); else scrollTo({ top:y, behavior:'instant' });
}
function chapterAt(s) { let c = 0; T.forEach((t, i) => { if (s >= chapStart(i)) c = i; }); return c; }
function jumpTo(j) {
  if (STATIC || !projection || jump) return;
  const target = chapLand(j);
  if (Math.abs(sC - target) < .05) return;
  const cur = chapterAt(sC);
  const from = topIsMap && lastCam ? { ...lastCam } : { lon:T[cur].lon, lat:T[cur].lat, k:cur === j ? 260 : pairK(cur, j), ox:0, oy:0 };
  load(L.find(l => l.kind === 'scene' && l.i === j)); load(L.find(l => l.site && l.i === j));
  jump = { j, target, from, reveal:!topIsMap, t0:performance.now(), dur:1700, moved:false, hop:clamp(d3.geoDistance([from.lon, from.lat], [T[j].lon, T[j].lat]) * 30, 0, 1.3) };
  document.documentElement.classList.add('film-gliding');
  const l = lenis(); if (l) l.stop();
  kick();
}
function jumpCam(now) {
  const u = (now - jump.t0) / jump.dur;
  if (!jump.moved && u >= .24) { jump.moved = true; setScroll(jump.target); snap = true; }
  if (u >= 1) return null;
  const to = camFor(jump.j, jump.target), e = smoother(seg(u, .08, 1)), c = jump.from;
  const [lon, lat] = d3.geoInterpolate([c.lon, c.lat], [to.lon, to.lat])(smooth(seg(u, .1, .92)));
  const k = Math.exp(lerp(Math.log(c.k), Math.log(to.k), e) - jump.hop * Math.sin(Math.PI * e));
  return { cam:{ lon, lat, k, ox:lerp(c.ox, to.ox, e), oy:lerp(c.oy, to.oy, e) }, r:jump.reveal ? grow(seg(u, 0, .24), 8, cover(W / 2, H / 2)) : null };
}
function endJump() {
  jump = null; document.documentElement.classList.remove('film-gliding');
  const l = lenis(); if (l) l.start();
}
// while gliding, the page holds still for that second and a half
addEventListener('wheel', e => { if (jump) e.preventDefault(); }, { passive:false, capture:true });
addEventListener('touchmove', e => { if (jump) e.preventDefault(); }, { passive:false });

// ---- One frame of the film ----
function render(s, now) {
  if (!W) return;
  fxc.clearRect(0, 0, W, H);
  const ready = !!projection && levels.length > 0;
  const J = jump && ready ? jumpCam(now) : null;
  if (jump && !J && ready) endJump();
  let mapLayer = null;
  for (const l of L) {
    const on = s >= l.a && s < l.end;
    if (l.el) {
      if (s > l.a - 2) load(l);
      // footage starts a little before its window opens, so the first frame you see is moving
      if (l.video) play(l, s > l.a - .35 && s < l.end);
      if (on !== !!l.on) { l.on = on; l.el.classList.toggle('on', on); if (!on) { mask(l.el, 0, 0, null); css(l.el, 'opacity', ''); } }
    } else if (on) mapLayer = l;
  }
  // ---- the map: the dive, a window onto it from a website, or a glide to another client ----
  const mapOn = !!mapLayer || !!J;
  mapWrap.classList.toggle('on', mapOn);
  let pin = [W / 2, H / 2];
  topIsMap = !!mapLayer && !L.some(l => l.el && l.on && l.j > mapLayer.j) && !(mapLayer.m > 0 && s < mapLayer.b);
  if (mapOn && ready) {
    let c, z, m = null, focus, route = null;
    if (J) { c = J.cam; z = 39; focus = jump.j; if (J.r != null) m = [W / 2, H / 2, J.r]; }   // above every scene, below the rings, words and chapter bar
    else {
      c = camFor(mapLayer.m, s); z = mapLayer.j + 1; focus = mapLayer.m < T.length ? mapLayer.m : -1;
      if (mapLayer.m >= 1 && mapLayer.m < T.length) { const b = B[mapLayer.m]; route = [mapLayer.m - 1, mapLayer.m, smooth(seg(s, b.o - .1, b.o + .9 + b.x))]; }
      if (mapLayer.m > 0 && mapLayer.m < T.length && s < mapLayer.b) m = [win.cx, win.cy, grow(seg(s, mapLayer.a, mapLayer.b), 6, cover(win.cx, win.cy))];
    }
    css(mapWrap, 'zIndex', String(z));
    setProj(c); lastCam = c;
    const key = `${c.lon.toFixed(5)},${c.lat.toFixed(5)},${c.k.toFixed(3)},${c.ox.toFixed(1)},${c.oy.toFixed(1)},${W},${H},${levels[3].length},${levels[1].length}`;
    if (key !== lastKey) { lastKey = key; drawMap(c); }
    placeAtmo(c); drawPins(c, focus, route, now);
    if (m) { mask(mapWrap, m[0], m[1], m[2]); ring(m[0], m[1], m[2]); } else mask(mapWrap, 0, 0, null);
    if (!J && mapLayer.m < T.length) { const p = projection([T[mapLayer.m].lon, T[mapLayer.m].lat]); if (p) pin = p; }
  }
  // ---- the places and the websites ----
  for (const l of L) {
    if (!l.el || !l.on) continue;
    const nx = l.next, b = B[l.i];
    if (l.kind === 'scene') {
      if (s < l.b) {
        // the client's pin opens into the place
        const u = seg(s, l.a, l.b), r = grow(u, 6, cover(pin[0], pin[1]));
        mask(l.el, pin[0], pin[1], r); ring(pin[0], pin[1], r);
      } else mask(l.el, 0, 0, null);
      // one long push: quick as the window opens, slowing as we settle; full size just as the
      // window fills the screen, so no edge of the footage ever shows
      const e = outExpo(seg(s, l.a, b.siteA + .4));
      const c = Math.exp(lerp(Math.log(.6), Math.log(l.items ? 1.04 : 1.18), e));
      css(l.content, 'transform', `scale(${c.toFixed(4)})`);
      if (l.items) { const u = seg(s, l.a - .1, b.siteB); renderWorld(l, lerp(0, l.def.end, outCubic(u) * .5 + u * .5), now); }
    } else if (l.kind === 'site') {
      // The website flies in from the middle of the place and lands in its spot, then the page
      // around it fades to beige; its transform maps the window's final box onto where it is now.
      const u = seg(s, l.a, l.a + .32), e = outCubic(u);
      let k = Math.exp(lerp(Math.log(.14), 0, e)), cx = lerp(W / 2, win.cx, e), cy = lerp(H / 2, win.cy, e), fade = 1;
      if (u >= 1) {
        k = 1 + .02 * Math.max(0, s - l.b);
        if (nx && s >= nx.a) {
          // as the next window opens, lean into it, gently at first
          const u2 = seg(s, nx.a, nx.b);
          k *= nx.kind === 'map' ? Math.exp(.32 * u2 * u2) : 1 + .5 * smooth(u2);
          if (nx.kind === 'globe') fade = 1 - smooth(seg(s, nx.a + .1, nx.a + .6));
        }
        cx = win.cx; cy = win.cy;
      }
      css(l.content, 'transform', `translate(${(cx - win.cx * k).toFixed(2)}px,${(cy - win.cy * k).toFixed(2)}px) scale(${k.toFixed(4)})`);
      css(l.content, 'opacity', String(Math.round(smooth(seg(u, 0, .22)) * 1000) / 1000));
      css(l.backdrop, 'opacity', String(Math.round(smooth(seg(s, l.a + .18, l.b)) * 1000) / 1000));
      css(l.el, 'opacity', fade < 1 ? fade.toFixed(3) : '');
      // three screens of the site, one after another, sliding up as if scrolling down the page
      const nextA = nx ? nx.a : l.b + 1, q = seg(s, l.b - .2, nextA + .35) * 2;
      const steps = [0, smooth(seg(q, .3, .75)), smooth(seg(q, 1.3, 1.75))];
      l.shots.forEach((im, k2) => {
        const y = Math.round(((k2 ? 1 - steps[k2] : 0) - (steps[k2 + 1] || 0)) * 1000) / 10;
        css(im, 'transform', y ? `translateY(${y}%)` : '');
      });
    }
  }
  // ---- words ----
  const ia = 1 - smooth(seg(s, .04, .45));
  for (const el of introEls) setOp(el, ia, -30);
  setOp(outroEl, smooth(seg(s, G.b - .25, G.b + .2)), 24);
  caps.forEach((cp, i) => {
    const b = B[i], nextA = i < T.length - 1 ? B[i + 1].mapA : G.a, quiet = J ? 0 : 1;
    setOp(cp.scene, quiet * smooth(seg(s, b.sceneA + .25, b.sceneB)) * (1 - smooth(seg(s, b.siteA, b.siteA + .25))), 16);
    setOp(cp.site, quiet * smooth(seg(s, b.siteB - .25, b.siteB + .05)) * (1 - smooth(seg(s, nextA, nextA + .25))), 16);
  });
  // ---- the chapter bar ----
  const cur = J ? jump.j : chapterAt(s);
  setOp(chapBox, smooth(seg(s, .55, .95)) * (1 - smooth(seg(s, G.a + .1, G.a + .5))), 14);
  chaps.forEach((c, i) => {
    const end = i < T.length - 1 ? chapStart(i + 1) : G.a, f = J ? (i < jump.j ? 1 : 0) : seg(s, chapStart(i), end);
    css(c.fill, 'transform', `scaleX(${f.toFixed(3)})`);
    if (c.btn._cur !== (i === cur)) {
      c.btn._cur = i === cur; c.btn.classList.toggle('is-on', i === cur); c.btn.setAttribute('aria-current', i === cur ? 'step' : 'false');
      if (i === cur && narrowQ.matches) chapList.scrollTo({ left:c.btn.parentNode.offsetLeft - (chapList.clientWidth - c.btn.offsetWidth) / 2, behavior:'smooth' });
    }
  });
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
  if (snap || (jump && jump.moved) || Math.abs(d) < .2 || Math.abs(d) > 3) { sC = sT; snap = false; } else sC += d * (1 - Math.exp(-dt / 90));
  if (!STATIC && sC < .02 && !jump) {
    idle = (idle + dt * .0035) % 360;
    // resting at the top, the planet turns slowly enough that 30 frames a second look the same
    if (sT === sC && (tick++ & 1)) { if (onScreen) raf = requestAnimationFrame(frame); return; }
  }
  if (PERF) { const t0 = performance.now(); render(sC, now); PERF.push([sC, performance.now() - t0]); } else render(sC, now);
  if ((onScreen || jump) && !STATIC) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf && (onScreen || STATIC || jump)) raf = requestAnimationFrame(frame); }
if (STATIC) {
  film.classList.add('is-static');
  film.querySelectorAll('.film-list img[data-src]').forEach(im => { im.src = im.dataset.src; });
}
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { lastNow = 0; kick(); } }).observe(film);
addEventListener('scroll', kick, { passive:true });
// The first footage loads early, so it is ready by the time the first dive reaches the pin.
addEventListener('load', () => { measure(); setTimeout(() => { if (!STATIC) load(L[1]); }, 1200); });
size(); kick();
})();
