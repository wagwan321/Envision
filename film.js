(() => {
'use strict';
// The home page is one film driven by the scroll. It opens on the planet, dives to a client, flies
// into the place itself (their own footage, or their own products flown through in depth), the
// website we built flies in and settles, and then a window in that website opens onto the map
// again, toward the next client. After the last client the planet comes back, and the page carries
// on to the services.
//
// Smoothness rules this file keeps to:
// - Every motion eases in and out of its neighbours: nothing starts or stops at full speed, so the
//   camera never "hits a wall" when one window has filled the screen.
// - Windows open with a soft, feathered edge rather than a drawn ring.
// - The map is redrawn only when the camera moves, at a capped resolution; the pins, the route and
//   the glow sit on separate, cheaper layers.
// - Images are decoded and footage started just before they are needed, so nothing pops in.
const film = document.querySelector('.film');
if (!film) return;
const stage = film.querySelector('.film-stage'), layersBox = film.querySelector('.film-layers'), capsBox = film.querySelector('.film-caps');
const mapWrap = film.querySelector('.film-map'), cv = mapWrap.querySelector('.map-base'), ctx = cv.getContext('2d');
const ov = mapWrap.querySelector('.map-pins'), octx = ov.getContext('2d'), atmo = mapWrap.querySelector('.map-atmo');
const fx = film.querySelector('.film-fx'), fxc = fx.getContext('2d');
const introEls = [...film.querySelectorAll('[data-film-intro]')], outroEl = film.querySelector('.film-outro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), narrowQ = matchMedia('(max-width: 860px)');
const STATIC = reduce.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (s, a, b) => clamp((s - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const outCubic = t => 1 - Math.pow(1 - t, 3), outQuart = t => 1 - Math.pow(1 - t, 4);
const lerp = (a, b, t) => a + (b - a) * t;
const grow = (u, a, b) => a * Math.pow(b / a, u);
const pad = n => String(n).padStart(2, '0');

// Clients, their real locations, and only facts true of each shipped site.
const T = [
  { name:'The Leisure Club', place:'Dik El-Mehdi, Lebanon', lon:35.6503, lat:33.9131, url:'https://leisure-nu.vercel.app', bar:'leisure-nu.vercel.app', site:'leisure',
    line:'A family country club: fitness, pools, Leisure Island, events and memberships, in one calm website.', facts:['15 pages', '3 languages', '43 weekly classes'],
    scene:{ video:'assets/film/leisure-drone' } },
  { name:'Enfantillage', place:'Mazraat Yachouh, Lebanon', lon:35.6745, lat:33.9405, bar:'Enfantillage · toy store', site:'enf',
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', facts:['592 toys', '6 age groups', '5 ways to browse'],
    scene:{ fly:'enf', items:[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `assets/film/enf-${pad(i)}.webp`), hero:'assets/film/enf-tillo.webp' } },
  { name:'Noma Living', place:'Hamra, Beirut', lon:35.4801, lat:33.8959, bar:'Noma Living · student studios', site:'noma',
    line:'Furnished student studios next to LAU, with a 3D walk-through we rendered in Blender.', facts:['3D walk-through', 'Day and night', '3 studio types'],
    scene:{ video:'assets/film/noma-walk' } },
  { name:'First Nutrition', place:'Amman, Jordan', lon:35.9105, lat:31.9626, url:'https://first-nutrition.vercel.app', bar:'first-nutrition.vercel.app', site:'fn',
    line:'An official supplement store in English and Arabic, with orders sent on WhatsApp.', facts:['69 products', '21 brands', 'English and Arabic'],
    scene:{ fly:'fn', items:[0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => `assets/film/fn-${pad(i)}.webp`), hero:'assets/film/fn-02.webp' } }
];

// ---- Timeline, in screens of scroll ----
// Each client: the map window opens out of the last website, the camera travels and dives to the
// pin, the pin opens into the place, the website flies in and settles. Amman is further away, so
// that leg gets a little more room.
const PER = 5, EXTRA = [0, 0, 0, .5];
const B = []; let o = .8;
T.forEach((t, i) => { const x = EXTRA[i]; B.push({ o, x, mapA:o - .2, mapB:o + .5, sceneA:o + 1.5 + x, sceneB:o + 2.4 + x, siteA:o + 3.2 + x, siteB:o + 3.9 + x }); o += PER + x; });
const G = { a:o - .2, b:o + .8 };
const END = G.b + .8;
film.style.setProperty('--film-screens', String(END + 1));
const KDEEP = 2400, KSTART = [0, 260, 70, 9];

// ---- Build the layers: map, then for each client the place and the website ----
const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const L = [{ kind:'map', m:0, a:-1e9, b:-1e9 }];
T.forEach((t, i) => {
  if (i) L.push({ kind:'map', m:i, a:B[i].mapA, b:B[i].mapB });
  // the place
  const el = h('div', 'film-layer film-scene ' + (t.scene.video ? 'is-video' : 'is-fly is-' + t.scene.fly)), content = h('div', 'film-content');
  const sc = { kind:'scene', i, a:B[i].sceneA, b:B[i].sceneB, el, content, imgs:[] };
  if (t.scene.video) {
    const poster = h('img', 'film-poster'); poster.alt = ''; poster.decoding = 'async';
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    content.append(poster, v); el.appendChild(content); sc.video = v; sc.poster = poster;
  } else {
    el.appendChild(h('div', 'fly-bg'));
    const world = h('div', 'fly-world'); content.appendChild(world); el.appendChild(content);
    sc.items = t.scene.items.map((src, k) => { const f = h('figure', 'fly-item'), im = h('img'); im.alt = ''; im.dataset.src = src; im.decoding = 'async'; f.appendChild(im); world.appendChild(f); sc.imgs.push(im); return { el:f, k }; });
    const f = h('figure', 'fly-item is-hero'), im = h('img'); im.alt = ''; im.dataset.src = t.scene.hero; f.appendChild(im); world.appendChild(f); sc.imgs.push(im);
    sc.hero = { el:f };
  }
  layersBox.appendChild(el); L.push(sc);
  // the website: a browser window over a beige backdrop that fades in once the window has landed
  const sel = h('div', 'film-layer film-site'), backdrop = h('div', 'site-backdrop'), sContent = h('div', 'film-content'), win = h('div', 'site-window');
  win.innerHTML = `<div class="site-bar"><i></i><i></i><i></i><span>${t.bar}</span></div><div class="site-screens"></div>`;
  const shots = [0, 1, 2].map(k => { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.dataset.src = `assets/film/site-${t.site}-${k}.webp`; win.lastChild.appendChild(im); return im; });
  sContent.appendChild(win); sel.append(backdrop, sContent); layersBox.appendChild(sel);
  L.push({ kind:'site', i, a:B[i].siteA, b:B[i].siteB, el:sel, backdrop, content:sContent, win, shots, imgs:shots });
});
L.push({ kind:'globe', m:4, a:G.a, b:G.b });
L.forEach((l, j) => { l.j = j; l.next = L[j + 1] || null; if (l.el) l.el.style.zIndex = j + 1; });
// A layer shows from the moment its window opens until the next one covers the screen.
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
script('assets/vendor/d3-array.min.js').then(() => script('assets/vendor/d3-geo.min.js')).then(() => {
  projection = d3.geoOrthographic().clipAngle(90).precision(0);
  // A light graticule: every 15 degrees, sampled every 5, which is plenty at globe size.
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
let W = 0, H = 0, DPR = 1, MDPR = 1, base = 1, filmTop = 0, stageH = 1;
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
  if (narrowQ.matches) { win.w = W - 32; win.x = 16; win.y = Math.max(84, H * .11); win.h = clamp(H - win.y - 300, win.w / 1.6 + 28, win.w * 1.45); }
  else { win.w = Math.min(W * .6, (H - 200) * 1.6); win.h = win.w / 1.6 + 34; win.x = W - win.w - Math.max(24, W * .05); win.y = (H - win.h) / 2 + 22; }
  win.cx = win.x + win.w / 2; win.cy = win.y + win.h / 2;
  for (const l of L) if (l.kind === 'site') Object.assign(l.win.style, { left:win.x + 'px', top:win.y + 'px', width:win.w + 'px', height:win.h + 'px' });
  // Products in depth: a loose ring around the centre, so they sweep past the edges of the screen.
  for (const l of L) if (l.items) {
    const small = narrowQ.matches, toys = l.el.classList.contains('is-enf');
    l.el.style.setProperty('--w', (toys ? (small ? 140 : 240) : (small ? 112 : 190)) + 'px');
    l.el.style.setProperty('--hw', (toys ? (small ? 200 : 320) : (small ? 230 : 380)) + 'px');
    l.items.forEach(it => {
      const ang = it.k * 2.39996 + .5, rf = .8 + .3 * ((it.k * .618) % 1);
      it.x = Math.cos(ang) * W * (small ? .4 : .33) * rf; it.y = Math.sin(ang) * H * .3 * rf;
      it.z = 300 + it.k * 330; it.rot = ((it.k * 37) % 13) - 6;
    });
  }
  lastKey = ''; kick();
}
new ResizeObserver(size).observe(stage);
new ResizeObserver(measure).observe(document.body);

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
    return { lon, lat, k:Math.exp(lerp(Math.log(.03), Math.log(hv.k), outCubic(u))), ox:(win.cx - W / 2) * back, oy:(win.cy - H / 2) * back + hv.oy * H * e };
  }
  const b = B[m], p = T[m - 1], t = T[m];
  const pc = smooth(seg(s, b.o + .1, b.o + 1.4 + b.x)), zc = smoother(seg(s, b.mapA, b.sceneB)), away = 1 - smooth(seg(s, b.mapB - .3, b.mapB + .6));
  const [lon, lat] = d3.geoInterpolate([p.lon, p.lat], [t.lon, t.lat])(pc);
  return { lon, lat, k:Math.exp(lerp(Math.log(KSTART[m]), Math.log(KDEEP), zc)), ox:(win.cx - W / 2) * away, oy:(win.cy - H / 2) * away };
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
    g.fillStyle = `rgba(${DEEP},${(.5 * cityA).toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], 2.4, 0, 7); g.fill();
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
function drawPins(c, m, s, now) {
  const g = octx; g.clearRect(0, 0, W, H);
  // the way from the last client to this one
  if (m >= 1 && m <= 3) {
    const b = B[m], pr = smooth(seg(s, b.o - .1, b.o + 1.25 + b.x));
    if (pr > 0) {
      const ip = d3.geoInterpolate([T[m - 1].lon, T[m - 1].lat], [T[m].lon, T[m].lat]);
      g.beginPath(); for (let q = 0; q <= 40; q++) { const p = projection(ip(pr * q / 40)); if (p) q ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.setLineDash([6, 7]); g.lineWidth = 2; g.strokeStyle = `rgba(${GREEN},.7)`; g.stroke(); g.setLineDash([]);
    }
  }
  const labels = c.k > 30 && m < 4;
  T.forEach((t, i) => {
    if (d3.geoDistance([t.lon, t.lat], [c.lon, c.lat]) > 1.45) return;
    const p = projection([t.lon, t.lat]); if (!p) return;
    const cur = i === m || m === 4, pulse = (now * .0009 + i * .25) % 1;
    if (cur) { g.strokeStyle = `rgba(${GREEN},${(.55 * (1 - pulse)).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 7 + pulse * 20, 0, 7); g.stroke(); }
    g.fillStyle = i === m ? `rgb(${DEEP})` : `rgb(${GREEN})`; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(p[0], p[1], i === m ? 7 : 5, 0, 7); g.fill(); g.stroke();
    if (labels) {
      g.fillStyle = i === m ? `rgb(${DEEP})` : `rgba(${DEEP},.7)`; g.font = (i === m ? '600 14px' : '500 12px') + ' "Space Grotesk", sans-serif'; g.fillText(t.name, p[0] + 13, p[1] + 4);
      if (i === m) { g.fillStyle = `rgba(${DEEP},.6)`; g.font = '500 11px "Space Grotesk", sans-serif'; g.fillText(t.place, p[0] + 13, p[1] + 19); }
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
// While a window is still small, a fine ring ties it to the pin it grew out of, then melts away.
function ring(x, y, r) {
  const a = 1 - smooth(seg(r, 30, 140)); if (a <= 0) return;
  const rr = Math.max(4, r - feather(r) * .5);
  fxc.beginPath(); fxc.arc(x, y, rr, 0, 7); fxc.lineWidth = 3; fxc.strokeStyle = `rgba(255,255,255,${(.95 * a).toFixed(3)})`; fxc.stroke();
  fxc.beginPath(); fxc.arc(x, y, rr + 2.5, 0, 7); fxc.lineWidth = 1.5; fxc.strokeStyle = `rgba(${GREEN},${(.85 * a).toFixed(3)})`; fxc.stroke();
}

// ---- Loading as the film approaches each layer ----
// AV1 is smaller and sharper, but only worth it where the device decodes it in hardware; decoding it
// in software would cost the very smoothness it is here for.
let av1 = false;
try {
  navigator.mediaCapabilities.decodingInfo({ type:'file', video:{ contentType:'video/mp4; codecs="av01.0.08M.08"', width:1920, height:1080, bitrate:4500000, framerate:30 } })
    .then(r => { av1 = !!(r.supported && r.powerEfficient && r.smooth); }).catch(() => {});
} catch {}
function load(l) {
  if (l.loaded) return; l.loaded = true;
  // On phones, each website shows its own phone layout.
  const phone = narrowQ.matches && l.kind === 'site';
  for (const im of l.imgs) if (im.dataset.src) {
    im.src = phone ? im.dataset.src.replace(/-(\d)\.webp$/, '-m$1.webp') : im.dataset.src; delete im.dataset.src;
    // decode ahead of time, off the main thread, so the first frame that shows it does not stall
    if (im.decode) im.decode().catch(() => {});
  }
  if (l.video) {
    const tall = W / H < .9, src = T[l.i].scene.video + (tall ? '-tall' : '');
    l.poster.src = src + '.webp'; l.video.src = src + (av1 ? '.av1.mp4' : '.mp4'); l.video.preload = 'auto';
  }
}
// Footage starts a little before its window opens, so the first frame you see is already moving.
function cue(l, s) {
  if (!l.video) return;
  const want = s > l.a - .5 && s < l.end;
  if (want === !!l.playing) return; l.playing = want;
  if (want) { load(l); try { l.video.currentTime = 0; } catch {} const p = l.video.play(); if (p) p.catch(() => {}); }
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
const css = (el, k, v) => { if (el['_' + k] === v) return; el['_' + k] = v; el.style[k] = v; };

// ---- One frame of the film ----
function render(s, now) {
  if (!W) return;
  fxc.clearRect(0, 0, W, H);
  let mapLayer = null;
  for (const l of L) {
    const on = s >= l.a && s < l.end;
    if (l.el) {
      if (s > l.a - 2.5) load(l);
      cue(l, s);
      if (on !== !!l.on) { l.on = on; l.el.classList.toggle('on', on); }
    } else if (on) mapLayer = l;
  }
  // The map: the dive, or a window onto it opening out of a website.
  mapWrap.classList.toggle('on', !!mapLayer);
  let pin = [W / 2, H / 2];
  if (mapLayer && projection && levels.length) {
    css(mapWrap, 'zIndex', String(mapLayer.j + 1));
    const c = camFor(mapLayer.m, s); setProj(c);
    const key = `${c.lon.toFixed(5)},${c.lat.toFixed(5)},${c.k.toFixed(3)},${c.ox.toFixed(1)},${c.oy.toFixed(1)},${W},${H},${levels[3].length},${levels[1].length}`;
    if (key !== lastKey) { lastKey = key; drawMap(c); }
    placeAtmo(c); drawPins(c, mapLayer.m, s, now);
    if (mapLayer.m <= 3) { const p = projection([T[mapLayer.m].lon, T[mapLayer.m].lat]); if (p) pin = p; }
    if (mapLayer.kind === 'map' && mapLayer.m > 0 && s < mapLayer.b) {
      const u = seg(s, mapLayer.a, mapLayer.b), r = grow(u, 6, cover(win.cx, win.cy));
      mask(mapWrap, win.cx, win.cy, r); ring(win.cx, win.cy, r);
    } else mask(mapWrap, 0, 0, null);
  }
  for (const l of L) {
    if (!l.el || !l.on) continue;
    const nx = l.next;
    if (l.kind === 'scene') {
      const b = B[l.i];
      if (s < l.b) {
        // The client's pin opens into the place.
        const u = seg(s, l.a, l.b), r = grow(u, 6, cover(pin[0], pin[1]));
        mask(l.el, pin[0], pin[1], r); ring(pin[0], pin[1], r);
      } else mask(l.el, 0, 0, null);
      // One long, easing push through the whole visit: quick as we arrive, slowing as we settle.
      const e = outQuart(seg(s, l.a, b.siteA + .6));
      const c = l.items ? Math.exp(lerp(Math.log(.72), Math.log(1.04), e)) : Math.exp(lerp(Math.log(.6), Math.log(1.16), e));
      css(l.content, 'transform', `scale(${c.toFixed(4)})`);
      if (l.items) {
        // Flying through the products, toward the one waiting at the end.
        const u = seg(s, l.a, b.siteB), camZ = lerp(-900, 3800, outCubic(u) * .55 + u * .45);
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
      // The website flies in from the middle of the place and lands in its spot, then the page
      // around it fades to beige. Its transform maps the window's final box onto where it is now.
      const u = seg(s, l.a, l.a + .5), e = outCubic(u);
      let k = Math.exp(lerp(Math.log(.14), 0, e)), cx = lerp(W / 2, win.cx, e), cy = lerp(H / 2, win.cy, e), fade = 1;
      if (u >= 1) {
        k = 1 + .02 * Math.max(0, s - l.b);
        if (nx && s >= nx.a) {
          // as the next window opens, lean into it, gently at first
          const u2 = seg(s, nx.a, nx.b);
          k *= nx.kind === 'map' ? Math.exp(.32 * u2 * u2) : 1 + .5 * smooth(u2);
          if (nx.kind === 'globe') fade = 1 - smooth(seg(s, nx.a + .1, nx.a + .65));
        }
      }
      css(l.content, 'transform', `translate(${(cx - win.cx * k).toFixed(2)}px,${(cy - win.cy * k).toFixed(2)}px) scale(${k.toFixed(4)})`);
      css(l.content, 'opacity', String(Math.round(smooth(seg(u, 0, .22)) * 1000) / 1000));
      css(l.backdrop, 'opacity', String(Math.round(smooth(seg(s, l.a + .3, l.b)) * 1000) / 1000));
      css(l.el, 'opacity', fade < 1 ? fade.toFixed(3) : '');
      // Three screens of the site, one after another, sliding up as if scrolling down the page.
      const nextA = nx ? nx.a : l.b + 1, q = seg(s, l.b - .2, nextA + .2) * 2;
      const steps = [0, smooth(seg(q, .3, .75)), smooth(seg(q, 1.3, 1.75))];
      l.shots.forEach((im, i) => {
        const y = Math.round(((i ? 1 - steps[i] : 0) - (steps[i + 1] || 0)) * 1000) / 10;
        css(im, 'transform', y ? `translateY(${y}%)` : '');
      });
    }
  }
  // Words
  const ia = 1 - smooth(seg(s, .04, .45));
  for (const el of introEls) setOp(el, ia, -30);
  setOp(outroEl, smooth(seg(s, G.b - .25, G.b + .2)), 24);
  caps.forEach((cp, i) => {
    const b = B[i], nextA = i < T.length - 1 ? B[i + 1].mapA : G.a;
    setOp(cp.scene, smooth(seg(s, b.sceneA + .4, b.sceneB)) * (1 - smooth(seg(s, b.siteA, b.siteA + .35))), 16);
    setOp(cp.site, smooth(seg(s, b.siteB - .3, b.siteB + .05)) * (1 - smooth(seg(s, nextA, nextA + .3))), 16);
  });
}

// ---- Scroll ----
// The page scroll is already smooth (Lenis on desktop, native momentum on touch), so the film
// follows it directly. Only a sudden jump, like a key press or a link, is eased here.
let sT = 0, sC = 0, raf = 0, lastNow = 0, onScreen = true, tick = 0;
// ?perf in the address records how long each frame of the film takes to draw, for testing.
const PERF = /[?&]perf(&|$)/.test(location.search) ? (window.__filmPerf = []) : null;
function frame(now) {
  raf = 0;
  const dt = Math.min(64, now - (lastNow || now)); lastNow = now;
  sT = STATIC ? 0 : clamp((scrollY - filmTop) / stageH, 0, END);
  const d = sT - sC;
  if (Math.abs(d) < .2 || Math.abs(d) > 3) sC = sT; else sC += d * (1 - Math.exp(-dt / 90));
  if (!STATIC && sC < .02) {
    idle = (idle + dt * .0035) % 360;
    // Resting at the top, the planet turns slowly enough that 30 frames a second look the same.
    if (sT === sC && (tick++ & 1)) { if (onScreen) raf = requestAnimationFrame(frame); return; }
  }
  if (PERF) { const t0 = performance.now(); render(sC, now); PERF.push([sC, performance.now() - t0]); } else render(sC, now);
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
addEventListener('load', () => { measure(); setTimeout(() => { if (!STATIC) load(L[1]); }, 1200); });
size(); kick();
})();
