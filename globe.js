(() => {
'use strict';
// The opening globe: hover a client or a country for a short pop-up, click to fly into the country,
// click a client to go down to the exact town. Drag turns the globe. The map is drawn only when the
// camera moves; pins and highlights draw on top of that cached map.
const box = document.querySelector('.gh-globe');
if (!box) return;
const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
const pop = box.querySelector('.gh-pop'), card = box.querySelector('.gh-card'), back = box.querySelector('.gh-back');
const chips = [...document.querySelectorAll('.gh-chips button')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Clients, their real locations, and only facts true of each shipped site.
const T = [
  { name:'The Leisure Club', place:'Dik El-Mehdi, Lebanon', country:422, lon:35.6503, lat:33.9131, img:'assets/work/leisure-en.webp', url:'https://leisure-nu.vercel.app',
    line:'A family country club: fitness, pools, Leisure Island, events and memberships in one calm website.', facts:'15 pages · 3 languages · 43 weekly classes' },
  { name:'Enfantillage', place:'Mazraat Yachouh, Lebanon', country:422, lon:35.6745, lat:33.9405, img:'assets/work/enfantillage-home.webp',
    line:'Lebanon’s family toy store, shoppable by age, brand or favourite character.', facts:'592 toys · 6 age groups · 5 ways to browse' },
  { name:'Noma Living', place:'Hamra, Beirut', country:422, lon:35.4801, lat:33.8959, img:'assets/work/noma-day.webp',
    line:'Furnished student studios next to LAU, with a 3D walk-through we rendered in Blender.', facts:'3D walk-through · day and night · 3 studio types' },
  { name:'First Nutrition', place:'Amman, Jordan', country:400, lon:35.9105, lat:31.9626, img:'assets/work/first-nutrition-home.webp', url:'https://first-nutrition.vercel.app',
    line:'An official supplement store in English and Arabic, with orders sent on WhatsApp.', facts:'69 products · 21 brands · English and Arabic' }
];
const CLIENT_COUNTRY = { 422:{ lon:35.86, lat:33.88, k:46 }, 400:{ lon:36.6, lat:31.3, k:20 } };
const CITIES = [['Beirut', 35.5018, 33.8938], ['Tripoli', 35.8497, 34.4367], ['Sidon', 35.3729, 33.5571], ['Byblos', 35.6511, 34.1236], ['Zahle', 35.9019, 33.8463],
  ['Damascus', 36.2765, 33.5138], ['Amman', 35.9284, 31.9454], ['Zarqa', 36.088, 32.0728], ['Irbid', 35.85, 32.5556], ['Aqaba', 35.0063, 29.5321]];
const HOME = { lon:28, lat:30, k:1, ox:0, oy:0 }, PIN_K = 240;
const narrow = matchMedia('(max-width: 860px)');
const pinOffset = () => narrow.matches ? { ox:0, oy:-.22 } : { ox:.17, oy:-.17 };

// ---- Map data and library, served from the site ----
const script = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
const json = f => fetch(f).then(r => r.json());
let projection = null, path = null, grat = null, levels = [], dirty = true;
const cache = document.createElement('canvas'), cctx = cache.getContext('2d');
script('assets/vendor/d3-array.min.js').then(() => script('assets/vendor/d3-geo.min.js')).then(() => {
  projection = d3.geoOrthographic().clipAngle(90).precision(0);
  path = d3.geoPath(projection, cctx); grat = d3.geoGraticule10();
  return json('assets/geo/world-low.json').then(low => {
    levels = [low, low, low]; dirty = true; kick();
    return json('assets/geo/region-mid.json').then(mid => {
      const ids = new Set(mid.map(f => f.id)); levels[1] = low.filter(f => !ids.has(f.id)).concat(mid); levels[2] = levels[1]; dirty = true; kick();
      return json('assets/geo/levant-high.json').then(high => { const near = new Set(high.map(f => f.id)); levels[2] = levels[1].filter(f => !near.has(f.id)).concat(high); dirty = true; kick(); });
    });
  });
}).catch(() => {});

// ---- Size ----
let W = 0, H = 0, DPR = 1, base = 1;
function size() {
  const r = box.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (r.width === W && r.height === H && dpr === DPR) return;
  W = r.width; H = r.height; DPR = dpr; base = Math.min(W, H) * .44;
  for (const c of [cv, cache]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); cctx.setTransform(DPR, 0, 0, DPR, 0, 0); dirty = true; kick();
}
new ResizeObserver(size).observe(box);

// ---- Camera and smooth flights between views ----
const cam = { ...HOME };
let flight = null, level = 'globe', focus = null, hover = null, drag = null, lastInteract = -1e9;
function flyTo(to, ms) {
  const from = { ...cam }, dist = Math.abs(Math.log(to.k / from.k));
  const dur = reduce.matches ? 1 : ms || clamp(700 + dist * 170, 700, 1900);
  flight = { from, to, t0:performance.now(), dur, path:d3.geoInterpolate([from.lon, from.lat], [to.lon, to.lat]) };
  kick();
}
function step(now) {
  if (!flight) return;
  const t = clamp((now - flight.t0) / flight.dur), e = io(t);
  // The centre leads and the zoom follows, so the camera slides over before it dives.
  const [lon, lat] = flight.path(io(clamp(t * 1.25))); cam.lon = lon; cam.lat = lat;
  cam.k = Math.exp(Math.log(flight.from.k) + (Math.log(flight.to.k) - Math.log(flight.from.k)) * e);
  cam.ox = flight.from.ox + ((flight.to.ox ?? 0) - flight.from.ox) * e; cam.oy = flight.from.oy + ((flight.to.oy ?? 0) - flight.from.oy) * e;
  if (t >= 1) flight = null;
}
const levelList = () => levels[cam.k > 24 ? 2 : cam.k > 3 ? 1 : 0] || [];
function visible(f) {
  const reach = Math.asin(clamp((Math.hypot(W, H) / 2 + Math.hypot(cam.ox * W, cam.oy * H)) / (base * cam.k))) + .02;
  return d3.geoDistance(f.c, [cam.lon, cam.lat]) - f.r < reach;
}

// ---- Drawing ----
const GREEN = '29,107,74', DEEP = '13,70,48';
let lastKey = '';
function drawMap() {
  const c = cctx, R = base * cam.k; c.clearRect(0, 0, W, H);
  if (R < Math.max(W, H) * 2.5) {
    const [cx, cy] = projection.translate(), g = c.createRadialGradient(cx, cy, R * .94, cx, cy, R * 1.14);
    g.addColorStop(0, 'rgba(70,201,145,0)'); g.addColorStop(.4, 'rgba(70,201,145,.18)'); g.addColorStop(1, 'rgba(70,201,145,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.14, 0, 7); c.fill();
  }
  c.beginPath(); path({ type:'Sphere' }); c.fillStyle = '#f7f2e9'; c.fill();
  c.lineWidth = 1; c.strokeStyle = `rgba(${GREEN},.09)`; c.beginPath(); path(grat); c.stroke();
  const shown = levelList().filter(visible);
  c.beginPath(); for (const f of shown) path(f.g);
  c.fillStyle = '#e3e6d6'; c.fill(); c.lineWidth = cam.k > 24 ? 1.1 : .7; c.strokeStyle = `rgba(${GREEN},.42)`; c.stroke();
  c.beginPath(); for (const f of shown) if (CLIENT_COUNTRY[f.id]) path(f.g);
  c.fillStyle = `rgba(70,201,145,${cam.k > 60 ? .14 : .3})`; c.fill(); c.lineWidth = 1.6; c.strokeStyle = `rgba(${GREEN},.85)`; c.stroke();
  c.lineWidth = 1.2; c.strokeStyle = `rgba(${GREEN},.45)`; c.beginPath(); path({ type:'Sphere' }); c.stroke();
  const cityA = clamp((cam.k - 12) / 16);
  if (cityA > 0) for (const [n, lon, lat] of CITIES) {
    if (d3.geoDistance([lon, lat], [cam.lon, cam.lat]) > 1.2) continue;
    const s = projection([lon, lat]); if (!s) continue;
    c.fillStyle = `rgba(${DEEP},${.55 * cityA})`; c.beginPath(); c.arc(s[0], s[1], 2.4, 0, 7); c.fill();
    c.font = '500 11px "Space Grotesk", sans-serif'; c.fillText(n, s[0] + 6, s[1] + 4);
  }
}
function pinsOnScreen() {
  return T.map((t, i) => { if (d3.geoDistance([t.lon, t.lat], [cam.lon, cam.lat]) > 1.45) return null; const s = projection([t.lon, t.lat]); return s && { i, x:s[0], y:s[1] }; }).filter(Boolean);
}
function draw(now) {
  projection.rotate([-cam.lon, -cam.lat]).scale(base * cam.k).translate([W / 2 + cam.ox * W, H / 2 + cam.oy * H]);
  const key = `${cam.lon.toFixed(4)},${cam.lat.toFixed(4)},${cam.k.toFixed(4)},${cam.ox.toFixed(4)},${cam.oy.toFixed(4)},${W},${H},${levels[2] && levels[2].length}`;
  if (dirty || key !== lastKey) { lastKey = key; dirty = false; drawMap(); }
  ctx.clearRect(0, 0, W, H); ctx.drawImage(cache, 0, 0, W, H);
  // hovered country outline
  if (hover && hover.type === 'country') {
    const p2 = d3.geoPath(projection, ctx); ctx.beginPath(); p2(hover.f.g);
    ctx.fillStyle = `rgba(${GREEN},.12)`; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${DEEP},.9)`; ctx.stroke();
  }
  // client pins, with a slow pulse; close together in Lebanon, so labels show only once zoomed in
  const pins = pinsOnScreen();
  for (const p of pins) {
    const on = (hover && hover.type === 'pin' && hover.i === p.i) || (level === 'pin' && focus === p.i);
    const pulse = reduce.matches ? .4 : (now * .0009 + p.i * .25) % 1;
    ctx.strokeStyle = `rgba(${GREEN},${.55 * (1 - pulse)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + pulse * 18, 0, 7); ctx.stroke();
    ctx.fillStyle = on ? `rgb(${DEEP})` : `rgb(${GREEN})`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, on ? 8 : 6, 0, 7); ctx.fill(); ctx.stroke();
    if (cam.k > 30) { ctx.fillStyle = `rgb(${DEEP})`; ctx.font = '600 13px "Space Grotesk", sans-serif'; ctx.fillText(T[p.i].name, p.x + 12, p.y + 4); }
  }
  // range rings around the client when down at town level
  if (level === 'pin' && focus !== null && cam.k > 150) {
    const p = pins.find(q => q.i === focus), pxKm = base * cam.k * Math.PI / 180 / 111.32;
    if (p) for (const km of [1, 3]) { ctx.strokeStyle = `rgba(${GREEN},.35)`; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, km * pxKm, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = `rgba(${DEEP},.6)`; ctx.font = '500 11px "Space Grotesk", sans-serif'; ctx.fillText(`${km} km`, p.x + km * pxKm + 5, p.y - 4); }
  }
  placePop();
}

// ---- Pop-ups and the project card ----
let popKey = '';
function placePop() {
  // No pop-up over the client whose card is already open.
  const open = hover && hover.type === 'pin' && level === 'pin' && focus === hover.i;
  if (!hover || drag || open) { if (!pop.hidden) pop.hidden = true; popKey = ''; return; }
  let html, x, y;
  if (hover.type === 'pin') {
    const t = T[hover.i], s = projection([t.lon, t.lat]); if (!s) { pop.hidden = true; return; }
    html = `<b>${t.name}</b><span>${t.place}</span><img src="${t.img}" alt=""><em>Click to zoom in</em>`; x = s[0]; y = s[1];
  } else {
    const n = T.filter(t => t.country === hover.f.id);
    html = `<b>${hover.f.n}</b>${n.length ? `<span>${n.length === 1 ? n[0].name : `${n.length} projects: ${n.map(t => t.name).join(', ')}`}</span><em>Click to zoom in</em>` : ''}`; x = hover.x; y = hover.y;
  }
  if (html !== popKey) { popKey = html; pop.innerHTML = html; }
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const left = clamp(x + 16, 0, W - pw), top = y - ph - 14 < 0 ? y + 18 : y - ph - 14;
  pop.style.transform = `translate(${left}px,${top}px)`;
}
function showCard(i) {
  if (i === null) { card.hidden = true; return; }
  const t = T[i];
  card.innerHTML = `<img src="${t.img}" alt="${t.name} website"><h2>${t.name}</h2><p class="gh-place">${t.place}</p><p>${t.line}</p><p class="gh-facts">${t.facts}</p>${t.url ? `<a href="${t.url}" target="_blank" rel="noopener">Visit the live site ↗</a>` : ''}`;
  card.hidden = false;
}
function setLevel(next, f) {
  level = next; focus = f;
  back.hidden = level === 'globe';
  showCard(level === 'pin' ? focus : null);
  chips.forEach((c, k) => c.setAttribute('aria-pressed', String(level === 'pin' && focus === k)));
}
function goPin(i) { const t = T[i]; setLevel('pin', i); flyTo({ lon:t.lon, lat:t.lat, k:PIN_K, ...pinOffset() }); }
function goCountry(f) {
  const known = CLIENT_COUNTRY[f.id];
  const k = known ? known.k : clamp(.95 / Math.sin(Math.max(.02, f.r)), 1.6, 60);
  setLevel('country', f.id); flyTo(known ? { lon:known.lon, lat:known.lat, k, ox:0, oy:0 } : { lon:f.c[0], lat:f.c[1], k, ox:0, oy:0 });
}
back.addEventListener('click', () => {
  if (level === 'pin') { const id = T[focus].country, f = (levels[1] || []).find(x => x.id === id); f ? goCountry(f) : (setLevel('globe', null), flyTo(HOME)); }
  else { setLevel('globe', null); flyTo(HOME); }
});
chips.forEach((c, k) => c.addEventListener('click', () => goPin(k)));

// ---- Pointer: hover, click, drag ----
function hitTest(x, y) {
  if (!projection) return null;
  for (const p of pinsOnScreen()) if (Math.hypot(p.x - x, p.y - y) < 16) return { type:'pin', i:p.i };
  const ll = projection.invert([x, y]);
  if (!ll || d3.geoDistance(ll, [cam.lon, cam.lat]) > Math.PI / 2) return null;
  const f = levelList().find(g => visible(g) && d3.geoContains(g.g, ll));
  return f ? { type:'country', f, x, y } : null;
}
const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
let pending = null;
cv.addEventListener('pointermove', e => {
  const [x, y] = local(e);
  if (drag) {
    const dx = x - drag.x, dy = y - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; cv.classList.add('is-dragging'); flight = null; }
    if (drag.moved) {
      const deg = 180 / Math.PI / (base * cam.k);
      cam.lon = drag.lon - dx * deg;
      if (e.pointerType === 'mouse') cam.lat = clamp(drag.lat + dy * deg, -75, 75);
      lastInteract = performance.now(); kick();
    }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  pending = [x, y]; kick();
});
cv.addEventListener('pointerleave', () => { hover = null; pending = null; cv.classList.remove('is-pointing'); kick(); });
cv.addEventListener('pointerdown', e => { const [x, y] = local(e); drag = { x, y, lon:cam.lon, lat:cam.lat, moved:false, id:e.pointerId }; lastInteract = performance.now(); });
addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null; cv.classList.remove('is-dragging');
  if (d.moved) return;
  // A tap or click: a client opens its town, a country flies in.
  const [x, y] = local(e), hit = hitTest(x, y);
  if (hit && hit.type === 'pin') goPin(hit.i);
  else if (hit && hit.type === 'country') goCountry(hit.f);
  lastInteract = performance.now();
});
addEventListener('pointercancel', () => { drag = null; cv.classList.remove('is-dragging'); });

// ---- Loop: runs only while something is moving or the globe is on screen ----
let raf = 0, onScreen = true, lastNow = 0;
function frame(now) {
  raf = 0;
  if (!projection || !levels.length) return;
  const dt = Math.min(64, now - (lastNow || now)); lastNow = now;
  step(now);
  // A slow turn while nobody is using the globe.
  if (level === 'globe' && !flight && !drag && !hover && !reduce.matches && now - lastInteract > 2500) cam.lon += dt * .004;
  if (pending) { hover = hitTest(...pending); pending = null; cv.classList.toggle('is-pointing', !!hover); }
  draw(now);
  if (onScreen) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf && onScreen) raf = requestAnimationFrame(frame); }
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { lastNow = 0; kick(); } }).observe(box);
size();
})();
