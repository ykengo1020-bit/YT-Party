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
  function setTheme(g) {
    if (curTheme === g) return; curTheme = g;
    const th = themes[g] || themes.none;
    tileMeshes.forEach((m) => { m.material = [th.side, th.side, th.top, th.side, th.side, th.side]; m.userData.base = m.material; });
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
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
  function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.55, metalness: o.m ?? 0.0, emissive: o.e ?? 0x000000 }); }
  function buildChar(key) {
    const C = CHARS[key];
    const root = new THREE.Group();
    const inner = new THREE.Group(); root.add(inner);
    const bodyMat = std(C.color); const subMat = std(C.sub);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.72, 8, 18), bodyMat);
    body.position.y = 0.86; body.castShadow = true; inner.add(body);
    const ol = new THREE.Mesh(body.geometry, outlineMat); ol.scale.setScalar(1.06); body.add(ol);
    // おなか
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), std(new THREE.Color(C.color).lerp(new THREE.Color(0xffffff), 0.35)));
    belly.scale.set(1, 1.1, 0.5); belly.position.set(0, -0.15, 0.24); body.add(belly);
    // 目
    const eyeW = std(0xffffff, { r: 0.2 }), eyeB = std(0x111111, { r: 0.1, e: 0x000000 });
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), eyeW); e.position.set(0.16 * s, 0.38, 0.38); e.scale.z = 0.6; body.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeB); pu.position.set(0, 0, 0.08); e.add(pu); eyes.push(e);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12, Math.PI), eyeB); mouth.position.set(0, 0.2, 0.43); mouth.rotation.z = Math.PI; body.add(mouth);
    // 腕
    const arms = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.5 * s, 1.0, 0); inner.add(piv);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), bodyMat); a.position.y = -0.24; a.castShadow = true; piv.add(a);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), subMat); f.position.y = -0.5; f.castShadow = true; piv.add(f);
      arms.push({ piv, f });
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(0.2 * s, 0.34, 0); inner.add(piv);
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.14, 4, 8), subMat); l.position.y = -0.17; l.castShadow = true; piv.add(l);
      legs.push(piv);
    }
    // アクセサリー
    const acc = new THREE.Group(); body.add(acc);
    const black = std(0x111111);
    switch (C.acc) {
      case 'glasses':
        for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), black); r.position.set(0.16 * s, 0.38, 0.45); acc.add(r); }
        { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.025), black); b.position.set(0, 0.4, 0.46); acc.add(b); }
        break;
      case 'helmet': {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf97316, { r: 0.25, m: 0.3 })); h.position.y = 0.42; acc.add(h);
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.1), std(0x111827, { r: 0.1, m: 0.6 })); v.position.set(0, 0.56, 0.42); acc.add(v);
        break;
      }
      case 'headphones': {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.04, 6, 20, Math.PI), black); band.position.y = 0.4; acc.add(band);
        for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), std(0x10b981, { e: 0x064e3b })); c.rotation.z = Math.PI / 2; c.position.set(0.47 * s, 0.4, 0); acc.add(c); }
        break;
      }
      case 'bandana': {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 20), std(0xdc2626)); b.position.y = 0.55; acc.add(b);
        const k = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), std(0xdc2626)); k.position.set(0, 0.5, -0.5); k.rotation.x = -2.2; acc.add(k);
        break;
      }
      case 'cap': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), std(0x6d28d9)); c.position.y = 0.45; acc.add(c);
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.35), std(0x4c1d95)); br.position.set(0, 0.5, 0.5); acc.add(br);
        break;
      }
      case 'hardhat': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.49, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xfacc15, { r: 0.3 })); c.position.y = 0.45; acc.add(c);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 22), std(0xfacc15, { r: 0.3 })); br.position.y = 0.46; acc.add(br);
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), std(0xeab308)); ridge.position.y = 0.85; acc.add(ridge);
        break;
      }
      case 'hood': {
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0x1f2937)); hd.position.set(0, 0.32, -0.04); acc.add(hd);
        const sc = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), std(0x3f3f46)); sc.add(pole);
        const blade = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 4, 16, Math.PI * 0.8), std(0xdc2626, { m: 0.5, r: 0.3, e: 0x450a0a })); blade.position.set(0.35, 0.75, 0); sc.add(blade);
        sc.position.set(0, 0, -0.5); sc.rotation.z = 0.5; acc.add(sc);
        break;
      }
      case 'ribbon': {
        for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), std(0xec4899)); r.rotation.z = (Math.PI / 2) * s; r.position.set(0.16 * s, 0.72, 0); acc.add(r); }
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), std(0xbe185d)); k.position.y = 0.72; acc.add(k);
        break;
      }
    }
    // 頭の上の飾り（気絶の星など）
    const stars = new THREE.Group(); stars.position.y = 2.0; root.add(stars);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), std(0xfde047, { e: 0xfde047 })); stars.add(s); }
    stars.visible = false;
    // MT（メカ）
    const mt = new THREE.Group(); root.add(mt); mt.visible = false;
    { const g = std(0x64748b, { m: 0.6, r: 0.35 }); const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), g);
      for (const s of [-1, 1]) { const l = leg.clone(); l.position.set(0.45 * s, 0.45, 0); mt.add(l); }
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), g); torso.position.y = 1.3; mt.add(torso);
      const cock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.2), std(0x38bdf8, { e: 0x0c4a6e, m: 0.3, r: 0.1 })); cock.position.set(0, 1.45, 0.56); mt.add(cock);
      for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), g); a.position.set(0.95 * s, 1.15, 0.1); mt.add(a); }
    }
    // バイク
    const bike = new THREE.Group(); root.add(bike); bike.visible = false;
    { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), black); for (const z of [-0.6, 0.65]) { const w = wheel.clone(); w.rotation.y = Math.PI / 2; w.position.set(0, 0.3, z); bike.add(w); }
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.2), std(0xef4444, { m: 0.4, r: 0.3 })); fr.position.y = 0.55; bike.add(fr);
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), std(0x9ca3af, { m: 0.8 })); hb.rotation.z = Math.PI / 2; hb.position.set(0, 1.0, 0.55); bike.add(hb); }
    // ゲーミングチェア
    const chair = new THREE.Group(); root.add(chair); chair.visible = false;
    { const r = std(0xef4444), k = std(0x111111); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), k); seat.position.y = 0.45; chair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.15), r); back.position.set(0, 1.0, -0.4); chair.add(back);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), k); post.position.y = 0.2; chair.add(post); }
    // キャシー塚本（身代わり）
    const cathy = new THREE.Group(); root.add(cathy); cathy.visible = false;
    { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.4, 6, 12), std(0xfda4af, { r: 0.4, e: 0x4c0519 })); b.position.y = 0.5; cathy.add(b);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0x111111)); for (const s of [-1, 1]) { const ee = e.clone(); ee.position.set(0.1 * s, 0.7, 0.24); cathy.add(ee); }
      cathy.position.set(-1.0, 0, -0.6); }
    // ムキムキのG
    const gbug = new THREE.Group(); root.add(gbug); gbug.visible = false;
    { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), std(0x5b3417, { r: 0.2, m: 0.3 })); b.scale.set(1, 0.5, 1.5); gbug.add(b);
      for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), std(0x3b2010)); l.position.set((i % 2 ? 1 : -1) * 0.6, -0.2, (Math.floor(i / 2) - 1) * 0.5); l.rotation.z = (i % 2 ? 1 : -1) * 0.9; gbug.add(l); }
      gbug.position.y = 2.2; }
    // 持ちアイテム
    const hold = new THREE.Group(); arms[1].f.add(hold);
    // チャージ光
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    arms[1].f.add(glow);
    // 影の丸
    // 名札
    const tag = makeTag();
    tag.position.y = 2.45; root.add(tag);
    if (OPT.tagScale) { tag.scale.multiplyScalar(OPT.tagScale); tag.position.y = 2.6; }
    scene.add(root);
    return { root, inner, body, bodyMat, arms, legs, eyes, mouth, stars, mt, bike, chair, cathy, gbug, hold, holdType: null, glow, tag, tagStr: '', squash: 1, lastGr: 1, walk: 0, alpha: 1, ko: 0, key };
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
  function itemMesh(type) {
    const g = new THREE.Group();
    const I = ITEMS[type];
    const m = std(I.color, { m: 0.4, r: 0.35 });
    if (type === 'ar') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.8), m); g.add(b); const mg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.1), m); mg.position.set(0, -0.18, 0.1); g.add(mg); }
    else if (type === 'sr') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.2), m); g.add(b); const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), std(0x111111)); sc.rotation.x = Math.PI / 2; sc.position.y = 0.13; g.add(sc); }
    else if (type === 'sg') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.85), m); g.add(b); const st = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.3), std(0x92400e)); st.position.z = -0.45; g.add(st); }
    else if (type === 'monitor') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.06), m); g.add(s); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.4), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })); sc.position.z = 0.035; g.add(sc); }
    else if (type === 'lan') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), m); g.add(t); }
    else if (type === 'chair') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), std(0xef4444)); g.add(s); const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), std(0x111111)); b.position.set(0, -0.25, 0.2); g.add(b); }
    else if (type === 'energy') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 12), m); g.add(c); }
    else if (type === 'goreisan') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), m); g.add(b); }
    else if (type === 'detox') { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.04), m); g.add(p); }
    else { const u = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.36), std(I.color, { e: I.color, m: 0.2 })); g.add(u); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
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
    setTheme(s.g);
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
      if (f.life <= 0) { scene.remove(f.o); if (f.o.material && f.o.material.map && f.o.material.map !== flashTex) f.o.material.map.dispose(); fxList.splice(i, 1); }
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
    if (p.ld) { la = ra = -3.0; lz = rz = 0; }
    if (p.ch > 0.35) { if (p.ps) la = 0.8; else ra = 0.8; }
    if (p.pt > 0) { const k = Math.sin((1 - p.pt / 0.25) * Math.PI); if (p.ps) la = -1.57 * Math.max(k, 0.3) - 0.1; else ra = -1.57 * Math.max(k, 0.3) - 0.1; }
    if (p.it && GD.ITEMS[p.it].weapon && p.it !== 'monitor') { ra = -1.45; la = -1.3; lz = -0.5; }
    if (p.sn > 0) { la = -2.8 + Math.sin(now * 8) * 0.4; ra = -2.8 + Math.cos(now * 8) * 0.4; }
    if (p.gby) { la = -2.8 + Math.sin(now * 25) * 0.6; ra = -2.8 + Math.cos(now * 25) * 0.6; }
    L.piv.rotation.x += (la - L.piv.rotation.x) * Math.min(1, dt * 22); Rr.piv.rotation.x += (ra - Rr.piv.rotation.x) * Math.min(1, dt * 22);
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
    // 目（気絶・状態異常）
    const eyeS = p.sn > 0 || p.gby ? 0.2 : has('majigire') ? 0.55 : 1;
    ch.eyes.forEach((e) => { e.scale.y += (eyeS - e.scale.y) * 0.3; });
    // 色の演出
    const emi = ch.bodyMat.emissive;
    if (has('majigire')) emi.setRGB(0.35 + Math.sin(now * 10) * 0.15, 0, 0);
    else if (has('kyouki')) emi.setRGB(0.2, 0, 0.3 + Math.sin(now * 7) * 0.1);
    else if (has('gamechu')) emi.setRGB(0, 0.12, 0.04);
    else if (p.inv) emi.setRGB(0.3, 0.3, 0.3);
    else if (p.h >= 100) emi.setRGB(Math.min(0.4, 0.1 + p.h / 1000) + Math.sin(now * 12) * 0.1, 0.03, 0);
    else emi.setRGB(0, 0, 0);
    if (s.bo) emi.add(new THREE.Color(0.05, 0.05, 0.08));
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
    const bg = g.createLinearGradient(0, 0, 0, 220); bg.addColorStop(0, '#3b2a7a'); bg.addColorStop(1, '#f08a6a'); g.fillStyle = bg; g.fillRect(0, 0, 220, 220);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const h = M.tile(i, j); if (h === null) continue;
      const k = Math.min(1, h / 2.2);
      g.fillStyle = `rgb(${Math.round(95 + 90 * k)},${Math.round(200 - 10 * k)},${Math.round(150 - 60 * k)})`;
      g.fillRect(i * sz + 1.5, j * sz + 1.5, sz - 3, sz - 3);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(i * sz + 1.5, j * sz + sz - 5, sz - 3, 3.5);
    }
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
    curTheme = null;
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
  return { init, update, thumbnails, mapPreview, applySettings, setHideTags: (v) => (hideTags = v), setMyId, clear, idle, project, previewChar, cam, get camera() { return camera; }, get scene() { return scene; }, get mars() { return marsObj; } };
})();
