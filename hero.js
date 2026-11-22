(() => {
'use strict';
// "Ideas into impact", told in particles. Thousands of points drift in as a loose cloud of ideas and
// gather into the Envision mark. Scrolling reshapes them into each thing we build: a website, a
// software dashboard, an AI assistant, a film camera, and finally the word "impact.". Everything
// moves on the graphics card (WebGL); the page only reads the scroll and the pointer.
const sec = document.querySelector('.ideas');
if (!sec) return;
const stage = sec.querySelector('.ideas-stage'), canvas = sec.querySelector('.ideas-gl');
const steps = [...sec.querySelectorAll('.ideas-step')], intro = [...sec.querySelectorAll('[data-ideas-intro]')], finale = sec.querySelector('.ideas-finale');
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), narrowQ = matchMedia('(max-width: 860px)'), fineQ = matchMedia('(pointer: fine)');
const STATIC = reduce.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (s, a, b) => clamp((s - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- Timeline, in screens of scroll: a hold for each shape, a morph between each pair ----
const HOLD = [[0, .35], [.9, 1.55], [2.1, 2.75], [3.3, 3.95], [4.5, 5.15], [5.7, 6.2]];
const END = 6.2, CLOUD = 6;
sec.style.setProperty('--ideas-screens', String(END + 1));
function stateAt(s) {
  if (s <= HOLD[0][1]) return [0, 0, 0];
  for (let k = 0; k < HOLD.length - 1; k++) {
    if (s < HOLD[k + 1][0]) return s <= HOLD[k][1] ? [k, k, 0] : [k, k + 1, seg(s, HOLD[k][1], HOLD[k + 1][0])];
  }
  return [HOLD.length - 1, HOLD.length - 1, 0];
}

// ---- WebGL ----
const gl = canvas.getContext('webgl', { alpha:true, premultipliedAlpha:false, antialias:false, powerPreference:'high-performance' });
if (!gl) { sec.classList.add('no-gl'); return; }
const VS = `
attribute vec3 aFrom; attribute vec3 aTo; attribute vec4 aSeed;
uniform mat4 uProj; uniform mat4 uView;
uniform float uMix; uniform float uTime; uniform float uSize; uniform float uAspect; uniform float uPull;
uniform vec2 uMouse;
varying vec3 vC; varying float vA;
const vec3 DEEP = vec3(.035, .22, .15);
const vec3 MID = vec3(.09, .40, .27);
const vec3 MINT = vec3(.275, .788, .569);
void main() {
  // each particle sets off a little after the one before it, so shapes sweep into each other
  float m = clamp((uMix - aSeed.x * .45) / .55, 0., 1.);
  m = m * m * (3. - 2. * m);
  vec3 p = mix(aFrom, aTo, m);
  // on the way, it lifts out of the plane and swirls
  float arc = sin(3.14159 * m), ang = aSeed.y * 6.2832 + uTime * .35;
  p += arc * vec3(cos(ang) * 60., sin(ang) * 60., (aSeed.z - .5) * 190.);
  // and it always breathes a little
  p += vec3(sin(uTime * .8 + aSeed.x * 40.), cos(uTime * .7 + aSeed.y * 40.), sin(uTime * .6 + aSeed.z * 40.)) * 2.6;
  vec4 mv = uView * vec4(p, 1.);
  vec4 c = uProj * mv;
  // the pointer gently pushes particles aside
  vec2 ndc = c.xy / c.w, d = (ndc - uMouse) * vec2(uAspect, 1.);
  float dist = length(d);
  ndc += d / max(dist, 1e-4) * vec2(1. / uAspect, 1.) * .055 * uPull * smoothstep(.24, 0., dist);
  gl_Position = vec4(ndc * c.w, c.z, c.w);
  gl_PointSize = uSize * (.65 + aSeed.z * .7) * (1. + arc * .5) * 1000. / -mv.z;
  float g = clamp((p.x + 460.) / 920., 0., 1.);
  vC = mix(mix(DEEP, MID, g), MINT, clamp((aSeed.w - .7) * 3.3, 0., 1.));
  vA = .9 + .1 * aSeed.w;
}`;
const FS = `
precision mediump float;
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - .5);
  if (r > .5) discard;
  gl_FragColor = vec4(vC, vA * smoothstep(.5, .3, r));
}`;
function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { sec.classList.add('no-gl'); return; }
gl.useProgram(prog);
const loc = n => gl.getAttribLocation(prog, n), uni = n => gl.getUniformLocation(prog, n);
const A = { from:loc('aFrom'), to:loc('aTo'), seed:loc('aSeed') };
const U = { proj:uni('uProj'), view:uni('uView'), mix:uni('uMix'), time:uni('uTime'), size:uni('uSize'), aspect:uni('uAspect'), pull:uni('uPull'), mouse:uni('uMouse') };
gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);

// ---- The shapes, drawn on a hidden canvas and turned into points ----
const N = narrowQ.matches ? 15000 : 30000;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const line = (g, x1, y1, x2, y2, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
const sparkle = (g, x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); };
const DRAW = [
  // 0 the Envision mark
  (g, img) => { const w = 780, h = w * img.height / img.width; g.drawImage(img, 500 - w / 2, 500 - h / 2, w, h); },
  // 1 a website: a headline and a button beside a picture, three cards beneath; all in clean lines,
  // so its particles sit as densely as in the other shapes
  g => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 14; rr(g, 110, 170, 780, 580, 36); g.stroke(); line(g, 110, 250, 890, 250, 12);
    [160, 196, 232].forEach(x => dot(g, x, 210, 11)); g.lineWidth = 9; rr(g, 300, 192, 380, 36, 18); g.stroke();
    line(g, 172, 322, 468, 322, 34); line(g, 172, 372, 418, 372, 34); line(g, 172, 418, 380, 418, 14); line(g, 172, 448, 340, 448, 14);
    rr(g, 170, 474, 150, 44, 22); g.fill();
    g.lineWidth = 12; rr(g, 520, 292, 320, 222, 18); g.stroke();
    g.beginPath(); g.moveTo(546, 488); g.lineTo(626, 398); g.lineTo(682, 452); g.lineTo(732, 406); g.lineTo(816, 488); g.stroke();
    dot(g, 772, 346, 22);
    for (const x of [170, 393, 616]) { g.lineWidth = 12; rr(g, x, 560, 204, 150, 18); g.stroke(); dot(g, x + 36, 598, 14); line(g, x + 26, 640, x + 160, 640, 16); line(g, x + 26, 672, x + 120, 672, 13); }
  },
  // 2 a software dashboard
  g => {
    g.lineCap = 'round'; g.lineWidth = 14; rr(g, 100, 160, 800, 600, 34); g.stroke(); line(g, 270, 160, 270, 760, 12);
    [230, 290, 350, 410, 470].forEach((y, k) => { g.globalAlpha = k ? .55 : 1; line(g, 145, y, k ? 220 : 235, y, 20); }); g.globalAlpha = 1;
    for (const x of [310, 510, 710]) { g.lineWidth = 10; rr(g, x, 200, 160, 100, 16); g.stroke(); line(g, x + 24, 236, x + 70, 236, 17); line(g, x + 24, 268, x + 120, 268, 26); }
    [150, 230, 190, 290, 250, 330, 280].forEach((hh, k) => { const x = 320 + k * 46; g.globalAlpha = .9; rr(g, x, 720 - hh, 28, hh, 8); g.fill(); }); g.globalAlpha = 1;
    g.lineWidth = 14; g.lineJoin = 'round'; g.beginPath(); [[660, 650], [705, 600], [750, 620], [795, 520], [850, 470]].forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    [[660, 650], [705, 600], [750, 620], [795, 520], [850, 470]].forEach(([x, y]) => dot(g, x, y, 13));
    g.lineWidth = 10; rr(g, 640, 340, 230, 380, 18); g.stroke();
  },
  // 3 an AI assistant: a big sparkle, two small ones, an orbit, a conversation
  g => {
    sparkle(g, 430, 430, 250); sparkle(g, 735, 230, 92); sparkle(g, 770, 610, 58);
    g.lineWidth = 10; g.globalAlpha = .6; g.beginPath(); g.ellipse(470, 450, 360, 140, -.35, 0, 7); g.stroke(); g.globalAlpha = 1;
    g.lineCap = 'round'; g.lineWidth = 12; rr(g, 560, 720, 300, 74, 37); g.stroke(); [640, 685, 730].forEach(x => dot(g, x, 757, 12));
    g.globalAlpha = .45; rr(g, 140, 740, 330, 64, 32); g.fill(); g.globalAlpha = 1;
  },
  // 4 a film camera
  g => {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 14;
    for (const [x, y, r] of [[330, 290, 112], [560, 305, 92]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); dot(g, x, y, 20); for (let a = 0; a < 3; a++) { const t = a * 2.094 + .5; line(g, x + Math.cos(t) * 32, y + Math.sin(t) * 32, x + Math.cos(t) * (r - 18), y + Math.sin(t) * (r - 18), 14); } }
    g.globalAlpha = .42; rr(g, 200, 410, 450, 250, 30); g.fill(); g.globalAlpha = 1; g.lineWidth = 14; rr(g, 200, 410, 450, 250, 30); g.stroke();
    g.beginPath(); g.moveTo(650, 470); g.lineTo(840, 405); g.lineTo(840, 665); g.lineTo(650, 600); g.closePath(); g.globalAlpha = .42; g.fill(); g.globalAlpha = 1; g.stroke();
    g.beginPath(); g.moveTo(385, 480); g.lineTo(385, 590); g.lineTo(480, 535); g.closePath(); g.fill();
    line(g, 425, 660, 320, 840, 13); line(g, 425, 660, 530, 840, 13); line(g, 425, 660, 425, 840, 13);
  },
  // 5 the word "impact."
  g => { g.font = '600 250px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('impact.', 500, 500); }
];
function sample(draw, img) {
  const S = 420, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently:true }); g.scale(S / 1000, S / 1000); g.fillStyle = g.strokeStyle = '#000'; draw(g, img);
  const d = g.getImageData(0, 0, S, S).data, cand = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const a = d[(y * S + x) * 4 + 3]; if (a > 24) cand.push(x, y, a); }
  const m = cand.length / 3, pts = [];
  // pick points in proportion to ink, so outlines are crisp and fills read as soft tone
  while (pts.length < N) {
    const j = (Math.random() * m) | 0, a = cand[j * 3 + 2];
    if (Math.random() * 255 > a) continue;
    pts.push([(cand[j * 3] + Math.random()) / S * 1000 - 500, 500 - (cand[j * 3 + 1] + Math.random()) / S * 1000, (Math.random() - .5) * 46]);
  }
  // ordered around the centre, so each change sweeps round like a hand on a clock
  pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  return pts;
}
function cloud() {
  const pts = [];
  for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.2832, r = 380 + Math.random() * 520, q = Math.sqrt(1 - u * u); pts.push([Math.cos(t) * q * r * 1.5, u * r * .9, Math.sin(t) * q * r]); }
  pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  return pts;
}
const buffers = [];
function upload(k, pts) { const a = new Float32Array(N * 3); pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); buffers[k] = b; }
// per particle: when it sets off, which way it swirls, its size, its colour
const seedBuf = gl.createBuffer();
{ const a = new Float32Array(N * 4); for (let i = 0; i < N; i++) { a[i * 4] = .7 * i / N + .3 * Math.random(); a[i * 4 + 1] = Math.random(); a[i * 4 + 2] = Math.random(); a[i * 4 + 3] = Math.pow(Math.random(), 1.4); } gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); }
let ready = false, t0 = 0;
const mark = new Image(); mark.src = 'assets/logo-ev.png';
Promise.all([mark.decode ? mark.decode() : new Promise(r => { mark.onload = r; }), document.fonts ? document.fonts.load('600 250px "Space Grotesk"').catch(() => {}) : 0]).then(() => {
  upload(CLOUD, cloud());
  DRAW.forEach((d, k) => upload(k, sample(d, mark)));
  ready = true; t0 = performance.now(); sec.classList.add('is-ready'); kick();
}).catch(() => sec.classList.add('no-gl'));

// ---- Size, camera and pointer ----
let W = 0, H = 0, DPR = 1, D = 2000, proj = null, secTop = 0, stageH = 1;
const FOV = 35 * Math.PI / 180;
function measure() { secTop = sec.getBoundingClientRect().top + scrollY; stageH = stage.offsetHeight || innerHeight; }
function size() {
  measure();
  const r = stage.getBoundingClientRect(); DPR = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height; if (!W) return;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); gl.viewport(0, 0, canvas.width, canvas.height);
  const asp = W / H, tan = Math.tan(FOV / 2) * 2;
  // far enough that a shape fits: beside the words on wide screens, above them on phones
  D = narrowQ.matches ? Math.max(1000 / (.9 * asp * tan), 1000 / (.5 * tan)) : Math.max(1000 / (.78 * tan), 1000 / (.56 * asp * tan));
  const n = 10, f = 10000, t = 1 / Math.tan(FOV / 2);
  proj = new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]);
  kick();
}
new ResizeObserver(size).observe(stage);
new ResizeObserver(measure).observe(document.body);
// where each shape sits: to the right of the words on wide screens, above them on phones
const OFF = () => narrowQ.matches ? [[0, -.04], [0, .11], [0, .11], [0, .11], [0, .11], [0, .06]] : [[0, -.05], [.2, 0], [.2, 0], [.2, 0], [.2, 0], [0, .03]];
const mouse = { x:0, y:0, tx:0, ty:0, pull:0, on:false };
stage.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = stage.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width * 2 - 1; mouse.ty = 1 - (e.clientY - r.top) / r.height * 2; mouse.on = true; kick(); });
stage.addEventListener('pointerleave', () => { mouse.on = false; });
function view(tx, ty, tz, rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  return new Float32Array([cy, sx * sy, -cx * sy, 0, 0, cx, sx, 0, sy, -sx * cy, cx * cy, 0, tx, ty, tz, 1]);
}

// ---- Words: the opening, one caption per shape, the closing ----
const css = (el, k, v) => { if (el['_' + k] === v) return; el['_' + k] = v; el.style[k] = v; };
function setOp(el, a, dy) {
  a = Math.round(a * 1000) / 1000;
  if (el._a === a) return; el._a = a;
  el.style.opacity = a; el.style.visibility = a > .01 ? 'visible' : 'hidden';
  el.style.transform = a < 1 ? `translateY(${((1 - a) * dy).toFixed(1)}px)` : '';
  el.style.pointerEvents = a > .6 ? '' : 'none';
}

// ---- One frame ----
let raf = 0, onScreen = true, last = 0, sC = 0;
function frame(now) {
  raf = 0;
  if (!W || !ready) return;
  const dt = Math.min(64, now - (last || now)); last = now;
  const sT = STATIC ? 0 : clamp((scrollY - secTop) / stageH, 0, END), d = sT - sC;
  sC = Math.abs(d) < .2 || Math.abs(d) > 3 ? sT : sC + d * (1 - Math.exp(-dt / 90));
  const s = sC;
  let [from, to, mix] = stateAt(s);
  // the opening: the cloud of ideas gathers into the mark, on its own, as the page loads
  const gather = STATIC ? 1 : seg(now - t0, 150, 2900);
  if (gather < 1 && from === 0 && to === 0) { from = CLOUD; to = 0; mix = gather; }
  // camera: placed for the shape, swaying a touch, following the pointer
  const off = OFF(), e = smooth(mix), ox = lerp(off[from === CLOUD ? 0 : from][0], off[to][0], e), oy = lerp(off[from === CLOUD ? 0 : from][1], off[to][1], e);
  const k = 1 - Math.exp(-dt / 220);
  mouse.x += (mouse.tx * (mouse.on ? 1 : 0) - mouse.x) * k; mouse.y += (mouse.ty * (mouse.on ? 1 : 0) - mouse.y) * k;
  mouse.pull += ((mouse.on && fineQ.matches ? 1 : 0) - mouse.pull) * k;
  const tt = STATIC ? 0 : now / 1000, vw = D * Math.tan(FOV / 2) * 2 * (W / H), vh = D * Math.tan(FOV / 2) * 2;
  // while a shape changes, the camera turns through it, so the change reads in depth
  const turn = from === to ? 0 : Math.sin(Math.PI * smooth(mix)) * .42;
  const ry = mouse.x * .28 + Math.sin(tt * .25) * .07 + turn, rx = -mouse.y * .16 + Math.sin(tt * .19) * .04 - turn * .25;
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniformMatrix4fv(U.proj, false, proj);
  gl.uniformMatrix4fv(U.view, false, view(ox * vw, oy * vh, -D, rx, ry));
  gl.uniform1f(U.mix, from === to ? 0 : mix); gl.uniform1f(U.time, tt);
  gl.uniform1f(U.size, (narrowQ.matches ? 2.2 : 2.3) * DPR); gl.uniform1f(U.aspect, W / H); gl.uniform1f(U.pull, mouse.pull);
  gl.uniform2f(U.mouse, mouse.x, mouse.y);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[from]); gl.enableVertexAttribArray(A.from); gl.vertexAttribPointer(A.from, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers[to]); gl.enableVertexAttribArray(A.to); gl.vertexAttribPointer(A.to, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.enableVertexAttribArray(A.seed); gl.vertexAttribPointer(A.seed, 4, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, N);
  // words
  const ia = 1 - smooth(seg(s, .05, .42));
  for (const el of intro) setOp(el, ia, -30);
  steps.forEach((el, i) => { const h = HOLD[i + 1]; setOp(el, smooth(seg(s, h[0] - .3, h[0] + .02)) * (1 - smooth(seg(s, h[1] + .02, h[1] + .32))), 22); });
  setOp(finale, smooth(seg(s, HOLD[5][0] - .2, HOLD[5][0] + .1)), 18);
  if (onScreen && !STATIC) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf && (onScreen || STATIC)) raf = requestAnimationFrame(frame); }
if (STATIC) sec.classList.add('is-static');
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { last = 0; kick(); } }).observe(sec);
addEventListener('scroll', kick, { passive:true });
addEventListener('load', measure);
size();
})();
