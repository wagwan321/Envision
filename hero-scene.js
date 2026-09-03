/* Hero object: a single flowing ribbon sculpture, rendered in WebGL.
   Seven strands share one parametric centreline and twist around it as a
   Mobius band, so they always read as one coherent object. Geometry is
   evaluated in the vertex shader; the CPU only updates uniforms. A light
   accumulation pass softens the 1px lines and a display pass adds a
   restrained glow. */
(function () {
  "use strict";

  var visual = document.getElementById("hero-visual");
  var canvas = document.getElementById("hero-canvas");
  if (!visual || !canvas) return;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  var contextOptions = {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  };
  var gl = canvas.getContext("webgl2", contextOptions) ||
           canvas.getContext("webgl", contextOptions) ||
           canvas.getContext("experimental-webgl", contextOptions);
  if (!gl) { canvas.hidden = true; return; }

  /* ---------- Shaders ---------- */
  var NOISE = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "  const vec2 C=vec2(1.0/6.0,1.0/3.0);",
    "  const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "  vec3 i=floor(v+dot(v,C.yyy));",
    "  vec3 x0=v-i+dot(i,C.xxx);",
    "  vec3 g=step(x0.yzx,x0.xyz);",
    "  vec3 l=1.0-g;",
    "  vec3 i1=min(g.xyz,l.zxy);",
    "  vec3 i2=max(g.xyz,l.zxy);",
    "  vec3 x1=x0-i1+C.xxx;",
    "  vec3 x2=x0-i2+C.yyy;",
    "  vec3 x3=x0-D.yyy;",
    "  i=mod289(i);",
    "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "  float n_=0.142857142857;",
    "  vec3 ns=n_*D.wyz-D.xzx;",
    "  vec4 j=p-49.0*floor(p*ns.z*ns.z);",
    "  vec4 x_=floor(j*ns.z);",
    "  vec4 y_=floor(j-7.0*x_);",
    "  vec4 x=x_*ns.x+ns.yyyy;",
    "  vec4 y=y_*ns.x+ns.yyyy;",
    "  vec4 h=1.0-abs(x)-abs(y);",
    "  vec4 b0=vec4(x.xy,y.xy);",
    "  vec4 b1=vec4(x.zw,y.zw);",
    "  vec4 s0=floor(b0)*2.0+1.0;",
    "  vec4 s1=floor(b1)*2.0+1.0;",
    "  vec4 sh=-step(h,vec4(0.0));",
    "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;",
    "  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "  vec3 p0=vec3(a0.xy,h.x);",
    "  vec3 p1=vec3(a0.zw,h.y);",
    "  vec3 p2=vec3(a1.xy,h.z);",
    "  vec3 p3=vec3(a1.zw,h.w);",
    "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
    "  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;",
    "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);",
    "  m=m*m;",
    "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
    "}"
  ].join("\n");

  /* a_data = (u, strand, seed, type). type 0 strand line, 1 seed point, 2 particle. */
  var SCENE_VS = [
    "precision highp float;",
    "attribute vec4 a_data;",
    "uniform mat4 u_view;",
    "uniform mat4 u_proj;",
    "uniform mat3 u_objRot;",
    "uniform float u_time;",
    "uniform float u_reveal;",
    "uniform float u_scale;",
    "uniform float u_twist;",
    "uniform float u_pixelRatio;",
    "uniform float u_mouseStrength;",
    "uniform vec3 u_mousePos;",
    "varying float v_depth;",
    "varying float v_bright;",
    "varying float v_alpha;",
    "varying float v_type;",
    NOISE,
    "float hash(float n){return fract(sin(n)*43758.5453);}",
    "vec3 hash3(float n){return vec3(hash(n),hash(n+1.7),hash(n+2.9));}",
    "",
    "vec3 centreline(float u, float t){",
    "  vec3 c=vec3(0.7*cos(u),0.44*sin(u),0.3*sin(2.0*u+0.4))*u_scale;",
    "  vec3 n=vec3(snoise(vec3(c.xy*0.9,t*0.06)),snoise(vec3(c.yx*0.9+5.0,t*0.05)),snoise(vec3(c.xz*0.9+9.0,t*0.055)));",
    "  return c+n*0.045;",
    "}",
    "",
    "vec3 ribbonNormal(float u){",
    "  vec3 radial=vec3(cos(u),sin(u),0.0);",
    "  float ang=0.5*u+u_twist;",
    "  return normalize(radial*cos(ang)+vec3(0.0,0.0,1.0)*sin(ang));",
    "}",
    "",
    "void main(){",
    "  float u=a_data.x;",
    "  float strand=a_data.y;",
    "  float seed=a_data.z;",
    "  float type=a_data.w;",
    "  float t=u_time;",
    "  v_type=type;",
    "  vec3 p;",
    "  float alpha=0.0;",
    "  float bright=0.0;",
    "  float size=1.0;",
    "",
    "  if(type<1.5){",
    "    float off=(strand-3.0)/3.0;",
    "    float u0=hash(strand*3.7+1.3)*6.2832;",
    "    if(type>0.5){u=u0;}",
    "    vec3 c=centreline(u,t);",
    "    p=c+ribbonNormal(u)*off*0.22*u_scale;",
    "    vec3 d=u_mousePos-c;",
    "    float f=u_mouseStrength*0.16/(1.0+dot(d,d)*4.0);",
    "    p+=d*f;",
    "    bright+=f*1.5;",
    "    p=u_objRot*p;",
    "    float stagger=strand*0.06;",
    "    float grow=clamp((u_reveal-stagger)/(1.0-stagger),0.0,1.0);",
    "    grow=grow*grow*(3.0-2.0*grow);",
    "    if(type<0.5){",
    "      float arc=abs(mod(u-u0+9.42477,6.2832)-3.14159);",
    "      float reach=grow*3.3;",
    "      float visible=1.0-smoothstep(reach-0.3,reach,arc);",
    "      float primary=step(0.99,abs(off));",
    "      alpha=mix(0.34,0.78,primary)*visible;",
    "      if(abs(off)<0.01){alpha*=0.8;}",
    "    } else {",
    "      alpha=smoothstep(0.0,0.12,u_reveal)*(1.0-smoothstep(0.25,0.6,grow));",
    "      size=2.6;",
    "      bright=0.6;",
    "    }",
    "  } else {",
    "    vec3 base=normalize(hash3(seed*31.0)-0.5)*(1.9+hash(seed*7.0)*1.3);",
    "    p=base+vec3(sin(t*0.07+seed*6.28),cos(t*0.05+seed*2.0),sin(t*0.06+seed*4.0))*0.08;",
    "    alpha=(0.1+0.15*hash(seed*3.0))*smoothstep(0.5,1.0,u_reveal);",
    "    size=1.3;",
    "  }",
    "",
    "  vec4 vp=u_view*vec4(p,1.0);",
    "  gl_Position=u_proj*vp;",
    "  float dist=-vp.z;",
    "  v_depth=clamp((dist-3.6)/2.4,0.0,1.0);",
    "  v_alpha=alpha*mix(1.0,0.28,v_depth);",
    "  v_bright=bright+(1.0-v_depth)*0.2;",
    "  gl_PointSize=size*(4.8/max(dist,0.5))*u_pixelRatio;",
    "}"
  ].join("\n");

  var SCENE_FS = [
    "precision mediump float;",
    "varying float v_depth;",
    "varying float v_bright;",
    "varying float v_alpha;",
    "varying float v_type;",
    "uniform vec3 u_colDeep;",
    "uniform vec3 u_colMid;",
    "uniform vec3 u_colHi;",
    "void main(){",
    "  float a=v_alpha;",
    "  if(v_type>0.5){",
    "    vec2 c=gl_PointCoord-0.5;",
    "    a*=1.0-smoothstep(0.5,1.0,length(c)*2.0);",
    "  }",
    "  vec3 col=mix(u_colDeep,u_colMid,1.0-v_depth);",
    "  col=mix(col,u_colHi,clamp(v_bright,0.0,1.0));",
    "  gl_FragColor=vec4(col*a,a);",
    "}"
  ].join("\n");

  var QUAD_VS = [
    "attribute vec2 a_pos;",
    "varying vec2 v_uv;",
    "void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}"
  ].join("\n");

  var FADE_FS = [
    "precision mediump float;",
    "varying vec2 v_uv;",
    "uniform sampler2D u_prev;",
    "uniform float u_decay;",
    "void main(){vec4 c=texture2D(u_prev,v_uv);gl_FragColor=max(c*u_decay-0.004,0.0);}"
  ].join("\n");

  var DISPLAY_FS = [
    "precision mediump float;",
    "varying vec2 v_uv;",
    "uniform sampler2D u_tex;",
    "uniform vec2 u_texel;",
    "uniform float u_reveal;",
    "void main(){",
    "  vec4 c=texture2D(u_tex,v_uv);",
    "  vec2 t=u_texel;",
    "  vec3 b=vec3(0.0);",
    "  b+=texture2D(u_tex,v_uv+vec2(1.5,0.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(-1.5,0.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(0.0,1.5)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(0.0,-1.5)*t).rgb;",
    "  vec3 h=vec3(0.0);",
    "  h+=texture2D(u_tex,v_uv+vec2(5.0,0.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(-5.0,0.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(0.0,5.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(0.0,-5.0)*t).rgb;",
    "  vec3 col=c.rgb+(b/4.0)*0.3+(h/4.0)*0.18*vec3(0.6,1.0,0.8);",
    "  vec2 q=v_uv-vec2(0.5,0.48);",
    "  float glow=exp(-dot(q,q)*7.0)*0.03*u_reveal;",
    "  col+=glow*vec3(0.25,1.0,0.65);",
    "  col=vec3(1.0)-exp(-col*1.5);",
    "  float a=clamp(max(col.r,max(col.g,col.b))*1.12,0.0,1.0);",
    "  gl_FragColor=vec4(col,a);",
    "}"
  ].join("\n");

  /* ---------- Program helpers ---------- */
  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("Shader: " + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function program(vs, fs) {
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Program: " + gl.getProgramInfoLog(prog));
    }
    var uniforms = {};
    var count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i += 1) {
      var info = gl.getActiveUniform(prog, i);
      uniforms[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(prog, info.name);
    }
    return { prog: prog, u: uniforms, aPos: gl.getAttribLocation(prog, "a_pos") };
  }

  var scene, fade, display;
  try {
    scene = program(SCENE_VS, SCENE_FS);
    fade = program(QUAD_VS, FADE_FS);
    display = program(QUAD_VS, DISPLAY_FS);
  } catch (error) {
    if (window.console) console.error("Hero scene disabled:", error.message);
    canvas.hidden = true;
    return;
  }

  /* ---------- Geometry ---------- */
  var STRANDS = 7;
  var SEGS = coarsePointer ? 180 : 260;
  var PARTICLES = 24;

  var lineData = [];
  var lineIndex = [];
  for (var strand = 0; strand < STRANDS; strand += 1) {
    var base = lineData.length / 4;
    for (var i = 0; i < SEGS; i += 1) {
      lineData.push((i / SEGS) * Math.PI * 2, strand, 0, 0);
      lineIndex.push(base + i, base + ((i + 1) % SEGS));
    }
  }

  var pointData = [];
  for (var seedIndex = 0; seedIndex < STRANDS; seedIndex += 1) pointData.push(0, seedIndex, 0, 1);
  for (var particle = 0; particle < PARTICLES; particle += 1) pointData.push(0, 0, Math.random(), 2);
  var pointCount = pointData.length / 4;

  function buffer(target, data) {
    var buf = gl.createBuffer();
    gl.bindBuffer(target, buf);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buf;
  }
  var lineBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(lineData));
  var lineIndexBuffer = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lineIndex));
  var pointBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(pointData));
  var quadBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
  var aData = gl.getAttribLocation(scene.prog, "a_data");

  /* ---------- Accumulation targets ---------- */
  var targets = [];
  var width = 0;
  var height = 0;
  var pixelRatio = 1;

  function createTarget() {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture: texture, fbo: fbo };
  }

  function resize() {
    var bounds = visual.getBoundingClientRect();
    var cssWidth = Math.max(1, Math.round(bounds.width));
    var cssHeight = Math.max(1, Math.round(bounds.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.5);
    var nextWidth = Math.round(cssWidth * pixelRatio);
    var nextHeight = Math.round(cssHeight * pixelRatio);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    targets.forEach(function (target) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.fbo);
    });
    targets = [createTarget(), createTarget()];
    if (reduceMotion) renderOnce();
    else requestFrame();
  }

  /* ---------- Camera and object transforms ---------- */
  var FOV = 0.55;
  var proj = new Float32Array(16);
  var view = new Float32Array(16);
  var objRot = new Float32Array(9);
  var camRight = [1, 0, 0];
  var camUp = [0, 1, 0];
  var camDist = 4.8;

  function perspective(out, fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  }

  function normalize(v) {
    var len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function lookAt(out, eye) {
    var forward = normalize([-eye[0], -eye[1], -eye[2]]);
    var right = normalize(cross(forward, [0, 1, 0]));
    var up = cross(right, forward);
    camRight = right;
    camUp = up;
    out[0] = right[0]; out[4] = right[1]; out[8] = right[2];
    out[1] = up[0]; out[5] = up[1]; out[9] = up[2];
    out[2] = -forward[0]; out[6] = -forward[1]; out[10] = -forward[2];
    out[3] = 0; out[7] = 0; out[11] = 0;
    out[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
    out[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
    out[14] = forward[0] * eye[0] + forward[1] * eye[1] + forward[2] * eye[2];
    out[15] = 1;
  }

  /* Column-major mat3 = rotZ(roll) * rotX(pitch) * rotY(yaw). */
  function objectRotation(out, yaw, pitch, roll) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cx = Math.cos(pitch), sx = Math.sin(pitch);
    var cz = Math.cos(roll), sz = Math.sin(roll);
    // rotX * rotY
    var m00 = cy, m01 = 0, m02 = sy;
    var m10 = sx * sy, m11 = cx, m12 = -sx * cy;
    var m20 = -cx * sy, m21 = sx, m22 = cx * cy;
    // rotZ * (rotX * rotY), stored column-major
    out[0] = cz * m00 - sz * m10; out[1] = sz * m00 + cz * m10; out[2] = m20;
    out[3] = cz * m01 - sz * m11; out[4] = sz * m01 + cz * m11; out[5] = m21;
    out[6] = cz * m02 - sz * m12; out[7] = sz * m02 + cz * m12; out[8] = m22;
  }

  /* ---------- Interaction state ---------- */
  var rawX = 0, rawY = 0;
  var mouseX = 0, mouseY = 0, mouseVX = 0, mouseVY = 0;
  var camX = 0, camY = 0;
  var strength = 0;
  var pointerActive = false;
  var lastMove = -100;
  var mouseWorld = [0, 0, 0];

  if (!coarsePointer) {
    window.addEventListener("pointermove", function (event) {
      var bounds = visual.getBoundingClientRect();
      rawX = Math.max(-2, Math.min(2, (event.clientX - (bounds.left + bounds.width * 0.5)) / (bounds.width * 0.5)));
      rawY = Math.max(-2, Math.min(2, -(event.clientY - (bounds.top + bounds.height * 0.5)) / (bounds.height * 0.5)));
      pointerActive = true;
      lastMove = time;
      requestFrame();
    }, { passive: true });

    document.addEventListener("pointerleave", function () {
      pointerActive = false;
    });
  }

  /* ---------- Frame loop ---------- */
  var time = 0;
  var lastNow = 0;
  var revealStart = -1;
  var animationFrame = 0;
  var sceneVisible = true;
  var objScale = 1;
  var objTwist = 0;

  function requestFrame() {
    if (reduceMotion || animationFrame || !sceneVisible || document.hidden || !width) return;
    animationFrame = requestAnimationFrame(frame);
  }

  function step(dt) {
    time += dt;
    if (revealStart < 0 && (root.classList.contains("is-ready") || !document.getElementById("loader"))) {
      revealStart = time;
    }

    // Soft magnetic field: quick to engage, slow to let go, slight overshoot.
    var target = pointerActive && time - lastMove < 2.5 ? 1 : 0;
    strength += (target - strength) * (target > strength ? 0.05 : 0.01);
    mouseVX += (rawX - mouseX) * 0.06;
    mouseVY += (rawY - mouseY) * 0.06;
    mouseVX *= 0.86;
    mouseVY *= 0.86;
    mouseX += mouseVX;
    mouseY += mouseVY;
    camX += (rawX - camX) * 0.04;
    camY += (rawY - camY) * 0.04;

    // Object: bounded orientation drift, breathing and Mobius twist.
    var yaw = 0.35 * Math.sin(time * 0.13) + 0.15 * Math.sin(time * 0.071) + mouseX * 0.18;
    var pitch = 0.55 + 0.18 * Math.sin(time * 0.09) - mouseY * 0.12;
    var roll = 0.5 + 0.06 * Math.sin(time * 0.05);
    objectRotation(objRot, yaw, pitch, roll);
    objScale = 1 + 0.035 * Math.sin(time * 0.27) + 0.02 * Math.sin(time * 0.11);
    objTwist = time * 0.09 + 0.25 * Math.sin(time * 0.21);

    // Camera: a few degrees of orbit, gentle parallax, no zoom.
    var camYaw = 0.05 * Math.sin(time * 0.1) + camX * 0.06;
    var camPitch = 0.2 + 0.02 * Math.sin(time * 0.13) - camY * 0.04;
    camDist = 4.8 + 0.03 * Math.sin(time * 0.09);
    var eye = [
      camDist * Math.sin(camYaw) * Math.cos(camPitch),
      camDist * Math.sin(camPitch),
      camDist * Math.cos(camYaw) * Math.cos(camPitch)
    ];
    lookAt(view, eye);
    perspective(proj, FOV, width / height, 0.5, 30);

    var halfH = camDist * Math.tan(FOV / 2);
    var halfW = halfH * (width / height);
    mouseWorld = [
      camRight[0] * mouseX * halfW + camUp[0] * mouseY * halfH,
      camRight[1] * mouseX * halfW + camUp[1] * mouseY * halfH,
      camRight[2] * mouseX * halfW + camUp[2] * mouseY * halfH
    ];
  }

  function drawQuad(prog) {
    gl.useProgram(prog.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render(decay, reveal) {
    var current = targets[0];
    var previous = targets[1];
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, width, height);

    // 1. Softly decay the previous frame into the current target.
    gl.bindFramebuffer(gl.FRAMEBUFFER, current.fbo);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, previous.texture);
    gl.useProgram(fade.prog);
    gl.uniform1i(fade.u.u_prev, 0);
    gl.uniform1f(fade.u.u_decay, decay);
    drawQuad(fade);

    // 2. Add the sculpture.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(scene.prog);
    gl.uniformMatrix4fv(scene.u.u_view, false, view);
    gl.uniformMatrix4fv(scene.u.u_proj, false, proj);
    gl.uniformMatrix3fv(scene.u.u_objRot, false, objRot);
    gl.uniform1f(scene.u.u_time, time);
    gl.uniform1f(scene.u.u_reveal, reveal);
    gl.uniform1f(scene.u.u_scale, objScale);
    gl.uniform1f(scene.u.u_twist, objTwist);
    gl.uniform1f(scene.u.u_pixelRatio, pixelRatio);
    gl.uniform1f(scene.u.u_mouseStrength, strength);
    gl.uniform3f(scene.u.u_mousePos, mouseWorld[0], mouseWorld[1], mouseWorld[2]);
    gl.uniform3f(scene.u.u_colDeep, 0.02, 0.3, 0.2);
    gl.uniform3f(scene.u.u_colMid, 0.06, 0.68, 0.42);
    gl.uniform3f(scene.u.u_colHi, 0.55, 0.98, 0.8);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.enableVertexAttribArray(aData);
    gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.drawElements(gl.LINES, lineIndex.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, pointCount);

    // 3. Composite with a restrained glow.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.useProgram(display.prog);
    gl.uniform1i(display.u.u_tex, 0);
    gl.uniform2f(display.u.u_texel, 1 / width, 1 / height);
    gl.uniform1f(display.u.u_reveal, reveal);
    drawQuad(display);

    targets[0] = previous;
    targets[1] = current;
  }

  function frame(now) {
    animationFrame = 0;
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    step(dt);
    var reveal = revealStart < 0 ? 0 : Math.min(1, (time - revealStart) / 2.6);
    render(Math.pow(0.72, dt * 60), reveal);
    requestFrame();
  }

  function renderOnce() {
    time = 40;
    step(0);
    render(0, 1);
  }

  /* ---------- Lifecycle ---------- */
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(visual);
  else window.addEventListener("resize", resize);

  if ("IntersectionObserver" in window && !reduceMotion) {
    new IntersectionObserver(function (entries) {
      sceneVisible = entries[0].isIntersecting;
      if (!sceneVisible && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      if (sceneVisible) {
        lastNow = 0;
        requestFrame();
      }
    }, { threshold: 0.02 }).observe(visual);
  }

  if (!reduceMotion) {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (!document.hidden) {
        lastNow = 0;
        requestFrame();
      }
    });
  }

  resize();
})();
