(() => {
'use strict';
// Selected work as one continuous scroll: a real globe with country borders turns to each client's
// location, dives to the exact town, and lays the client's live site and figures over the map.
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

// ---- Story timeline over the section's scroll (0..1) ----
const TL = { boot:[0, .05], targets:[.1, .84], handoff:[.84, .92], final:[.93, 1] };
const slot = (TL.targets[1] - TL.targets[0]) / T.length;
const EXACT = 900; // the zoom where a 5 km ring fills about half the screen

// Camera keyframes: progress, longitude, latitude, zoom (times the globe), sideways offset (share of width).
const KF = [[0, -22, 24, .82, 0], [.05, 0, 26, 1, 0], [.1, 33, 31, 1.25, 0]];
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

// ---- Libraries and map data load only when the section comes near ----
const script = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/';
const LEVANT = new Set([422, 400, 760, 376, 275, 196, 818, 792, 368, 682]);
let projection = null, path = null, grat = null, layers = {}, started = false;
function boot() {
  if (started) return; started = true;
  script('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js').then(() => script('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js')).then(() => {
    projection = d3.geoOrthographic().clipAngle(90).precision(.4);
    path = d3.geoPath(projection, ctx); grat = d3.geoGraticule10();
    const take = (file, key, keep) => fetch(ATLAS + file).then(r => r.json()).then(topo => {
      const all = topojson.feature(topo, topo.objects.countries).features;
      layers[key] = { land:{ type:'FeatureCollection', features:keep ? all.filter(keep) : all }, clients:all.filter(f => +f.id === 422 || +f.id === 400), borders:topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b) };
    }).catch(() => {});
    take('countries-110m.json', 'low').then(() => take('countries-50m.json', 'mid')).then(() => take('countries-10m.json', 'high', f => LEVANT.has(+f.id)));
  }).catch(() => { started = false; });
}

// ---- Canvas ----
const cv = q('.ops-world'), ctx = cv.getContext('2d');
let W = 0, H = 0;
function size() { const dpr = Math.min(devicePixelRatio || 1, 1.75), r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
addEventListener('resize', size); size();
const G = '18,147,91', DEEP = '10,74,49';
const activeTarget = p => p < TL.targets[0] || p >= TL.targets[1] ? null : T[Math.min(T.length - 1, Math.floor((p - TL.targets[0]) / slot))];

function draw(p, time) {
  ctx.clearRect(0, 0, W, H);
  const base = Math.min(W, H) * .34, z = Math.exp(camZ(p)), lon = camLon(p), lat = camLat(p), R = base * z;
  const ox = narrow.matches ? 0 : camOx(p);
  const pxPerKm = R * Math.PI / 180 / 111.32;
  if (!projection) return { lon, lat, pxPerKm };
  projection.rotate([-lon - (p < .1 ? time * .0015 * (1 - p / .1) : 0), -lat]).scale(R).translate([W / 2 + ox * W, H / 2]);
  const L = z > 30 && layers.high ? layers.high : z > 4 && layers.mid ? layers.mid : layers.low || layers.mid;
  if (R < Math.max(W, H) * 2.5) {
    const [cx, cy] = projection.translate(), g = ctx.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.16);
    g.addColorStop(0, 'rgba(159,227,195,0)'); g.addColorStop(.45, 'rgba(159,227,195,.32)'); g.addColorStop(1, 'rgba(159,227,195,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 7); ctx.fill();
  }
  ctx.beginPath(); path({ type:'Sphere' }); ctx.fillStyle = '#f3fbf7'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${G},.13)`; ctx.beginPath(); path(grat); ctx.stroke();
  if (L) {
    ctx.beginPath(); path(L.land); ctx.fillStyle = '#e1f3e9'; ctx.fill();
    ctx.lineWidth = z > 30 ? 1.2 : .7; ctx.strokeStyle = `rgba(${G},.55)`; ctx.beginPath(); path(L.borders); ctx.stroke();
    ctx.lineWidth = 1.1; ctx.strokeStyle = `rgba(${DEEP},.5)`; ctx.beginPath(); path(L.land); ctx.stroke();
    const lit = seg(p, .07, .12);
    L.clients.forEach(f => { ctx.beginPath(); path(f); ctx.fillStyle = `rgba(159,227,195,${.75 * lit * (z > 30 ? .4 : 1)})`; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${G},${lit})`; ctx.stroke(); });
  }
  ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${G},.6)`; ctx.beginPath(); path({ type:'Sphere' }); ctx.stroke();
  // country names, then reference cities as the camera comes down
  const cl = clamp((z - 8) / 10) * clamp((600 - z) / 300);
  ctx.textAlign = 'center';
  if (cl > 0) for (const id in COUNTRY) { const c = COUNTRY[id], s = projection([c.lon, c.lat]); if (!s) continue; ctx.font = `700 ${Math.round(11 + Math.min(z, 120) / 12)}px "Martian Mono", monospace`; ctx.fillStyle = `rgba(${DEEP},${.35 * cl})`; ctx.fillText(c.name, s[0], s[1] + (id === '422' ? 60 : 0)); }
  ctx.textAlign = 'left';
  const ca = clamp((z - 14) / 20);
  if (ca > 0) CITIES.forEach(([n, clon, clat]) => { const s = projection([clon, clat]); if (!s || d3.geoDistance([clon, clat], [lon, lat]) > 1.4) return; ctx.fillStyle = `rgba(${DEEP},${.8 * ca})`; ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, 7); ctx.fill(); ctx.font = '500 10px "Martian Mono", monospace'; ctx.fillText(n.toUpperCase(), s[0] + 7, s[1] + 3); });
  // range rings in real kilometres around the client
  const rr = clamp((z - 250) / 300), at = activeTarget(p), ts = at && projection([at.lon, at.lat]);
  if (rr > 0 && ts) [1, 2, 5].forEach(km => { ctx.strokeStyle = `rgba(${G},${.45 * rr})`; ctx.setLineDash(km === 5 ? [] : [4, 6]); ctx.beginPath(); ctx.arc(ts[0], ts[1], km * pxPerKm, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = `rgba(${DEEP},${.7 * rr})`; ctx.font = '500 9.5px "Martian Mono", monospace'; ctx.fillText(`${km} KM`, ts[0] + km * pxPerKm + 5, ts[1] - 4); });
  // the route between clients
  for (let n = 0; n < T.length - 1; n++) {
    const a = TL.targets[0] + slot * (n + .8), done = seg(p, a, a + slot * .25); if (!done) continue;
    const ip = d3.geoInterpolate([T[n].lon, T[n].lat], [T[n + 1].lon, T[n + 1].lat]);
    ctx.strokeStyle = `rgba(${G},.9)`; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.beginPath();
    let last; for (let k = 0; k <= 48 * done; k++) { const s = projection(ip(k / 48)); if (!s) continue; last ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); last = s; }
    ctx.stroke(); ctx.setLineDash([]);
    if (last && done < 1) { ctx.fillStyle = `rgb(${G})`; ctx.beginPath(); ctx.arc(last[0], last[1], 5, 0, 7); ctx.fill(); }
  }
  // client pins
  T.forEach((t, n) => {
    const s = projection([t.lon, t.lat]); if (!s || d3.geoDistance([t.lon, t.lat], [lon, lat]) > 1.5) return;
    const seen = p > TL.targets[0] + slot * (n + .3), pulse = reduce.matches ? .5 : (time * .0012 + n * .25) % 1;
    ctx.strokeStyle = `rgba(${G},${.6 * (1 - pulse)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s[0], s[1], 6 + pulse * 22, 0, 7); ctx.stroke();
    ctx.fillStyle = seen ? `rgb(${G})` : '#fff'; ctx.strokeStyle = `rgb(${G})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, 7); ctx.fill(); ctx.stroke();
    if (z < 10 && p > .09 && p < TL.targets[1]) { ctx.fillStyle = `rgb(${DEEP})`; ctx.font = '600 10px "Martian Mono", monospace'; ctx.fillText(t.name.toUpperCase(), s[0] + 10, s[1] + [-12, -26, 18, 18][n]); }
  });
  return { lon, lat, pxPerKm };
}

// ---- HUD ----
const el = {
  mode:q('.ops-mode'), clock:q('.ops-clock'), term:q('.ops-term'), scaleTxt:q('.ops-scale span'), scaleBar:q('.ops-scale i'), readout:q('.ops-readout'),
  ret:q('.ops-ret'), br:q('.ops-ret .br'), tname:q('.ops-coords b'), tlat:q('.ops-tlat'), tlon:q('.ops-tlon'), leader:q('.ops-leader'),
  site:q('.ops-site'), frame:q('.ops-frame'), tint:q('.ops-tint'), scan:q('.ops-scan'), url:q('.ops-url'), state:q('.ops-state'), tag:q('.ops-tag'),
  data:q('.ops-data'), intro:q('.ops-intro'), handoff:q('.ops-handoff'), final:q('.ops-final'), strip:q('.ops-strip'), shots:q('.ops-shots')
};
el.shots.innerHTML = T.map(t => `<img src="${t.img}" alt="" decoding="async" loading="lazy">`).join('');
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
let shown = -1, lastBoot = -1, lastLog = '';
function showTarget(n) {
  if (n === shown) return; shown = n; const t = T[n];
  el.data.innerHTML = dataHTML(t, n); shotEls.forEach((s, k) => s.classList.toggle('on', k === n));
  el.url.textContent = `SRC // ${t.url}`; el.tag.textContent = `TARGET 0${n + 1} // ${t.name.toUpperCase()} // LIVE`; lastLog = '';
}
const niceKm = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

function hud(p, time, w) {
  const now = new Date();
  el.clock.textContent = `UTC ${now.toISOString().slice(11, 19)} · BEIRUT ${now.toLocaleTimeString('en-GB', { timeZone:'Asia/Beirut' })}`;
  const viewKm = W / w.pxPerKm;
  el.readout.innerHTML = `CENTER <b>${fmt(w.lat, 'N', 'S')} ${fmt(w.lon, 'E', 'W')}</b><br>VIEW WIDTH <b>${viewKm > 100 ? Math.round(viewKm).toLocaleString('en') : viewKm.toFixed(1)} KM</b>`;
  const km = niceKm.find(k => k * w.pxPerKm > 70) || 5000;
  el.scaleTxt.textContent = `${km} KM`; el.scaleBar.style.width = `${Math.min(220, km * w.pxPerKm)}px`;
  el.intro.style.opacity = 1 - seg(p, 0, .025);
  const lines = Math.floor(seg(p, .008, .07) * (BOOT.length + .99));
  if (lines !== lastBoot) { lastBoot = lines; el.term.innerHTML = BOOT.slice(0, lines).map(l => `<div class="${/OK|\d$|JORDAN/.test(l) ? 'ops-ok' : ''}">${l}</div>`).join(''); }
  el.term.style.opacity = 1 - seg(p, .09, .11);
  const inT = p >= TL.targets[0] && p < TL.targets[1];
  const local = (p - TL.targets[0]) / slot, n = clamp(Math.floor(local), 0, T.length - 1), s = inT ? local - n : 0;
  el.mode.textContent = p < TL.boot[1] ? 'BOOT' : p < TL.targets[0] ? 'GLOBAL SWEEP' : inT ? (s < .13 ? `ACQUIRING ${COUNTRY[T[n].country].name}` : s < .3 ? 'DESCENT' : s < .82 ? 'TARGET LOCKED' : 'TRANSIT') : p < TL.handoff[1] ? 'NETWORK' : 'STANDBY';
  stripEls.forEach((d, k) => { d.classList.toggle('on', inT && k === n); d.classList.toggle('done', p > TL.targets[0] + slot * (k + .8)); });
  el.strip.style.opacity = seg(p, .08, .1) * (1 - seg(p, .85, .87));
  const t = T[n], pin = projection && projection([t.lon, t.lat]);
  el.ret.style.opacity = inT ? seg(s, .05, .12) * (1 - seg(s, .3, .38)) : 0;
  if (pin) el.ret.style.transform = `translate(${pin[0]}px,${pin[1]}px)`;
  el.br.setAttribute('transform', `scale(${1 + (1 - ease(seg(s, .08, .3))) * .9})`);
  if (inT) {
    showTarget(n);
    const lock = ease(seg(s, .1, .3)), jitter = reduce.matches ? 0 : 1 - lock;
    el.tname.textContent = lock < .98 ? `SCANNING ${COUNTRY[t.country].name}` : t.name.toUpperCase();
    el.tlat.textContent = fmt(t.lat + jitter * Math.sin(time * .02) * 1.2, 'N', 'S'); el.tlon.textContent = fmt(t.lon + jitter * Math.cos(time * .017) * 1.6, 'E', 'W');
    const rev = ease(seg(s, .36, .52)), inA = smooth(seg(s, .33, .42)), out = smooth(seg(s, .82, .92));
    el.site.style.opacity = inA * (1 - out);
    el.site.style.setProperty('--sy', `${(1 - inA) * 40 - out * 30}px`); el.site.style.setProperty('--ss', .97 + rev * .03);
    el.tint.style.opacity = 1 - seg(s, .46, .6);
    el.scan.style.top = `${rev * 100}%`; el.scan.style.opacity = rev < 1 ? 1 : 0;
    el.frame.style.clipPath = `inset(0 0 ${(1 - rev) * 100}% 0)`;
    el.state.textContent = rev < 1 ? `DECRYPTING ${Math.round(rev * 100)}%` : 'ONLINE ●';
    if (pin && inA > 0 && !narrow.matches) {
      const sr = el.site.getBoundingClientRect(), x0 = sr.right, y0 = sr.top + sr.height * .3, dx = pin[0] - x0, dy = pin[1] - y0;
      el.leader.style.width = `${Math.hypot(dx, dy) * ease(seg(s, .4, .5))}px`; el.leader.style.transform = `translate(${x0}px,${y0}px) rotate(${Math.atan2(dy, dx)}rad)`; el.leader.style.opacity = inA * (1 - out);
    } else el.leader.style.opacity = 0;
    const dIn = smooth(seg(s, .38, .48)), build = ease(seg(s, .42, .78));
    el.data.style.opacity = dIn * (1 - out); el.data.style.setProperty('--dy', `${(1 - dIn) * 30 - out * 30}px`);
    el.data.querySelectorAll('[data-to]').forEach(d => d.textContent = Math.round(+d.dataset.to * build));
    el.data.querySelectorAll('.ops-bars i').forEach((d, k) => d.style.height = `${+d.dataset.h * ease(seg(s, .46 + k * .06, .66 + k * .06))}%`);
    const dots = [...el.data.querySelectorAll('.ops-dots i')]; dots.forEach((d, k) => d.classList.toggle('on', k < dots.length * build));
    const film = el.data.querySelector('.ops-film'); if (film) film.scrollLeft = build * 380 + (reduce.matches ? 0 : (time * .04) % 61);
    const mirror = el.data.querySelector('.ops-mirror'); if (mirror) { const ar = s > .62; mirror.style.flexDirection = ar ? 'row-reverse' : 'row'; const l = el.data.querySelectorAll('.ops-lang span'); l[0].classList.toggle('on', !ar); l[1].classList.toggle('on', ar); }
    el.data.querySelectorAll('.ops-gauge .val').forEach(d => d.setAttribute('stroke-dashoffset', 100 - 100 * ease(seg(s, .52 + +d.dataset.k * .07, .68 + +d.dataset.k * .07))));
    const logLines = [`> locate ${t.place.toLowerCase()}`, `  ${fmt(t.lat, 'N', 'S')} ${fmt(t.lon, 'E', 'W')}`, `> open ${t.url}`, ...t.built.map(x => `  ${x.padEnd(19, '.')} DONE`), '  status ............. LIVE'];
    const count = Math.floor(ease(seg(s, .44, .8)) * logLines.length);
    const html = logLines.slice(0, count).map(l => `<div class="${/DONE|LIVE|°/.test(l) ? 'ops-ok' : ''}">${l}</div>`).join('') + (count < logLines.length ? '<div>▍</div>' : '');
    if (html !== lastLog) { lastLog = html; const log = el.data.querySelector('.ops-log'); if (log) log.innerHTML = html; }
  } else { el.site.style.opacity = 0; el.data.style.opacity = 0; el.leader.style.opacity = 0; }
  const h = seg(p, ...TL.handoff);
  el.handoff.style.opacity = h > 0 && h < 1 ? Math.sin(h * Math.PI) : 0;
  const f = seg(p, ...TL.final);
  el.final.style.opacity = ease(seg(f, .05, .4));
  el.final.style.pointerEvents = f > .2 ? 'auto' : 'none';
  el.final.style.visibility = f > 0 ? 'visible' : 'hidden';
}

// ---- Run only while the section is on screen; ease the scroll so motion glides at any refresh rate ----
let pNow = 0, last = 0, running = false, raf = 0;
function progress() { const r = section.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); }
function frame(time) {
  const dt = Math.min(64, time - (last || time)); last = time;
  const target = progress();
  pNow = reduce.matches ? target : pNow + (target - pNow) * (1 - Math.exp(-dt / 140));
  if (Math.abs(target - pNow) < 1e-5) pNow = target;
  const w = draw(pNow, time); hud(pNow, time, w);
  raf = running ? requestAnimationFrame(frame) : 0;
}
new IntersectionObserver(([e]) => { if (e.isIntersecting) boot(); }, { rootMargin:'150% 0px' }).observe(section);
new IntersectionObserver(([e]) => {
  running = e.isIntersecting;
  if (running && !raf) { size(); pNow = progress(); last = 0; raf = requestAnimationFrame(frame); }
}).observe(section);
})();
