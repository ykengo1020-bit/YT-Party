// ===== 3D描画（Three.js）=====
'use strict';
window.Render = (function () {
  const { CHARS, STATUS, ITEMS } = GD;
  let renderer, scene, camera, clock;
  let hemi, sun, amb;
  const tileMeshes = [];
  let themes = {}, curTheme = null;
  const chars = new Map();
  const itemMeshes = new Map();
  const projMeshes = new Map();
  let boxGroup, platGroup, marsObj = null, windPts = null;
  const fxList = [];
  let shake = 0;
  let myId = 0, hideTags = false;
  let lastSnap = null;
  let OPT = { shake: true, tags: true };
  const cam = { yaw: 0, pitch: 0.35, dist: 9.5, x: 0, y: 4, z: 10, tx: 0, ty: 1, tz: 0 };

  // ---------- テクスチャ生成 ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  function noise(g, w, h, a, col) {
    for (let i = 0; i < w * h * 0.04; i++) {
      g.fillStyle = col || `rgba(0,0,0,${Math.random() * a})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }
  function makeThemes() {
    const mk = (topDraw, sideDraw, opt = {}) => {
      const top = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, topDraw), roughness: opt.rough ?? 0.75, metalness: opt.metal ?? 0.05 });
      const side = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, sideDraw), roughness: 0.85 });
      return { top, side, opt };
    };
    const edge = (g, w, h, c) => { g.strokeStyle = c; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); };
    themes.none = mk((g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7dd3a8'); gr.addColorStop(1, '#4fb38a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); noise(g, w, h, 0.15); edge(g, w, h, 'rgba(255,255,255,.35)'); },
      (g, w, h) => { g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fbf8f'; g.fillRect(0, 0, w, 18); noise(g, w, h, 0.3); });
    themes.wind = mk((g, w, h) => { g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.25); g.strokeStyle = '#fbbf24'; g.lineWidth = 8; g.setLineDash([20, 14]); g.strokeRect(14, 14, w - 28, h - 28); },
      (g, w, h) => { g.fillStyle = '#4b5563'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = '#93c5fd'; g.fillRect(x + 4, 30, 22, 30); g.fillRect(x + 4, 78, 22, 30); } });
    themes.ice = mk((g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e0f2fe'); gr.addColorStop(1, '#93c5fd'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); } edge(g, w, h, 'rgba(255,255,255,.6)'); },
      (g, w, h) => { g.fillStyle = '#bfdbfe'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.1, 'rgba(255,255,255,.5)'); }, { rough: 0.08, metal: 0.2 });
    themes.conveyor = mk((g, w, h) => { g.fillStyle = '#1f2937'; g.fillRect(0, 0, w, h); g.fillStyle = '#facc15'; for (let y = 20; y < h; y += 64) { g.beginPath(); g.moveTo(60, y); g.lineTo(196, y); g.lineTo(196, y - 14); g.lineTo(236, y + 12); g.lineTo(196, y + 38); g.lineTo(196, y + 24); g.lineTo(60, y + 24); g.fill(); } },
      (g, w, h) => { g.fillStyle = '#374151'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 12, 16); });
    themes.crumble = mk((g, w, h) => { g.fillStyle = '#b45309'; g.fillRect(0, 0, w, h); g.strokeStyle = '#78350f'; g.lineWidth = 6; for (let y = 0; y < h; y += 64) { g.strokeRect(0, y, w, 64); for (let x = (y / 64) % 2 ? 0 : 64; x < w; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } } noise(g, w, h, 0.3); },
      (g, w, h) => { g.fillStyle = '#92400e'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.4); });
    themes.lagbridge = mk((g, w, h) => { g.fillStyle = '#0f172a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#22d3ee'; g.lineWidth = 3; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.fillStyle = 'rgba(236,72,153,.6)'; g.fillRect(40, 100, 90, 10); g.fillRect(150, 30, 60, 8); },
      (g, w, h) => { g.fillStyle = '#1e1b4b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ec4899'; g.fillRect(0, 0, w, 6); }, { rough: 0.3 });
    themes.rack = mk((g, w, h) => { g.fillStyle = '#111827'; g.fillRect(0, 0, w, h); for (let y = 16; y < h; y += 40) { g.fillStyle = '#374151'; g.fillRect(16, y, w - 32, 28); for (let x = 28; x < w - 30; x += 18) { g.fillStyle = Math.random() < 0.5 ? '#22c55e' : '#3b82f6'; g.fillRect(x, y + 10, 6, 6); } } },
      (g, w, h) => { g.fillStyle = '#1f2937'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 20) { g.fillStyle = '#4b5563'; g.fillRect(6, y, w - 12, 12); g.fillStyle = '#22c55e'; g.fillRect(14, y + 4, 4, 4); g.fillStyle = '#f59e0b'; g.fillRect(24, y + 4, 4, 4); } });
    themes.build = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d6a76b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8b5e34'; g.lineWidth = 4; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } noise(g, w, h, 0.2); }), roughness: 0.8 });
    themes.warn = new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0x991122, roughness: 0.6 });
  }

  // ---------- 空と背景 ----------
  function makeSky() {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3b2a7a) }, mid: { value: new THREE.Color(0xf08a6a) }, bot: { value: new THREE.Color(0x2a3d6b) }, dark: { value: 0 } },
      vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float dark; varying vec3 vp; void main(){ float h=vp.y; vec3 c = h>0.0 ? mix(mid, top, pow(h,0.6)) : mix(mid, bot, pow(-h,0.5)); float sun = pow(max(dot(vp, normalize(vec3(0.5,0.15,-0.85))),0.0), 64.0); c += vec3(1.0,0.8,0.5)*sun*1.2; c = mix(c, c*0.12, dark); gl_FragColor=vec4(c,1.0);} ',
    });
    const sky = new THREE.Mesh(geo, mat); sky.name = 'sky';
    scene.add(sky);
    // 雲
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffe4e6, roughness: 1, transparent: true, opacity: 0.85 });
    const clouds = new THREE.Group(); clouds.name = 'clouds';
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      const n = 3 + ((Math.random() * 4) | 0);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 5, 12, 8), cloudMat);
        s.position.set(k * 5 - n * 2.5, Math.random() * 2, Math.random() * 4); s.scale.y = 0.55; c.add(s);
      }
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 120;
      c.position.set(Math.cos(a) * r, -22 - Math.random() * 18, Math.sin(a) * r);
      c.userData.sp = 0.5 + Math.random();
      clouds.add(c);
    }
    scene.add(clouds);
    // 遠くの浮島
    const rock = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 1, flatShading: true });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6fcf97, roughness: 1, flatShading: true });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const s = 3 + Math.random() * 7;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.6, 7), rock); cone.rotation.x = Math.PI; cone.position.y = -s * 0.8; g.add(cone);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.95, 0.8, 7), grass); g.add(top);
      const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 90;
      g.position.set(Math.cos(a) * r, -5 + Math.random() * 25, Math.sin(a) * r);
      g.userData.bob = Math.random() * 6;
      g.name = 'island'; scene.add(g);
    }
  }

  // ---------- ステージ ----------
  function makeTiles() {
    const geo = new THREE.BoxGeometry(Sim.TS - 0.08, 1.2, Sim.TS - 0.08);
    for (let i = 0; i < Sim.N * Sim.N; i++) {
      const m = new THREE.Mesh(geo, [themes.none.side, themes.none.side, themes.none.top, themes.none.side, themes.none.side, themes.none.side]);
      const ii = (i / Sim.N) | 0, jj = i % Sim.N;
      m.position.set(-Sim.HALF + Sim.TS * (ii + 0.5), -0.6, -Sim.HALF + Sim.TS * (jj + 0.5));
      m.castShadow = true; m.receiveShadow = true;
      m.userData = { j: jj, fall: 0, gone: false };
      scene.add(m); tileMeshes.push(m);
    }
    boxGroup = new THREE.Group(); scene.add(boxGroup);
    platGroup = new THREE.Group(); scene.add(platGroup);
  }
  // ---------- マップごとの見た目（ライバル風アリーナ）----------
  let curMap = null, decoGroup = null, coverIdx = new Map();
  const coverCache = {};
  function coverMats(kind, v = 0) {
    const key = kind + v; if (coverCache[key]) return coverCache[key];
    let top, side;
    const mat = (draw, w = 256, h = 256, o = {}) => new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw), roughness: o.r ?? 0.75, metalness: o.m ?? 0.05, emissive: o.e ?? 0x000000, emissiveMap: o.em ? canvasTex(w, h, draw) : null });
    if (kind === 'crate') {
      const d = (g, w, h) => { g.fillStyle = '#c98a4b'; g.fillRect(0, 0, w, h); g.fillStyle = '#a86a32'; for (let y = 0; y < h; y += 42) g.fillRect(0, y, w, 6); g.strokeStyle = '#7a4a1e'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22); g.beginPath(); g.moveTo(20, 20); g.lineTo(w - 20, h - 20); g.stroke(); noise(g, w, h, 0.25); };
      top = mat(d); side = mat(d);
    } else if (kind === 'container') {
      const cols = ['#d94b3d', '#2f7dd1', '#2f9e5b', '#e58a1f'][v % 4];
      const d = (g, w, h) => { g.fillStyle = cols; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 8, 0, 3, h); } g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 30px sans-serif'; g.fillText('YB-' + (100 + v * 37), 26, 60); };
      top = mat(d, 256, 256, { m: 0.35, r: 0.5 }); side = mat(d, 256, 256, { m: 0.35, r: 0.5 });
    } else if (kind === 'concrete') {
      top = mat((g, w, h) => { g.fillStyle = '#a8a29e'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.25); g.save(); g.beginPath(); g.rect(0, 0, w, 26); g.rect(0, h - 26, w, 26); g.clip(); for (let x = -40; x < w + 40; x += 36) { g.fillStyle = '#facc15'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x - 8, h); g.lineTo(x - 26, h); g.fill(); g.fillStyle = '#1c1917'; g.beginPath(); g.moveTo(x + 18, 0); g.lineTo(x + 36, 0); g.lineTo(x + 10, h); g.lineTo(x - 8, h); g.fill(); } g.restore(); });
      side = mat((g, w, h) => { g.fillStyle = '#78716c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#57534e'; g.lineWidth = 3; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#f97316'; g.fillRect(0, 0, w, 10); noise(g, w, h, 0.3); });
    } else if (kind === 'pillar') {
      const d = (g, w, h) => { g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, w, h); g.strokeStyle = '#cbd5e1'; g.lineWidth = 3; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.fillStyle = '#16a34a'; g.fillRect(0, h * 0.45, w, 24); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('ゆうじょう駅', 60, h * 0.45 + 19); };
      top = mat(d); side = mat(d);
    } else if (kind === 'wood') {
      const d = (g, w, h) => { g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? '#8b5a2e' : '#a7764a'; g.fillRect(x, 0, 30, h); g.fillStyle = '#5c3a1a'; g.fillRect(x + 30, 0, 2, h); } noise(g, w, h, 0.25); };
      top = mat(d); side = mat((g, w, h) => { d(g, w, h); g.fillStyle = '#3a2412'; g.fillRect(60, 40, 50, 60); g.fillRect(150, 40, 50, 60); g.fillStyle = '#fde68a'; g.fillRect(66, 46, 38, 48); g.fillRect(156, 46, 38, 48); });
    } else { // neon
      const d = (g, w, h) => { g.fillStyle = '#0b0a14'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a855f7'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.strokeStyle = '#22d3ee'; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52); };
      top = mat(d, 256, 256, { e: 0xffffff, em: true, r: 0.3, m: 0.3 }); side = top;
    }
    return (coverCache[key] = [side, side, top, side, side, side]);
  }
  const floorCache = {};
  function floorMats(kind) {
    if (floorCache[kind]) return floorCache[kind];
    const mk = (topDraw, sideDraw, o = {}) => { const t = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, topDraw), roughness: o.r ?? 0.8, metalness: o.m ?? 0.05, emissive: o.e ?? 0, emissiveMap: o.e ? canvasTex(256, 256, topDraw) : null }); const s = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, sideDraw), roughness: 0.85 }); return [s, s, t, s, s, s]; };
    const F = {
      crate: () => mk((g, w, h) => { g.fillStyle = '#d4b98a'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.2); g.strokeStyle = '#b08b52'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.strokeStyle = 'rgba(160,110,60,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 70, 0, 7); g.stroke(); }, (g, w, h) => { g.fillStyle = '#b08050'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a5f36'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h); }),
      container: () => mk((g, w, h) => { g.fillStyle = '#6b7280'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.25); g.fillStyle = '#facc15'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.strokeRect(20, 20, w - 40, h - 40); }, (g, w, h) => { g.fillStyle = '#4b5563'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f2937'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 6, h); }),
      concrete: () => mk((g, w, h) => { g.fillStyle = '#b3aca5'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.25); g.strokeStyle = '#8a837c'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }, (g, w, h) => { g.fillStyle = '#57534e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#facc15'; g.lineWidth = 6; for (let x = -20; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, h); g.stroke(); } }),
      pillar: () => mk((g, w, h) => { g.fillStyle = '#b9c0ca'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.15); g.strokeStyle = '#9aa3ae'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.fillStyle = '#facc15'; g.fillRect(0, 0, w, 14); for (let x = 6; x < w; x += 16) { g.fillStyle = '#eab308'; g.fillRect(x, 3, 6, 8); } }, (g, w, h) => { g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h); g.fillStyle = '#facc15'; g.fillRect(0, 0, w, 10); }),
      wood: () => mk((g, w, h) => { g.fillStyle = '#c99a5e'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.25, 'rgba(150,100,50,.3)'); noise(g, w, h, 0.15); }, (g, w, h) => { g.fillStyle = '#c08a52'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.3); }),
      neon: () => mk((g, w, h) => { g.fillStyle = '#15121f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7c3aed'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = 'rgba(124,58,237,.18)'; g.fillRect(40, 40, w - 80, h - 80); }, (g, w, h) => { g.fillStyle = '#0b0a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#a855f7'; g.fillRect(0, 0, w, 6); }, { e: 0xffffff, r: 0.3, m: 0.3 }),
    };
    return (floorCache[kind] = F[kind]());
  }
  // マップの周りの飾り（当たり判定なし）
  function buildDeco(kind) {
    const g = new THREE.Group();
    const S = (c, o) => std(new THREE.Color(c).convertSRGBToLinear(), o);
    const box = (w, h, d, m, x, y, z, ry = 0) => { const b = M(new THREE.BoxGeometry(w, h, d), m, x, y, z, g); b.rotation.y = ry; b.castShadow = true; return b; };
    const ring = (r, n, fn) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fn(Math.cos(a) * r, Math.sin(a) * r, a); } };
    if (kind === 'colosseum') {
      const st = S(0xe7d8bf, { r: 0.9 }), st2 = S(0xcdb896, { r: 0.9 });
      ring(24, 28, (x, z, a) => { M(new THREE.CylinderGeometry(0.9, 1.0, 12, 10), st, x, -3, z, g); box(2.6, 0.8, 2.6, st2, x, 3.4, z, -a); });
      const wall = M(new THREE.CylinderGeometry(26, 26, 3, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xd9c7a5, side: THREE.DoubleSide, roughness: 0.95 }), 0, 4.6, 0, g);
      ring(25.5, 8, (x, z, a) => { const f = M(new THREE.PlaneGeometry(2.2, 4), new THREE.MeshStandardMaterial({ color: [0xef4444, 0x3b82f6][Math.round(a * 10) % 2], side: THREE.DoubleSide }), x * 0.98, 3.2, z * 0.98, g); f.lookAt(0, 3.2, 0); });
      M(new THREE.CircleGeometry(23, 48), S(0xd6b98c, { r: 1 }), 0, -9, 0, g).rotation.x = -Math.PI / 2;
    } else if (kind === 'docks') {
      const water = M(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1d7fc4, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }), 0, -3.5, 0, g); water.rotation.x = -Math.PI / 2; water.userData.water = true;
      const cc = [0xd94b3d, 0x2f7dd1, 0x2f9e5b, 0xe58a1f, 0x9ca3af];
      for (let k = 0; k < 40; k++) { const s = k % 2 ? 1 : -1, x = s * (18 + (k % 5) * 3.2), z = -20 + ((k * 7) % 40), y = -1.2 + ((k * 3) % 3) * 2.6; box(2.8, 2.5, 6, S(cc[k % 5], { m: 0.3, r: 0.5 }), x, y, z); }
      for (const s of [-1, 1]) { const y = S(0xfacc15, { m: 0.4, r: 0.4 }); for (const dz of [-1.2, 1.2]) box(0.5, 18, 0.5, y, s * 16, 5, dz - 8 * s); box(0.6, 0.6, 20, y, s * 16, 14, -8 * s + 4); box(3, 2, 3, S(0x1f2937), s * 16, 13, -8 * s - 5); }
      for (let k = 0; k < 10; k++) box(0.5, 1, 0.5, S(0x374151), (k % 2 ? 1 : -1) * 13.2, -0.5, -12 + k * 2.6);
    } else if (kind === 'construction') {
      const y = S(0xf59e0b, { m: 0.4, r: 0.4 }), dk = S(0x44403c);
      // タワークレーン
      for (const [cx, cz, ry] of [[-20, 12, 0.6], [22, -14, 2.4]]) {
        for (let h = -8; h < 18; h += 2.4) { box(1.6, 0.15, 1.6, y, cx, h, cz); for (const [ox, oz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) box(0.12, 2.4, 0.12, y, cx + ox, h + 1.2, cz + oz); }
        const arm = new THREE.Group(); arm.position.set(cx, 19, cz); arm.rotation.y = ry; g.add(arm);
        M(new THREE.BoxGeometry(22, 0.8, 0.8), y, 6, 0, 0, arm); M(new THREE.BoxGeometry(2, 2, 2), S(0x78716c), -5, -0.6, 0, arm); M(new THREE.BoxGeometry(1.4, 1.4, 1.6), S(0x1f2937), 0, -1, 0, arm);
        rod([12, 0, 0], [12, -9, 0], 0.04, dk, arm); M(new THREE.BoxGeometry(1.2, 0.8, 1.2), S(0x9ca3af), 12, -9.4, 0, arm);
      }
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const c = M(new THREE.ConeGeometry(0.35, 0.9, 10), S(0xf97316), Math.cos(a) * 17, -2.5, Math.sin(a) * 17, g); }
      for (let k = 0; k < 6; k++) box(4, 0.3, 0.6, S(0x8b5a2e), -16 + k * 6.4, -6 + (k % 3), 18);
    } else if (kind === 'station') {
      const rail = S(0x9ca3af, { m: 0.9, r: 0.3 }), sl = S(0x5b3a1e);
      for (const z of [-0.7, 0.7]) box(80, 0.15, 0.12, rail, 0, -0.9, z);
      for (let x = -40; x <= 40; x += 1.3) box(0.3, 0.12, 2.2, sl, x, -1.02, 0);
      M(new THREE.PlaneGeometry(90, 8), S(0x6b6b6b, { r: 1 }), 0, -1.1, 0, g).rotation.x = -Math.PI / 2;
      for (const s of [-1, 1]) for (let x = -24; x <= 24; x += 8) { if (Math.abs(x) < 15) continue; rod([x, -6, s * 10], [x, 4, s * 10], 0.15, S(0x374151), g); M(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff7c2 }), x, 4.2, s * 10, g); }
      const sign = M(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ map: labelTex('stsign', 384, 100, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#16a34a'; c.fillRect(0, 70, w, 30); c.fillStyle = '#111'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.fillText('ゆうじょう', w / 2, 56); c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText('YUJO  ←ブレイカーズ　　ライバル→', w / 2, 92); }), side: THREE.DoubleSide }), 0, 6.5, -16, g);
      rod([-2.5, -4, -16], [-2.5, 5.7, -16], 0.1, S(0x374151), g); rod([2.5, -4, -16], [2.5, 5.7, -16], 0.1, S(0x374151), g);
    } else if (kind === 'westown') {
      M(new THREE.CircleGeometry(160, 40), S(0xe0b277, { r: 1 }), 0, -6, 0, g).rotation.x = -Math.PI / 2;
      const wd = S(0x9a6a3c, { r: 0.9 }), wd2 = S(0x7a4f2a, { r: 0.9 }), cac = S(0x4d9a4a, { r: 0.8 });
      for (let k = 0; k < 8; k++) { const s = k % 2 ? 1 : -1, z = -15 + (k >> 1) * 10; box(6, 9 + (k % 3) * 2, 8, k % 3 ? wd : wd2, s * 22, -1.5, z); box(6.4, 1.2, 8.4, wd2, s * 22, 3.6 + (k % 3) * 1, z); }
      for (let k = 0; k < 12; k++) { const a = k * 2.1, r = 30 + (k * 13) % 40; const x = Math.cos(a) * r, z = Math.sin(a) * r; M(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), cac, x, -3.5, z, g); M(new THREE.CylinderGeometry(0.3, 0.3, 2, 8), cac, x + 0.9, -2.5, z, g); }
      const tower = new THREE.Group(); tower.position.set(-16, 0, -18); g.add(tower);
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) rod([x, -6, z], [x * 0.8, 6, z * 0.8], 0.15, wd2, tower);
      M(new THREE.CylinderGeometry(2.3, 2.3, 3, 14), wd, 0, 7.5, 0, tower); M(new THREE.ConeGeometry(2.6, 1.4, 14), wd2, 0, 9.7, 0, tower);
    } else if (kind === 'onyx') {
      const nm = [0xa855f7, 0x22d3ee, 0xf472b6];
      for (let k = 0; k < 6; k++) { const r = M(new THREE.TorusGeometry(20 + k * 4, 0.15, 6, 80), new THREE.MeshBasicMaterial({ color: nm[k % 3] }), 0, -4 - k * 2, 0, g); r.rotation.x = Math.PI / 2; r.userData.spin = (k % 2 ? 1 : -1) * 0.1; }
      for (let k = 0; k < 18; k++) { const a = k * 0.35 * Math.PI, rr = 22 + (k * 7) % 20; const c = M(new THREE.OctahedronGeometry(1.2 + (k % 3)), std(0x1e1b2e, { m: 0.6, r: 0.2, e: nm[k % 3] }), Math.cos(a) * rr, -2 + (k % 5) * 3, Math.sin(a) * rr, g); c.scale.y = 2; c.userData.bob = k; }
    }
    return g;
  }
  const SKY_DEF = { top: 0x3b2a7a, mid: 0xf08a6a, bot: 0x2a3d6b };
  function applyMap(mp) {
    if (curMap === mp) return; curMap = mp;
    if (decoGroup) { scene.remove(decoGroup); decoGroup = null; }
    coverIdx = new Map();
    const Mp = GD.MAPS[mp], st = Mp && Mp.style;
    const sky = scene.getObjectByName('sky');
    if (st) {
      for (let i = 0; i < Sim.N * Sim.N; i++) { const ii = (i / Sim.N) | 0, jj = i % Sim.N, h = Mp.tile(ii, jj); if (h !== null && h >= st.min) coverIdx.set(i, coverMats(st.cover, (ii * 7 + jj * 3) % 4)); }
      decoGroup = buildDeco(st.deco); scene.add(decoGroup);
      if (sky) { const c = new THREE.Color(st.sky); sky.material.uniforms.mid.value.copy(c); sky.material.uniforms.top.value.copy(c.clone().lerp(new THREE.Color(0x1e3a8a), 0.55)); sky.material.uniforms.bot.value.copy(c.clone().multiplyScalar(0.5)); }
    } else if (sky) { sky.material.uniforms.top.value.setHex(SKY_DEF.top); sky.material.uniforms.mid.value.setHex(SKY_DEF.mid); sky.material.uniforms.bot.value.setHex(SKY_DEF.bot); }
    const isl = []; scene.children.forEach((o) => { if (o.name === 'island') isl.push(o); }); isl.forEach((o) => (o.visible = !st || st.deco === 'onyx'));
    curTheme = null; // タイルの見た目を作り直す
  }
  function setTheme(g) {
    if (curTheme === g) return; curTheme = g;
    const th = themes[g] || themes.none;
    // ライバル風マップはマップ専用の床（向きが大事なベルトコンベアと氷だけはギミックの見た目）
    const st = curMap && GD.MAPS[curMap] && GD.MAPS[curMap].style;
    const floor = st && g !== 'conveyor' && g !== 'ice' ? floorMats(st.cover) : [th.side, th.side, th.top, th.side, th.side, th.side];
    tileMeshes.forEach((m, i) => { m.material = coverIdx.get(i) || floor; m.userData.base = m.material; });
    if (windPts) windPts.visible = g === 'wind';
  }
  function makeWind() {
    const n = 300, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    windPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.6 }));
    windPts.visible = false; scene.add(windPts);
  }

  // ---------- キャラクター ----------
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x15121f, side: THREE.BackSide });
  function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.55, metalness: o.m ?? 0.0, emissive: o.e ?? 0x000000, transparent: !!o.t, opacity: o.t ?? 1 }); }
  // トゥーン調（アニメ風の3段階の陰影）
  const toonGrad = (() => {
    const d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
  })();
  function toon(color, o = {}) { return new THREE.MeshToonMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), gradientMap: toonGrad, emissive: o.e ?? 0x000000, transparent: !!o.t, opacity: o.t ?? 1 }); }
  // 縁取り（裏返した少し大きいメッシュ）
  function ol(mesh, k = 1.07) { const o = new THREE.Mesh(mesh.geometry, outlineMat); o.scale.setScalar(k); o.raycast = () => {}; mesh.add(o); return mesh; }
  function M(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
  // 2点を結ぶ円柱（フレームや脚に使う）
  function rod(a, b, r, mat, parent, seg = 8) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
    m.position.copy(va).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    if (parent) parent.add(m); return m;
  }
  const texCache = {};
  function labelTex(key, w, h, draw) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; texCache[key] = t; return t;
  }
  // にもの大鎌
  function makeScythe() {
    const g = new THREE.Group();
    const wood = toon(0x2a1a14), metal = std(0x9ca3af, { m: 0.85, r: 0.25 }), red = std(0xb91c1c, { m: 0.6, r: 0.28, e: 0x3f0606 });
    ol(M(new THREE.CylinderGeometry(0.035, 0.04, 1.9, 8), wood, 0, 0, 0, g), 1.25);
    for (const y of [-0.55, -0.4, 0.15, 0.3]) { const r = M(new THREE.TorusGeometry(0.045, 0.014, 6, 12), std(0xdc2626, { r: 0.6 }), 0, y, 0, g); r.rotation.x = Math.PI / 2; }
    M(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10), metal, 0, 0.92, 0, g);
    M(new THREE.ConeGeometry(0.045, 0.16, 8), metal, 0, -1.02, 0, g).rotation.x = Math.PI;
    // 三日月形の刃
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.06); sh.quadraticCurveTo(0.7, 0.42, 1.25, -0.28); sh.quadraticCurveTo(0.78, 0.0, 0.02, -0.12); sh.lineTo(0, 0.06);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 18 }), red);
    blade.position.set(0.02, 0.86, -0.0175); g.add(blade); ol(blade, 1.04);
    // 刃の光るふち
    const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.02, 0.94, 0), new THREE.Vector3(0.79, 0.72, 0), new THREE.Vector3(1.27, 0.58, 0)), 16, 0.016, 5, false),
      new THREE.MeshBasicMaterial({ color: 0xff8a8a }));
    g.add(edge);
    // 根元の飾り
    const gem = M(new THREE.OctahedronGeometry(0.07), std(0xff1f4b, { e: 0xaa0022, r: 0.2 }), 0.02, 0.86, 0.04, g);
    g.userData.gem = gem;
    g.traverse((o) => { if (o.isMesh && o.material !== outlineMat) o.castShadow = true; });
    return g;
  }
  function buildChar(key) {
    const C = CHARS[key];
    const root = new THREE.Group();
    const inner = new THREE.Group(); root.add(inner);
    const bodyMat = toon(C.color); const subMat = toon(C.sub);
    const lightCol = new THREE.Color(C.color).lerp(new THREE.Color(0xffffff), 0.38);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.72, 10, 22), bodyMat);
    body.position.y = 0.86; body.castShadow = true; inner.add(body); ol(body, 1.055);
    // おなか
    const belly = M(new THREE.SphereGeometry(0.34, 20, 14), toon(lightCol), 0, -0.17, 0.3, body);
    belly.scale.set(1, 1.1, 0.55);
    // 目（白目・黒目・ハイライト）
    const eyeW = toon(0xffffff), iris = toon(0x1b1530), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = M(new THREE.SphereGeometry(0.115, 16, 12), eyeW, 0.16 * s, 0.37, 0.385, body); e.scale.z = 0.55;
      ol(e, 1.12);
      const pu = M(new THREE.SphereGeometry(0.075, 14, 10), iris, 0, -0.005, 0.075, e); pu.scale.z = 0.7;
      M(new THREE.SphereGeometry(0.026, 8, 6), hiM, 0.028, 0.035, 0.115, e);
      M(new THREE.SphereGeometry(0.013, 6, 5), hiM, -0.03, -0.03, 0.115, e);
      eyes.push(e);
    }
    // 眉
    const brows = [];
    for (const s of [-1, 1]) { const b = M(new THREE.BoxGeometry(0.14, 0.032, 0.03), toon(0x1b1530), 0.16 * s, 0.53, 0.415, body); b.rotation.z = 0.12 * s; b.userData.s = s; brows.push(b); }
    // ほっぺ
    const blushM = new THREE.MeshBasicMaterial({ color: 0xff6b8b, transparent: true, opacity: 0.45, depthWrite: false });
    for (const s of [-1, 1]) { const c = M(new THREE.CircleGeometry(0.065, 16), blushM, 0.3 * s, 0.24, 0.355, body); c.rotation.y = 0.62 * s; }
    // 口（ふだんはにっこり、殴られると開く）
    const mouth = M(new THREE.TorusGeometry(0.07, 0.02, 6, 14, Math.PI), toon(0x1b1530), 0, 0.2, 0.432, body); mouth.rotation.z = Math.PI;
    const mouthO = M(new THREE.SphereGeometry(0.07, 12, 10), toon(0x5b0f1e), 0, 0.17, 0.42, body); mouthO.scale.set(1, 1.15, 0.45); mouthO.visible = false; ol(mouthO, 1.15);
    M(new THREE.SphereGeometry(0.04, 8, 6), toon(0xff7b93), 0, -0.03, 0.03, mouthO).scale.set(1.2, 0.6, 0.6);
    // 腕と手
    const arms = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.5 * s, 1.0, 0); inner.add(piv);
      const a = M(new THREE.CapsuleGeometry(0.115, 0.28, 4, 10), bodyMat, 0, -0.23, 0, piv); a.castShadow = true; ol(a, 1.12);
      const f = M(new THREE.SphereGeometry(0.165, 14, 12), subMat, 0, -0.5, 0, piv); f.castShadow = true; ol(f, 1.1);
      const th = M(new THREE.SphereGeometry(0.07, 8, 6), subMat, -0.1 * s, 0.04, 0.08, f); th.scale.set(1, 1.3, 1);
      arms.push({ piv, f });
    }
    // 足と靴
    const legs = [];
    const shoeM = toon(new THREE.Color(C.sub).lerp(new THREE.Color(0x000000), 0.25)), soleM = toon(0xf5f1ea);
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.2 * s, 0.34, 0); inner.add(piv);
      const l = M(new THREE.CapsuleGeometry(0.12, 0.12, 4, 8), subMat, 0, -0.15, 0, piv); l.castShadow = true; ol(l, 1.12);
      const sh = M(new THREE.SphereGeometry(0.15, 14, 10), shoeM, 0, -0.28, 0.05, piv); sh.scale.set(1, 0.62, 1.35); sh.castShadow = true; ol(sh, 1.1);
      M(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14), soleM, 0, -0.33, 0.05, piv).scale.set(1, 1, 1.35);
      legs.push(piv);
    }
    // アクセサリー
    const acc = new THREE.Group(); body.add(acc);
    const black = toon(0x15121f);
    let scythe = null;
    switch (C.acc) {
      case 'glasses': { // kenken：黒ぶちメガネ
        const lens = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 });
        for (const s of [-1, 1]) {
          const r = M(new THREE.TorusGeometry(0.13, 0.026, 8, 20), black, 0.16 * s, 0.37, 0.455, acc); r.scale.y = 0.85;
          M(new THREE.CircleGeometry(0.12, 18), lens, 0.16 * s, 0.37, 0.452, acc).scale.y = 0.85;
          rod([0.29 * s, 0.39, 0.43], [0.43 * s, 0.4, 0.05], 0.016, black, acc);
        }
        M(new THREE.BoxGeometry(0.08, 0.025, 0.025), black, 0, 0.39, 0.47, acc);
        // パソコン用の小さなキーボード柄のバッジ
        M(new THREE.BoxGeometry(0.16, 0.08, 0.02), toon(0xfacc15), 0.2, -0.2, 0.44, acc).rotation.z = -0.2;
        break;
      }
      case 'helmet': { // ayu：自転車ヘルメット
        const hm = toon(0xfb923c), dk = toon(0x7c2d12);
        const h = M(new THREE.SphereGeometry(0.5, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 0.42, -0.02, acc); h.scale.set(1, 0.9, 1.12); ol(h, 1.04);
        for (const x of [-0.18, 0, 0.18]) { const v = M(new THREE.BoxGeometry(0.06, 0.05, 0.5), dk, x, 0.86, -0.05, acc); v.rotation.x = 0.1; }
        const vi = M(new THREE.BoxGeometry(0.62, 0.06, 0.16), std(0x0f172a, { m: 0.5, r: 0.15 }), 0, 0.6, 0.47, acc); vi.rotation.x = -0.35;
        for (const s of [-1, 1]) rod([0.42 * s, 0.45, 0.05], [0.3 * s, 0.05, 0.25], 0.018, dk, acc);
        break;
      }
      case 'headphones': { // ヒロ：ゲーミングヘッドホン
        const band = M(new THREE.TorusGeometry(0.48, 0.05, 8, 24, Math.PI), black, 0, 0.42, 0, acc); ol(band, 1.08);
        M(new THREE.TorusGeometry(0.48, 0.035, 6, 24, Math.PI * 0.5), toon(0x34d399), 0, 0.44, 0, acc).rotation.z = Math.PI * 0.25;
        for (const s of [-1, 1]) {
          const c = M(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 18), black, 0.48 * s, 0.4, 0, acc); c.rotation.z = Math.PI / 2; ol(c, 1.1);
          const led = M(new THREE.TorusGeometry(0.12, 0.022, 6, 20), new THREE.MeshBasicMaterial({ color: 0x34ffb0 }), 0.55 * s, 0.4, 0, acc); led.rotation.y = Math.PI / 2;
        }
        const mic = rod([-0.5, 0.33, 0.05], [-0.28, 0.12, 0.42], 0.018, black, acc);
        M(new THREE.SphereGeometry(0.045, 8, 6), black, -0.27, 0.11, 0.44, acc);
        break;
      }
      case 'bandana': { // コットン：バンダナ
        const bm = toon(0xdc2626);
        const b = M(new THREE.CylinderGeometry(0.47, 0.475, 0.14, 24, 1, true), bm, 0, 0.56, 0, acc); b.material.side = THREE.DoubleSide;
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; M(new THREE.CircleGeometry(0.018, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.sin(a) * 0.478, 0.56, Math.cos(a) * 0.478, acc).lookAt(Math.sin(a) * 2, 0.56, Math.cos(a) * 2); }
        const kn = M(new THREE.SphereGeometry(0.07, 10, 8), bm, 0, 0.55, -0.48, acc); ol(kn, 1.12);
        for (const s of [-1, 1]) { const t = M(new THREE.ConeGeometry(0.07, 0.32, 6), bm, 0.09 * s, 0.42, -0.53, acc); t.rotation.set(-0.5, 0, 0.5 * s); ol(t, 1.1); }
        break;
      }
      case 'cap': { // タカラソド：キャップ
        const cm = toon(0x6d28d9), dk = toon(0x4c1d95);
        const c = M(new THREE.SphereGeometry(0.485, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.15), cm, 0, 0.45, 0, acc); ol(c, 1.04);
        const br = M(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 22, 1, false, -Math.PI / 2, Math.PI), dk, 0, 0.5, 0.36, acc); br.scale.z = 1.25; br.rotation.x = 0.12; ol(br, 1.06);
        M(new THREE.SphereGeometry(0.05, 8, 6), dk, 0, 0.93, 0, acc);
        M(new THREE.CircleGeometry(0.1, 16), toon(0xfde047), 0, 0.72, 0.36, acc).rotation.x = -0.6;
        break;
      }
      case 'hardhat': { // ゆるる：工事用ヘルメット
        const hm = toon(0xfacc15);
        const c = M(new THREE.SphereGeometry(0.49, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 0.45, 0, acc); ol(c, 1.04);
        const br = M(new THREE.CylinderGeometry(0.6, 0.62, 0.04, 26), hm, 0, 0.46, 0.03, acc); ol(br, 1.03);
        M(new THREE.BoxGeometry(0.1, 0.09, 0.92), toon(0xeab308), 0, 0.88, 0, acc);
        const lamp = M(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 14), black, 0, 0.72, 0.4, acc); lamp.rotation.x = Math.PI / 2 - 0.5;
        M(new THREE.CircleGeometry(0.065, 14), new THREE.MeshBasicMaterial({ color: 0xfff7c2 }), 0, 0.745, 0.44, acc).rotation.x = -0.5;
        M(new THREE.BoxGeometry(0.5, 0.05, 0.02), toon(0xf97316), 0, 0.62, 0.46, acc).rotation.x = -0.45;
        break;
      }
      case 'hood': { // にも：フード＋大鎌
        const hdM = toon(0x1f2937);
        const hd = M(new THREE.SphereGeometry(0.53, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hdM, 0, 0.3, -0.05, acc); hd.material.side = THREE.DoubleSide; ol(hd, 1.04);
        const rim = M(new THREE.TorusGeometry(0.43, 0.04, 6, 24), toon(0xdc2626), 0, 0.42, 0.22, acc); rim.rotation.x = -0.25; rim.scale.y = 1.12;
        const tip = M(new THREE.ConeGeometry(0.16, 0.36, 10), hdM, 0, 0.62, -0.5, acc); tip.rotation.x = -2.0; ol(tip, 1.08);
        for (const s of [-1, 1]) { rod([0.13 * s, 0.05, 0.43], [0.16 * s, -0.25, 0.4], 0.016, toon(0xe5e7eb), acc); }
        scythe = makeScythe(); scythe.position.set(0.05, -0.05, -0.55); scythe.rotation.set(0, Math.PI / 2, 0.55); acc.add(scythe);
        scythe.userData.rest = { p: scythe.position.clone(), r: scythe.rotation.clone(), parent: acc };
        break;
      }
      case 'ribbon': { // うぃきっと：大きなリボン
        const rm = toon(0xec4899), dk = toon(0xbe185d);
        for (const s of [-1, 1]) {
          const lp = M(new THREE.TorusGeometry(0.14, 0.06, 8, 18), rm, 0.2 * s, 0.78, -0.05, acc); lp.scale.set(1.25, 0.85, 0.6); lp.rotation.z = 0.25 * s; ol(lp, 1.08);
          const tl = M(new THREE.BoxGeometry(0.09, 0.3, 0.03), rm, 0.1 * s, 0.6, -0.1, acc); tl.rotation.z = 0.5 * s; ol(tl, 1.1);
        }
        const k = M(new THREE.SphereGeometry(0.08, 10, 8), dk, 0, 0.78, -0.03, acc); ol(k, 1.12);
        // マイク型のヘアピン（声がかわいい）
        M(new THREE.SphereGeometry(0.05, 8, 6), toon(0xfde68a), -0.34, 0.55, 0.25, acc);
        break;
      }
    }
    // 頭の上の飾り（気絶の星など）
    const stars = new THREE.Group(); stars.position.y = 2.0; root.add(stars);
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), std(0xfde047, { e: 0xfde047 })); stars.add(st); }
    stars.visible = false;
    // MT（メカ）
    const mt = new THREE.Group(); root.add(mt); mt.visible = false;
    {
      const g = std(0x7b8798, { m: 0.65, r: 0.32 }), dk = std(0x334155, { m: 0.6, r: 0.4 }), ac = std(0xf472b6, { m: 0.3, r: 0.4 }), glow = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
      for (const s of [-1, 1]) {
        M(new THREE.BoxGeometry(0.34, 0.5, 0.36), g, 0.45 * s, 0.65, 0, mt);
        M(new THREE.SphereGeometry(0.17, 12, 8), dk, 0.45 * s, 0.4, 0.05, mt);
        M(new THREE.BoxGeometry(0.42, 0.18, 0.6), dk, 0.45 * s, 0.1, 0.08, mt);
        const sh = M(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), ac, 0.95 * s, 1.62, 0.05, mt); sh.scale.set(1, 0.7, 1.1);
        M(new THREE.BoxGeometry(0.38, 0.95, 0.38), g, 0.95 * s, 1.12, 0.1, mt);
        const gun = M(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 12), dk, 0.95 * s, 0.75, 0.38, mt); gun.rotation.x = Math.PI / 2;
        M(new THREE.CircleGeometry(0.06, 10), glow, 0.95 * s, 0.75, 0.69, mt);
      }
      const torso = M(new THREE.CylinderGeometry(0.72, 0.6, 0.95, 8), g, 0, 1.32, 0, mt); torso.rotation.y = Math.PI / 8;
      const cock = M(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.4 }), 0, 1.78, 0.05, mt);
      M(new THREE.BoxGeometry(0.9, 0.12, 0.05), glow, 0, 1.42, 0.62, mt);
      M(new THREE.BoxGeometry(1.0, 0.18, 0.06), ac, 0, 1.0, 0.6, mt);
      rod([0.3, 1.8, -0.4], [0.45, 2.5, -0.5], 0.025, dk, mt); M(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6d }), 0.45, 2.5, -0.5, mt);
      mt.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    // 自転車（ayu）
    const bike = new THREE.Group(); root.add(bike); bike.visible = false;
    {
      const fr = std(0xf97316, { m: 0.45, r: 0.3 }), tire = toon(0x15121f), mtl = std(0xd1d5db, { m: 0.9, r: 0.2 });
      for (const z of [-0.62, 0.66]) {
        const w = new THREE.Group(); w.position.set(0, 0.34, z); bike.add(w);
        const t = M(new THREE.TorusGeometry(0.31, 0.05, 8, 26), tire, 0, 0, 0, w); t.rotation.y = Math.PI / 2;
        const rim = M(new THREE.TorusGeometry(0.27, 0.018, 6, 24), mtl, 0, 0, 0, w); rim.rotation.y = Math.PI / 2;
        for (let i = 0; i < 6; i++) { const sp = M(new THREE.BoxGeometry(0.01, 0.54, 0.012), mtl, 0, 0, 0, w); sp.rotation.x = (i / 6) * Math.PI; }
        const hub = M(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), mtl, 0, 0, 0, w); hub.rotation.z = Math.PI / 2;
        w.userData.wheel = true;
      }
      const P = { rear: [0, 0.34, -0.62], front: [0, 0.34, 0.66], crank: [0, 0.32, -0.02], seat: [0, 0.82, -0.25], head: [0, 0.9, 0.5] };
      rod(P.rear, P.crank, 0.03, fr, bike); rod(P.rear, P.seat, 0.03, fr, bike); rod(P.crank, P.seat, 0.035, fr, bike);
      rod(P.seat, P.head, 0.035, fr, bike); rod(P.crank, P.head, 0.04, fr, bike); rod(P.head, P.front, 0.03, mtl, bike);
      const sd = M(new THREE.BoxGeometry(0.16, 0.06, 0.3), toon(0x15121f), 0, 0.88, -0.27, bike); ol(sd, 1.1);
      rod([0, 0.9, 0.5], [0, 1.08, 0.48], 0.025, mtl, bike);
      rod([-0.3, 1.08, 0.45], [0.3, 1.08, 0.45], 0.022, mtl, bike);
      for (const s of [-1, 1]) M(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), toon(0x15121f), 0.3 * s, 1.08, 0.45, bike).rotation.z = Math.PI / 2;
      M(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14), mtl, 0.06, 0.32, -0.02, bike).rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) M(new THREE.BoxGeometry(0.12, 0.03, 0.08), toon(0x15121f), 0.14 * s, 0.32 + 0.12 * s, -0.02 + 0.06 * s, bike);
      M(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: 0xfff7c2 }), 0, 0.98, 0.56, bike);
      bike.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    // ゲーミングチェア（乗り物）
    const chair = new THREE.Group(); root.add(chair); chair.visible = false;
    buildChairModel(chair, 1);
    // キャシー塚本（身代わり）
    const cathy = new THREE.Group(); root.add(cathy); cathy.visible = false;
    { const b = M(new THREE.CapsuleGeometry(0.28, 0.4, 6, 14), toon(0xfda4af, { e: 0x4c0519 }), 0, 0.5, 0, cathy); ol(b, 1.07);
      for (const s of [-1, 1]) { M(new THREE.SphereGeometry(0.06, 8, 6), toon(0x15121f), 0.1 * s, 0.68, 0.25, cathy); M(new THREE.CircleGeometry(0.04, 10), new THREE.MeshBasicMaterial({ color: 0xff6b8b, transparent: true, opacity: 0.6 }), 0.17 * s, 0.6, 0.27, cathy); }
      cathy.position.set(-1.0, 0, -0.6); }
    // ムキムキのG
    const gbug = new THREE.Group(); root.add(gbug); gbug.visible = false;
    { const b = M(new THREE.SphereGeometry(0.6, 14, 10), std(0x5b3417, { r: 0.2, m: 0.3 }), 0, 0, 0, gbug); b.scale.set(1, 0.5, 1.5);
      for (let i = 0; i < 6; i++) { const l = M(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), std(0x3b2010), (i % 2 ? 1 : -1) * 0.6, -0.2, (Math.floor(i / 2) - 1) * 0.5, gbug); l.rotation.z = (i % 2 ? 1 : -1) * 0.9; }
      for (const s of [-1, 1]) rod([0.15 * s, 0.1, 0.8], [0.5 * s, 0.4, 1.6], 0.02, std(0x3b2010), gbug);
      gbug.position.y = 2.2; }
    // 持ちアイテム
    const hold = new THREE.Group(); arms[1].f.add(hold);
    // チャージ光
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    arms[1].f.add(glow);
    // 名札
    const tag = makeTag();
    tag.position.y = 2.45; root.add(tag);
    if (OPT.tagScale) { tag.scale.multiplyScalar(OPT.tagScale); tag.position.y = 2.6; }
    scene.add(root);
    let hsh = 0; for (const c of key) hsh = (hsh * 31 + c.charCodeAt(0)) % 997;
    return { root, inner, body, bodyMat, arms, legs, eyes, brows, mouth, mouthO, scythe, stars, mt, bike, chair, cathy, gbug, hold, holdType: null, glow, tag, tagStr: '', squash: 1, lastGr: 1, walk: 0, alpha: 1, ko: 0, key, blinkOff: hsh / 997 * 4 };
  }
  // ゲーミングチェア（乗り物と持ちアイテムで共用）
  function buildChairModel(g, k) {
    const red = toon(0xef4444), blk = toon(0x1c1a24), wht = toon(0xf5f5f4), mtl = std(0x9ca3af, { m: 0.85, r: 0.25 });
    const seat = M(new THREE.BoxGeometry(0.82, 0.14, 0.8), blk, 0, 0.47, 0, g); ol(seat, 1.04);
    for (const s of [-1, 1]) { const w = M(new THREE.BoxGeometry(0.1, 0.16, 0.78), red, 0.38 * s, 0.54, 0, g); ol(w, 1.06); }
    const back = M(new THREE.BoxGeometry(0.72, 1.15, 0.14), blk, 0, 1.08, -0.4, g); back.rotation.x = -0.12; ol(back, 1.03);
    for (const s of [-1, 1]) { const w = M(new THREE.BoxGeometry(0.14, 1.1, 0.18), red, 0.36 * s, 1.08, -0.37, g); w.rotation.set(-0.12, 0.3 * s, 0); ol(w, 1.05); }
    M(new THREE.BoxGeometry(0.1, 1.0, 0.02), wht, 0, 1.08, -0.32, g).rotation.x = -0.12;
    const pil = M(new THREE.BoxGeometry(0.42, 0.18, 0.12), red, 0, 1.52, -0.38, g); pil.rotation.x = -0.12;
    for (const s of [-1, 1]) { M(new THREE.BoxGeometry(0.08, 0.04, 0.4), blk, 0.47 * s, 0.75, 0.02, g); rod([0.47 * s, 0.5, 0.02], [0.47 * s, 0.74, 0.02], 0.025, blk, g); }
    M(new THREE.CylinderGeometry(0.05, 0.06, 0.34, 10), mtl, 0, 0.24, 0, g);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; rod([0, 0.08, 0], [Math.sin(a) * 0.38, 0.05, Math.cos(a) * 0.38], 0.03, blk, g); M(new THREE.SphereGeometry(0.05, 8, 6), blk, Math.sin(a) * 0.38, 0.04, Math.cos(a) * 0.38, g); }
    g.scale.setScalar(k);
    g.traverse((o) => { if (o.isMesh && o.material !== outlineMat) o.castShadow = true; });
    return g;
  }
  function makeTag() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(2.4, 0.75, 1); s.renderOrder = 10; s.userData.c = c; s.userData.t = t;
    return s;
  }
  function drawTag(ch, p) {
    const nameCol = p.id === myId ? '#fde047' : p.mi ? '#c084fc' : (p.tm >= 0 && GD.TEAMS[p.tm]) ? GD.TEAMS[p.tm].css : '#ffffff';
    const sts = p.st.map((s) => STATUS[s[0]] ? STATUS[s[0]].name : '').filter(Boolean);
    const str = p.n + '|' + p.h + '|' + sts.join(',') + '|' + p.mi + '|' + (p.id === myId) + '|' + p.tm;
    if (str === ch.tagStr) return; ch.tagStr = str;
    const c = ch.tag.userData.c, g = c.getContext('2d');
    g.clearRect(0, 0, 512, 160);
    g.font = 'bold 38px "Noto Sans JP", "Yu Gothic", sans-serif'; g.textAlign = 'center';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)';
    const label = (p.mi ? '[手下] ' : '') + (p.tm >= 0 && GD.TEAMS[p.tm] ? '[' + GD.TEAMS[p.tm].name + '] ' : '') + p.n;
    g.strokeText(label, 256, 46); g.fillStyle = nameCol; g.fillText(label, 256, 46);
    const hc = p.h < 50 ? '#ffffff' : p.h < 100 ? '#fde047' : p.h < 150 ? '#fb923c' : '#ef4444';
    g.font = 'bold 44px "Noto Sans JP", sans-serif';
    g.strokeText(p.h + '%', 256, 96); g.fillStyle = hc; g.fillText(p.h + '%', 256, 96);
    if (sts.length) { g.font = 'bold 28px "Noto Sans JP", sans-serif'; const s = sts.slice(0, 3).join('・'); g.strokeText(s, 256, 140); g.fillStyle = '#f0abfc'; g.fillText(s, 256, 140); }
    ch.tag.userData.t.needsUpdate = true;
  }

  // ---------- 持ち物メッシュ ----------
  // 向き：銃口が +z、上が +y、握る場所が原点の近く
  function itemMesh(type) {
    const g = new THREE.Group();
    const I = ITEMS[type];
    const gun = std(0x2b2f38, { m: 0.7, r: 0.35 }), gun2 = std(0x3f4552, { m: 0.6, r: 0.4 }), steel = std(0xb6bcc6, { m: 0.9, r: 0.22 });
    const wood = std(0x8a4b22, { r: 0.6 }), wood2 = std(0x6b3a1a, { r: 0.65 });
    const B = (w, h, d, m, x, y, z) => M(new THREE.BoxGeometry(w, h, d), m, x, y, z, g);
    const Cz = (r1, r2, L, m, x, y, z, seg = 12) => { const c = M(new THREE.CylinderGeometry(r1, r2, L, seg), m, x, y, z, g); c.rotation.x = Math.PI / 2; return c; };
    const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
    if (type === 'ar') {
      const tan = std(0xc8a46a, { r: 0.6 });
      B(0.12, 0.15, 0.46, gun, 0, 0.07, 0.1); ol(g.children[0], 1.05);
      B(0.1, 0.12, 0.32, tan, 0, 0.07, 0.47);
      for (let i = 0; i < 4; i++) B(0.104, 0.03, 0.04, gun2, 0, 0.1, 0.36 + i * 0.07);
      Cz(0.024, 0.024, 0.36, gun2, 0, 0.08, 0.76); Cz(0.04, 0.035, 0.08, steel, 0, 0.08, 0.96);
      B(0.03, 0.02, 0.6, gun2, 0, 0.155, 0.3); // レール
      const mag = B(0.07, 0.24, 0.11, tan, 0, -0.1, 0.2); mag.rotation.x = 0.3; ol(mag, 1.06);
      const gr = B(0.065, 0.17, 0.08, gun, 0, -0.07, -0.02); gr.rotation.x = -0.35;
      B(0.07, 0.13, 0.3, tan, 0, 0.04, -0.3); B(0.08, 0.16, 0.05, gun, 0, 0.02, -0.46);
      B(0.06, 0.07, 0.12, gun, 0, 0.2, 0.1); M(new THREE.CircleGeometry(0.022, 10), glowM(0xff3355), 0, 0.2, 0.161, g);
    } else if (type === 'sr') {
      const cam = std(0x4d5b3a, { r: 0.55 });
      B(0.1, 0.13, 0.5, gun, 0, 0.06, 0.12); ol(g.children[0], 1.05);
      Cz(0.022, 0.026, 0.9, gun2, 0, 0.07, 0.8); Cz(0.04, 0.04, 0.12, steel, 0, 0.07, 1.27);
      B(0.09, 0.11, 0.42, cam, 0, 0.05, 0.5);
      const sc = Cz(0.05, 0.05, 0.42, gun, 0, 0.2, 0.15, 14); ol(sc, 1.08);
      Cz(0.065, 0.055, 0.08, gun, 0, 0.2, 0.38, 14); Cz(0.06, 0.05, 0.07, gun, 0, 0.2, -0.08, 14);
      M(new THREE.CircleGeometry(0.05, 14), glowM(0x5eead4), 0, 0.2, 0.421, g); M(new THREE.CircleGeometry(0.045, 14), glowM(0x2dd4bf), 0, 0.2, -0.116, g).rotation.y = Math.PI;
      for (const z of [0.07, 0.24]) B(0.03, 0.08, 0.03, gun2, 0, 0.14, z);
      const bolt = M(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), steel, 0.08, 0.08, 0.02, g); bolt.rotation.z = Math.PI / 2; M(new THREE.SphereGeometry(0.028, 8, 6), steel, 0.14, 0.08, 0.02, g);
      const st = B(0.08, 0.16, 0.42, cam, 0, 0.02, -0.33); ol(st, 1.05); B(0.07, 0.06, 0.2, cam, 0, 0.12, -0.3);
      const gr = B(0.06, 0.15, 0.07, gun, 0, -0.07, -0.05); gr.rotation.x = -0.4;
      for (const s of [-1, 1]) { const bp = M(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6), gun2, 0.03 * s, 0.02, 0.88, g); bp.rotation.set(Math.PI / 2 - 0.08, 0, 0.05 * s); }
    } else if (type === 'sg') {
      B(0.13, 0.15, 0.32, gun, 0, 0.06, 0.08); ol(g.children[0], 1.05);
      Cz(0.036, 0.036, 0.62, gun2, 0, 0.09, 0.55); Cz(0.028, 0.028, 0.5, gun2, 0, 0.02, 0.48);
      Cz(0.045, 0.04, 0.05, steel, 0, 0.09, 0.87);
      const pump = B(0.1, 0.09, 0.24, wood, 0, 0.02, 0.42); ol(pump, 1.06);
      for (let i = 0; i < 4; i++) B(0.104, 0.093, 0.012, wood2, 0, 0.02, 0.33 + i * 0.06);
      const gr = B(0.07, 0.15, 0.08, wood, 0, -0.06, -0.08); gr.rotation.x = -0.45;
      const st = B(0.09, 0.15, 0.36, wood, 0, 0.0, -0.32); st.rotation.x = 0.12; ol(st, 1.05);
      B(0.095, 0.17, 0.04, std(0x1c1a24), 0, -0.02, -0.5);
      for (let i = 0; i < 3; i++) Cz(0.016, 0.016, 0.05, std(0xdc2626), 0.07, 0.04, 0.0 + i * 0.05, 8);
    } else if (type === 'monitor') {
      const bez = B(0.82, 0.5, 0.05, std(0x111318, { r: 0.4, m: 0.3 }), 0, 0, 0); ol(bez, 1.04);
      const tex = labelTex('monitor', 256, 160, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1e1b4b'); gr.addColorStop(1, '#0e7490'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#22d3ee'; c.lineWidth = 4; c.beginPath(); for (let x = 0; x <= w; x += 16) c.lineTo(x, 110 - Math.sin(x * 0.05) * 30 - x * 0.15); c.stroke();
        c.fillStyle = '#fde047'; c.font = 'bold 28px sans-serif'; c.fillText('FPS 240', 14, 34);
        c.fillStyle = '#f472b6'; c.fillRect(14, 132, 140, 12); c.fillStyle = '#4ade80'; c.fillRect(14, 132, 92, 12);
      });
      M(new THREE.PlaneGeometry(0.75, 0.43), new THREE.MeshBasicMaterial({ map: tex }), 0, 0.01, 0.027, g);
      B(0.42, 0.3, 0.1, std(0x1c1f26, { r: 0.5 }), 0, 0, -0.07);
      B(0.7, 0.02, 0.02, glowM(0xf472b6), 0, -0.24, -0.03);
      B(0.07, 0.26, 0.05, steel, 0, -0.34, -0.1); const base = B(0.36, 0.03, 0.22, std(0x1c1f26), 0, -0.47, -0.06); ol(base, 1.06);
    } else if (type === 'lan') {
      const curve = new (class extends THREE.Curve { getPoint(t) { const a = t * Math.PI * 2 * 3.2; return new THREE.Vector3(Math.cos(a) * 0.16, Math.sin(a) * 0.16, (t - 0.5) * 0.36); } })();
      const tube = M(new THREE.TubeGeometry(curve, 120, 0.026, 6, false), std(0x3b82f6, { r: 0.45 }), 0, 0, 0, g); ol(tube, 1.06);
      for (const s of [-1, 1]) {
        const end = new THREE.Group(); end.position.copy(curve.getPoint(s < 0 ? 0 : 1)); end.position.z += 0.06 * s; g.add(end);
        M(new THREE.BoxGeometry(0.07, 0.05, 0.11), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 0, 0, end);
        M(new THREE.BoxGeometry(0.05, 0.012, 0.06), std(0xfbbf24, { m: 0.9, r: 0.2 }), 0, 0.015, 0.02 * s, end);
        M(new THREE.BoxGeometry(0.03, 0.02, 0.05), std(0x3b82f6), 0, 0.035, -0.01 * s, end);
      }
    } else if (type === 'chair') {
      const c = new THREE.Group(); buildChairModel(c, 0.42); c.position.set(0, -0.35, -0.05); g.add(c);
    } else if (type === 'energy') {
      const tex = labelTex('energy', 256, 128, (c, w, h) => {
        c.fillStyle = '#111827'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#a3e635'; c.beginPath(); c.moveTo(70, 8); c.lineTo(40, 70); c.lineTo(66, 70); c.lineTo(48, 122); c.lineTo(100, 50); c.lineTo(72, 50); c.lineTo(92, 8); c.fill();
        c.fillStyle = '#a3e635'; c.font = 'bold 30px sans-serif'; c.fillText('ENERGY', 112, 62); c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.fillText('MAX POWER', 116, 92);
        c.fillStyle = '#a3e635'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
      });
      tex.wrapS = THREE.RepeatWrapping;
      const can = M(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.5 }), 0, 0, 0, g); ol(can, 1.05);
      M(new THREE.CylinderGeometry(0.085, 0.1, 0.03, 24), steel, 0, 0.165, 0, g); M(new THREE.CylinderGeometry(0.1, 0.085, 0.03, 24), steel, 0, -0.165, 0, g);
      M(new THREE.BoxGeometry(0.04, 0.008, 0.06), steel, 0, 0.183, 0.02, g);
    } else if (type === 'goreisan') {
      const tex = labelTex('goreisan', 256, 170, (c, w, h) => {
        c.fillStyle = '#fefce8'; c.fillRect(0, 0, w, h); c.fillStyle = '#15803d'; c.fillRect(0, 0, w, 44); c.fillRect(0, h - 22, w, 22);
        c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.fillText('漢方薬', 12, 32);
        c.fillStyle = '#14532d'; c.font = 'bold 64px serif'; c.fillText('五苓散', 30, 124);
        c.strokeStyle = '#dc2626'; c.lineWidth = 5; c.strokeRect(196, 52, 46, 46); c.fillStyle = '#dc2626'; c.font = 'bold 24px sans-serif'; c.fillText('第2類', 194, 84);
      });
      const box = M(new THREE.BoxGeometry(0.32, 0.22, 0.1), [toon(0x15803d), toon(0x15803d), toon(0xfefce8), toon(0xfefce8), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })], 0, 0, 0, g); ol(box, 1.05);
      const sa = M(new THREE.BoxGeometry(0.12, 0.16, 0.01), std(0xe5e7eb, { m: 0.6, r: 0.3 }), 0.06, 0.13, 0.02, g); sa.rotation.z = -0.25;
    } else if (type === 'detox') {
      const tex = labelTex('detox', 128, 240, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bbf7d0'); gr.addColorStop(1, '#22c55e'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = '#15803d'; c.beginPath(); c.ellipse(64, 100, 28, 46, 0.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#bbf7d0'; c.lineWidth = 4; c.beginPath(); c.moveTo(44, 138); c.lineTo(82, 64); c.stroke();
        c.fillStyle = '#14532d'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('OFF', 64, 196);
      });
      const ph = B(0.21, 0.4, 0.03, std(0x1c1a24, { r: 0.3, m: 0.4 }), 0, 0, 0); ol(ph, 1.05);
      M(new THREE.PlaneGeometry(0.19, 0.36), new THREE.MeshBasicMaterial({ map: tex }), 0, 0, 0.0155, g);
      const leaf = M(new THREE.SphereGeometry(0.08, 10, 8), toon(0x4ade80), 0.11, 0.2, 0.03, g); leaf.scale.set(0.5, 1, 0.2); leaf.rotation.z = -0.6;
    } else if (type === 'sst' || type === 'sst2') {
      const col = type === 'sst2' ? 0xff3b6b : 0x22d3ee;
      const glass = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, emissive: col, emissiveIntensity: 0.25 });
      const core = M(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), glowM(col), 0, 0, 0, g); core.rotation.x = Math.PI / 2;
      Cz(0.08, 0.08, 0.34, glass, 0, 0, 0, 16);
      for (const z of [-0.2, 0.2]) { Cz(0.09, 0.09, 0.06, steel, 0, 0, z, 16); }
      for (const z of [-0.08, 0.08]) { const r = M(new THREE.TorusGeometry(0.085, 0.012, 6, 18), std(0x1c1a24), 0, 0, z, g); }
      Cz(0.03, 0.01, 0.1, steel, 0, 0, 0.28, 8);
      if (type === 'sst2') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const sp = M(new THREE.ConeGeometry(0.025, 0.09, 6), std(0x1c1a24, { m: 0.6 }), Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, g); sp.rotation.z = a - Math.PI / 2; }
    } else { const u = B(0.16, 0.06, 0.36, std(I.color, { e: I.color, m: 0.2 }), 0, 0, 0); ol(u, 1.08); }
    g.traverse((o) => { if (o.isMesh && o.material !== outlineMat) o.castShadow = true; });
    return g;
  }
  function groundItem(type) {
    const g = new THREE.Group();
    const m = itemMesh(type); m.scale.setScalar(1.3); g.add(m); g.userData.m = m;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: ITEMS[type].cookie ? 0x22d3ee : 0xfde047, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.25; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), new THREE.MeshBasicMaterial({ color: ITEMS[type].cookie ? 0x22d3ee : 0xfff3b0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 1.2; g.add(beam);
    scene.add(g);
    return g;
  }

  // ---------- Mars ----------
  function buildMars(isTrue) {
    const g = new THREE.Group();
    const planet = canvasTex(512, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, isTrue ? '#7f1d1d' : '#c2410c'); gr.addColorStop(0.5, isTrue ? '#450a0a' : '#ea580c'); gr.addColorStop(1, isTrue ? '#7f1d1d' : '#9a3412'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 22; c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,200,150,.15)'; c.beginPath(); c.arc(x - 2, y - 2, r * 0.8, 0, 7); c.fill(); }
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.3, 40, 28), new THREE.MeshStandardMaterial({ map: planet, roughness: 0.9, emissive: isTrue ? 0x330000 : 0x000000 }));
    head.position.y = 6.2; head.castShadow = true; g.add(head);
    const eyeW = std(0xffffff, { e: isTrue ? 0xff0000 : 0x222222 }), eyeB = std(0x000000);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), eyeW); e.position.set(0.75 * s, 0.35, 1.95); e.scale.z = 0.5; head.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), eyeB); p.position.z = 0.3; e.add(p);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.2), eyeB); br.position.set(0.75 * s, 0.95, 2.0); br.rotation.z = -0.45 * s; head.add(br);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.2), eyeB); mouth.position.set(0, -0.75, 2.05); head.add(mouth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 48), std(isTrue ? 0xa855f7 : 0xfbbf24, { e: isTrue ? 0x581c87 : 0x92400e })); ring.rotation.x = 1.3; ring.position.y = 6.2; g.add(ring);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 4.2, 20), std(isTrue ? 0x1f0a0a : 0x7f1d1d, { r: 0.8 })); robe.position.y = 2.1; robe.castShadow = true; g.add(robe);
    const arms = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(1.6 * s, 3.8, 0); g.add(piv);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 2.0, 6, 12), std(isTrue ? 0x2a0f0f : 0x991b1b)); a.position.y = -1.3; a.castShadow = true; piv.add(a);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), std(0xfdba74)); f.position.y = -2.6; piv.add(f);
      arms.push(piv);
      if (isTrue) {
        const w = s < 0 ? itemMesh('sg') : new THREE.Group();
        if (s > 0) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2.2), std(0xd4d4d8, { m: 0.9, r: 0.2 })); bl.position.z = 1.0; w.add(bl); const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.8), std(0xf59e0b)); w.add(body); }
        w.scale.setScalar(2.4); w.position.y = -2.6; piv.add(w);
      }
    }
    const aura = new THREE.PointLight(isTrue ? 0xa855f7 : 0xff5522, 3, 18); aura.position.y = 5; g.add(aura);
    scene.add(g);
    return { g, head, arms, true: isTrue };
  }

  // ---------- エフェクト ----------
  const flashTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,240,180,.8)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  // 演出が終わったらGPUのメモリを解放する（長い試合でも重くならないように）
  function disposeFx(o) {
    o.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      const m = c.material; if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map && mm.map !== flashTex && mm.map !== circleTex) mm.map.dispose(); mm.dispose(); });
    });
  }
  function addFx(o, life, upd) { fxList.push({ o, life, max: life, upd }); scene.add(o); }
  function spark(x, y, z, p, col) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: col || 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x, y, z); const sz = 1 + p * 1.5;
    addFx(s, 0.25, (f, k) => { s.scale.setScalar(sz * (0.5 + (1 - k) * 1.5)); s.material.opacity = k; });
    const n = 6 + ((p * 8) | 0);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.08), new THREE.MeshBasicMaterial({ color: col || (Math.random() < 0.5 ? 0xfff1a8 : 0xffffff) }));
      m.position.set(x, y, z);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 6 * (0.5 + p));
      addFx(m, 0.4 + Math.random() * 0.3, (f, k, dt) => { m.position.addScaledVector(v, dt); v.y -= 15 * dt; m.rotation.x += dt * 10; m.scale.setScalar(k); });
    }
  }
  // ---------- スキル・掴みの演出 ----------
  const addB = (c, o = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const circleTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.translate(128, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 96, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, b = a + Math.PI * 2 / 3; g.beginPath(); g.moveTo(Math.cos(a) * 96, Math.sin(a) * 96); g.lineTo(Math.cos(b) * 96, Math.sin(b) * 96); g.stroke(); }
    g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center';
    const T = '友情ブレイカーズ★スキル発動★'; for (let i = 0; i < T.length; i++) { const a = (i / T.length) * Math.PI * 2; g.save(); g.rotate(a); g.fillText(T[i], 0, -102); g.restore(); }
    const t = new THREE.CanvasTexture(c); return t;
  })();
  // ---------- スキルごとのモーション ----------
  // t: 0→1 の進み具合。返り値で腕の角度などを上書きする（x:前後 -1.6=前 -3=真上、z:横への開き）
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
  function castPose(sid, t, now) {
    const P = { la: 0, ra: 0, lz: 0.15, rz: -0.15, twist: 0, lean: 0, hop: 0, sq: 1, shake: 0, lr: 1, rr: 1 };
    const w = Math.sin(now * 30), w2 = Math.sin(now * 14);
    switch (sid) {
      case 'modifier': case 'edit': // キーボードを高速で打つ
        P.la = -1.05 + w * 0.25; P.ra = -1.05 - w * 0.25; P.lz = 0.35; P.rz = -0.35; P.lean = 0.25; P.hop = sid === 'edit' && t > 0.8 ? pulse(t, 0.8, 1) * 0.5 : 0; break;
      case 'surume': // スルメをかじる
        P.ra = -2.3 + Math.abs(w2) * 0.3; P.rz = 0.75; P.la = -0.3; P.sq = 1 - Math.abs(w2) * 0.06; P.lean = 0.1; break;
      case 'kirinuki': // スマホで動画を見る
        P.la = P.ra = -1.25; P.lz = 0.45; P.rz = -0.45; P.lean = 0.3; P.twist = Math.sin(now * 3) * 0.15; break;
      case 'kichige': { // ためて…爆発
        const charge = t < 0.45;
        if (charge) { P.la = P.ra = 0.6; P.lz = 0.2; P.rz = -0.2; P.sq = 0.75; P.shake = 0.06; }
        else { const k = ease((t - 0.45) / 0.2); P.la = P.ra = -3.0 * k; P.lz = -1.0 * k; P.rz = 1.0 * k; P.sq = 1 + 0.25 * pulse(t, 0.45, 0.8); P.hop = 0.6 * pulse(t, 0.45, 0.85); P.shake = 0.03; P.lean = -0.25; }
        break;
      }
      case 'subaka': // 横を指して呼び出す
        P.la = -1.4; P.lz = -1.0; P.ra = -0.5 + pulse(t, 0.1, 0.4) * -1.2; P.twist = 0.5; break;
      case 'soundboard': // 片手でヘッドホン、片手でスクラッチ
        P.la = -2.7; P.lz = 0.9; P.ra = -1.3; P.rz = -0.2 + Math.sin(now * 18) * 0.5; P.twist = Math.sin(now * 18) * 0.15; P.hop = Math.abs(Math.sin(now * 9)) * 0.12; break;
      case 'role': // 相手をビシッと指さす
        P.ra = -1.62; P.rr = 1 + 0.35 * ease(t / 0.3); P.la = -0.2; P.lz = 0.9; P.twist = -0.45; P.lean = 0.1; break;
      case 'chudoku': // おいでおいで
        P.la = -1.4 + Math.sin(now * 12) * 0.45; P.ra = -1.4 + Math.sin(now * 12 + 0.6) * 0.45; P.lz = -0.1; P.rz = 0.1; P.lean = -0.1; break;
      case 'rasher': // ヘドバン
        P.la = P.ra = -2.9; P.lz = -0.3; P.rz = 0.3; P.lean = Math.sin(now * 16) * 0.45; P.hop = Math.abs(Math.sin(now * 8)) * 0.15; break;
      case 'rhythmrev': // くるっと回って踊る
        P.la = -1.6; P.ra = -1.6; P.lz = -1.4; P.rz = 1.4; P.twist = t * Math.PI * 2 * 2; P.hop = Math.abs(Math.sin(t * Math.PI * 4)) * 0.3; break;
      case 'goreisan': // 薬を飲む
        P.ra = -2.5; P.rz = 0.7; P.la = -0.2; P.lean = -0.35 * ease(t / 0.4); break;
      case 'mousou': // 手を組んでうっとり
        P.la = -1.3; P.ra = -1.3; P.lz = 0.75; P.rz = -0.75; P.twist = Math.sin(now * 3) * 0.3; P.hop = 0.35 * ease(t / 0.4) + Math.sin(now * 4) * 0.06; P.lean = -0.15; break;
      case 'rinri': // 頭を抱えて発狂
        P.la = P.ra = -2.7; P.lz = 0.85; P.rz = -0.85; P.shake = t > 0.35 ? 0.09 : 0.02; P.twist = t > 0.35 ? Math.sin(now * 25) * 0.3 : 0; P.sq = 1 + Math.sin(now * 20) * 0.05; break;
      case 'mic': // マイクを口元に→前へ突き出す
        if (t < 0.4) { P.ra = -2.25; P.rz = 0.55; } else { P.ra = -1.6; P.rr = 1.35; P.lean = 0.25; }
        P.la = -0.4; P.lz = 0.4; break;
      case 'sniper': case 'snipe': // ひざをついて構える→反動
        P.la = -1.6; P.ra = -1.55; P.lz = -0.35; P.rz = 0.1; P.sq = 0.78; P.lean = 0.15;
        if (t > 0.55) { const r = pulse(t, 0.55, 0.85); P.lean = 0.15 - r * 0.5; P.la -= r * 0.5; P.ra -= r * 0.5; }
        break;
      case 'fish': { // 竿を振りかぶって投げる→釣り上げる
        if (t < 0.35) { P.la = P.ra = -3.2 + ease(t / 0.35) * 0.0; P.lean = -0.3; }
        else if (t < 0.6) { const k = ease((t - 0.35) / 0.25); P.la = P.ra = -3.2 + k * 2.1; P.lean = -0.3 + k * 0.5; }
        else { const k = ease((t - 0.6) / 0.3); P.la = P.ra = -1.1 - k * 1.8; P.lean = 0.2 - k * 0.5; }
        P.lz = -0.15; P.rz = 0.15; break;
      }
      case 'tenjou': // 天上天下唯我独尊のポーズ
        P.ra = -3.1; P.rz = -0.05; P.la = 0.25; P.lz = -0.2; P.hop = 0.25 * ease(t / 0.3); P.sq = 1.08; break;
      case 'build': { // ハンマーでトントン
        const hit = Math.sin(now * 16); P.ra = -2.6 + (hit > 0 ? hit * 1.6 : 0); P.rz = 0.05; P.la = -1.3; P.lz = 0.3; P.lean = 0.35; P.sq = 0.92; break;
      }
      case 'mt': // 大ジャンプしてメカへ
        P.la = P.ra = -3.0; P.lz = -0.6; P.rz = 0.6; P.hop = 1.6 * Math.sin(Math.min(1, t) * Math.PI); P.twist = t * Math.PI * 2; break;
      case 'sherpa': // 空から来た荷物を受け取る
        P.la = P.ra = -3.0; P.lz = 0.25; P.rz = -0.25; P.sq = t > 0.55 ? 1 - pulse(t, 0.55, 0.8) * 0.25 : 1; P.lean = -0.1; break;
      case 'muku': // 手を合わせて首をかしげる
        P.la = -1.5; P.ra = -1.5; P.lz = 0.8; P.rz = -0.8; P.twist = 0.25; P.hop = Math.abs(Math.sin(t * Math.PI * 2)) * 0.25; P.lean = 0.12; break;
      case 'positive': // ガッツポーズで大ジャンプ
        P.ra = -3.1; P.rz = -0.1; P.la = 0.2 + (t > 0.3 ? -1.0 : 0); P.lz = 0.4; P.hop = 0.9 * pulse(t, 0.2, 0.75); P.sq = t < 0.2 ? 0.8 : 1.1; break;
      case 'bike': // 前へ乗り出す
        P.la = P.ra = -1.5; P.lean = 0.45; P.hop = 0.4 * pulse(t, 0, 0.5); break;
      case 'weapon': // 背中から武器を引き抜く
        P.ra = t < 0.4 ? -3.2 : -1.5; P.rz = t < 0.4 ? 0.4 : -0.1; P.la = -0.5; P.twist = t < 0.4 ? -0.4 : 0.2; break;
      default:
        P.la = P.ra = -2.9; P.lz = -0.45; P.rz = 0.45;
    }
    return P;
  }
  // ---------- スキルごとの演出 ----------
  function iconSprite(txt, col, size = 0.9) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
    g.font = '900 72px "Noto Sans JP", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(txt, 48, 52); g.fillStyle = col; g.fillText(txt, 48, 52);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.setScalar(size); return sp;
  }
  // 記号が相手へ飛んでいく
  function flyIcons(from, to, txt, col, n = 3, dur = 0.55) {
    for (let i = 0; i < n; i++) {
      const sp = iconSprite(typeof txt === 'function' ? txt(i) : txt, typeof col === 'function' ? col(i) : col, 0.7);
      const A = new THREE.Vector3(...from), B = new THREE.Vector3(...to), mid = A.clone().lerp(B, 0.5); mid.y += 1.5 + Math.random();
      const off = (Math.random() - 0.5) * 0.12;
      addFx(sp, dur + i * 0.08, (f, k) => { const u = Math.min(1, (1 - k) * (1 + i * 0.15) + off); const a = A.clone().lerp(mid, u), b = mid.clone().lerp(B, u); sp.position.copy(a.lerp(b, u)); sp.material.opacity = Math.min(1, k * 3); });
    }
  }
  function ringPulse(x, y, z, col, r0, r1, life, vertical, yw) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), addB(col, 0.9));
    m.position.set(x, y, z); if (vertical) { m.rotation.y = yw || 0; } else m.rotation.x = -Math.PI / 2;
    addFx(m, life, (f, k) => { m.scale.setScalar(r0 + (r1 - r0) * (1 - k)); m.material.opacity = k * 0.9; });
  }
  function riseParts(x, y, z, n, txtOrCol, life = 1.0, spread = 0.9) {
    for (let i = 0; i < n; i++) {
      const isTxt = typeof txtOrCol === 'string' && txtOrCol.length <= 2;
      const o = isTxt ? iconSprite(txtOrCol, '#ffffff', 0.5) : new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), addB(txtOrCol, 0.9));
      const ox = (Math.random() - 0.5) * spread * 2, oz = (Math.random() - 0.5) * spread * 2, sp = 1.5 + Math.random() * 2, dl = Math.random() * 0.3;
      addFx(o, life + dl, (f, k) => { const t = 1 - k; o.position.set(x + ox + Math.sin(t * 8 + i) * 0.15, y + t * sp * life, z + oz); (o.material).opacity = Math.min(1, k * 2); });
    }
  }
  // 手に一時的に持つ小道具
  function handProp(ch, kind, life) {
    let g = new THREE.Group();
    const dark = toon(0x1c1a24);
    if (kind === 'keyboard') { M(new THREE.BoxGeometry(0.9, 0.06, 0.32), dark, 0, 0, 0, g); for (let i = 0; i < 12; i++) M(new THREE.BoxGeometry(0.11, 0.04, 0.09), addB([0xff4d6d, 0x22d3ee, 0xa3e635, 0xfacc15][i % 4], 1), -0.37 + (i % 6) * 0.15, 0.045, -0.06 + ((i / 6) | 0) * 0.12, g); g.position.set(0, 0.95, 0.75); ch.inner.add(g); }
    else if (kind === 'squid') { const b = M(new THREE.ConeGeometry(0.14, 0.45, 8), toon(0xe8c9a0), 0, 0, 0, g); b.rotation.x = Math.PI; for (let i = 0; i < 5; i++) { const t = M(new THREE.CylinderGeometry(0.02, 0.01, 0.3, 4), toon(0xd9b48a), -0.1 + i * 0.05, -0.35, 0, g); t.rotation.z = (i - 2) * 0.15; } g.position.set(0, -0.15, 0.05); ch.arms[1].f.add(g); }
    else if (kind === 'phone') { M(new THREE.BoxGeometry(0.42, 0.26, 0.03), dark, 0, 0, 0, g); M(new THREE.PlaneGeometry(0.38, 0.22), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }), 0, 0, -0.02, g).rotation.y = Math.PI; g.position.set(0, 1.25, 0.6); g.rotation.x = 0.35; ch.inner.add(g); }
    else if (kind === 'mic') { const st = M(new THREE.CylinderGeometry(0.035, 0.03, 0.3, 8), dark, 0, -0.15, 0.05, g); M(new THREE.SphereGeometry(0.08, 10, 8), toon(0x9ca3af), 0, -0.32, 0.05, g); ch.arms[1].f.add(g); }
    else if (kind === 'rod') { rod([0, 0, 0], [0, -1.8, 0.4], 0.025, toon(0x8b5a2b), g); M(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), toon(0x1c1a24), 0, -0.2, 0.06, g).rotation.z = Math.PI / 2; ch.arms[1].f.add(g); }
    else if (kind === 'hammer') { rod([0, 0, 0], [0, -0.5, 0.05], 0.03, toon(0x8b5a2b), g); const h = M(new THREE.BoxGeometry(0.28, 0.14, 0.14), toon(0x6b7280), 0, -0.55, 0.05, g); ol(h, 1.1); ch.arms[1].f.add(g); }
    else if (kind === 'medicine') { M(new THREE.BoxGeometry(0.14, 0.2, 0.04), toon(0x15803d), 0, -0.15, 0.08, g); ch.arms[1].f.add(g); }
    else if (kind === 'flag') { rod([0, 0, 0], [0, -0.9, 0], 0.02, toon(0xe5e7eb), g); M(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }), 0.2, -0.78, 0, g); ch.arms[1].f.add(g); }
    else return;
    let left = life;
    addFx(new THREE.Group(), life, (f) => { if (f.life <= 0.02 && g.parent) { g.parent.remove(g); disposeFx(g); } });
  }
  function charPos(ch, e) { return ch ? ch.root.position.clone() : new THREE.Vector3(e.x, e.y, e.z); }
  function castFx(e) {
    const ch = chars.get(e.id);
    const P = charPos(ch, e), x = P.x, y = P.y, z = P.z, yw = ch ? ch.root.rotation.y : e.yw;
    const fx = Math.sin(yw), fz = Math.cos(yw);
    const col = new THREE.Color(e.c).lerp(new THREE.Color(0xffffff), 0.25).getHex();
    const tgs = (e.tg || []).map((id) => chars.get(id)).filter(Boolean).map((c) => [c.root.position.x, c.root.position.y + 1.1, c.root.position.z]);
    const me = [x, y + 1.3, z];
    const hitAll = (delay, c2, txt) => tgs.forEach((b, i) => later(delay + i * 0.05, () => { spark(b[0], b[1], b[2], 0.7, c2); if (txt) floatText(b[0], b[1] + 1.2, b[2], txt, '#' + new THREE.Color(c2).getHexString(), false); }));
    switch (e.sid) {
      case 'modifier':
        handProp(ch, 'keyboard', 0.9);
        later(0.35, () => { const S = ['?', '!', '★', '♪', '×', '♥']; const C = ['#f472b6', '#fde047', '#4ade80', '#60a5fa', '#f97316', '#c084fc']; tgs.forEach((b) => flyIcons(me, b, (i) => S[(Math.random() * S.length) | 0], (i) => C[(Math.random() * C.length) | 0], 3)); hitAll(0.5, 0xc084fc); });
        riseParts(x, y + 1.0, z, 8, 0xc084fc, 0.8, 0.7); break;
      case 'edit':
        handProp(ch, 'keyboard', 1.0);
        { const film = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.16, 4, 40), new THREE.MeshBasicMaterial({ color: 0x111111 })); film.position.set(x, y + 1.1, z); film.rotation.x = Math.PI / 2;
          for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; M(new THREE.BoxGeometry(0.14, 0.04, 0.1), addB(0xffffff, 0.9), Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0.13, film); }
          addFx(film, 1.0, (f, k) => { film.rotation.z += 0.12; film.scale.setScalar(0.6 + (1 - k) * 0.6); }); }
        later(0.7, () => { tgs.forEach((b) => { zap(me, b, 0xf43f5e); floatText(b[0], b[1] + 1.2, b[2], 'カット！', '#f43f5e', false); }); hitAll(0.05, 0xf43f5e); }); break;
      case 'surume':
        handProp(ch, 'squid', 1.1); for (let i = 0; i < 3; i++) later(0.2 + i * 0.3, () => floatText(x, y + 2.3, z, 'もぐもぐ', '#e8c9a0', false)); break;
      case 'kirinuki':
        handProp(ch, 'phone', 1.0); later(0.5, () => floatText(x + fx * 0.5, y + 2.4, z + fz * 0.5, 'それってあなたの感想ですよね', '#93c5fd', false)); break;
      case 'kichige':
        for (let i = 0; i < 10; i++) later(i * 0.04, () => { const a = Math.random() * 6.28; const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), addB(0xff3b3b, 1)); const r = 1.6; addFx(m, 0.35, (f, k) => { const u = 1 - k; m.position.set(x + Math.cos(a) * r * (1 - u), y + 0.8, z + Math.sin(a) * r * (1 - u)); }); });
        later(0.45, () => { for (let i = 0; i < 3; i++) later(i * 0.1, () => ringPulse(x, y + 0.2 + i * 0.6, z, i % 2 ? 0xffb020 : 0xff3b3b, 0.5, 10, 0.6)); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 6), addB(0xff5a2a, 0.9)); sp.position.set(x + Math.cos(a) * 1.4, y + 0.8, z + Math.sin(a) * 1.4); addFx(sp, 0.5, (f, k) => { sp.scale.set(1, 0.3 + (1 - k) * 1.2, 1); sp.material.opacity = k; }); } floatText(x, y + 2.8, z, 'うおおおお！！', '#ff3b3b', true); }); break;
      case 'subaka':
        later(0.3, () => { const cx = x - fz * 1.0 + -fx * 0.6, cz = z + fx * 1.0 - fz * 0.6; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), addB(0xfda4af, 0.7)); const a = Math.random() * 6.28; addFx(m, 0.6, (f, k) => { m.position.set(cx + Math.cos(a) * (1 - k) * 0.9, y + 0.5 + (1 - k) * 0.6, cz + Math.sin(a) * (1 - k) * 0.9); m.material.opacity = k * 0.7; }); } riseParts(cx, y + 0.8, cz, 6, '♥', 1.0, 0.5); floatText(cx, y + 2.2, cz, 'ポンッ！', '#fda4af', false); }); break;
      case 'soundboard':
        for (let i = 0; i < 5; i++) later(i * 0.15, () => ringPulse(x, y + 1.0, z, 0xa855f7, 0.4, 6, 0.5));
        tgs.forEach((b) => flyIcons(me, b, (i) => ['♪', '♫', '♬'][i % 3], '#c084fc', 4)); hitAll(0.6, 0xa855f7, 'ザザッ'); break;
      case 'role':
        later(0.25, () => tgs.forEach((b) => { zap(me, b, 0xfacc15); const tag = iconSprite('役', '#facc15', 1.0); const A = new THREE.Vector3(...me), B = new THREE.Vector3(...b); addFx(tag, 0.5, (f, k) => { tag.position.copy(A.clone().lerp(B, Math.min(1, (1 - k) * 1.6))); tag.position.y += 0.5; }); })); hitAll(0.5, 0xfacc15); break;
      case 'chudoku':
        tgs.forEach((b) => flyIcons(b, me, (i) => ['G', 'A', 'M', 'E'][i % 4], '#4ade80', 4, 0.8));
        later(0.1, () => tgs.forEach((b) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), addB(0x22c55e, 0.9)); m.position.set(b[0], b[1], b[2]); m.rotation.x = Math.PI / 2; addFx(m, 0.8, (f, k) => { m.rotation.z += 0.2; m.scale.setScalar(0.5 + k); m.material.opacity = k; }); })); break;
      case 'rasher':
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), addB([0x22d3ee, 0xa855f7, 0xf472b6][i % 3], 0.9)); bar.position.set(x + Math.cos(a) * 1.5, y, z + Math.sin(a) * 1.5); addFx(bar, 1.0, (f, k, dt) => { const h = 0.3 + Math.abs(Math.sin(performance.now() / 90 + i)) * 1.8; bar.scale.y = h * k; bar.position.y = y + h * k / 2; }); }
        riseParts(x, y + 1.5, z, 6, '♪', 1.0, 0.6); break;
      case 'rhythmrev':
        for (let i = 0; i < 4; i++) later(i * 0.24, () => { ringPulse(x, y + 0.1, z, [0xf43f5e, 0x22d3ee, 0xfacc15, 0x4ade80][i], 0.3, 3.5, 0.4); floatText(x + (Math.random() - 0.5) * 2, y + 2.2, z + (Math.random() - 0.5) * 2, ['←', '↑', '↓', '→'][i], '#fff', true); }); break;
      case 'goreisan':
        handProp(ch, 'medicine', 1.0); later(0.4, () => { riseParts(x, y + 0.4, z, 16, 0x86efac, 1.0, 0.8); ringPulse(x, y + 0.1, z, 0x4ade80, 0.5, 2.4, 0.6); floatText(x, y + 2.5, z, 'ゴクッ', '#86efac', false); }); break;
      case 'mousou': {
        const cloud = new THREE.Group(); for (let i = 0; i < 5; i++) M(new THREE.SphereGeometry(0.35 + (i % 2) * 0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), (i - 2) * 0.32, Math.sin(i) * 0.12, 0, cloud);
        for (let i = 0; i < 3; i++) M(new THREE.SphereGeometry(0.08 + i * 0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), 0.3 - i * 0.1, -0.5 - i * 0.25, 0, cloud).position.set(0.3 - i * 0.12, -0.45 - i * 0.22, 0);
        const ic = iconSprite('♥', '#fb7185', 0.5); ic.position.set(0, 0.05, 0.4); cloud.add(ic);
        cloud.position.set(x, y + 3.0, z); addFx(cloud, 1.1, (f, k) => { cloud.scale.setScalar(Math.min(1, (1 - k) * 4)); cloud.position.y = y + 3.0 + Math.sin(performance.now() / 300) * 0.1; cloud.quaternion.copy(camera.quaternion); });
        riseParts(x, y + 2.0, z, 6, '★', 1.0, 0.7); break;
      }
      case 'rinri': {
        const sw = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 40, Math.PI * 1.6), addB(0x8b5cf6, 0.95)); sw.position.set(x, y + 1.9, z); sw.rotation.x = Math.PI / 2;
        addFx(sw, 1.0, (f, k) => { sw.rotation.z += 0.35; sw.scale.setScalar(0.6 + Math.sin(performance.now() / 80) * 0.15 + (1 - k) * 0.4); sw.material.opacity = k; });
        for (let i = 0; i < 3; i++) later(0.3 + i * 0.2, () => floatText(x + (Math.random() - 0.5), y + 2.6, z, ['？！', 'SAN値ﾁｪｯｸ', 'ｱﾜﾜ'][i], '#c4b5fd', false)); break;
      }
      case 'mic':
        handProp(ch, 'mic', 0.9);
        later(0.4, () => { for (let i = 0; i < 4; i++) later(i * 0.08, () => { const a = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 24, 1, -0.7, 1.4), addB(0xc4b5fd, 0.9)); a.position.set(x + fx * (0.8 + i * 0.6), y + 1.2, z + fz * (0.8 + i * 0.6)); a.rotation.set(0, yw - Math.PI / 2, 0); addFx(a, 0.4, (f, k) => { a.scale.setScalar(1 + (1 - k) * 1.5 + i * 0.4); a.material.opacity = k; }); }); hitAll(0.2, 0xc4b5fd); }); break;
      case 'sniper': case 'snipe': {
        const tg2 = e.sid === 'snipe' ? tgs : tgs;
        tg2.forEach((b) => { const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), addB(0xff2244, 0.8)); const A = new THREE.Vector3(...me), B = new THREE.Vector3(...b), d = B.clone().sub(A); ln.position.copy(A).addScaledVector(d, 0.5); ln.scale.y = d.length(); ln.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); addFx(ln, 0.6, (f, k) => (ln.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(performance.now() / 50))));
          const cr = iconSprite('⊕', '#ff2244', 1.1); cr.position.set(b[0], b[1], b[2]); addFx(cr, 0.6, (f, k) => { cr.scale.setScalar(0.6 + k * 1.2); }); });
        later(0.58, () => { spark(x + fx * 1.1, y + 1.3, z + fz * 1.1, 1.0, 0xffd166); floatText(x, y + 2.6, z, 'バァン！', '#ff2244', false); tgs.forEach((b) => beam(me, b, 0xffd166, true)); hitAll(0.02, 0xff2244); });
        break;
      }
      case 'fish':
        handProp(ch, 'rod', 1.1);
        later(0.5, () => tgs.forEach((b) => { const A = new THREE.Vector3(x + fx * 1.5, y + 2.6, z + fz * 1.5), B = new THREE.Vector3(...b); const curve = new THREE.QuadraticBezierCurve3(A, A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, 2.5, 0)), B); const ln = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.012, 3, false), addB(0xe0f2fe, 0.9)); addFx(ln, 0.6, (f, k) => (ln.material.opacity = k)); later(0.2, () => { for (let i = 0; i < 8; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), addB(0x38bdf8, 0.9)); const v = new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3); d.position.set(b[0], b[1] - 0.8, b[2]); addFx(d, 0.6, (f, k, dt) => { d.position.addScaledVector(v, dt); v.y -= 12 * dt; }); } }); })); break;
      case 'tenjou': {
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), addB(0xfde047, 0.95)); halo.position.set(x - fx * 0.3, y + 2.0, z - fz * 0.3); halo.rotation.y = yw;
        const rays = new THREE.Group(); for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.6), addB(0xfff7c2, 0.6)); r.rotation.z = (i / 12) * Math.PI * 2; r.position.set(Math.sin(-r.rotation.z) * 1.3, Math.cos(r.rotation.z) * 1.3, 0); rays.add(r); } halo.add(rays);
        addFx(halo, 1.1, (f, k) => { rays.rotation.z += 0.02; halo.scale.setScalar(Math.min(1, (1 - k) * 4)); halo.material.opacity = k; rays.children.forEach((r) => (r.material.opacity = k * 0.6)); });
        later(0.3, () => floatText(x, y + 3.2, z, '天上天下唯我独尊', '#fde047', true)); later(0.6, () => tgs.forEach((b) => zap(me, b, 0xfde047))); hitAll(0.65, 0xfde047); break;
      }
      case 'build':
        handProp(ch, 'hammer', 1.1);
        for (let i = 0; i < 4; i++) later(0.15 + i * 0.22, () => { const px = x + fx * 0.9, pz = z + fz * 0.9; spark(px, y + 0.3, pz, 0.3, 0xfde68a); floatText(px, y + 1.6, pz, 'トン', '#fde68a', false); for (let j = 0; j < 3; j++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.14), toon(0xc08a52)); const v = new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3); pl.position.set(px, y + 0.3, pz); addFx(pl, 0.6, (f, k, dt) => { pl.position.addScaledVector(v, dt); v.y -= 12 * dt; pl.rotation.x += dt * 8; }); } }); break;
      case 'mt':
        for (let i = 0; i < 10; i++) { const pn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.05), std(0x9ca3af, { m: 0.8, r: 0.3 })); const a = (i / 10) * Math.PI * 2, r0 = 3.5; addFx(pn, 0.8, (f, k) => { const u = 1 - k; pn.position.set(x + Math.cos(a + u * 3) * r0 * k, y + 1 + k * 2, z + Math.sin(a + u * 3) * r0 * k); pn.rotation.y += 0.3; }); }
        later(0.75, () => { spark(x, y + 1.5, z, 1.2, 0x67e8f9); ringPulse(x, y + 0.1, z, 0x67e8f9, 0.5, 4, 0.5); floatText(x, y + 3.2, z, 'ガシャーン！', '#67e8f9', true); }); break;
      case 'sherpa': {
        const box = new THREE.Group(); const cr = M(new THREE.BoxGeometry(0.6, 0.5, 0.6), toon(0xc08a52), 0, 0, 0, box); ol(cr, 1.05); M(new THREE.BoxGeometry(0.62, 0.1, 0.62), toon(0x16a34a), 0, 0, 0, box);
        const chute = M(new THREE.SphereGeometry(0.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide }), 0, 1.4, 0, box); for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) rod([a * 0.3, 0.25, b * 0.3], [a, 1.4, b], 0.01, toon(0xffffff), box);
        addFx(box, 0.75, (f, k) => { box.position.set(x, y + 2.2 + k * 8, z); box.rotation.y += 0.05; });
        later(0.72, () => { riseParts(x, y + 1.5, z, 14, 0x86efac, 0.8, 0.8); floatText(x, y + 3, z, '補給！', '#86efac', true); }); break;
      }
      case 'muku':
        riseParts(x, y + 1.2, z, 6, '♥', 1.0, 0.6);
        later(0.3, () => tgs.forEach((b) => { for (let i = 0; i < 6; i++) { const pe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(0x3b2416)); const A = new THREE.Vector3(...me), B = new THREE.Vector3(b[0] + (Math.random() - 0.5) * 0.6, b[1] + (Math.random() - 0.5) * 0.6, b[2]); const mid = A.clone().lerp(B, 0.5); mid.y += 1.5; addFx(pe, 0.5 + i * 0.04, (f, k) => { const u = 1 - k; pe.position.copy(A.clone().lerp(mid, u).lerp(mid.clone().lerp(B, u), u)); }); } })); hitAll(0.85, 0xfbcfe8, 'タピオカパン'); break;
      case 'positive':
        handProp(ch, 'flag', 1.0);
        later(0.3, () => { const sun = new THREE.Group(); for (let i = 0; i < 16; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.2), addB(0xfde047, 0.7)); r.rotation.z = (i / 16) * Math.PI * 2; sun.add(r); } sun.position.set(x, y + 1.6, z); addFx(sun, 0.7, (f, k) => { sun.quaternion.copy(camera.quaternion); sun.rotateZ((1 - k) * 2); sun.scale.setScalar(0.5 + (1 - k) * 1.5); sun.children.forEach((r) => (r.material.opacity = k * 0.7)); }); riseParts(x, y + 0.5, z, 6, '↑', 1.0, 0.7); floatText(x, y + 3, z, 'いける！！', '#fde047', true); }); break;
      case 'bike':
        later(0.15, () => { for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd6d3d1, transparent: true, opacity: 0.7 })); const a = Math.random() * 6.28; addFx(d, 0.6, (f, k) => { d.position.set(x - fx * 0.8 + Math.cos(a) * (1 - k) * 1.2, y + 0.3 + (1 - k) * 0.4, z - fz * 0.8 + Math.sin(a) * (1 - k) * 1.2); d.material.opacity = k * 0.7; }); } floatText(x, y + 2.6, z, 'ブーン！', '#fb923c', false); }); break;
      case 'weapon':
        later(0.25, () => { spark(x, y + 2.0, z, 0.8, 0xfacc15); ringPulse(x, y + 1.4, z, 0xfacc15, 0.3, 1.6, 0.35, true, yw); floatText(x, y + 2.8, z, 'チャキッ', '#facc15', false); }); break;
      default:
        spark(x, y + 1.2, z, 0.9, col);
    }
  }
  // 演出の時間で少し後に実行（録画でもずれない）
  function later(sec, fn) { let done = false; addFx(new THREE.Group(), sec, (f) => { if (!done && f.life <= 0.02) { done = true; fn(); } }); }
  // ジグザグの光線
  function zap(a, b, col) {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), pts = [];
    for (let i = 0; i <= 10; i++) { const p = A.clone().lerp(Bv, i / 10); if (i && i < 10) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7)); pts.push(p); }
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 5, false), addB(col, 1));
    const core = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 4, false), addB(0xffffff, 1)); t.add(core);
    addFx(t, 0.3, (f, k) => { t.material.opacity = k; core.material.opacity = k; });
  }
  // 掴みの空振り／つかみかかり：左右から閉じる2本の弧
  function grabSwing(e) {
    const g = new THREE.Group(); g.position.set(e.x, e.y + 1.0, e.z); g.rotation.y = e.yw;
    const col = e.ok ? 0xffa53b : 0xffffff;
    const arcs = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 16, 1, 0, 1.3), addB(col, 0.8)); m.rotation.x = -Math.PI / 2; g.add(m); m.userData.s = s; return m; });
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.55), addB(col, 0.8)); l.position.set((i - 1.5) * 0.2, (Math.random() - 0.5) * 0.4, 0.9); g.add(l); }
    addFx(g, 0.22, (f, k) => { arcs.forEach((m) => { m.rotation.z = Math.PI / 2 + m.userData.s * (0.2 + k * 1.1) - 0.65; }); g.children.forEach((c) => (c.material.opacity = k * 0.85)); g.position.x += Math.sin(e.yw) * 0.03; g.position.z += Math.cos(e.yw) * 0.03; });
  }
  // 掴んだ瞬間
  function grabCatch(e) {
    const col = new THREE.Color(e.c).lerp(new THREE.Color(0xffd166), 0.5).getHex();
    spark(e.x, e.y, e.z, 0.9, 0xffd166);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 24), addB(col, 0.95)); r.position.set(e.x, e.y, e.z); r.lookAt(camera.position);
    addFx(r, 0.3, (f, k) => { r.scale.setScalar(1 + (1 - k) * 2.6); r.material.opacity = k; });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), addB(0xffffff, 0.9)); l.position.set(e.x, e.y, e.z); const v = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyQuaternion(r.quaternion); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); addFx(l, 0.25, (f, k, dt) => { l.position.addScaledVector(v, dt * 6); l.material.opacity = k; }); }
    floatText(e.x, e.y + 1.4, e.z, 'ガシッ！', '#ffb020', false);
  }
  // 投げ：頭上から振り下ろす大きな弧＋衝撃の輪
  function throwFx(e) {
    const g = new THREE.Group(); g.position.set(e.x, e.y + 1.2, e.z); g.rotation.y = e.yw;
    const col = e.big ? 0xff7a2f : 0xffc04a;
    const arc = new THREE.Mesh(new THREE.RingGeometry(1.0, e.big ? 1.6 : 1.35, 26, 1, 0, 2.8), addB(col, 0.9));
    arc.rotation.y = Math.PI / 2; arc.rotation.z = -0.2; g.add(arc);
    addFx(g, 0.3, (f, k) => { arc.material.opacity = k * 0.9; arc.scale.setScalar(1 + (1 - k) * 0.4); });
    wave(e.x + Math.sin(e.yw) * 1.2, e.y + 0.1, e.z + Math.cos(e.yw) * 1.2, e.big ? 2.6 : 1.8, col);
    floatText(e.x, e.y + 2.6, e.z, e.big ? 'ブンッ！！' : 'ブンッ！', '#ff8a3b', false);
  }
  // 投げられて飛んでいる間の軌跡
  function trailPuff(ch, col) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), addB(col, 0.55));
    m.position.copy(ch.root.position); m.position.y += 0.9;
    addFx(m, 0.35, (f, k) => { m.material.opacity = k * 0.55; m.scale.setScalar(0.4 + k * 0.8); });
  }
  // パンチの振り抜きエフェクト（三日月の軌跡＋スピード線）
  function swoosh(e) {
    const big = e.c || e.f, col = e.f ? 0xffd23b : e.c ? 0xff8a3b : 0xffffff;
    const g = new THREE.Group(); g.position.set(e.x, e.y + 1.0, e.z); g.rotation.y = e.yw;
    const arc = new THREE.Mesh(new THREE.RingGeometry(big ? 1.0 : 0.75, big ? 1.55 : 1.1, 24, 1, 0, big ? 2.6 : 1.9),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    arc.rotation.x = -Math.PI / 2; arc.rotation.z = Math.PI / 2 - (big ? 1.3 : 0.95) + (e.s ? 0.25 : -0.25);
    g.add(arc);
    // 拳の先のスピード線
    for (let i = 0; i < (big ? 6 : 3); i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, big ? 1.2 : 0.7), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      l.position.set((Math.random() - 0.5) * 0.7 + (e.s ? -0.3 : 0.3), (Math.random() - 0.5) * 0.5, 1.0 + Math.random() * 0.5); g.add(l);
    }
    addFx(g, big ? 0.28 : 0.18, (f, k) => { g.children.forEach((c) => (c.material.opacity = k * 0.85)); arc.scale.setScalar(1 + (1 - k) * 0.35); g.children.slice(1).forEach((c) => (c.position.z += 0.12)); });
    if (big) wave(e.x + Math.sin(e.yw) * 1.4, e.y + 0.1, e.z + Math.cos(e.yw) * 1.4, e.f ? 2.2 : 1.6, col);
  }
  function wave(x, y, z, r, col) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: col || 0xffffff, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.15, z);
    addFx(m, 0.5, (f, k) => { const s = r * (1 - k * k) + 0.3; m.scale.setScalar(s); m.material.opacity = k; });
  }
  function beam(a, b, col, thin) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(thin ? 0.03 : 0.08, thin ? 0.03 : 0.08, L, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); m.rotateX(Math.PI / 2);
    addFx(m, thin ? 0.08 : 0.3, (f, k) => { m.material.opacity = k; m.scale.x = m.scale.z = 0.5 + k; });
  }
  function boom(x, y, z, big) {
    const s = big ? 4 : 1.6;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z);
    addFx(m, 0.6, (f, k) => { m.scale.setScalar(s * (1.6 - k)); m.material.opacity = k; });
    spark(x, y, z, 2, 0xffaa44);
    shake = Math.max(shake, big ? 1 : 0.4);
  }
  function koFx(x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff88cc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y + 10, z);
    addFx(m, 0.7, (f, k) => { m.material.opacity = k * 0.7; m.scale.x = m.scale.z = 1 + (1 - k) * 1.5; });
    spark(x, Math.max(y, -4), z, 2.5, 0xff6699);
    shake = Math.max(shake, 0.7);
  }
  function meteor(x, z) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), std(0x7c2d12, { e: 0xff4400 }));
    const warn = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.4 }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(x, 0.05, z); scene.add(warn);
    m.position.set(x + 8, 30, z - 8);
    addFx(m, 1.2, (f, k) => { const t = 1 - k; m.position.set(x + 8 * (1 - t), 30 * (1 - t) + 0.5, z - 8 * (1 - t)); m.rotation.x += 0.2; warn.material.opacity = 0.2 + 0.4 * Math.abs(Math.sin(t * 20)); if (k <= 0.02) scene.remove(warn); });
  }
  function floatText(x, y, z, s, col, big) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const g = c.getContext('2d'); g.font = `900 ${big ? 60 : 46}px "Noto Sans JP", sans-serif`; g.textAlign = 'center';
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(s, 256, 66); g.fillStyle = col || '#fff'; g.fillText(s, 256, 66);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const TS2 = OPT.tagScale || 1;
    sp.scale.set(4 * TS2, 0.75 * TS2, 1); sp.position.set(x, y, z); sp.renderOrder = 20;
    addFx(sp, 1.4, (f, k, dt) => { sp.position.y += dt * 1.2; sp.material.opacity = Math.min(1, k * 2.5); const s2 = (k > 0.9 ? 1 + (k - 0.9) * 4 : 1) * TS2; sp.scale.set(4 * s2, 0.75 * s2, 1); });
  }

  // ---------- 初期化 ----------
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd98a7a, 60, 220);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    hemi = new THREE.HemisphereLight(0xffe8d6, 0x4a3a6a, 0.7); scene.add(hemi);
    amb = new THREE.AmbientLight(0xffffff, 0.15); scene.add(amb);
    sun = new THREE.DirectionalLight(0xfff0dd, 1.6);
    sun.position.set(14, 26, -18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun);
    makeThemes(); makeSky(); makeTiles(); makeWind();
    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // キャラのサムネイル（キャラ選択画面用）
  function thumbnails() {
    const out = {};
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x666688, 0.55));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(2, 4, 5); sc.add(dl);
    const cm = new THREE.PerspectiveCamera(35, 1, 0.1, 50); cm.position.set(1.2, 1.6, 4.2); cm.lookAt(0, 1.0, 0);
    const old = renderer.getSize(new THREE.Vector2());
    renderer.setSize(256, 256, false);
    renderer.setClearColor(0x000000, 0);
    const oldTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    for (const k of GD.CHAR_KEYS) {
      const ch = buildChar(k); scene.remove(ch.root); sc.add(ch.root); ch.tag.visible = false;
      ch.root.rotation.y = 0.35;
      ch.arms[1].piv.rotation.x = -0.5; ch.arms[0].piv.rotation.z = -0.4;
      renderer.render(sc, cm);
      out[k] = renderer.domElement.toDataURL();
      sc.remove(ch.root);
    }
    renderer.toneMapping = oldTM;
    renderer.setSize(old.x, old.y, false);
    resize();
    return out;
  }

  // ---------- 毎フレーム描画 ----------
  function decodeTile(v) {
    let warn = false, shake = false;
    if (v < -150) return { none: true };
    if (v > 1500) { warn = true; v -= 2000; }
    if (v > 500) { shake = true; v -= 1000; }
    return { top: v, warn, shake, on: v > -40, gone: v < -90 };
  }

  function update(s, events, dt, input) {
    const now = clock.getElapsedTime();
    lastSnap = s;
    applyMap(s.mp);
    setTheme(s.g);
    if (decoGroup) decoGroup.children.forEach((o) => { if (o.userData.spin) o.rotation.z += o.userData.spin * dt; if (o.userData.bob !== undefined) o.position.y += Math.sin(now + o.userData.bob) * 0.01; if (o.userData.water) o.position.y = -3.5 + Math.sin(now * 0.8) * 0.15; });
    // 停電
    const dark = s.bo ? 1 : 0;
    const sky = scene.getObjectByName('sky');
    sky.material.uniforms.dark.value += (dark - sky.material.uniforms.dark.value) * Math.min(1, dt * 3);
    const dk = sky.material.uniforms.dark.value;
    sun.intensity = 1.6 * (1 - dk * 0.95); hemi.intensity = 0.7 * (1 - dk * 0.9); amb.intensity = 0.15 + dk * 0.02;
    scene.fog.color.setRGB(0.85 * (1 - dk * 0.9), 0.54 * (1 - dk * 0.9), 0.48 * (1 - dk * 0.9));
    // 雲・浮島
    const clouds = scene.getObjectByName('clouds');
    clouds.children.forEach((c) => { c.position.x += c.userData.sp * dt; if (c.position.x > 160) c.position.x = -160; });
    scene.children.forEach((o) => { if (o.name === 'island') o.position.y += Math.sin(now * 0.5 + o.userData.bob) * 0.01; });
    // 風
    if (windPts && windPts.visible) {
      const a = windPts.geometry.attributes.position, wx = Math.cos(s.wd) * 18 * dt, wz = Math.sin(s.wd) * 18 * dt;
      for (let i = 0; i < a.count; i++) { let x = a.getX(i) + wx, z = a.getZ(i) + wz; if (x > 25) x -= 50; if (x < -25) x += 50; if (z > 25) z -= 50; if (z < -25) z += 50; a.setX(i, x); a.setZ(i, z); }
      a.needsUpdate = true;
    }
    // タイル
    s.tl.forEach((v, i) => {
      const m = tileMeshes[i], d = decodeTile(v);
      if (d.none) { m.visible = false; m.userData.gone = false; m.userData.top = undefined; m.position.y = -0.6; m.scale.y = 1; return; }
      if (d.gone) {
        if (!m.userData.gone) { m.userData.gone = true; m.userData.fall = 0; }
        m.userData.fall += dt; m.position.y -= m.userData.fall * 18 * dt; m.rotation.x += dt * 0.6; if (m.position.y < -60) m.visible = false;
        return;
      }
      m.userData.gone = false; m.visible = true; m.rotation.set(0, 0, 0);
      if (!d.on) { m.visible = false; m.position.y = -0.6; return; }
      if (m.userData.top === undefined) m.userData.top = d.top;
      m.userData.top += (d.top - m.userData.top) * Math.min(1, dt * 20);
      const tp = m.userData.top, sy = Math.max(1, (tp + 1.2) / 1.2);
      m.scale.y = sy; m.position.y = tp - 0.6 * sy;
      m.position.x = m.userData.bx ?? (m.userData.bx = m.position.x);
      if (d.shake) m.position.x = m.userData.bx + Math.sin(now * 60 + i) * 0.06;
      if (d.warn && Math.sin(now * 14) > 0) { if (m.material[2] !== themes.warn) m.material = [themes.warn, themes.warn, themes.warn, themes.warn, themes.warn, themes.warn]; }
      else if (m.material[2] === themes.warn) m.material = m.userData.base;
    });
    if (curTheme === 'conveyor') {
      const t = themes.conveyor.top.map; t.wrapS = THREE.RepeatWrapping; t.offset.y = (now * 0.6) % 1;
    }
    // 浮き床
    const pls = s.pl || [];
    while (platGroup.children.length > pls.length) platGroup.remove(platGroup.children[platGroup.children.length - 1]);
    pls.forEach((q, i) => {
      let g = platGroup.children[i];
      if (!g) {
        g = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.5, metalness: 0.1 }));
        top.castShadow = top.receiveShadow = true; g.add(top);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 1.02), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
        rim.position.y = -0.17; g.add(rim);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        glow.rotation.x = Math.PI / 2; glow.position.y = -0.4; g.add(glow);
        platGroup.add(g);
      }
      g.scale.set(q[2] * 2, 1, q[3] * 2); g.position.set(q[0], q[4] - 0.15, q[1]);
      g.children[2].material.opacity = 0.18 + Math.sin(now * 3 + i) * 0.08;
    });
    // 建築ブロック
    while (boxGroup.children.length > s.bx.length) boxGroup.remove(boxGroup.children[boxGroup.children.length - 1]);
    s.bx.forEach((b, i) => {
      let m = boxGroup.children[i];
      if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), themes.build); m.castShadow = m.receiveShadow = true; boxGroup.add(m); }
      m.scale.set(b[2] * 2, b[4] - b[5], b[3] * 2); m.position.set(b[0], (b[4] + b[5]) / 2, b[1]);
    });
    // アイテム
    const seen = new Set();
    s.it.forEach((it) => {
      seen.add(it[0]);
      let m = itemMeshes.get(it[0]);
      if (!m) { m = groundItem(it[1]); itemMeshes.set(it[0], m); }
      m.position.set(it[2], it[3] + Math.sin(now * 3 + it[0]) * 0.12, it[4]); m.userData.m.rotation.y += dt * 2;
    });
    for (const [id, m] of itemMeshes) if (!seen.has(id)) { scene.remove(m); itemMeshes.delete(id); }
    const seenP = new Set();
    s.pr.forEach((p) => {
      seenP.add(p[0]);
      let m = projMeshes.get(p[0]);
      if (!m) { m = itemMesh(p[1]); scene.add(m); projMeshes.set(p[0], m); }
      m.position.set(p[2], p[3], p[4]); m.rotation.x += dt * 12;
    });
    for (const [id, m] of projMeshes) if (!seenP.has(id)) { scene.remove(m); projMeshes.delete(id); }

    // キャラクター
    const seenC = new Set();
    for (const p of s.p) {
      seenC.add(p.id);
      let ch = chars.get(p.id);
      if (!ch) { ch = buildChar(p.c); chars.set(p.id, ch); }
      animChar(ch, p, dt, now, s);
    }
    for (const [id, ch] of chars) if (!seenC.has(id)) { scene.remove(ch.root); chars.delete(id); }

    // Mars
    if (s.m) {
      if (!marsObj || marsObj.true !== !!s.m.tr) { if (marsObj) scene.remove(marsObj.g); marsObj = buildMars(!!s.m.tr); marsObj.g.position.y = 30; }
      const M = marsObj;
      if (M.drop === undefined) M.drop = 0;
      if (M.drop < 1.5) { M.drop += dt; const k = Math.min(1, M.drop / 1.5); M.g.position.y = 30 * (1 - k) * (1 - k); if (k >= 1) boom(0, 0.5, 0, 1); }
      M.head.rotation.y = Math.sin(now * 0.4) * 0.3;
      M.head.material.emissive.setHex(s.m.fl ? 0x663322 : (s.m.tr ? 0x330000 : 0x000000));
      const sl = s.m.sl;
      M.arms.forEach((a, k) => { a.rotation.x = sl > 0 ? -2.4 + (0.6 - sl) * 4 : -0.3 + Math.sin(now * 1.5 + k) * 0.25; });
      if (s.m.dn) M.g.rotation.z = 0.4; else M.g.rotation.z *= 0.9;
      const me = s.p.find((p) => p.id === myId);
      if (me) M.g.rotation.y = Math.atan2(me.x, me.z) * 0.6;
    } else if (marsObj) {
      marsObj.g.position.y += dt * 25;
      if (marsObj.g.position.y > 60) { scene.remove(marsObj.g); marsObj = null; }
    }

    // イベント効果
    for (const e of events) {
      if (e.k === 'hit') spark(e.x, e.y, e.z, e.p || 0.5);
      else if (e.k === 'guard') spark(e.x, e.y, e.z, 0.3, 0x60a5fa);
      else if (e.k === 'wave') wave(e.x, e.y, e.z, e.r, e.c);
      else if (e.k === 'beam') beam(e.a, e.b, e.c, e.thin);
      else if (e.k === 'boom') boom(e.x, e.y, e.z, e.big);
      else if (e.k === 'ko') koFx(e.x, e.y, e.z);
      else if (e.k === 'meteor') meteor(e.x, e.z);
      else if (e.k === 'blast') { spark(e.x, e.y, e.z, 1.2, 0xffcc66); }
      else if (e.k === 'djump') { wave(e.x, e.y, e.z, 1.6, 0xffffff); const ch = chars.get(e.id); if (ch) ch.flip = 0.4; }
      else if (e.k === 'smash') { const ch = chars.get(e.id); if (ch) ch.trail = Math.min(1.6, e.p / 25); shake = Math.max(shake, Math.min(0.8, e.p / 60)); }
      else if (e.k === 'swing') swoosh(e);
      else if (e.k === 'cast') castFx(e);
      else if (e.k === 'gswing') grabSwing(e);
      else if (e.k === 'gcatch') grabCatch(e);
      else if (e.k === 'throwfx') throwFx(e);
      else if (e.k === 'crumble') { spark(e.x, 0, e.z, 0.8, 0xc2915a); }
      else if (e.k === 'txt' || e.k === 'skill') {
        let x = 0, y = 9, z = 0;
        if (e.id) { const ch = chars.get(e.id); if (ch) { x = ch.root.position.x; y = ch.root.position.y + 3.0 + Math.random() * 0.4; z = ch.root.position.z; } }
        floatText(x, y, z, e.s, e.c, e.k === 'skill');
      }
    }
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i]; f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.upd(f, k, dt);
      if (f.life <= 0) { scene.remove(f.o); disposeFx(f.o); fxList.splice(i, 1); }
    }

    // カメラ（急に飛ばないように：最大速度つきで追いかける）
    const me = s.p.find((p) => p.id === myId);
    const ch = me && chars.get(me.id);
    let tx = cam.tx, ty = cam.ty, tz = cam.tz;
    const LIM = Sim.HALF + 6;
    if (ch && !me.e && me.rs <= 0) {
      // 吹っ飛ばされて場外へ出ても、カメラはステージ付近に残す（スマブラ風）
      tx = Math.max(-LIM, Math.min(LIM, ch.root.position.x));
      tz = Math.max(-LIM, Math.min(LIM, ch.root.position.z));
      ty = Math.max(-2, Math.min(12, ch.root.position.y + 1.6));
      cam.good = [tx, ty, tz];
    } else if (me && !me.e && me.rs > 0) {
      // 復帰待ち：最後にいた場所のまま止めておく（ステージ内に寄せる）
      const g = cam.good || [0, 1.6, 0];
      tx = Math.max(-Sim.HALF, Math.min(Sim.HALF, g[0])); ty = Math.max(1.6, g[1]); tz = Math.max(-Sim.HALF, Math.min(Sim.HALF, g[2]));
    } else { // 観戦
      const live = s.p.filter((p) => !p.e && p.rs <= 0);
      if (live.length) { let sx = 0, sz = 0; live.forEach((p) => { sx += p.x; sz += p.z; }); tx = sx / live.length; tz = sz / live.length; ty = 2; }
      tx = Math.max(-LIM, Math.min(LIM, tx)); tz = Math.max(-LIM, Math.min(LIM, tz));
    }
    if (s.m) { ty = Math.max(ty, 2); }
    if (cam.tx === undefined || !isFinite(cam.tx)) { cam.tx = tx; cam.ty = ty; cam.tz = tz; }
    const ddx = tx - cam.tx, ddy = ty - cam.ty, ddz = tz - cam.tz, far = Math.hypot(ddx, ddy, ddz);
    let kf = Math.min(1, dt * (far > 6 ? 3.5 : 9));
    const maxStep = 28 * dt; // 1秒に最大28m
    if (far * kf > maxStep) kf = maxStep / far;
    cam.tx += ddx * kf; cam.ty += ddy * kf; cam.tz += ddz * kf;
    cam.yaw = input.camYaw; cam.pitch = input.camPitch;
    if (cam.cd === undefined) cam.cd = cam.dist;
    cam.cd += (cam.dist + (s.m ? 3 : 0) - cam.cd) * Math.min(1, dt * 2);
    const dist = cam.cd;
    const cx = cam.tx - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist;
    const cz = cam.tz - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist;
    const cy = cam.ty + Math.sin(cam.pitch) * dist;
    camera.position.set(cx, Math.max(cy, cam.ty - 3), cz);
    if (!OPT.shake) shake = 0;
    shake = Math.min(shake, 0.6);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.45; camera.position.y += (Math.random() - 0.5) * shake * 0.45; shake = Math.max(0, shake - dt * 3); }
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    renderer.render(scene, camera);
  }

  function animChar(ch, p, dt, now, s) {
    const R = ch.root;
    const hidden = p.e || p.rs > 0;
    R.visible = !hidden;
    if (hidden) return;
    // 位置（通信の補間は呼び出し側で済み）
    R.position.set(p.x, p.y, p.z);
    R.rotation.y = Sim.lerpAngle(R.rotation.y, p.yw, Math.min(1, dt * 20));
    const bf = Object.fromEntries(p.bf.map((b) => [b[0], b[1]]));
    const has = (k) => p.st.some((x) => x[0] === k);
    // 乗り物
    ch.mt.visible = !!p.mt; ch.bike.visible = !!bf.bike; ch.chair.visible = !!bf.chair;
    ch.inner.position.y = p.mt ? 1.05 : bf.bike ? 0.5 : bf.chair ? 0.5 : 0;
    ch.inner.scale.setScalar(p.mt ? 0.85 : 1);
    ch.cathy.visible = p.ca > 0;
    if (ch.cathy.visible) ch.cathy.position.y = Math.abs(Math.sin(now * 5)) * 0.2;
    ch.gbug.visible = !!p.gB; if (p.gB) { ch.gbug.rotation.y += dt * 3; }
    // 着地スクワッシュ
    if (p.gr && !ch.lastGr) ch.squash = 0.7;
    ch.lastGr = p.gr;
    ch.squash += (1 - ch.squash) * Math.min(1, dt * 10);
    let sq = ch.squash;
    if (!p.gr && !p.ld) sq = 1 + Math.min(0.15, Math.abs(p.vy) * 0.01);
    if (p.cr) sq = 0.6;
    ch.inner.scale.y = (p.mt ? 0.85 : 1) * sq; ch.inner.scale.x = ch.inner.scale.z = (p.mt ? 0.85 : 1) * (1 + (1 - sq) * 0.5);
    // 歩き
    const moving = p.gr && !p.sn;
    ch.walk += dt * (moving ? 12 : 0);
    const prevX = ch.px ?? p.x, prevZ = ch.pz ?? p.z;
    const spd = Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 0.001);
    ch.px = p.x; ch.pz = p.z;
    const walkAmt = moving ? Math.min(1, spd / 6) : 0;
    ch.legs[0].rotation.x = Math.sin(ch.walk) * 0.8 * walkAmt; ch.legs[1].rotation.x = -Math.sin(ch.walk) * 0.8 * walkAmt;
    ch.inner.rotation.z = Math.sin(ch.walk) * 0.06 * walkAmt;
    ch.inner.rotation.x = walkAmt * 0.12 + (p.ds ? 0.4 : 0);
    // 腕
    const [L, Rr] = ch.arms;
    let la = Math.sin(ch.walk) * 0.6 * walkAmt, ra = -Math.sin(ch.walk) * 0.6 * walkAmt, lz = 0.15, rz = -0.15;
    if (!p.gr) { la = -2.6; ra = -2.6; lz = 0.5; rz = -0.5; }
    if (p.gd) { la = ra = -1.5; lz = -0.6; rz = 0.6; }
    if (p.gb) { la = ra = -1.45; lz = -0.15; rz = 0.15; }
    // 掴みかかる：両腕を前へ伸ばす
    let grabReach = 1;
    if (p.ga > 0 && !p.tw) { la = ra = -1.6; lz = -0.25; rz = 0.25; grabReach = 1 + 0.45 * Math.sin(Math.min(1, p.ga / 0.28) * Math.PI); }
    // 投げ：両腕を頭上から振り下ろす
    if (p.tw) { la = ra = -2.6 + (1 - Math.min(1, p.ga / 0.35)) * 1.6; lz = -0.1; rz = 0.1; }
    // スキル発動：スキルごとのモーション
    let CP = null;
    if (p.cs && !p.pt && !p.gb && !p.sn && !p.gby) { CP = castPose(p.cs, p.cq || 0, now); la = CP.la; ra = CP.ra; lz = CP.lz; rz = CP.rz; }
    if (p.ld) { la = ra = -3.0; lz = rz = 0; }
    if (p.ch > 0.35) { if (p.ps) la = 0.8; else ra = 0.8; }
    // パンチ：引く → 体をひねって突き出す（腕が伸びる） → 戻す
    let twist = CP ? CP.twist : 0, reach = 1, lean = CP ? CP.lean : 0, fistS = 1, punching = false;
    if (p.pt > 0) {
      punching = true;
      const dur = p.pt > 0.25 || ch.lastCharged ? 0.3 : 0.25, t = Math.min(1, 1 - p.pt / dur);
      const ext = t < 0.22 ? -t / 0.22 * 0.5 : t < 0.55 ? -0.5 + (t - 0.22) / 0.33 * 1.5 : 1 - (t - 0.55) / 0.45 * 0.85;
      const e = Math.max(0, ext), back = Math.max(0, -ext);
      const armA = 0.55 * back - 1.7 * e;
      if (p.ps) { la = armA; ra = 0.5 * e; lz = 0.05; } else { ra = armA; la = 0.5 * e; rz = -0.05; }
      twist = (p.ps ? 1 : -1) * (0.55 * e - 0.35 * back);
      reach = 1 + 0.5 * e; lean = 0.22 * e; fistS = 1 + 0.35 * e;
    } else ch.lastCharged = false;
    if (p.ch > 0.35) { twist = (p.ps ? -1 : 1) * 0.4; lean = -0.1; ch.lastCharged = true; }
    if (p.it && GD.ITEMS[p.it].weapon && p.it !== 'monitor') { ra = -1.45; la = -1.3; lz = -0.5; }
    if (p.sn > 0) { la = -2.8 + Math.sin(now * 8) * 0.4; ra = -2.8 + Math.cos(now * 8) * 0.4; }
    if (p.gby) { la = -2.8 + Math.sin(now * 25) * 0.6; ra = -2.8 + Math.cos(now * 25) * 0.6; }
    const armK = Math.min(1, dt * (punching ? 40 : 22));
    L.piv.rotation.x += (la - L.piv.rotation.x) * armK; Rr.piv.rotation.x += (ra - Rr.piv.rotation.x) * armK;
    const pa = p.ps ? L : Rr, oa = p.ps ? Rr : L;
    let oReach = grabReach > 1 ? grabReach : 1; if (grabReach > 1) reach = grabReach;
    if (CP) { if (pa === Rr) { reach = CP.rr; oReach = CP.lr; } else { reach = CP.lr; oReach = CP.rr; } }
    pa.piv.scale.y += (reach - pa.piv.scale.y) * armK; oa.piv.scale.y += (oReach - oa.piv.scale.y) * armK;
    pa.f.scale.setScalar(pa.f.scale.x + (fistS - pa.f.scale.x) * armK); oa.f.scale.setScalar(oa.f.scale.x + (1 - oa.f.scale.x) * armK);
    if (CP && Math.abs(CP.twist) > 1.2) ch.inner.rotation.y = CP.twist; // 回転は直接
    else ch.inner.rotation.y += (twist - ch.inner.rotation.y) * Math.min(1, dt * (punching ? 30 : 12));
    if (CP) { R.position.y += CP.hop; ch.inner.scale.y *= CP.sq; if (CP.shake) { R.position.x += (Math.random() - 0.5) * CP.shake * 2; R.position.z += (Math.random() - 0.5) * CP.shake * 2; } }
    ch.inner.rotation.x += lean;
    L.piv.rotation.z += (lz - L.piv.rotation.z) * Math.min(1, dt * 15); Rr.piv.rotation.z += (rz - Rr.piv.rotation.z) * Math.min(1, dt * 15);
    // 頭突き
    if (p.hd > 0) ch.inner.rotation.x = Math.sin((1 - p.hd / 0.3) * Math.PI) * 0.7;
    // 二段ジャンプの宙返り
    if (ch.flip > 0) { ch.flip -= dt; ch.inner.rotation.x = -(1 - ch.flip / 0.4) * Math.PI * 2; }
    // 強く吹っ飛んだときの軌跡
    if (ch.trail > 0) {
      ch.trail -= dt;
      if (!ch.tl) { ch.tl = 0; }
      ch.tl += dt;
      if (ch.tl > 0.03) {
        ch.tl = 0;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(p.x, p.y + 0.9, p.z);
        addFx(m, 0.45, (f, k) => { m.material.opacity = k * 0.55; m.scale.setScalar(0.4 + k); });
      }
    }
    // 気絶
    ch.stars.visible = p.sn > 0;
    if (p.sn > 0) { ch.stars.rotation.y += dt * 5; ch.stars.children.forEach((st, k) => { const a = (k / 3) * Math.PI * 2; st.position.set(Math.cos(a) * 0.5, Math.sin(now * 4 + k) * 0.08, Math.sin(a) * 0.5); }); }
    // チャージ光
    ch.glow.material.opacity = p.ch > 0.35 ? Math.min(0.9, (p.ch - 0.35) * 1.5) * (0.7 + Math.sin(now * 30) * 0.3) : (p.sr > 0.6 ? 0.8 : 0);
    // 目（気絶・状態異常・まばたき）
    const blink = ((now + ch.blinkOff) % 3.6) < 0.11;
    const eyeS = p.sn > 0 || p.gby ? 0.2 : has('majigire') ? 0.55 : blink ? 0.12 : 1;
    ch.eyes.forEach((e) => { e.scale.y += (eyeS - e.scale.y) * (blink ? 0.6 : 0.3); });
    // 眉と口の表情
    const angry = has('majigire') || has('kyouki') || p.ch > 0.35 || p.gb;
    const sad = p.sn > 0 || p.h >= 150 || has('naeochi');
    ch.brows.forEach((b) => { const tz = (angry ? -0.45 : sad ? 0.4 : 0.12) * b.userData.s; b.rotation.z += (tz - b.rotation.z) * 0.25; b.position.y += ((sad ? 0.5 : angry ? 0.5 : 0.53) - b.position.y) * 0.25; });
    const open = !!(p.hs || p.sn > 0 || p.gby || (!p.gr && p.vy > 6) || has('takawarai'));
    ch.mouth.visible = !open; ch.mouthO.visible = open;
    if (open) ch.mouthO.scale.y = 1.15 + Math.sin(now * 18) * (has('takawarai') ? 0.3 : 0.08);
    if (p.tr && Math.random() < 0.8) trailPuff(ch, 0xffc04a);
    // 自転車の車輪
    if (bf.bike) ch.bike.children.forEach((w) => { if (w.userData.wheel) w.rotation.x += spd * dt * 3.2; });
    // にもの大鎌：大鎌ダッシュ中は手に持って振り抜く
    if (ch.scythe) {
      const sc = ch.scythe, rest = sc.userData.rest;
      if (p.sy && !(ch.syLeft > 0)) ch.syLeft = 0.7;
      if (ch.syLeft > 0) {
        ch.syLeft -= dt;
        if (sc.parent !== ch.inner) { ch.inner.add(sc); ch.syT = 0; }
        ch.syT = (ch.syT || 0) + dt;
        const k = Math.min(1, ch.syT / 0.45);
        sc.position.set(0.55, 1.0, 0.35); sc.rotation.set(-0.3, 0, 1.4 - k * 3.0);
        sc.userData.gem.material.emissive.setHex(0xff2244);
        if (k < 1) {
          const v = new THREE.Vector3(1.25, 0.6, 0); sc.localToWorld(v);
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
          m.position.copy(v); addFx(m, 0.35, (f, kk) => { m.material.opacity = kk * 0.7; m.scale.setScalar(0.5 + kk); });
        }
      } else if (sc.parent !== rest.parent) { rest.parent.add(sc); sc.position.copy(rest.p); sc.rotation.copy(rest.r); sc.userData.gem.material.emissive.setHex(0xaa0022); }
      else sc.userData.gem.material.emissive.setHex(0xaa0022 + (Math.sin(now * 3) > 0 ? 0x110000 : 0));
    }
    // 色の演出
    const emi = ch.bodyMat.emissive;
    if (has('majigire')) emi.setRGB(0.35 + Math.sin(now * 10) * 0.15, 0, 0);
    else if (has('kyouki')) emi.setRGB(0.2, 0, 0.3 + Math.sin(now * 7) * 0.1);
    else if (has('gamechu')) emi.setRGB(0, 0.12, 0.04);
    else if (p.inv) emi.setRGB(0.3, 0.3, 0.3);
    else if (p.h >= 100) emi.setRGB(Math.min(0.4, 0.1 + p.h / 1000) + Math.sin(now * 12) * 0.1, 0.03, 0);
    else emi.setRGB(0, 0, 0);
    if (s.bo) emi.add(new THREE.Color(0.05, 0.05, 0.08));
    if (p.cs) emi.add(new THREE.Color(0.1, 0.1, 0.08));
    R.visible = !(p.inv && Math.sin(now * 30) > 0.5);
    if (has('lag') && Math.random() < 0.04) R.position.x += (Math.random() - 0.5) * 0.6;
    // チームの輪
    if (p.tm >= 0 && GD.TEAMS[p.tm]) {
      if (!ch.tring) {
        ch.tring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: GD.TEAMS[p.tm].hex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        ch.tring.rotation.x = -Math.PI / 2; ch.tring.position.y = 0.04; ch.root.add(ch.tring);
      }
      ch.tring.material.color.setHex(GD.TEAMS[p.tm].hex);
      ch.tring.scale.setScalar(1 + Math.sin(now * 4) * 0.06);
    } else if (ch.tring) { ch.root.remove(ch.tring); ch.tring = null; }
    // 持ち物
    if (ch.holdType !== p.it) {
      ch.hold.clear(); ch.holdType = p.it;
      if (p.it) { const m = itemMesh(p.it); m.rotation.x = Math.PI / 2; m.position.y = -0.1; ch.hold.add(m); }
    }
    // 名札
    ch.tag.visible = OPT.tags !== false && !hideTags;
    if (ch.tag.visible) drawTag(ch, p);
  }

  function mapPreview(key) {
    const c = document.createElement('canvas'); c.width = 220; c.height = 220;
    const g = c.getContext('2d'); const M = GD.MAPS[key]; const n = Sim.N, sz = 220 / n;
    const bg = g.createLinearGradient(0, 0, 0, 220);
    if (M.style) { const c = '#' + M.style.sky.toString(16).padStart(6, '0'); bg.addColorStop(0, '#1e3a8a'); bg.addColorStop(1, c); } else { bg.addColorStop(0, '#3b2a7a'); bg.addColorStop(1, '#f08a6a'); }
    g.fillStyle = bg; g.fillRect(0, 0, 220, 220);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const h = M.tile(i, j); if (h === null) continue;
      const k = Math.min(1, h / 2.2), st = M.style;
      const PC = { crate: ['#d4b98a', '#a86a32'], container: ['#7b818c', null], concrete: ['#b3aca5', '#e8a23a'], pillar: ['#b9c0ca', '#f1f5f9'], wood: ['#c99a5e', '#7a4f2a'], neon: ['#2a2140', '#a855f7'] };
      if (st && PC[st.cover]) { const cv = h >= st.min; g.fillStyle = cv ? (PC[st.cover][1] || ['#d94b3d', '#2f7dd1', '#2f9e5b', '#e58a1f'][(i * 7 + j * 3) % 4]) : PC[st.cover][0]; }
      else g.fillStyle = `rgb(${Math.round(95 + 90 * k)},${Math.round(200 - 10 * k)},${Math.round(150 - 60 * k)})`;
      g.fillRect(i * sz + 1.5, j * sz + 1.5, sz - 3, sz - 3);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(i * sz + 1.5, j * sz + sz - 5, sz - 3, 3.5);
    }
    // 浮き床
    for (const q of M.plats || []) { const px = (q.x / (Sim.TS * n) + 0.5) * 220, pz = (q.z / (Sim.TS * n) + 0.5) * 220, w = (q.w * 2 / (Sim.TS * n)) * 220, d = (q.d * 2 / (Sim.TS * n)) * 220; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(px - w / 2, pz - d / 2, w, d); g.strokeStyle = q.mv ? '#7dd3fc' : 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(px - w / 2, pz - d / 2, w, d); }
    if (M.rivals) { g.fillStyle = '#ff4d8d'; g.fillRect(0, 0, 92, 26); g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.fillText('ライバル風', 8, 19); }
    return c.toDataURL();
  }
  function applySettings(st) {
    OPT = st;
    if (!renderer) return;
    camera.fov = st.fov; camera.updateProjectionMatrix();
    cam.dist = st.camDist;
    sun.castShadow = !!st.shadows;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * st.res);
    resize();
  }
  function setMyId(id) { myId = id; }
  function clear() {
    for (const [, ch] of chars) scene.remove(ch.root); chars.clear();
    for (const [, m] of itemMeshes) scene.remove(m); itemMeshes.clear();
    for (const [, m] of projMeshes) scene.remove(m); projMeshes.clear();
    if (marsObj) { scene.remove(marsObj.g); marsObj = null; }
    fxList.forEach((f) => scene.remove(f.o)); fxList.length = 0;
    tileMeshes.forEach((m) => { m.visible = true; m.userData.gone = false; m.userData.top = undefined; m.rotation.set(0, 0, 0); m.position.y = -0.6; m.scale.y = 1; });
    curTheme = null; curMap = null; if (decoGroup) { scene.remove(decoGroup); decoGroup = null; } coverIdx = new Map();
    scene.children.forEach((o) => { if (o.name === 'island') o.visible = true; });
    { const sky = scene.getObjectByName('sky'); if (sky) { sky.material.uniforms.top.value.setHex(SKY_DEF.top); sky.material.uniforms.mid.value.setHex(SKY_DEF.mid); sky.material.uniforms.bot.value.setHex(SKY_DEF.bot); } }
    if (platGroup) platGroup.clear();
    cam.tx = undefined; cam.good = null; cam.cd = undefined;
  }
  function project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
  }
  function idle(dt, yaw) { // タイトル画面用の回転カメラ
    const t = clock.getElapsedTime();
    camera.position.set(Math.sin(t * 0.1) * 26, 12, Math.cos(t * 0.1) * 26);
    camera.lookAt(0, 0, 0);
    const clouds = scene.getObjectByName('clouds');
    clouds.children.forEach((c) => { c.position.x += c.userData.sp * dt; if (c.position.x > 160) c.position.x = -160; });
    renderer.render(scene, camera);
  }
  function previewChar(key) {
    // タイトル画面のアリーナに飾るキャラ
    for (const [, ch] of chars) scene.remove(ch.root); chars.clear();
    GD.CHAR_KEYS.forEach((k, i) => {
      const ch = buildChar(k); const a = (i / 8) * Math.PI * 2;
      ch.root.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5); ch.root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      ch.tag.visible = false; chars.set(-1 - i, ch);
    });
  }
  return { _render: () => renderer.render(scene, camera), _buildChar: (k) => buildChar(k), _itemMesh: (t) => itemMesh(t), init, update, thumbnails, mapPreview, applySettings, setHideTags: (v) => (hideTags = v), setMyId, clear, idle, project, previewChar, cam, get camera() { return camera; }, get scene() { return scene; }, get mars() { return marsObj; } };
})();
