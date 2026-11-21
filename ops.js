(() => {
'use strict';
// The opening of the site: one continuous scroll over a real globe. It turns to each client's
// location, dives into the country and down to the exact town, and lays the client's live site and
// figures over the map. The scroll drives it directly, so it moves with the finger.
const section = document.querySelector('.ops');
if (!section) return;
const q = sel => section.querySelector(sel);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const smooth = t => t * t * (3 - 2 * t);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 760px)');

// Clients, their real locations, and only facts true of each shipped site.
const T = [
  { name:'The Leisure Club', place:'Dik El-Mehdi, Lebanon', country:422, lat:33.9131, lon:35.6503, url:'leisure-nu.vercel.app', img:'assets/work/leisure-en.webp',
    line:'A family country club: fitness, pools, events and memberships, in three languages.', stats:[[15, 'PAGES'], [3, 'LANGUAGES'], [43, 'WEEKLY CLASSES']], built:['website design', 'development', '3 languages'], viz:'bars' },
  { name:'Enfantillage', place:'Mazraat Yachouh, Lebanon', country:422, lat:33.9405, lon:35.6745, url:'enfantillage', img:'assets/work/enfantillage-home.webp',
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', stats:[[592, 'TOYS'], [6, 'AGE GROUPS'], [5, 'WAYS TO BROWSE']], built:['storefront design', 'e-commerce', 'development'], viz:'dots' },
  { name:'Noma Living', place:'Hamra, Beirut', country:422, lat:33.8959, lon:35.4801, url:'noma living', img:'assets/work/noma-day.webp',
    line:'Student studios next to LAU, with a 3D walk-through rendered in Blender.', stats:[[530, '3D FRAMES'], [2, 'LOOKS'], [3, 'STUDIO TYPES']], built:['website design', '3D in blender', 'tour booking'], viz:'film' },
  { name:'First Nutrition', place:'Amman, Jordan', country:400, lat:31.9626, lon:35.9105, url:'first-nutrition.vercel.app', img:'assets/work/first-nutrition-home.webp',
    line:'An official supplement store in English and Arabic, with orders sent on WhatsApp.', stats:[[69, 'PRODUCTS'], [21, 'BRANDS'], [2, 'LANGUAGES']], built:['store design', 'react build', 'arabic rtl'], viz:'mirror' }
];
const COUNTRY = { 422:{ name:'LEBANON', lon:35.86, lat:33.88, k:62 }, 400:{ name:'JORDAN', lon:36.6, lat:31.3, k:26 } };
const CITIES = [['Beirut', 35.5018, 33.8938], ['Tripoli', 35.8497, 34.4367], ['Sidon', 35.3729, 33.5571], ['Byblos', 35.6511, 34.1236], ['Jounieh', 35.6178, 33.9808],
  ['Zahle', 35.9019, 33.8463], ['Damascus', 36.2765, 33.5138], ['Amman', 35.9284, 31.9454], ['Zarqa', 36.088, 32.0728], ['Irbid', 35.85, 32.5556], ['Aqaba', 35.0063, 29.5321]];
const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

// ---- Timeline over the section's scroll (0..1) ----
const TL = { hero:[0, .04], boot:[.02, .07], targets:[.1, .84], handoff:[.84, .92], final:[.93, 1] };
const slot = (TL.targets[1] - TL.targets[0]) / T.length;
const EXACT = 900; // the zoom where a 5 km ring fills about half the screen

// Camera keyframes: progress, longitude, latitude, zoom (times the globe), sideways offset (share of width).
const KF = [[0, 8, 26, 1, .2], [.05, 18, 28, 1.08, .04], [.1, 33, 31, 1.25, 0]];
T.forEach((t, i) => {
  const a = TL.targets[0] + slot * i, C = COUNTRY[t.country], nx = T[i + 1];
  KF.push([a + slot * .13, C.lon, C.lat, C.k, 0], [a + slot * .3, t.lon, t.lat, EXACT, 0],
    [a + slot * .42, t.lon, t.lat, EXACT * .86, .12], [a + slot * .8, t.lon + .004, t.lat + .002, EXACT * 1.12, .12]);
  if (nx) KF.push(nx.country === t.country ? [a + slot * .96, C.lon, C.lat, C.k * 1.8, 0] : [a + slot * .96, 35.6, 32.9, 15, 0]);
});
KF.push([.865, 36, 32.6, 15, 0], [.93, 28, 27, 1.15, 0], [1, 24, 25, 1.05, 0]);

// Monotone cubic interpolation per channel, so the camera glides through every key without stopping.
function spline(xs, ys) {
  const n = xs.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 3 * (xs[i + 1] - xs[i - 1]) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const xs = KF.map(k => k[0]);
const camLon = spline(xs, KF.map(k => k[1])), camLat = spline(xs, KF.map(k => k[2])), camZ = spline(xs, KF.map(k => Math.log(k[3]))), camOx = spline(xs, KF.map(k => k[4]));

// ---- Map data, served from the site itself ----
const script = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
const json = f => fetch(f).then(r => r.json());
let projection = null, path = null, grat = null, ready = false;
const levels = [];  // three detail levels, each a list of { id, c (centre), r (radius in radians), g (geometry) }
script('assets/vendor/d3-array.min.js').then(() => script('assets/vendor/d3-geo.min.js')).then(() => {
  projection = d3.geoOrthographic().clipAngle(90).precision(0);
  path = d3.geoPath(projection, cache.ctx); grat = d3.geoGraticule10();
  return json('assets/geo/world-low.json').then(low => {
    levels[0] = low; levels[1] = low; levels[2] = low; ready = true; dirty = true;
    return json('assets/geo/region-mid.json').then(mid => {
      const ids = new Set(mid.map(f => f.id)); levels[1] = low.filter(f => !ids.has(f.id)).concat(mid); levels[2] = levels[1]; dirty = true;
      return json('assets/geo/levant-high.json').then(high => { const near = new Set(high.map(f => f.id)); levels[2] = levels[1].filter(f => !near.has(f.id)).concat(high); dirty = true; });
    });
  });
}).catch(() => {});

// ---- Canvases: the map is drawn into a cache only when the camera moves; pins draw on top ----
const cv = q('.ops-world'), ctx = cv.getContext('2d');
const cache = { el:document.createElement('canvas') }; cache.ctx = cache.el.getContext('2d');
let W = 0, H = 0, DPR = 1, dirty = true, measured = false, siteBox = null;
function size() {
  // Phones resize the window as the address bar slides; only rebuild the canvases when the stage really changed.
  const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
  if (r.width === W && r.height === H && dpr === DPR) return;
  DPR = dpr; W = r.width; H = r.height;
  for (const c of [cv, cache.el]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); cache.ctx.setTransform(DPR, 0, 0, DPR, 0, 0); dirty = true; measured = false;
}
addEventListener('resize', size); size();
const G = '18,147,91', DEEP = '10,74,49';
const activeTarget = p => p < TL.targets[0] || p >= TL.targets[1] ? null : T[Math.min(T.length - 1, Math.floor((p - TL.targets[0]) / slot))];

let lastKey = '';
function camera(p) {
  const base = Math.min(W, H) * .34, z = Math.exp(camZ(p));
  return { lon:camLon(p), lat:camLat(p), z, R:base * z, ox:narrow.matches ? 0 : camOx(p) };
}
function drawMap(v, p) {
  const c = cache.ctx; c.clearRect(0, 0, W, H);
  if (v.R < Math.max(W, H) * 2.5) {
    const [cx, cy] = projection.translate(), g = c.createRadialGradient(cx, cy, v.R * .92, cx, cy, v.R * 1.16);
    g.addColorStop(0, 'rgba(159,227,195,0)'); g.addColorStop(.45, 'rgba(159,227,195,.32)'); g.addColorStop(1, 'rgba(159,227,195,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, v.R * 1.16, 0, 7); c.fill();
  }
  c.beginPath(); path({ type:'Sphere' }); c.fillStyle = '#f3fbf7'; c.fill();
  c.lineWidth = 1; c.strokeStyle = `rgba(${G},.13)`; c.beginPath(); path(grat); c.stroke();
  // Only countries that can be on screen: their bounding circle overlaps the visible cap of the globe.
  const reach = Math.asin(clamp((Math.hypot(W, H) / 2 + Math.abs(v.ox) * W) / v.R)) + .02;
  const list = levels[v.z > 30 ? 2 : v.z > 4 ? 1 : 0] || [], centre = [v.lon, v.lat], shown = [];
  for (const f of list) if (d3.geoDistance(f.c, centre) - f.r < reach) shown.push(f);
  c.beginPath(); for (const f of shown) path(f.g);
  c.fillStyle = '#e1f3e9'; c.fill(); c.lineWidth = v.z > 30 ? 1.2 : .8; c.strokeStyle = `rgba(${G},.6)`; c.stroke();
  const lit = seg(p, .07, .12);
  if (lit > 0) {
    c.beginPath(); for (const f of shown) if (f.id === 422 || f.id === 400) path(f.g);
    c.fillStyle = `rgba(159,227,195,${.75 * lit * (v.z > 30 ? .4 : 1)})`; c.fill(); c.lineWidth = 2; c.strokeStyle = `rgba(${G},${lit})`; c.stroke();
  }
  c.lineWidth = 1.5; c.strokeStyle = `rgba(${G},.6)`; c.beginPath(); path({ type:'Sphere' }); c.stroke();
  const cl = clamp((v.z - 8) / 10) * clamp((600 - v.z) / 300);
  c.textAlign = 'center';
  if (cl > 0) for (const id in COUNTRY) { const k = COUNTRY[id], s = projection([k.lon, k.lat]); if (!s) continue; c.font = `700 ${Math.round(11 + Math.min(v.z, 120) / 12)}px "Martian Mono", monospace`; c.fillStyle = `rgba(${DEEP},${.35 * cl})`; c.fillText(k.name, s[0], s[1] + (id === '422' ? 60 : 0)); }
  c.textAlign = 'left';
  const ca = clamp((v.z - 14) / 20);
  if (ca > 0) for (const [n, lon, lat] of CITIES) { if (d3.geoDistance([lon, lat], centre) > 1.4) continue; const s = projection([lon, lat]); if (!s) continue; c.fillStyle = `rgba(${DEEP},${.8 * ca})`; c.beginPath(); c.arc(s[0], s[1], 3, 0, 7); c.fill(); c.font = '500 10px "Martian Mono", monospace'; c.fillText(n.toUpperCase(), s[0] + 7, s[1] + 3); }
}

function drawOverlay(v, p, time) {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cache.el, 0, 0, W, H);
  const centre = [v.lon, v.lat], pxPerKm = v.R * Math.PI / 180 / 111.32;
  const rr = clamp((v.z - 250) / 300), at = activeTarget(p), ts = at && projection([at.lon, at.lat]);
  if (rr > 0 && ts) for (const km of [1, 2, 5]) { ctx.strokeStyle = `rgba(${G},${.45 * rr})`; ctx.setLineDash(km === 5 ? [] : [4, 6]); ctx.beginPath(); ctx.arc(ts[0], ts[1], km * pxPerKm, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = `rgba(${DEEP},${.7 * rr})`; ctx.font = '500 9.5px "Martian Mono", monospace'; ctx.fillText(`${km} KM`, ts[0] + km * pxPerKm + 5, ts[1] - 4); }
  for (let n = 0; n < T.length - 1; n++) {
    const a = TL.targets[0] + slot * (n + .8), done = seg(p, a, a + slot * .25); if (!done) continue;
    const ip = d3.geoInterpolate([T[n].lon, T[n].lat], [T[n + 1].lon, T[n + 1].lat]);
    ctx.strokeStyle = `rgba(${G},.9)`; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.beginPath();
    let last; for (let k = 0; k <= 40 * done; k++) { const s = projection(ip(k / 40)); if (!s) continue; last ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); last = s; }
    ctx.stroke(); ctx.setLineDash([]);
    if (last && done < 1) { ctx.fillStyle = `rgb(${G})`; ctx.beginPath(); ctx.arc(last[0], last[1], 5, 0, 7); ctx.fill(); }
  }
  T.forEach((t, n) => {
    if (d3.geoDistance([t.lon, t.lat], centre) > 1.5) return;
    const s = projection([t.lon, t.lat]); if (!s) return;
    const seen = p > TL.targets[0] + slot * (n + .3), pulse = reduce.matches ? .5 : (time * .0012 + n * .25) % 1;
    ctx.strokeStyle = `rgba(${G},${.6 * (1 - pulse)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s[0], s[1], 6 + pulse * 22, 0, 7); ctx.stroke();
    ctx.fillStyle = seen ? `rgb(${G})` : '#fff'; ctx.strokeStyle = `rgb(${G})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, 7); ctx.fill(); ctx.stroke();
    if (v.z < 10 && p > .09 && p < TL.targets[1]) { ctx.fillStyle = `rgb(${DEEP})`; ctx.font = '600 10px "Martian Mono", monospace'; ctx.fillText(t.name.toUpperCase(), s[0] + 10, s[1] + [-12, -26, 18, 18][n]); }
  });
  return pxPerKm;
}

// ---- HUD ----
const el = {
  hero:q('.ops-hero'), mode:q('.ops-mode'), clock:q('.ops-clock'), term:q('.ops-term'), scaleTxt:q('.ops-scale span'), scaleBar:q('.ops-scale i'), readout:q('.ops-readout'),
  ret:q('.ops-ret'), br:q('.ops-ret .br'), tname:q('.ops-coords b'), tlat:q('.ops-tlat'), tlon:q('.ops-tlon'), leader:q('.ops-leader'),
  site:q('.ops-site'), frame:q('.ops-frame'), tint:q('.ops-tint'), scan:q('.ops-scan'), url:q('.ops-url'), state:q('.ops-state'), tag:q('.ops-tag'),
  data:q('.ops-data'), handoff:q('.ops-handoff'), final:q('.ops-final'), strip:q('.ops-strip'), shots:q('.ops-shots')
};
el.shots.innerHTML = T.map(t => `<img src="${t.img}" alt="" decoding="async">`).join('');
const shotEls = [...el.shots.children];
el.strip.innerHTML = T.map((t, n) => `<div><span>T-0${n + 1} · ${t.lat.toFixed(3)}N ${t.lon.toFixed(3)}E</span><b>${t.name}</b></div>`).join('');
const stripEls = [...el.strip.children];
const BOOT = ['> envision.ops --link global', '  handshake ...................... OK', '  loading country borders ......... OK', '  clients located ................. 4', '  countries ........ LEBANON, JORDAN', '> begin sweep'];
function dataHTML(t, n) {
  const viz = { bars:`<div class="ops-bars">${t.stats.map(([v, l]) => `<div><i data-h="${Math.round(v / 43 * 100)}"></i>${l}</div>`).join('')}</div>`,
    dots:`<div class="ops-dots">${'<i></i>'.repeat(148)}</div>`,
    film:`<div class="ops-tick" data-to="530">0</div><div class="ops-film">${'<i></i>'.repeat(10)}</div>`,
    mirror:`<div>LAYOUT<span class="ops-lang"><span class="on">EN</span><span>ع</span></span></div><div class="ops-mirror"><i style="flex:2"></i><i style="flex:1"></i><i style="flex:1"></i></div>` }[t.viz];
  const gauges = t.built.map((b, k) => `<div class="ops-gauge"><svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="30"/><circle class="val" cx="40" cy="40" r="30" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-k="${k}"/><text x="40" y="46">✓</text></svg>${b.toUpperCase()}</div>`).join('');
  return `<span class="ops-where">T-0${n + 1} // ${t.place.toUpperCase()}</span><h3>${t.name}</h3><p>${t.line}</p>
    <div class="ops-box"><h4><span>SITE METRICS</span><span>VERIFIED</span></h4><div class="ops-stats">${t.stats.map(([v, l]) => `<div><b data-to="${v}">0</b><span>${l}</span></div>`).join('')}</div></div>
    <div class="ops-box"><h4><span>INSIDE THE BUILD</span><span>LIVE</span></h4><div class="ops-viz">${viz}</div></div>
    <div class="ops-box"><h4><span>WHAT WE BUILT</span><span>COMPLETE</span></h4><div class="ops-gauges">${gauges}</div></div>
    <div class="ops-box ops-log"></div>`;
}
// Everything the panel animates is looked up once per client, never per frame.
let shown = -1, P = null;
function showTarget(n) {
  if (n === shown) return; shown = n; const t = T[n];
  el.data.innerHTML = dataHTML(t, n); shotEls.forEach((s, k) => s.classList.toggle('on', k === n));
  el.url.textContent = `SRC // ${t.url}`; el.tag.textContent = `TARGET 0${n + 1} // ${t.name.toUpperCase()} // LIVE`;
  P = { counts:[...el.data.querySelectorAll('[data-to]')], bars:[...el.data.querySelectorAll('.ops-bars i')], dots:[...el.data.querySelectorAll('.ops-dots i')],
    film:el.data.querySelector('.ops-film'), mirror:el.data.querySelector('.ops-mirror'), lang:[...el.data.querySelectorAll('.ops-lang span')],
    gauges:[...el.data.querySelectorAll('.ops-gauge .val')], log:el.data.querySelector('.ops-log'), logHTML:'', dotsOn:-1, ar:null, last:{} };
}
const put = (key, node, prop, value) => { if (P && P.last[key] !== value) { P.last[key] = value; node.style[prop] = value; } };
// The site panel's resting box, read once per resize rather than on every frame.
function measure() { measured = true; siteBox = { left:el.site.offsetLeft, top:el.site.offsetTop, w:el.site.offsetWidth, h:el.site.offsetHeight }; }
const niceKm = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
let lastBoot = -1, lastClock = 0, lastRead = '', lastScale = '';

function hud(p, time, v, pxPerKm) {
  if (time - lastClock > 1000) { lastClock = time; const now = new Date(); el.clock.textContent = `UTC ${now.toISOString().slice(11, 19)} · BEIRUT ${now.toLocaleTimeString('en-GB', { timeZone:'Asia/Beirut' })}`; }
  const viewKm = W / pxPerKm;
  const read = `CENTER <b>${fmt(v.lat, 'N', 'S')} ${fmt(v.lon, 'E', 'W')}</b><br>VIEW WIDTH <b>${viewKm > 100 ? Math.round(viewKm).toLocaleString('en') : viewKm.toFixed(1)} KM</b>`;
  if (read !== lastRead) { lastRead = read; el.readout.innerHTML = read; }
  const km = niceKm.find(k => k * pxPerKm > 70) || 5000, scale = `${km}|${Math.round(Math.min(220, km * pxPerKm))}`;
  if (scale !== lastScale) { lastScale = scale; el.scaleTxt.textContent = `${km} KM`; el.scaleBar.style.width = `${Math.min(220, km * pxPerKm)}px`; }
  // the opening words leave as the camera starts to move
  const heroOut = seg(p, ...TL.hero);
  el.hero.style.opacity = 1 - heroOut; el.hero.style.setProperty('--hy', `${-heroOut * 60}px`);
  el.hero.style.visibility = heroOut >= 1 ? 'hidden' : 'visible';
  const lines = Math.floor(seg(p, ...TL.boot) * (BOOT.length + .99));
  if (lines !== lastBoot) { lastBoot = lines; el.term.innerHTML = BOOT.slice(0, lines).map(l => `<div class="${/OK|\d$|JORDAN/.test(l) ? 'ops-ok' : ''}">${l}</div>`).join(''); }
  el.term.style.opacity = 1 - seg(p, .09, .11);
  const inT = p >= TL.targets[0] && p < TL.targets[1];
  const local = (p - TL.targets[0]) / slot, n = clamp(Math.floor(local), 0, T.length - 1), s = inT ? local - n : 0;
  el.mode.textContent = p < TL.boot[1] ? 'STANDBY' : p < TL.targets[0] ? 'GLOBAL SWEEP' : inT ? (s < .13 ? `ACQUIRING ${COUNTRY[T[n].country].name}` : s < .3 ? 'DESCENT' : s < .82 ? 'TARGET LOCKED' : 'TRANSIT') : p < TL.handoff[1] ? 'NETWORK' : 'STANDBY';
  stripEls.forEach((d, k) => { d.classList.toggle('on', inT && k === n); d.classList.toggle('done', p > TL.targets[0] + slot * (k + .8)); });
  el.strip.style.opacity = seg(p, .08, .1) * (1 - seg(p, .85, .87));
  const t = T[n], pin = projection && projection([t.lon, t.lat]);
  el.ret.style.opacity = inT ? seg(s, .05, .12) * (1 - seg(s, .3, .38)) : 0;
  if (pin && inT && s < .4) el.ret.style.transform = `translate(${pin[0]}px,${pin[1]}px)`;
  if (inT && s < .4) el.br.setAttribute('transform', `scale(${1 + (1 - ease(seg(s, .08, .3))) * .9})`);
  if (inT) {
    showTarget(n);
    const lock = ease(seg(s, .1, .3)), jitter = reduce.matches ? 0 : 1 - lock;
    if (s < .4) {
      el.tname.textContent = lock < .98 ? `SCANNING ${COUNTRY[t.country].name}` : t.name.toUpperCase();
      el.tlat.textContent = fmt(t.lat + jitter * Math.sin(time * .02) * 1.2, 'N', 'S'); el.tlon.textContent = fmt(t.lon + jitter * Math.cos(time * .017) * 1.6, 'E', 'W');
    }
    const rev = ease(seg(s, .36, .52)), inA = smooth(seg(s, .33, .42)), out = smooth(seg(s, .82, .92)), sy = (1 - inA) * 40 - out * 30;
    put('so', el.site, 'opacity', String(inA * (1 - out)));
    el.site.style.setProperty('--sy', `${sy}px`); el.site.style.setProperty('--ss', .97 + rev * .03);
    put('ti', el.tint, 'opacity', String(1 - seg(s, .46, .6)));
    put('st', el.scan, 'top', `${rev * 100}%`); put('sc', el.scan, 'opacity', rev < 1 ? '1' : '0');
    put('cp', el.frame, 'clipPath', `inset(0 0 ${(1 - rev) * 100}% 0)`);
    const state = rev < 1 ? `DECRYPTING ${Math.round(rev * 100)}%` : 'ONLINE ●'; if (el.state.textContent !== state) el.state.textContent = state;
    if (pin && inA > 0 && !narrow.matches) {
      if (!measured) measure();
      const x0 = siteBox.left + siteBox.w, y0 = siteBox.top - siteBox.h / 2 + sy + siteBox.h * .3, dx = pin[0] - x0, dy = pin[1] - y0;
      el.leader.style.width = `${Math.hypot(dx, dy) * ease(seg(s, .4, .5))}px`; el.leader.style.transform = `translate(${x0}px,${y0}px) rotate(${Math.atan2(dy, dx)}rad)`; put('lo', el.leader, 'opacity', String(inA * (1 - out)));
    } else put('lo', el.leader, 'opacity', '0');
    const dIn = smooth(seg(s, .38, .48)), build = ease(seg(s, .42, .78));
    put('do', el.data, 'opacity', String(dIn * (1 - out))); el.data.style.setProperty('--dy', `${(1 - dIn) * 30 - out * 30}px`);
    for (const d of P.counts) { const v2 = String(Math.round(+d.dataset.to * build)); if (d.textContent !== v2) d.textContent = v2; }
    P.bars.forEach((d, k) => put('b' + k, d, 'height', `${+d.dataset.h * ease(seg(s, .46 + k * .06, .66 + k * .06))}%`));
    const on = Math.round(P.dots.length * build); if (on !== P.dotsOn) { P.dots.forEach((d, k) => d.classList.toggle('on', k < on)); P.dotsOn = on; }
    if (P.film) P.film.scrollLeft = build * 380 + (reduce.matches ? 0 : (time * .04) % 61);
    if (P.mirror) { const ar = s > .62; if (ar !== P.ar) { P.ar = ar; P.mirror.style.flexDirection = ar ? 'row-reverse' : 'row'; P.lang[0].classList.toggle('on', !ar); P.lang[1].classList.toggle('on', ar); } }
    P.gauges.forEach(d => { const o = String(100 - 100 * ease(seg(s, .52 + +d.dataset.k * .07, .68 + +d.dataset.k * .07))); if (d.getAttribute('stroke-dashoffset') !== o) d.setAttribute('stroke-dashoffset', o); });
    const logLines = [`> locate ${t.place.toLowerCase()}`, `  ${fmt(t.lat, 'N', 'S')} ${fmt(t.lon, 'E', 'W')}`, `> open ${t.url}`, ...t.built.map(x => `  ${x.padEnd(19, '.')} DONE`), '  status ............. LIVE'];
    const count = Math.floor(ease(seg(s, .44, .8)) * logLines.length);
    const html = logLines.slice(0, count).map(l => `<div class="${/DONE|LIVE|°/.test(l) ? 'ops-ok' : ''}">${l}</div>`).join('') + (count < logLines.length ? '<div>▍</div>' : '');
    if (html !== P.logHTML) { P.logHTML = html; P.log.innerHTML = html; }
  } else { el.site.style.opacity = 0; el.data.style.opacity = 0; el.leader.style.opacity = 0; }
  const h = seg(p, ...TL.handoff);
  el.handoff.style.opacity = h > 0 && h < 1 ? Math.sin(h * Math.PI) : 0;
  const f = seg(p, ...TL.final);
  el.final.style.opacity = ease(seg(f, .05, .4));
  el.final.style.visibility = f > 0 ? 'visible' : 'hidden';
}

// ---- Run only while the section is on screen. The map redraws only when the camera moved. ----
let running = false, raf = 0, pNow = -1, lastT = 0;
const finePointer = matchMedia('(pointer: fine)');
function progress() { const r = section.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); }
function frame(time) {
  raf = 0;
  // A mouse wheel moves in big steps, so it gets a short glide; touch stays tied to the finger.
  const target = progress(), dt = Math.min(64, time - (lastT || time)); lastT = time;
  pNow = pNow < 0 || reduce.matches || !finePointer.matches ? target : pNow + (target - pNow) * (1 - Math.exp(-dt / 90));
  if (Math.abs(target - pNow) < 1e-5) pNow = target;
  const p = pNow, v = camera(p);
  if (ready) {
    projection.rotate([-v.lon, -v.lat]).scale(v.R).translate([W / 2 + v.ox * W, H / 2]);
    const key = `${v.lon.toFixed(5)},${v.lat.toFixed(5)},${v.R.toFixed(2)},${v.ox.toFixed(4)},${W},${H},${seg(p, .07, .12).toFixed(2)},${levels[2] && levels[2].length}`;
    if (dirty || key !== lastKey) { lastKey = key; dirty = false; drawMap(v, p); }
    const pxPerKm = drawOverlay(v, p, time);
    hud(p, time, v, pxPerKm);
  } else hud(p, time, v, v.R * Math.PI / 180 / 111.32);
  if (running) raf = requestAnimationFrame(frame);
}
new IntersectionObserver(([e]) => {
  running = e.isIntersecting;
  if (running && !raf) { size(); pNow = -1; lastT = 0; raf = requestAnimationFrame(frame); }
}).observe(section);
// "See the work" jumps to where the camera turns towards the first client.
q('.ops-go')?.addEventListener('click', e => {
  e.preventDefault();
  const top = section.getBoundingClientRect().top + scrollY + (section.offsetHeight - innerHeight) * TL.targets[0];
  scrollTo({ top, behavior:reduce.matches ? 'auto' : 'smooth' });
});
})();
