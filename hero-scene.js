/* Hero object: the Envision "EV" mark as a living glass sculpture, WebGL.
   The three bars of the E and the V are traced from the logo and extruded
   into depth. Each outline is drawn as five strands stacked through the
   thickness, so the mark reads as one coherent wireframe solid. Layered
   on top: translucent glass walls and faces between the strands, energy
   pulses that ride the front and back edges, ripples along each outline,
   a scanning window that reveals cross-ribs, a slow heartbeat, orbital
   dust, a delayed echo, wave events, a depth twist and a cursor light.
   Outline geometry is static; the vertex shader animates it from
   uniforms, and only a small point buffer is updated per frame. */
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

  /* Vertex layout (10 floats):
       a_pos  = (x, y, z, extra)   object-space position; extra is a per-type
                                   field (rib: 1 = structural corner rib,
                                   dust / ambient: seed)
       a_norm = (nx, ny)           outward in-plane normal of the outline
       a_data = (u, strand, u0, type)
                u      arc position around the outline, 0..2pi
                strand shape * LAYERS + layer
                u0     where this strand starts drawing during the reveal
     Types: 0 strand line, 1 seed point, 2 ambient particle, 3 energy
     pulse, 4 glass wall, 5 cross-rib, 6 orbital dust, 7 glass face. */
  var SCENE_VS = [
    "precision highp float;",
    "attribute vec4 a_pos;",
    "attribute vec2 a_norm;",
    "attribute vec4 a_data;",
    "uniform mat4 u_view;",
    "uniform mat4 u_proj;",
    "uniform mat3 u_objRot;",
    "uniform vec3 u_camPos;",
    "uniform float u_time;",
    "uniform float u_echo;",
    "uniform float u_reveal;",
    "uniform float u_scale;",
    "uniform float u_twist;",
    "uniform float u_beat;",
    "uniform float u_sweep;",
    "uniform float u_sweepGate;",
    "uniform float u_scanU;",
    "uniform float u_pixelRatio;",
    "uniform float u_mouseStrength;",
    "uniform float u_layers;",
    "uniform vec3 u_mousePos;",
    "uniform vec3 u_shapeK;",
    "uniform vec4 u_pulse[6];",
    "uniform vec4 u_wave[3];",
    "varying float v_depth;",
    "varying float v_bright;",
    "varying float v_alpha;",
    "varying float v_type;",
    NOISE,
    "float hash(float n){return fract(sin(n)*43758.5453);}",
    "vec3 hash3(float n){return vec3(hash(n),hash(n+1.7),hash(n+2.9));}",
    "float sq(float x){return x*x;}",
    "float wrapDist(float a){return abs(mod(a+3.14159,6.2832)-3.14159);}",
    "",
    "float pulseGlow(float u, float shape, float off){",
    "  float g=0.0;",
    "  for(int i=0;i<6;i++){",
    "    float match=step(abs(u_pulse[i].y-shape),0.5);",
    "    g+=match*exp(-sq(wrapDist(u-u_pulse[i].x)*3.0))*(1.0-0.45*abs(off-u_pulse[i].z));",
    "  }",
    "  return g;",
    "}",
    "",
    "void main(){",
    "  float u=a_data.x;",
    "  float strand=a_data.y;",
    "  float u0=a_data.z;",
    "  float type=a_data.w;",
    "  float t=u_time-u_echo*0.6;",
    "  v_type=type;",
    "  vec3 p=vec3(0.0);",
    "  float alpha=0.0;",
    "  float bright=0.0;",
    "  float size=1.0;",
    "  bool ambient=type>1.5&&type<2.5;",
    "  float visible=1.0;",
    "  float mouseF=0.0;",
    "",
    "  if(!ambient){",
    "    float shape=floor((strand+0.5)/u_layers);",
    "    float layer=strand-shape*u_layers;",
    "    float off=(layer-(u_layers-1.0)*0.5)/((u_layers-1.0)*0.5);",
    "    float k=shape<0.5?u_shapeK.x:(shape<1.5?u_shapeK.y:u_shapeK.z);",
    "    float ang=a_pos.z*u_twist;",
    "    float ca=cos(ang);",
    "    float sa=sin(ang);",
    "    vec2 xy=vec2(ca*a_pos.x-sa*a_pos.y,sa*a_pos.x+ca*a_pos.y);",
    "    p=vec3(xy,a_pos.z)*u_scale;",
    "    vec3 n=vec3(snoise(vec3(a_pos.xy*0.9,t*0.06)),snoise(vec3(a_pos.yx*0.9+5.0,t*0.05)),snoise(vec3(a_pos.xy*0.7+9.0,t*0.055)));",
    "    p+=n*0.028;",
    "    float ripple=exp(-sq(wrapDist(u-t*0.5*k)*2.2))*0.8+exp(-sq(wrapDist(u+t*0.37*k+2.0)*2.6))*0.6;",
    "    p+=vec3(a_norm,0.0)*ripple*0.022;",
    "    bright+=ripple*0.35+pulseGlow(u,shape,off)*0.6;",
    "    p=u_objRot*p;",
    "    vec3 d=u_mousePos-p;",
    "    mouseF=u_mouseStrength*0.16/(1.0+dot(d,d)*4.0);",
    "    p+=d*mouseF;",
    "    bright+=mouseF*1.5;",
    "    float stagger=strand*0.035;",
    "    float grow=clamp((u_reveal-stagger)/(1.0-stagger),0.0,1.0);",
    "    grow=grow*grow*(3.0-2.0*grow);",
    "    float arc=wrapDist(u-u0);",
    "    float reach=grow*3.4;",
    "    visible=1.0-smoothstep(reach-0.3,reach,arc);",
    "    if(type<0.5){",
    "      float primary=step(0.99,abs(off));",
    "      alpha=mix(0.3,0.8,primary)*visible*mix(1.0,0.15,u_echo);",
    "    } else if(type<1.5){",
    "      alpha=smoothstep(0.0,0.12,u_reveal)*(1.0-smoothstep(0.25,0.6,grow));",
    "      size=2.6;",
    "      bright=0.6;",
    "    } else if(type<3.5){",
    "      alpha=smoothstep(0.9,1.0,u_reveal)*(1.0-u_echo);",
    "      size=3.0;",
    "      bright=1.2;",
    "    } else if(type<4.5){",
    "      vec3 wn=normalize(u_objRot*vec3(a_norm,0.0));",
    "      vec3 toCam=normalize(u_camPos-p);",
    "      float facing=abs(dot(wn,toCam));",
    "      alpha=(0.02+0.07*(1.0-facing))*visible*(1.0-u_echo);",
    "      bright*=0.6;",
    "    } else if(type<5.5){",
    "      float win=exp(-sq(wrapDist(u-u_scanU*k)*1.6));",
    "      alpha=(0.22*win+mouseF*3.0+a_pos.w*0.3)*visible*(1.0-u_echo);",
    "    } else if(type<6.5){",
    "      p+=vec3(snoise(p*2.0+t*0.1),snoise(p.yzx*2.0-t*0.09),snoise(p.zxy*2.0+t*0.11))*0.03;",
    "      alpha=0.14*smoothstep(0.6,1.0,u_reveal);",
    "      size=1.2+hash(a_pos.w*2.0)*0.6;",
    "    } else {",
    "      vec3 fn=normalize(u_objRot*vec3(0.0,0.0,1.0));",
    "      vec3 toCam=normalize(u_camPos-p);",
    "      float facing=abs(dot(fn,toCam));",
    "      alpha=(0.008+0.018*facing)*visible*(1.0-u_echo);",
    "      bright*=0.5;",
    "    }",
    "  } else {",
    "    float seed=a_pos.w;",
    "    vec3 base=normalize(hash3(seed*31.0)-0.5)*(1.9+hash(seed*7.0)*1.3);",
    "    p=base+vec3(sin(t*0.07+seed*6.28),cos(t*0.05+seed*2.0),sin(t*0.06+seed*4.0))*0.08;",
    "    alpha=(0.1+0.15*hash(seed*3.0))*smoothstep(0.5,1.0,u_reveal);",
    "    size=1.3;",
    "  }",
    "",
    "  if(!ambient){",
    "    for(int i=0;i<3;i++){",
    "      float age=u_time-u_wave[i].w;",
    "      if(age>0.0&&age<2.8){",
    "        vec3 away=p-u_wave[i].xyz;",
    "        float dd=length(away)+0.0001;",
    "        float w=exp(-sq((dd-age*1.4)*2.5))*(1.0-age/2.8);",
    "        p+=(away/dd)*w*0.05;",
    "        bright+=w*0.8;",
    "      }",
    "    }",
    "    bright+=u_sweepGate*0.45*exp(-sq((p.y-u_sweep)*5.0));",
    "    bright+=u_beat;",
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
    "  bool isPoint=(v_type>0.5&&v_type<3.5)||(v_type>5.5&&v_type<6.5);",
    "  if(isPoint){",
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
    "uniform vec2 u_cursor;",
    "uniform float u_cursorStrength;",
    "uniform float u_reveal;",
    "uniform float u_time;",
    "float hash2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}",
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
    "  vec3 col=c.rgb+(b/4.0)*0.32+(h/4.0)*0.2*vec3(0.6,1.0,0.8);",
    "  vec2 q=v_uv-vec2(0.5,0.48);",
    "  col+=exp(-dot(q,q)*7.0)*0.03*u_reveal*vec3(0.25,1.0,0.65);",
    "  vec2 cq=(v_uv-u_cursor)*vec2(1.0,t.x/t.y);",
    "  float cursorLight=exp(-dot(cq,cq)*45.0)*u_cursorStrength;",
    "  col*=1.0+cursorLight*0.4;",
    "  col+=cursorLight*0.012*vec3(0.3,1.0,0.7);",
    "  float vig=1.0-0.28*smoothstep(0.45,1.0,length(v_uv-0.5)*1.25);",
    "  col*=vig;",
    "  float grain=(hash2(v_uv*vec2(1.0/t.x,1.0/t.y)+fract(u_time)*13.0)-0.5)*0.014;",
    "  col+=grain*clamp(0.25+col.g*3.0,0.0,1.0);",
    "  col=vec3(1.0)-exp(-max(col,0.0)*1.5);",
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

  /* ---------- The mark ----------
     Corner points traced from assets/logo-ev.png (320 x 164 px, y down),
     then centred and scaled so the mark is about 1.7 units wide. Shape 0
     is the top bar of the E flowing into the V; shapes 1 and 2 are the
     middle and bottom bars. Each polygon is listed clockwise on screen. */
  var LOGO_PX = [
    [[8, 8], [143, 8], [203, 96], [269, 8], [311, 8], [198, 154], [127, 37.5], [38, 37.5]],
    [[8.5, 71.5], [120, 71.5], [139.5, 99], [36.5, 99]],
    [[39, 127.5], [157, 127.5], [173.5, 155.5], [8, 155.5]]
  ];
  /* Glass faces, as corner-index triangles per shape. */
  var LOGO_TRIS = [
    [[0, 1, 6], [0, 6, 7], [1, 2, 5], [1, 5, 6], [2, 3, 4], [2, 4, 5]],
    [[0, 1, 2], [0, 2, 3]],
    [[0, 1, 2], [0, 2, 3]]
  ];
  var UNIT = 1 / 180;
  var CENTRE_X = 160;
  var CENTRE_Y = 82;

  var LAYERS = 5;
  var DEPTH = 0.26;
  var DENSITY = coarsePointer ? 44 : 64;   // samples per unit of outline
  var RIB_EVERY = 8;
  var PARTICLES = 24;
  var PULSES = 6;
  var DUST = coarsePointer ? 24 : 40;
  var TWO_PI = Math.PI * 2;

  function hashJs(n) {
    var s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  }

  /* Build one outline: corners in object space, edges with outward
     normals and cumulative length, evenly spaced samples that always
     include the corners. */
  function buildShape(pixels) {
    var corners = pixels.map(function (pt) {
      return [(pt[0] - CENTRE_X) * UNIT, (CENTRE_Y - pt[1]) * UNIT];
    });
    var count = corners.length;
    var area = 0;
    for (var i = 0; i < count; i += 1) {
      var a = corners[i];
      var b = corners[(i + 1) % count];
      area += a[0] * b[1] - b[0] * a[1];
    }
    var outward = area > 0 ? 1 : -1;
    var edges = [];
    var length = 0;
    for (var e = 0; e < count; e += 1) {
      var from = corners[e];
      var to = corners[(e + 1) % count];
      var dx = to[0] - from[0];
      var dy = to[1] - from[1];
      var len = Math.hypot(dx, dy);
      edges.push({
        from: from,
        to: to,
        len: len,
        start: length,
        normal: [dy / len * outward, -dx / len * outward]
      });
      length += len;
    }
    var cornerNormals = corners.map(function (_, c) {
      var prev = edges[(c - 1 + count) % count].normal;
      var next = edges[c].normal;
      var nx = prev[0] + next[0];
      var ny = prev[1] + next[1];
      var nl = Math.hypot(nx, ny) || 1;
      return [nx / nl, ny / nl];
    });

    var samples = [];
    var cornerIndex = [];
    var spacing = 1 / DENSITY;
    edges.forEach(function (edge, index) {
      var steps = Math.max(1, Math.round(edge.len / spacing));
      for (var s = 0; s < steps; s += 1) {
        var f = s / steps;
        var along = edge.start + edge.len * f;
        var normal = s === 0 ? cornerNormals[index] : edge.normal;
        if (s === 0) cornerIndex.push(samples.length);
        samples.push({
          x: edge.from[0] + (edge.to[0] - edge.from[0]) * f,
          y: edge.from[1] + (edge.to[1] - edge.from[1]) * f,
          nx: normal[0],
          ny: normal[1],
          u: (along / length) * TWO_PI,
          corner: s === 0
        });
      }
    });

    function evalAt(u) {
      var along = ((u % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * length;
      var edge = edges[edges.length - 1];
      for (var j = 0; j < edges.length; j += 1) {
        if (along < edges[j].start + edges[j].len) { edge = edges[j]; break; }
      }
      var f = (along - edge.start) / edge.len;
      return {
        x: edge.from[0] + (edge.to[0] - edge.from[0]) * f,
        y: edge.from[1] + (edge.to[1] - edge.from[1]) * f,
        nx: edge.normal[0],
        ny: edge.normal[1]
      };
    }

    return { corners: corners, cornerNormals: cornerNormals, samples: samples,
             cornerIndex: cornerIndex, length: length, evalAt: evalAt };
  }

  var shapes = LOGO_PX.map(buildShape);
  var shapeK = shapes.map(function (shape) { return TWO_PI / shape.length; });
  var strandStart = [];
  for (var si = 0; si < shapes.length * LAYERS; si += 1) {
    strandStart.push(hashJs(si * 3.7 + 1.3) * TWO_PI);
  }
  function layerZ(layer) { return (layer / (LAYERS - 1) - 0.5) * DEPTH; }

  /* ---------- Geometry buffers ---------- */
  var FLOATS = 10;
  var lineData = [];
  var lineIndex = [];
  var wallIndex = [];

  function pushVertex(target, x, y, z, extra, nx, ny, u, strand, type) {
    target.push(x, y, z, extra, nx, ny, u, strand, strandStart[strand], type);
    return target.length / FLOATS - 1;
  }

  shapes.forEach(function (shape, shapeIndex) {
    var n = shape.samples.length;
    var layerBase = [];
    for (var layer = 0; layer < LAYERS; layer += 1) {
      var strand = shapeIndex * LAYERS + layer;
      var z = layerZ(layer);
      var base = lineData.length / FLOATS;
      layerBase.push(base);
      shape.samples.forEach(function (s) {
        pushVertex(lineData, s.x, s.y, z, 0, s.nx, s.ny, s.u, strand, 0);
      });
      for (var i = 0; i < n; i += 1) lineIndex.push(base + i, base + ((i + 1) % n));
    }
    // Glass walls between consecutive layers reuse the strand vertices.
    for (var w = 0; w < LAYERS - 1; w += 1) {
      for (var q = 0; q < n; q += 1) {
        var a = layerBase[w] + q;
        var b = layerBase[w] + ((q + 1) % n);
        var c = layerBase[w + 1] + q;
        var d = layerBase[w + 1] + ((q + 1) % n);
        wallIndex.push(a, c, b, b, c, d);
      }
    }
  });
  var wallData = lineData.slice();
  for (var wv = 0; wv < wallData.length / FLOATS; wv += 1) wallData[wv * FLOATS + 9] = 4;

  // Cross-ribs: structural ribs at every corner, scanned ribs along the edges.
  shapes.forEach(function (shape, shapeIndex) {
    var strand = shapeIndex * LAYERS;
    shape.samples.forEach(function (s, index) {
      if (!s.corner && index % RIB_EVERY !== 0) return;
      var flag = s.corner ? 1 : 0;
      var first = pushVertex(lineData, s.x, s.y, layerZ(0), flag, s.nx, s.ny, s.u, strand, 5);
      var second = pushVertex(lineData, s.x, s.y, layerZ(LAYERS - 1), flag, s.nx, s.ny, s.u, strand, 5);
      lineIndex.push(first, second);
    });
  });

  // Glass faces on the front and back of the mark.
  var faceData = [];
  shapes.forEach(function (shape, shapeIndex) {
    [0, LAYERS - 1].forEach(function (layer) {
      var strand = shapeIndex * LAYERS + layer;
      var z = layerZ(layer);
      LOGO_TRIS[shapeIndex].forEach(function (tri) {
        tri.forEach(function (cornerIdx) {
          var corner = shape.corners[cornerIdx];
          var normal = shape.cornerNormals[cornerIdx];
          var sample = shape.samples[shape.cornerIndex[cornerIdx]];
          pushVertex(faceData, corner[0], corner[1], z, 0, normal[0], normal[1], sample.u, strand, 7);
        });
      });
    });
  });
  var faceCount = faceData.length / FLOATS;

  // Static points: one seed per strand, plus ambient particles.
  var pointData = [];
  shapes.forEach(function (shape, shapeIndex) {
    for (var layer = 0; layer < LAYERS; layer += 1) {
      var strand = shapeIndex * LAYERS + layer;
      var at = shape.evalAt(strandStart[strand]);
      pushVertex(pointData, at.x, at.y, layerZ(layer), 0, at.nx, at.ny, strandStart[strand], strand, 1);
    }
  });
  for (var particle = 0; particle < PARTICLES; particle += 1) {
    pointData.push(0, 0, 0, Math.random(), 0, 0, 0, 0, 0, 2);
  }
  var pointCount = pointData.length / FLOATS;

  function buffer(target, data, usage) {
    var buf = gl.createBuffer();
    gl.bindBuffer(target, buf);
    gl.bufferData(target, data, usage || gl.STATIC_DRAW);
    return buf;
  }
  var lineBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(lineData));
  var lineIndexBuffer = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lineIndex));
  var wallBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(wallData));
  var wallIndexBuffer = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(wallIndex));
  var faceBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(faceData));
  var pointBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array(pointData));
  var dynamicCount = PULSES + DUST;
  var dynamicData = new Float32Array(dynamicCount * FLOATS);
  var dynamicBuffer = buffer(gl.ARRAY_BUFFER, dynamicData, gl.DYNAMIC_DRAW);
  var quadBuffer = buffer(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
  var aPos = gl.getAttribLocation(scene.prog, "a_pos");
  var aNorm = gl.getAttribLocation(scene.prog, "a_norm");
  var aData = gl.getAttribLocation(scene.prog, "a_data");
  var STRIDE = FLOATS * 4;

  function bindGeometry(buf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(aNorm, 2, gl.FLOAT, false, STRIDE, 16);
    gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, STRIDE, 24);
  }

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
  var eye = [0, 0, camDist];

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

  function lookAt(out, from) {
    var forward = normalize([-from[0], -from[1], -from[2]]);
    var right = normalize(cross(forward, [0, 1, 0]));
    var up = cross(right, forward);
    camRight = right;
    camUp = up;
    out[0] = right[0]; out[4] = right[1]; out[8] = right[2];
    out[1] = up[0]; out[5] = up[1]; out[9] = up[2];
    out[2] = -forward[0]; out[6] = -forward[1]; out[10] = -forward[2];
    out[3] = 0; out[7] = 0; out[11] = 0;
    out[12] = -(right[0] * from[0] + right[1] * from[1] + right[2] * from[2]);
    out[13] = -(up[0] * from[0] + up[1] * from[1] + up[2] * from[2]);
    out[14] = forward[0] * from[0] + forward[1] * from[1] + forward[2] * from[2];
    out[15] = 1;
  }

  /* Column-major mat3 = rotZ(roll) * rotX(pitch) * rotY(yaw). */
  function objectRotation(out, yaw, pitch, roll) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cx = Math.cos(pitch), sx = Math.sin(pitch);
    var cz = Math.cos(roll), sz = Math.sin(roll);
    var m00 = cy, m01 = 0, m02 = sy;
    var m10 = sx * sy, m11 = cx, m12 = -sx * cy;
    var m20 = -cx * sy, m21 = sx, m22 = cx * cy;
    out[0] = cz * m00 - sz * m10; out[1] = sz * m00 + cz * m10; out[2] = m20;
    out[3] = cz * m01 - sz * m11; out[4] = sz * m01 + cz * m11; out[5] = m21;
    out[6] = cz * m02 - sz * m12; out[7] = sz * m02 + cz * m12; out[8] = m22;
  }

  function rotateByObject(v) {
    return [
      objRot[0] * v[0] + objRot[3] * v[1] + objRot[6] * v[2],
      objRot[1] * v[0] + objRot[4] * v[1] + objRot[7] * v[2],
      objRot[2] * v[0] + objRot[5] * v[1] + objRot[8] * v[2]
    ];
  }

  /* ---------- Interaction and event state ---------- */
  var rawX = 0, rawY = 0;
  var mouseX = 0, mouseY = 0, mouseVX = 0, mouseVY = 0;
  var camX = 0, camY = 0;
  var strength = 0;
  var pointerActive = false;
  var lastMove = -100;
  var lastMouseWave = -100;
  var mouseWorld = [0, 0, 0];
  var waves = [[0, 0, 0, -100], [0, 0, 0, -100], [0, 0, 0, -100]];
  var waveSlot = 0;
  var nextAmbientWave = 5 + Math.random() * 5;

  var pulses = [];
  for (var pi = 0; pi < PULSES; pi += 1) {
    pulses.push({
      shape: pi % shapes.length,
      u: Math.random() * TWO_PI,
      side: pi % 2 === 0 ? 1 : -1,
      speed: (0.3 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1)
    });
  }
  var dusts = [];
  for (var di = 0; di < DUST; di += 1) {
    dusts.push({
      shape: Math.floor(Math.random() * shapes.length),
      u: Math.random() * TWO_PI,
      speed: 0.04 * (Math.random() > 0.5 ? 1 : -1),
      out: 0.05 + Math.random() * 0.18,
      z: (Math.random() - 0.5) * DEPTH * 2.6,
      seed: Math.random()
    });
  }
  var pulseUniform = new Float32Array(PULSES * 4);
  var waveUniform = new Float32Array(12);

  function spawnWave(x, y, z, at) {
    waves[waveSlot] = [x, y, z, at];
    waveSlot = (waveSlot + 1) % waves.length;
  }

  if (!coarsePointer) {
    window.addEventListener("pointermove", function (event) {
      var bounds = visual.getBoundingClientRect();
      var nextX = Math.max(-2, Math.min(2, (event.clientX - (bounds.left + bounds.width * 0.5)) / (bounds.width * 0.5)));
      var nextY = Math.max(-2, Math.min(2, -(event.clientY - (bounds.top + bounds.height * 0.5)) / (bounds.height * 0.5)));
      var moved = Math.hypot(nextX - rawX, nextY - rawY);
      if (moved > 0.2 && time - lastMouseWave > 1.6 && Math.abs(nextX) < 1.2 && Math.abs(nextY) < 1.2) {
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
  var revealStart = -1;
  var animationFrame = 0;
  var sceneVisible = true;
  var objScale = 1;
  var objTwist = 0;
  var beat = 0;
  var sweep = 0;
  var sweepGate = 0;

  function requestFrame() {
    if (reduceMotion || animationFrame || !sceneVisible || document.hidden || !width) return;
    animationFrame = requestAnimationFrame(frame);
  }

  function writeDynamic(index, x, y, z, extra, nx, ny, u, strand, type) {
    var o = index * FLOATS;
    dynamicData[o] = x; dynamicData[o + 1] = y; dynamicData[o + 2] = z; dynamicData[o + 3] = extra;
    dynamicData[o + 4] = nx; dynamicData[o + 5] = ny;
    dynamicData[o + 6] = u; dynamicData[o + 7] = strand; dynamicData[o + 8] = strandStart[strand]; dynamicData[o + 9] = type;
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

    // Object: the mark stays legible; bounded drift, breathing, depth twist bursts.
    var yaw = 0.3 * Math.sin(time * 0.13) + 0.12 * Math.sin(time * 0.071) + mouseX * 0.24;
    var pitch = 0.1 * Math.sin(time * 0.09) + 0.04 * Math.sin(time * 0.19) - mouseY * 0.16;
    var roll = 0.04 * Math.sin(time * 0.05);
    objectRotation(objRot, yaw, pitch, roll);
    objScale = 1 + 0.035 * Math.sin(time * 0.27) + 0.02 * Math.sin(time * 0.11);
    var burstPhase = (time % 13) / 13;
    var burst = Math.sin(Math.PI * Math.max(0, Math.min(1, (burstPhase - 0.7) / 0.3)));
    objTwist = 0.35 * Math.sin(time * 0.21) + burst * 1.2;

    // Heartbeat, scanner plane and its gate.
    var beatPhase = (time % 8.5) / 8.5;
    beat = Math.exp(-beatPhase * 6) * 0.3;
    sweep = 0.7 * Math.sin(time * 0.23);
    sweepGate = Math.max(0, Math.min(1, (Math.sin(time * 0.09) - 0.3) / 0.3));

    // Energy pulses travel the front and back edges of each shape.
    for (var i = 0; i < PULSES; i += 1) {
      var pulse = pulses[i];
      pulse.u += pulse.speed * shapeK[pulse.shape] * dt;
      pulseUniform[i * 4] = pulse.u;
      pulseUniform[i * 4 + 1] = pulse.shape;
      pulseUniform[i * 4 + 2] = pulse.side;
      pulseUniform[i * 4 + 3] = 0;
      var at = shapes[pulse.shape].evalAt(pulse.u);
      writeDynamic(i, at.x, at.y, pulse.side * DEPTH * 0.5, 0, at.nx, at.ny, pulse.u, pulse.shape * LAYERS, 3);
    }
    // Orbital dust drifts along the outline just outside the mark.
    for (var d = 0; d < DUST; d += 1) {
      var mote = dusts[d];
      mote.u += mote.speed * shapeK[mote.shape] * dt;
      var m = shapes[mote.shape].evalAt(mote.u);
      writeDynamic(PULSES + d, m.x + m.nx * mote.out, m.y + m.ny * mote.out, mote.z, mote.seed, m.nx, m.ny, mote.u, mote.shape * LAYERS, 6);
    }

    // Ambient wave events originate on the mark itself.
    if (time > nextAmbientWave) {
      nextAmbientWave = time + 6 + Math.random() * 7;
      var ws = Math.floor(Math.random() * shapes.length);
      var wp = shapes[ws].evalAt(Math.random() * TWO_PI);
      var origin = rotateByObject([wp.x * objScale, wp.y * objScale, 0]);
      spawnWave(origin[0], origin[1], origin[2], time);
    }
    for (var w = 0; w < 3; w += 1) {
      waveUniform[w * 4] = waves[w][0];
      waveUniform[w * 4 + 1] = waves[w][1];
      waveUniform[w * 4 + 2] = waves[w][2];
      waveUniform[w * 4 + 3] = waves[w][3];
    }

    // Camera: a few degrees of orbit, gentle parallax, no zoom.
    var camYaw = 0.05 * Math.sin(time * 0.1) + camX * 0.06;
    var camPitch = 0.1 + 0.02 * Math.sin(time * 0.13) - camY * 0.04;
    camDist = 4.8 + 0.03 * Math.sin(time * 0.09);
    eye = [
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

  function drawLines(echo) {
    gl.uniform1f(scene.u.u_echo, echo);
    bindGeometry(lineBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.drawElements(gl.LINES, lineIndex.length, gl.UNSIGNED_SHORT, 0);
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

    // 2. Add the mark: glass faces and walls, echo, strands and ribs, then points.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(scene.prog);
    gl.uniformMatrix4fv(scene.u.u_view, false, view);
    gl.uniformMatrix4fv(scene.u.u_proj, false, proj);
    gl.uniformMatrix3fv(scene.u.u_objRot, false, objRot);
    gl.uniform3f(scene.u.u_camPos, eye[0], eye[1], eye[2]);
    gl.uniform1f(scene.u.u_time, time);
    gl.uniform1f(scene.u.u_reveal, reveal);
    gl.uniform1f(scene.u.u_scale, objScale);
    gl.uniform1f(scene.u.u_twist, objTwist);
    gl.uniform1f(scene.u.u_beat, beat);
    gl.uniform1f(scene.u.u_sweep, sweep);
    gl.uniform1f(scene.u.u_sweepGate, sweepGate);
    gl.uniform1f(scene.u.u_scanU, time * 0.35);
    gl.uniform1f(scene.u.u_pixelRatio, pixelRatio);
    gl.uniform1f(scene.u.u_mouseStrength, strength);
    gl.uniform1f(scene.u.u_layers, LAYERS);
    gl.uniform3f(scene.u.u_mousePos, mouseWorld[0], mouseWorld[1], mouseWorld[2]);
    gl.uniform3f(scene.u.u_shapeK, shapeK[0], shapeK[1], shapeK[2]);
    gl.uniform4fv(scene.u.u_pulse, pulseUniform);
    gl.uniform4fv(scene.u.u_wave, waveUniform);
    gl.uniform3f(scene.u.u_colDeep, 0.02, 0.3, 0.2);
    gl.uniform3f(scene.u.u_colMid, 0.06, 0.68, 0.42);
    gl.uniform3f(scene.u.u_colHi, 0.55, 0.98, 0.8);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNorm);
    gl.enableVertexAttribArray(aData);

    gl.uniform1f(scene.u.u_echo, 0);
    bindGeometry(faceBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, faceCount);
    bindGeometry(wallBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIndexBuffer);
    gl.drawElements(gl.TRIANGLES, wallIndex.length, gl.UNSIGNED_SHORT, 0);

    drawLines(1);
    drawLines(0);

    bindGeometry(pointBuffer);
    gl.drawArrays(gl.POINTS, 0, pointCount);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynamicData);
    bindGeometry(dynamicBuffer);
    gl.drawArrays(gl.POINTS, 0, dynamicCount);

    // 3. Composite with glow, cursor light, vignette and grain.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.useProgram(display.prog);
    gl.uniform1i(display.u.u_tex, 0);
    gl.uniform2f(display.u.u_texel, 1 / width, 1 / height);
    gl.uniform2f(display.u.u_cursor, mouseX * 0.5 + 0.5, mouseY * 0.5 + 0.5);
    gl.uniform1f(display.u.u_cursorStrength, strength);
    gl.uniform1f(display.u.u_reveal, reveal);
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
    var reveal = revealStart < 0 ? 0 : Math.min(1, (time - revealStart) / 2.6);
    render(Math.pow(0.8, dt * 60), reveal);
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
