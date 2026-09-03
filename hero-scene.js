/* Hero object: a GPU-rendered generative structure.
   All geometry is evaluated procedurally in the vertex shader from a static
   buffer of (curve parameter, layer, seed, type) tuples, so the CPU only
   updates a handful of uniforms per frame. Rendering runs through a
   ping-pong accumulation buffer for temporal trails and a display pass
   that adds bloom and haze. */
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

  /* Type codes carried in a_data.w:
     0 structural line, 2 structural particle, 3 energy particle,
     4 micro particle, 5 ambient dust, 6 measurement ring. */
  var SCENE_VS = [
    "precision highp float;",
    "attribute vec4 a_data;",
    "uniform mat4 u_view;",
    "uniform mat4 u_proj;",
    "uniform mat3 u_camRot;",
    "uniform float u_time;",
    "uniform float u_ghost;",
    "uniform float u_assemble;",
    "uniform float u_turb;",
    "uniform float u_pixelRatio;",
    "uniform float u_mouseStrength;",
    "uniform vec3 u_mousePos;",
    "uniform vec4 u_wave[3];",
    "varying float v_depth;",
    "varying float v_bright;",
    "varying float v_alpha;",
    "varying float v_type;",
    NOISE,
    "float hash(float n){return fract(sin(n)*43758.5453);}",
    "vec3 hash3(float n){return vec3(hash(n),hash(n+1.7),hash(n+2.9));}",
    "mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c);}",
    "mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);}",
    "mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.0,-s,c,0.0,0.0,0.0,1.0);}",
    "",
    "vec3 curvePoint(float u, float layer, float t){",
    "  float s=layer*7.31+3.1;",
    "  float a=1.25+0.55*hash(s+1.0);",
    "  float b=0.5+0.45*hash(s+2.0);",
    "  float lobes=1.0+floor(hash(s+3.0)*3.0);",
    "  float tilt=hash(s+4.0)*3.14159;",
    "  float spin=0.05+hash(s+5.0)*0.12;",
    "  float dir=hash(s+9.0)>0.5?1.0:-1.0;",
    "  float phase=t*spin*dir+hash(s+6.0)*6.2832;",
    "  float r=1.0+0.14*sin(u*lobes+phase*0.9)+0.07*sin(u*(lobes+2.0)-phase*1.4+hash(s+10.0)*6.28);",
    "  vec3 p=vec3(a*r*cos(u),b*r*sin(u),0.36*sin(u*lobes*0.5+phase)*(0.5+0.5*hash(s+7.0))+0.12*cos(u*2.0-phase*0.6));",
    "  p=rotZ(hash(s+8.0)*6.2832+t*0.01*dir)*(rotY(phase*0.35)*(rotX(tilt)*p));",
    "  p.x*=1.3;",
    "  return p;",
    "}",
    "",
    "vec3 displace(vec3 p, float t, float amp){",
    "  vec3 q=p*1.1;",
    "  vec3 n1=vec3(snoise(q+vec3(0.0,0.0,t*0.09)),snoise(q+vec3(31.4,0.0,t*0.08)),snoise(q+vec3(0.0,71.3,-t*0.1)));",
    "  vec3 n2=vec3(snoise(q*2.3+vec3(t*0.15,0.0,0.0)),snoise(q*2.3+vec3(0.0,t*0.14,9.1)),snoise(q*2.3+vec3(5.2,0.0,-t*0.13)));",
    "  return p+(n1*0.22+n2*0.07)*amp;",
    "}",
    "",
    "void main(){",
    "  float u=a_data.x;",
    "  float layer=a_data.y;",
    "  float seed=a_data.z;",
    "  float type=a_data.w;",
    "  float t=u_time-u_ghost*0.5;",
    "  v_type=type;",
    "  vec3 p;",
    "  float bright=0.0;",
    "  float alpha=1.0;",
    "  float size=1.0;",
    "  bool interactive=true;",
    "  float turbAmp=1.0+u_turb*0.8;",
    "",
    "  if(type<1.5){",
    "    p=curvePoint(u,layer,t);",
    "    p=displace(p,t,(0.6+0.8*hash(layer*3.7+0.5))*turbAmp);",
    "    float prim=step(layer,5.5);",
    "    alpha=mix(0.26,0.55,prim)*mix(1.0,0.18,u_ghost);",
    "  } else if(type<2.5){",
    "    p=curvePoint(u,layer,t);",
    "    p=displace(p,t,0.9*turbAmp);",
    "    float detach=smoothstep(0.55,1.0,sin(t*0.11+seed*6.2832));",
    "    vec3 drift=p+(hash3(seed*13.0)-0.5)*1.2+vec3(snoise(p+t*0.2),snoise(p.yzx+t*0.17),snoise(p.zxy-t*0.19))*0.4;",
    "    p=mix(p,drift,detach);",
    "    alpha=0.5-detach*0.3;",
    "    size=1.7+hash(seed*5.0)*1.2;",
    "    bright=0.15;",
    "  } else if(type<3.5){",
    "    float speed=0.35+hash(seed*2.0)*0.4;",
    "    float burst=1.0+2.5*smoothstep(0.86,1.0,sin(t*0.27+seed*6.2832));",
    "    float uu=seed*6.2832+t*speed*burst*(1.0+u_turb*0.5);",
    "    p=curvePoint(uu,layer,t);",
    "    p=displace(p,t,0.9*turbAmp);",
    "    alpha=1.0;",
    "    size=2.8;",
    "    bright=0.9+0.6*(burst-1.0);",
    "  } else if(type<4.5){",
    "    vec3 base=(hash3(seed*97.0)-0.5)*5.6;",
    "    p=base+vec3(snoise(base*0.5+t*0.03),snoise(base*0.5+20.0+t*0.025),snoise(base*0.5-40.0+t*0.028))*0.5;",
    "    float flash=step(0.9965,hash(floor(t*3.0)+seed*7.0));",
    "    alpha=0.1+flash*0.8;",
    "    size=1.0+flash*1.5;",
    "    bright=flash;",
    "  } else if(type<5.5){",
    "    vec3 base=(hash3(seed*61.0)-0.5)*8.0;",
    "    base.z-=2.5;",
    "    p=base+vec3(sin(t*0.05+seed*6.28),cos(t*0.04+seed*3.1),0.0)*0.3;",
    "    alpha=0.06;",
    "    size=4.0+hash(seed*3.0)*4.0;",
    "    interactive=false;",
    "  } else {",
    "    float rr=1.9+layer*0.55;",
    "    float uu=u+t*0.02*(layer+1.0);",
    "    p=u_camRot*vec3(cos(uu)*rr,sin(uu)*rr,0.0);",
    "    alpha=0.05;",
    "    interactive=false;",
    "  }",
    "",
    "  if(interactive){",
    "    vec3 d=u_mousePos-p;",
    "    float f=u_mouseStrength/(1.0+dot(d,d)*2.2);",
    "    p+=d*f*0.38;",
    "    bright+=f*1.4*u_mouseStrength;",
    "    for(int i=0;i<3;i++){",
    "      float age=u_time-u_wave[i].w;",
    "      if(age>0.0&&age<3.0){",
    "        vec3 away=p-u_wave[i].xyz;",
    "        float dd=length(away)+0.0001;",
    "        float e=(dd-age*1.6)*2.2;",
    "        float w=exp(-e*e)*(1.0-age/3.0);",
    "        p+=(away/dd)*w*0.14;",
    "        bright+=w*1.1;",
    "      }",
    "    }",
    "  }",
    "",
    "  float stagger;",
    "  vec3 scatter;",
    "  if(type<1.5){",
    "    stagger=0.45*hash(layer*11.0)+0.1*sin(u*2.0+layer);",
    "    scatter=p*(2.2+1.5*hash(layer*3.0))+(hash3(layer*41.0)-0.5)*4.0+vec3(sin(u*5.0+layer),cos(u*3.0),sin(u*7.0))*0.5;",
    "  } else {",
    "    stagger=hash(seed*19.0)*0.5;",
    "    scatter=(hash3(seed*41.0+layer)-0.5)*7.0;",
    "  }",
    "  float ease=smoothstep(stagger,stagger+0.5,u_assemble);",
    "  ease=ease*ease*(3.0-2.0*ease);",
    "  p=mix(scatter,p,ease);",
    "  alpha*=(type<1.5||type>5.5)?smoothstep(0.2,0.9,ease):mix(0.35,1.0,ease);",
    "",
    "  vec4 vp=u_view*vec4(p,1.0);",
    "  gl_Position=u_proj*vp;",
    "  float dist=-vp.z;",
    "  v_depth=clamp((dist-2.4)/4.0,0.0,1.0);",
    "  v_alpha=alpha*mix(1.0,0.18,v_depth);",
    "  v_bright=bright+(1.0-v_depth)*0.25;",
    "  gl_PointSize=size*(4.3/max(dist,0.5))*u_pixelRatio;",
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
    "  if(v_type>1.5&&v_type<5.5){",
    "    vec2 c=gl_PointCoord-0.5;",
    "    float r=length(c)*2.0;",
    "    float soft=v_type>4.5?1.0:0.5;",
    "    a*=1.0-smoothstep(1.0-soft,1.0,r);",
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
    "uniform float u_time;",
    "void main(){",
    "  vec4 c=texture2D(u_tex,v_uv);",
    "  vec2 t=u_texel;",
    "  vec3 b=vec3(0.0);",
    "  b+=texture2D(u_tex,v_uv+vec2(2.0,0.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(-2.0,0.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(0.0,2.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(0.0,-2.0)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(1.5,1.5)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(-1.5,1.5)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(1.5,-1.5)*t).rgb;",
    "  b+=texture2D(u_tex,v_uv+vec2(-1.5,-1.5)*t).rgb;",
    "  vec3 h=vec3(0.0);",
    "  h+=texture2D(u_tex,v_uv+vec2(7.0,0.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(-7.0,0.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(0.0,7.0)*t).rgb;",
    "  h+=texture2D(u_tex,v_uv+vec2(0.0,-7.0)*t).rgb;",
    "  vec3 col=c.rgb+(b/8.0)*0.5+(h/4.0)*0.35*vec3(0.6,1.0,0.8);",
    "  float sweep=fract(u_time*0.045);",
    "  float se=(v_uv.y-sweep)*60.0;",
    "  float sl=exp(-se*se);",
    "  col+=sl*vec3(0.03,0.08,0.055)*clamp(c.g*6.0+0.15,0.0,1.0);",
    "  col=vec3(1.0)-exp(-col*1.7);",
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
      var name = info.name.replace(/\[0\]$/, "");
      uniforms[name] = gl.getUniformLocation(prog, info.name);
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
  var LAYERS = coarsePointer ? 11 : 16;
  var SEGS = coarsePointer ? 150 : 210;
  var RINGS = 3;
  var RING_SEGS = 140;
  var counts = coarsePointer
    ? { structural: 420, energy: 24, micro: 700, dust: 120 }
    : { structural: 820, energy: 36, micro: 1400, dust: 220 };

  var lineData = [];
  var lineIndex = [];
  function pushLoop(layer, segments, type) {
    var base = lineData.length / 4;
    for (var i = 0; i < segments; i += 1) {
      lineData.push((i / segments) * Math.PI * 2, layer, Math.random(), type);
      lineIndex.push(base + i, base + ((i + 1) % segments));
    }
  }
  for (var layer = 0; layer < LAYERS; layer += 1) pushLoop(layer, SEGS, 0);
  for (var ring = 0; ring < RINGS; ring += 1) pushLoop(ring, RING_SEGS, 6);

  var pointData = [];
  function pushPoints(total, type) {
    for (var i = 0; i < total; i += 1) {
      pointData.push(Math.random() * Math.PI * 2, Math.floor(Math.random() * LAYERS), Math.random(), type);
    }
  }
  pushPoints(counts.structural, 2);
  pushPoints(counts.energy, 3);
  pushPoints(counts.micro, 4);
  pushPoints(counts.dust, 5);
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

  /* ---------- Camera math ---------- */
  var FOV = 0.61;
  var proj = new Float32Array(16);
  var view = new Float32Array(16);
  var camRot = new Float32Array(9);
  var camRight = [1, 0, 0];
  var camUp = [0, 1, 0];
  var camDist = 4.4;

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
    camRot[0] = right[0]; camRot[1] = right[1]; camRot[2] = right[2];
    camRot[3] = up[0]; camRot[4] = up[1]; camRot[5] = up[2];
    camRot[6] = forward[0]; camRot[7] = forward[1]; camRot[8] = forward[2];
  }

  /* ---------- Interaction state ---------- */
  var rawX = 0, rawY = 0;
  var mouseX = 0, mouseY = 0, mouseVX = 0, mouseVY = 0;
  var camX = 0, camY = 0;
  var strength = 0;
  var turbulence = 0;
  var speedPool = 0;
  var pointerActive = false;
  var lastMove = -100;
  var lastMouseWave = -100;
  var waves = [[0, 0, 0, -100], [0, 0, 0, -100], [0, 0, 0, -100]];
  var waveSlot = 0;
  var nextAmbientWave = 6 + Math.random() * 6;
  var mouseWorld = [0, 0, 0];

  function spawnWave(x, y, z, at) {
    waves[waveSlot] = [x, y, z, at];
    waveSlot = (waveSlot + 1) % waves.length;
  }

  if (!coarsePointer) {
    window.addEventListener("pointermove", function (event) {
      var bounds = visual.getBoundingClientRect();
      var nextX = (event.clientX - (bounds.left + bounds.width * 0.5)) / (bounds.width * 0.5);
      var nextY = -(event.clientY - (bounds.top + bounds.height * 0.5)) / (bounds.height * 0.5);
      nextX = Math.max(-2.2, Math.min(2.2, nextX));
      nextY = Math.max(-2.2, Math.min(2.2, nextY));
      var moved = Math.hypot(nextX - rawX, nextY - rawY);
      speedPool += moved * 3;
      if (moved > 0.22 && time - lastMouseWave > 1.8 && Math.abs(nextX) < 1.3 && Math.abs(nextY) < 1.3) {
        lastMouseWave = time;
        spawnWave(mouseWorld[0], mouseWorld[1], mouseWorld[2], time);
      }
      rawX = nextX;
      rawY = nextY;
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
  var assembleStart = -1;
  var animationFrame = 0;
  var sceneVisible = true;

  function requestFrame() {
    if (reduceMotion || animationFrame || !sceneVisible || document.hidden || !width) return;
    animationFrame = requestAnimationFrame(frame);
  }

  function updateCamera() {
    var yaw = time * 0.03 + camX * 0.32 + Math.sin(time * 0.17) * 0.04;
    var pitch = 0.22 + Math.sin(time * 0.11) * 0.07 - camY * 0.2;
    camDist = 4.4 + Math.sin(time * 0.09) * 0.14 + Math.sin(time * 0.023) * 0.1;
    var eye = [
      camDist * Math.sin(yaw) * Math.cos(pitch),
      camDist * Math.sin(pitch),
      camDist * Math.cos(yaw) * Math.cos(pitch)
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

  function step(dt) {
    time += dt;
    if (assembleStart < 0 && (root.classList.contains("is-ready") || !document.getElementById("loader"))) {
      assembleStart = time;
    }

    var target = pointerActive && time - lastMove < 3 ? 1 : 0;
    strength += (target - strength) * (target > strength ? 0.07 : 0.012);
    mouseVX += (rawX - mouseX) * 0.085;
    mouseVY += (rawY - mouseY) * 0.085;
    mouseVX *= 0.8;
    mouseVY *= 0.8;
    mouseX += mouseVX;
    mouseY += mouseVY;
    camX += (rawX - camX) * 0.045;
    camY += (rawY - camY) * 0.045;
    turbulence += (Math.min(1.4, speedPool * 0.9) - turbulence) * 0.08;
    speedPool *= 0.9;

    if (time > nextAmbientWave) {
      nextAmbientWave = time + 7 + Math.random() * 9;
      spawnWave((Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, time);
    }

    updateCamera();
  }

  function drawQuad(prog) {
    gl.useProgram(prog.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  var waveUniform = new Float32Array(12);

  function render(decay, assemble) {
    var current = targets[0];
    var previous = targets[1];
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, width, height);

    // 1. Decay the previous accumulation into the current target.
    gl.bindFramebuffer(gl.FRAMEBUFFER, current.fbo);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, previous.texture);
    gl.useProgram(fade.prog);
    gl.uniform1i(fade.u.u_prev, 0);
    gl.uniform1f(fade.u.u_decay, decay);
    drawQuad(fade);

    // 2. Add the geometry on top.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(scene.prog);
    gl.uniformMatrix4fv(scene.u.u_view, false, view);
    gl.uniformMatrix4fv(scene.u.u_proj, false, proj);
    gl.uniformMatrix3fv(scene.u.u_camRot, false, camRot);
    gl.uniform1f(scene.u.u_time, time);
    gl.uniform1f(scene.u.u_assemble, assemble);
    gl.uniform1f(scene.u.u_turb, turbulence);
    gl.uniform1f(scene.u.u_pixelRatio, pixelRatio);
    gl.uniform1f(scene.u.u_mouseStrength, strength);
    gl.uniform3f(scene.u.u_mousePos, mouseWorld[0], mouseWorld[1], mouseWorld[2]);
    for (var i = 0; i < 3; i += 1) {
      waveUniform[i * 4] = waves[i][0];
      waveUniform[i * 4 + 1] = waves[i][1];
      waveUniform[i * 4 + 2] = waves[i][2];
      waveUniform[i * 4 + 3] = waves[i][3];
    }
    gl.uniform4fv(scene.u.u_wave, waveUniform);
    gl.uniform3f(scene.u.u_colDeep, 0.03, 0.32, 0.21);
    gl.uniform3f(scene.u.u_colMid, 0.05, 0.72, 0.44);
    gl.uniform3f(scene.u.u_colHi, 0.45, 0.98, 0.76);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.enableVertexAttribArray(aData);
    gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.uniform1f(scene.u.u_ghost, 1);
    gl.drawElements(gl.LINES, lineIndex.length, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(scene.u.u_ghost, 0);
    gl.drawElements(gl.LINES, lineIndex.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, pointCount);

    // 3. Composite to the canvas with bloom and haze.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.useProgram(display.prog);
    gl.uniform1i(display.u.u_tex, 0);
    gl.uniform2f(display.u.u_texel, 1 / width, 1 / height);
    gl.uniform1f(display.u.u_time, time);
    drawQuad(display);

    targets[0] = previous;
    targets[1] = current;
  }

  function frame(now) {
    animationFrame = 0;
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    step(dt);
    var assemble = assembleStart < 0 ? 0 : Math.min(1, (time - assembleStart) / 3.4);
    render(Math.pow(0.86, dt * 60), assemble);
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
