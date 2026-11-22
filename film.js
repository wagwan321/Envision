(() => {
'use strict';
// The home page is one film driven by the scroll. It opens on the planet, dives to a client, flies
// into the place itself (their own footage, or their own photos flown through in depth), opens the
// website we built, and then a window in that website opens onto the map again, toward the next
// client. Every handover is a zoom through a window, so the camera only ever moves forward. After
// the last client the planet comes back, and the page carries on to the services.
const film = document.querySelector('.film');
if (!film) return;
const stage = film.querySelector('.film-stage'), layersBox = film.querySelector('.film-layers'), capsBox = film.querySelector('.film-caps');
const mapWrap = film.querySelector('.film-map'), cv = mapWrap.querySelector('canvas'), ctx = cv.getContext('2d');
const fx = film.querySelector('.film-fx'), fxc = fx.getContext('2d');
const introEls = [...film.querySelectorAll('[data-film-intro]')], outroEl = film.querySelector('.film-outro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), narrowQ = matchMedia('(max-width: 860px)');
const STATIC = reduce.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (s, a, b) => clamp((s - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const grow = (u, a, b) => a * Math.pow(b / a, u);
const pad = n => String(n).padStart(2, '0');

// Clients, their real locations, and only facts true of each shipped site.
const T = [
  { name:'The Leisure Club', place:'Dik El-Mehdi, Lebanon', lon:35.6503, lat:33.9131, url:'https://leisure-nu.vercel.app', bar:'leisure-nu.vercel.app', site:'leisure',
    line:'A family country club: fitness, pools, Leisure Island, events and memberships, in one calm website.', facts:['15 pages', '3 languages', '43 weekly classes'],
    scene:{ video:'assets/film/leisure-drone', rate:.8 } },
  { name:'Enfantillage', place:'Mazraat Yachouh, Lebanon', lon:35.6745, lat:33.9405, bar:'Enfantillage · toy store', site:'enf',
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', facts:['592 toys', '6 age groups', '5 ways to browse'],
    scene:{ fly:'enf', items:[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `assets/film/enf-${pad(i)}.webp`), hero:'assets/film/enf-tillo.webp', card:true } },
  { name:'Noma Living', place:'Hamra, Beirut', lon:35.4801, lat:33.8959, bar:'Noma Living · student studios', site:'noma',
    line:'Furnished student studios next to LAU, with a 3D walk-through we rendered in Blender.', facts:['3D walk-through', 'Day and night', '3 studio types'],
    scene:{ video:'assets/film/noma-walk', rate:1 } },
  { name:'First Nutrition', place:'Amman, Jordan', lon:35.9105, lat:31.9626, url:'https://first-nutrition.vercel.app', bar:'first-nutrition.vercel.app', site:'fn',
    line:'An official supplement store in English and Arabic, with orders sent on WhatsApp.', facts:['69 products', '21 brands', 'English and Arabic'],
    scene:{ fly:'fn', items:[0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `assets/film/fn-${pad(i)}.webp`), hero:'assets/film/fn-02.webp', card:false } }
];

// ---- Timeline, in screens of scroll ----
// Each client: the map window opens out of the last website, the camera travels and dives to the
// pin, the pin opens into the place, the place opens into the website. Amman is further away, so
// that leg gets a little more room.
const PER = 5, EXTRA = [0, 0, 0, .5];
const B = []; let o = .8;
T.forEach((t, i) => { const x = EXTRA[i]; B.push({ o, x, mapA:o - .2, mapB:o + .5, sceneA:o + 1.5 + x, sceneB:o + 2.4 + x, siteA:o + 3.2 + x, siteB:o + 3.9 + x }); o += PER + x; });
const G = { a:o - .2, b:o + .8 };
const END = G.b + .8;
film.style.setProperty('--film-screens', String(END + 1));
const KDEEP = 2400, KSTART = [0, 260, 70, 9], G0 = .07;

// ---- Build the layers: map, then for each client the place and the website ----
const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const L = [{ kind:'map', m:0, a:-1e9, b:-1e9 }];
T.forEach((t, i) => {
  if (i) L.push({ kind:'map', m:i, a:B[i].mapA, b:B[i].mapB });
  // the place
  const el = h('div', 'film-layer film-scene ' + (t.scene.video ? 'is-video' : 'is-fly is-' + t.scene.fly)), content = h('div', 'film-content');
  el.appendChild(content);
  const sc = { kind:'scene', i, a:B[i].sceneA, b:B[i].sceneB, el, content, imgs:[] };
  if (t.scene.video) {
    const poster = h('img', 'film-poster'); poster.alt = ''; poster.decoding = 'async';
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    content.append(poster, v); sc.video = v; sc.poster = poster;
  } else {
    content.appendChild(h('div', 'fly-bg'));
    const world = h('div', 'fly-world'); content.appendChild(world);
    sc.items = t.scene.items.map((src, k) => { const f = h('figure', 'fly-item' + (t.scene.card ? ' is-card' : '')), im = h('img'); im.alt = ''; im.dataset.src = src; im.decoding = 'async'; f.appendChild(im); world.appendChild(f); sc.imgs.push(im); return { el:f, k }; });
    const f = h('figure', 'fly-item is-hero'), im = h('img'); im.alt = ''; im.dataset.src = t.scene.hero; f.appendChild(im); world.appendChild(f); sc.imgs.push(im);
    sc.hero = { el:f };
  }
  layersBox.appendChild(el); L.push(sc);
  // the website
  const sel = h('div', 'film-layer film-site'), sContent = h('div', 'film-content'), win = h('div', 'site-window');
  win.innerHTML = `<div class="site-bar"><i></i><i></i><i></i><span>${t.bar}</span></div><div class="site-screens"></div>`;
  const shots = [0, 1, 2].map(k => { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.dataset.src = `assets/film/site-${t.site}-${k}.webp`; win.lastChild.appendChild(im); return im; });
  sContent.appendChild(win); sel.appendChild(sContent); layersBox.appendChild(sel);
  L.push({ kind:'site', i, a:B[i].siteA, b:B[i].siteB, el:sel, content:sContent, win, shots, imgs:shots });
});
L.push({ kind:'globe', m:4, a:G.a, b:G.b });
L.forEach((l, j) => { l.j = j; l.next = L[j + 1] || null; if (l.el) l.el.style.zIndex = j + 1; });
// A layer shows from the moment its window opens until the next window covers the screen.
L.forEach(l => { l.end = !l.next ? Infinity : l.next.kind === 'globe' ? G.b + .02 : l.next.b; });

// Captions, one per client: the place, then what we built.
const caps = T.map((t, i) => {
  const el = h('div', 'film-cap');
  el.innerHTML = `<div class="cap-page cap-scene"><p class="cap-num">${pad(i + 1)} / ${pad(T.length)} · ${t.place}</p><p class="cap-name">${t.name}</p><p class="cap-line">${t.line}</p></div>` +
    `<div class="cap-page cap-site"><p class="cap-num">The website we built</p><p class="cap-name">${t.name}</p><ul class="cap-facts">${t.facts.map(f => `<li>${f}</li>`).join('')}</ul>${t.url ? `<a class="cap-link" href="${t.url}" target="_blank" rel="noopener" tabindex="-1">Visit the live site <span aria-hidden="true">↗</span></a>` : ''}</div>`;
  capsBox.appendChild(el);
  return { scene:el.children[0], site:el.children[1] };
});

// ---- Map data and library, served from the site ----
const script = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
const json = f => fetch(f).then(r => r.json());
let projection = null, path = null, grat = null, levels = [], lastKey = '';
const cache = document.createElement('canvas'), cctx = cache.getContext('2d');
script('assets/vendor/d3-array.min.js').then(() => script('assets/vendor/d3-geo.min.js')).then(() => {
  projection = d3.geoOrthographic().clipAngle(90).precision(0);
  path = d3.geoPath(projection, cctx); grat = d3.geoGraticule10();
  return json('assets/geo/world-low.json').then(low => {
    levels = [low, low, low]; lastKey = ''; kick();
    return json('assets/geo/region-mid.json').then(mid => {
      const ids = new Set(mid.map(f => f.id)); levels[1] = low.filter(f => !ids.has(f.id)).concat(mid); levels[2] = levels[1]; lastKey = ''; kick();
      return json('assets/geo/levant-high.json').then(high => { const near = new Set(high.map(f => f.id)); levels[2] = levels[1].filter(f => !near.has(f.id)).concat(high); lastKey = ''; kick(); });
    });
  });
}).catch(() => {});

// ---- Size and layout ----
let W = 0, H = 0, DPR = 1, base = 1;
const win = { x:0, y:0, w:0, h:0, cx:0, cy:0 };
function size() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, narrowQ.matches ? 1.5 : 2);
  if (!r.width || (r.width === W && r.height === H && dpr === DPR)) return;
  W = r.width; H = r.height; DPR = dpr; base = Math.min(W, H) * .44;
  for (const c of [cv, cache, fx]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  for (const c of [ctx, cctx, fxc]) c.setTransform(DPR, 0, 0, DPR, 0, 0);
  // The browser window: beside the caption on wide screens, above it on phones.
  if (narrowQ.matches) { win.w = W - 32; win.x = 16; win.y = Math.max(84, H * .11); win.h = clamp(H - win.y - 300, win.w / 1.6 + 28, win.w * 1.45); }
  else { win.w = Math.min(W * .6, (H - 200) * 1.6); win.h = win.w / 1.6 + 34; win.x = W - win.w - Math.max(24, W * .05); win.y = (H - win.h) / 2 + 22; }
  win.cx = win.x + win.w / 2; win.cy = win.y + win.h / 2;
  for (const l of L) if (l.kind === 'site') {
    Object.assign(l.win.style, { left:win.x + 'px', top:win.y + 'px', width:win.w + 'px', height:win.h + 'px' });
    l.content.style.setProperty('--wx', win.cx + 'px'); l.content.style.setProperty('--wy', win.cy + 'px');
  }
  // Photos in depth: a loose ring around the centre, so they fly past the edges of the screen.
  for (const l of L) if (l.items) {
    const card = l.el.classList.contains('is-enf'), small = narrowQ.matches;
    l.el.style.setProperty('--w', (card ? (small ? 124 : 210) : (small ? 104 : 176)) + 'px');
    l.el.style.setProperty('--hw', (card ? (small ? 190 : 300) : (small ? 220 : 360)) + 'px');
    l.items.forEach(it => {
      const ang = it.k * 2.39996 + .5, rf = .8 + .3 * ((it.k * .618) % 1);
      it.x = Math.cos(ang) * W * (small ? .4 : .33) * rf; it.y = Math.sin(ang) * H * .3 * rf;
      it.z = 300 + it.k * 330; it.rot = ((it.k * 37) % 13) - 6;
    });
  }
  lastKey = ''; kick();
}
new ResizeObserver(size).observe(stage);

// ---- The map camera, as a function of the scroll ----
const HOMEV = () => narrowQ.matches ? { lon:30, lat:22, k:1, oy:0 } : { lon:26, lat:22, k:.75, oy:.13 };
let idle = 0;
function camFor(m, s) {
  const hv = HOMEV();
  if (m === 0) {
    // The camera turns toward Lebanon first, then dives, so the pin never drifts off screen.
    const t = T[0], pc = smooth(seg(s, .25, 1.45)), zc = smoother(seg(s, .5, B[0].sceneB));
    const [lon, lat] = d3.geoInterpolate([hv.lon - idle, hv.lat], [t.lon, t.lat])(pc);
    return { lon, lat, k:Math.exp(lerp(Math.log(hv.k), Math.log(KDEEP), zc)), ox:0, oy:hv.oy * H * (1 - smooth(seg(s, .3, 1.7))) };
  }
  if (m === 4) {
    // The planet comes back, out of the last website, and settles where the film began.
    const u = seg(s, G.a, G.b), e = smooth(u), back = 1 - e;
    const [lon, lat] = d3.geoInterpolate([35.8, 32.6], [hv.lon, hv.lat])(e);
    return { lon, lat, k:Math.exp(lerp(Math.log(.03), Math.log(hv.k), 1 - Math.pow(1 - u, 2))), ox:(win.cx - W / 2) * back, oy:(win.cy - H / 2) * back + hv.oy * H * e };
  }
  const b = B[m], p = T[m - 1], t = T[m];
  const pc = smooth(seg(s, b.o + .1, b.o + 1.4 + b.x)), zc = smoother(seg(s, b.mapA, b.sceneB)), away = 1 - smooth(seg(s, b.mapB - .3, b.mapB + .6));
  const [lon, lat] = d3.geoInterpolate([p.lon, p.lat], [t.lon, t.lat])(pc);
  return { lon, lat, k:Math.exp(lerp(Math.log(KSTART[m]), Math.log(KDEEP), zc)), ox:(win.cx - W / 2) * away, oy:(win.cy - H / 2) * away };
}
function setProj(c) { projection.rotate([-c.lon, -c.lat]).scale(base * c.k).translate([W / 2 + c.ox, H / 2 + c.oy]); }
const levelList = k => levels[k > 24 ? 2 : k > 3 ? 1 : 0] || [];
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
  const g = cctx, R = base * c.k; g.clearRect(0, 0, W, H);
  if (R < Math.max(W, H) * 2.5) {
    const [cx, cy] = projection.translate(), gr = g.createRadialGradient(cx, cy, R * .94, cx, cy, R * 1.14);
    gr.addColorStop(0, 'rgba(70,201,145,0)'); gr.addColorStop(.4, 'rgba(70,201,145,.18)'); gr.addColorStop(1, 'rgba(70,201,145,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.14, 0, 7); g.fill();
  }
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
      g.strokeStyle = `rgba(${GREEN},${(.13 * a).toFixed(3)})`; g.beginPath();
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
    g.fillStyle = `rgba(${DEEP},${(.5 * cityA).toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, 7); g.fill();
    g.font = '500 11px "Space Grotesk", sans-serif'; g.fillText(n, p[0] + 6, p[1] + 4);
  }
}
function drawOverlay(c, m, s, now) {
  ctx.clearRect(0, 0, W, H); ctx.drawImage(cache, 0, 0, W, H);
  // the way from the last client to this one
  if (m >= 1 && m <= 3) {
    const b = B[m], pr = smooth(seg(s, b.o - .1, b.o + 1.25 + b.x));
    if (pr > 0) {
      const ip = d3.geoInterpolate([T[m - 1].lon, T[m - 1].lat], [T[m].lon, T[m].lat]);
      ctx.beginPath(); for (let q = 0; q <= 40; q++) { const p = projection(ip(pr * q / 40)); if (p) q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.setLineDash([6, 7]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${GREEN},.7)`; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  const labels = c.k > 30 && m < 4;
  T.forEach((t, i) => {
    if (d3.geoDistance([t.lon, t.lat], [c.lon, c.lat]) > 1.45) return;
    const p = projection([t.lon, t.lat]); if (!p) return;
    const cur = i === m || m === 4, pulse = (now * .0009 + i * .25) % 1;
    if (cur) { ctx.strokeStyle = `rgba(${GREEN},${(.55 * (1 - pulse)).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p[0], p[1], 7 + pulse * 20, 0, 7); ctx.stroke(); }
    ctx.fillStyle = i === m ? `rgb(${DEEP})` : `rgb(${GREEN})`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p[0], p[1], i === m ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
    if (labels) {
      ctx.fillStyle = i === m ? `rgb(${DEEP})` : `rgba(${DEEP},.7)`; ctx.font = (i === m ? '600 14px' : '500 12px') + ' "Space Grotesk", sans-serif'; ctx.fillText(t.name, p[0] + 13, p[1] + 4);
      if (i === m) { ctx.fillStyle = `rgba(${DEEP},.6)`; ctx.font = '500 11px "Space Grotesk", sans-serif'; ctx.fillText(t.place, p[0] + 13, p[1] + 19); }
    }
  });
}

// ---- Window rims, drawn over the layers ----
function rimCircle(x, y, r) {
  if (r > Math.hypot(W, H)) return;
  fxc.beginPath(); fxc.arc(x, y, r + 5, 0, 7); fxc.lineWidth = 10; fxc.strokeStyle = 'rgba(22,22,19,.06)'; fxc.stroke();
  fxc.beginPath(); fxc.arc(x, y, r, 0, 7); fxc.lineWidth = 4; fxc.strokeStyle = '#fff'; fxc.stroke();
  fxc.beginPath(); fxc.arc(x, y, r + 2.6, 0, 7); fxc.lineWidth = 1.6; fxc.strokeStyle = `rgba(${GREEN},.9)`; fxc.stroke();
}
function rimRect(x, y, w, hh, rad) {
  if (w > W * 1.2 && hh > H * 1.2) return;
  const box = d => { fxc.beginPath(); if (fxc.roundRect) fxc.roundRect(x - d, y - d, w + 2 * d, hh + 2 * d, rad + d); else fxc.rect(x - d, y - d, w + 2 * d, hh + 2 * d); };
  box(5); fxc.lineWidth = 10; fxc.strokeStyle = 'rgba(22,22,19,.07)'; fxc.stroke();
  box(0); fxc.lineWidth = 6; fxc.strokeStyle = '#f8f4ec'; fxc.stroke();
  box(3); fxc.lineWidth = 1; fxc.strokeStyle = 'rgba(22,22,19,.18)'; fxc.stroke();
}
const cover = (x, y) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 6;

// ---- Loading as the film approaches each layer ----
function load(l) {
  if (l.loaded) return; l.loaded = true;
  for (const im of l.imgs) if (im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; }
  if (l.video) {
    const tall = W / H < .9, src = T[l.i].scene.video + (tall ? '-tall' : '');
    l.poster.src = src + '.webp'; l.video.src = src + '.mp4'; l.video.preload = 'auto';
    l.video.playbackRate = T[l.i].scene.rate; l.video.defaultPlaybackRate = T[l.i].scene.rate;
  }
}
function toggled(l, on) {
  if (!l.video) return;
  if (on) { load(l); try { l.video.currentTime = 0; } catch {} const p = l.video.play(); if (p) p.catch(() => {}); }
  else l.video.pause();
}

// ---- Fading text in and out ----
function setOp(el, a, dy) {
  a = Math.round(a * 1000) / 1000;
  if (el._a === a) return; el._a = a;
  el.style.opacity = a; el.style.visibility = a > .01 ? 'visible' : 'hidden';
  el.style.transform = a < 1 ? `translateY(${((1 - a) * dy).toFixed(1)}px)` : '';
  el.style.pointerEvents = a > .6 ? '' : 'none';
}

// ---- One frame of the film ----
function render(s, now) {
  if (!W) return;
  fxc.clearRect(0, 0, W, H);
  let mapLayer = null;
  for (const l of L) {
    const on = s >= l.a && s < l.end;
    if (l.el) {
      if (s > l.a - 2.5) load(l);
      if (on !== !!l.on) { l.on = on; l.el.classList.toggle('on', on); toggled(l, on); }
    } else if (on) mapLayer = l;
  }
  // The map: the dive, or a window onto it opening out of a website.
  mapWrap.classList.toggle('on', !!mapLayer);
  let pin = [W / 2, H / 2];
  if (mapLayer && projection && levels.length) {
    mapWrap.style.zIndex = mapLayer.j + 1;
    const c = camFor(mapLayer.m, s); setProj(c);
    const key = `${c.lon.toFixed(5)},${c.lat.toFixed(5)},${c.k.toFixed(3)},${c.ox.toFixed(1)},${c.oy.toFixed(1)},${W},${H},${levels[2].length}`;
    if (key !== lastKey) { lastKey = key; drawMap(c); }
    drawOverlay(c, mapLayer.m, s, now);
    if (mapLayer.m <= 3) { const p = projection([T[mapLayer.m].lon, T[mapLayer.m].lat]); if (p) pin = p; }
    if (mapLayer.kind === 'map' && mapLayer.m > 0 && s < mapLayer.b) {
      const u = seg(s, mapLayer.a, mapLayer.b), r = grow(u, 10, cover(win.cx, win.cy));
      mapWrap.style.clipPath = `circle(${r.toFixed(1)}px at ${win.cx.toFixed(1)}px ${win.cy.toFixed(1)}px)`; rimCircle(win.cx, win.cy, r);
    } else mapWrap.style.clipPath = '';
  }
  for (const l of L) {
    if (!l.el || !l.on) continue;
    const inner = s < l.b, nx = l.next;
    let c = 1;
    if (l.kind === 'scene') {
      if (inner) {
        // The client's pin opens into the place.
        const u = seg(s, l.a, l.b), R = cover(pin[0], pin[1]), r = grow(u, 7, R);
        l.el.style.clipPath = `circle(${r.toFixed(1)}px at ${pin[0].toFixed(1)}px ${pin[1].toFixed(1)}px)`; rimCircle(pin[0], pin[1], r);
        c = Math.pow(r / R, .2);
      } else { l.el.style.clipPath = ''; c = Math.exp(.12 * (s - l.b)); }
      if (nx && s >= nx.a) c *= Math.pow(grow(seg(s, nx.a, nx.b), G0, 1) / G0, .1);
      l.content.style.transform = `scale(${c.toFixed(4)})`;
      if (l.items) {
        // Flying through the photos, toward the one waiting at the end.
        const u = seg(s, l.a, B[l.i].siteB), camZ = lerp(-900, 3800, 1 - Math.pow(1 - u, 1.5));
        const place = (it, x, y, z, rot) => {
          const ze = camZ - z, a = (1 - smooth(seg(ze, 100, 420))) * smooth(seg(ze, -3400, -2400));
          if (a < .01) { if (it.vis !== false) { it.vis = false; it.el.style.visibility = 'hidden'; } return; }
          if (it.vis !== true) { it.vis = true; it.el.style.visibility = 'visible'; }
          it.el.style.opacity = a.toFixed(3);
          it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${ze.toFixed(1)}px) translate(-50%,-50%) rotate(${rot}deg)`;
        };
        for (const it of l.items) place(it, it.x, it.y, it.z, it.rot);
        place(l.hero, 0, -H * .02, 4800, 0);
      }
    } else if (l.kind === 'site') {
      if (inner) {
        // A card opens in the middle of the place and grows into the website.
        const u = seg(s, l.a, l.b), g = grow(u, G0, 1), w = W * g, hh = H * g, rad = 22 * (1 - u * u * u);
        const x = (W - w) / 2, y = (H - hh) / 2;
        l.el.style.clipPath = `inset(${y.toFixed(1)}px ${x.toFixed(1)}px ${y.toFixed(1)}px ${x.toFixed(1)}px round ${rad.toFixed(1)}px)`; rimRect(x, y, w, hh, rad);
        c = Math.pow(g, .25);
      } else { l.el.style.clipPath = ''; c = 1 + .025 * (s - l.b); }
      let fade = 1;
      if (nx && s >= nx.a) {
        const u2 = seg(s, nx.a, nx.b);
        if (nx.kind === 'map') c *= Math.pow(grow(u2, 10, cover(win.cx, win.cy)) / 10, .09);
        else { c *= 1 + .6 * smooth(u2); fade = 1 - smooth(seg(s, nx.a + .2, nx.b)); }
      }
      l.content.style.transform = `scale(${c.toFixed(4)})`;
      l.el.style.opacity = fade < 1 ? fade.toFixed(3) : '';
      // Three screens of the site, one after another, sliding up as if scrolling down the page.
      const nextA = nx ? nx.a : l.b + 1, q = seg(s, l.b - .2, nextA + .2) * 2;
      const steps = [0, smooth(seg(q, .3, .75)), smooth(seg(q, 1.3, 1.75))];
      l.shots.forEach((im, k) => {
        const y = Math.round(((k ? 1 - steps[k] : 0) - (steps[k + 1] || 0)) * 1000) / 10;
        if (im._y === y) return; im._y = y;
        im.style.transform = y ? `translateY(${y}%)` : '';
      });
    }
  }
  // Words
  const ia = 1 - smooth(seg(s, .04, .45));
  for (const el of introEls) setOp(el, ia, -30);
  setOp(outroEl, smooth(seg(s, G.b - .35, G.b + .15)), 24);
  caps.forEach((cp, i) => {
    const b = B[i], nextA = i < T.length - 1 ? B[i + 1].mapA : G.a;
    setOp(cp.scene, smooth(seg(s, b.sceneA + .4, b.sceneB)) * (1 - smooth(seg(s, b.siteA, b.siteA + .35))), 16);
    setOp(cp.site, smooth(seg(s, b.siteB - .3, b.siteB + .05)) * (1 - smooth(seg(s, nextA, nextA + .3))), 16);
  });
}

// ---- Scroll, smoothed a touch so a mouse wheel glides instead of stepping ----
let sT = 0, sC = 0, raf = 0, lastNow = 0, onScreen = true;
function readScroll() { const r = film.getBoundingClientRect(), sh = stage.offsetHeight || H || 1; sT = clamp(-r.top / sh, 0, END); }
function frame(now) {
  raf = 0;
  const dt = Math.min(64, now - (lastNow || now)); lastNow = now;
  readScroll();
  if (STATIC) sC = 0;
  else if (Math.abs(sT - sC) > 2.5) sC = sT;
  else sC += (sT - sC) * (1 - Math.exp(-dt / 85));
  if (Math.abs(sT - sC) < 1e-4) sC = sT;
  if (!STATIC && sC < .02) idle = (idle + dt * .0035) % 360;
  render(sC, now);
  if (onScreen && !STATIC) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf && (onScreen || STATIC)) raf = requestAnimationFrame(frame); }
if (STATIC) {
  film.classList.add('is-static');
  film.querySelectorAll('.film-list img[data-src]').forEach(im => { im.src = im.dataset.src; });
}
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { lastNow = 0; kick(); } }).observe(film);
addEventListener('scroll', kick, { passive:true });
// The first footage loads early, so it is ready by the time the first dive reaches the pin.
addEventListener('load', () => setTimeout(() => { if (!STATIC) load(L[1]); }, 1200));
size(); kick();
})();
