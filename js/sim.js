// ===== ゲームシミュレーション（ホスト／ソロで実行される権威側）=====
'use strict';
window.Sim = (function () {
  const { CHARS, STATUS, RANDOM_POOL, ITEMS, SPAWN_ITEMS, RES, GIMMICKS, T } = GD;
  const N = 11, TS = 2.6, HALF = (N * TS) / 2; // タイル数・サイズ
  const GRAV = -24, R = 0.45, H = 1.7, KILL_Y = -14, KB_MUL = 1.25;
  let rng = Math.random;
  const rnd = () => rng();
  const pick = (a) => a[(rnd() * a.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len2 = (x, z) => Math.sqrt(x * x + z * z);

  function emptyInput() {
    return { mx: 0, mz: 0, ay: 0, ap: 0, b: {}, c: {}, sel: 0, useHold: false, buy: null };
  }

  class Game {
    constructor(opts) {
      this.lives = opts.lives || 2;
      this.map = GD.MAPS[opts.map] ? opts.map : 'arena';
      this.teamMode = !!opts.teamMode; this.ff = !!opts.ff;
      // 出るアイテム（ロビーで選択）と出現量 0:なし 1:少なめ 2:普通 3:多め
      this.itemPool = (opts.items || SPAWN_ITEMS).filter((k) => SPAWN_ITEMS.includes(k));
      this.itemRate = opts.itemRate === undefined ? 2 : opts.itemRate;
      this.shopList = this.itemPool.concat('sst');
      this.t = 0; this.tick = 0;
      this.players = []; this.items = []; this.proj = []; this.boxes = [];
      this.fx = [];
      this.nextId = 1;
      this.over = false; this.result = null;
      this.gimmick = 'none'; this.gimmickT = 0; this.windDir = 0;
      this.phase = 'gimmick';
      this.eventT = 30; this.event = null; this.blackout = 0;
      this.mars = null; this.marsRepelled = false; this.curtain = false;
      this.itemT = 3; this.sstT = 0;
      this.banner = null;
      this.buildTiles();
      this.plats = (GD.MAPS[this.map].plats || []).map((q) => ({ ...q, bx: q.x, bz: q.z, dx: 0, dz: 0 }));
      this.setGimmick(pick(['wind', 'ice', 'conveyor', 'crumble', 'lagbridge', 'rack']));
    }

    // ---------- ステージ ----------
    buildTiles() {
      this.tiles = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const ring = Math.min(i, j, N - 1 - i, N - 1 - j);
        const base = GD.MAPS[this.map].tile(i, j);
        const none = base === null;
        this.tiles.push({
          i, j, ring, x: -HALF + TS * (i + 0.5), z: -HALF + TS * (j + 0.5),
          top: none ? 0 : base, base: none ? 0 : base, none, on: !none, gone: none, shake: 0, back: 0, blink: 0,
        });
      }
    }
    solids() {
      const out = [];
      for (const t of this.tiles) if (t.on && !t.gone) out.push({ x: t.x, z: t.z, w: TS / 2, d: TS / 2, top: t.top, bot: Math.min(t.top - 1.2, -1.2), tile: t });
      for (const b of this.boxes) out.push(b);
      return out;
    }
    setGimmick(g) {
      this.gimmick = g;
      for (const t of this.tiles) { t.top = t.base; if (!t.gone) t.on = true; t.shake = 0; t.blink = 0; }
      this.say('ギミック：' + GIMMICKS[g].name, '#7dd3fc');
    }
    updateStage(dt) {
      const g = this.gimmick;
      if (g === 'wind' && this.tick % 480 === 0) this.windDir = rnd() * Math.PI * 2;
      if (g === 'rack') for (const t of this.tiles) if (!t.gone) t.top = t.base + Math.max(0, Math.sin(this.t * 0.8 + t.i * 0.7 + t.j * 0.4)) * 1.4;
      if (g === 'crumble') {
        if (this.tick % 90 === 0) {
          const c = this.tiles.filter((t) => t.on && !t.gone && t.shake <= 0);
          if (c.length > 16) { const t = pick(c); t.shake = 1.2; }
        }
      }
      if (g === 'lagbridge') {
        if (this.tick % 240 === 0) for (const t of this.tiles) if (!t.gone && rnd() < 0.22) t.blink = 3.0;
      }
      for (const t of this.tiles) {
        if (t.gone) continue;
        if (t.shake > 0) { t.shake -= dt; if (t.shake <= 0) { t.on = false; t.back = 7; } }
        if (t.blink > 0) { t.blink -= dt; t.on = !(t.blink < 2 && t.blink > 0); if (t.blink <= 0) t.on = true; }
        if (!t.on && t.back > 0) { t.back -= dt; if (t.back <= 0) t.on = true; }
      }
      // ガチ乱闘期：外周が崩れる
      if (this.t >= T.GACHI) {
        const k = Math.floor((this.t - T.GACHI) / 30); // ring 0,1,2 を順に崩す
        for (const t of this.tiles) {
          if (t.ring < Math.min(k, 3) && !t.gone) { t.gone = true; t.on = false; this.emit({ k: 'crumble', x: t.x, z: t.z }); }
          else if (t.ring === Math.min(k, 3) && k < 3 && !t.gone) {
            const left = 30 - ((this.t - T.GACHI) % 30);
            t.warn = left < 4;
          }
        }
      }
      for (let i = this.boxes.length - 1; i >= 0; i--) { const b = this.boxes[i]; b.life -= dt; if (b.life <= 0) this.boxes.splice(i, 1); }
    }

    updatePlats(dt) {
      for (const q of this.plats) {
        if (!q.mv) { q.dx = q.dz = 0; continue; }
        const m = q.mv, a = this.t * m.sp + (m.ph || 0);
        const nx = m.circle ? q.bx + Math.cos(a) * m.r : q.bx + (m.ax || 0) * Math.sin(a) * m.r;
        const nz = m.circle ? q.bz + Math.sin(a) * m.r : q.bz + (m.az || 0) * Math.sin(a) * m.r;
        q.dx = nx - q.x; q.dz = nz - q.z; q.x = nx; q.z = nz;
      }
    }
    // 着地できる面（AIやアイテム用：タイル＋浮き床）
    surfaces() {
      const out = this.solids();
      for (const q of this.plats) out.push({ x: q.x, z: q.z, w: q.w, d: q.d, top: q.y, bot: q.y - 0.3, plat: true });
      return out;
    }

    // ---------- プレイヤー ----------
    addPlayer(o) {
      const c = CHARS[o.char];
      const p = {
        id: this.nextId++, name: o.name, char: o.char, bot: !!o.bot, cpu: o.cpu || 0, team: this.teamMode ? (o.team | 0) : -1,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, ground: false,
        hero: 0, stun: 0, hitstun: 0, lives: this.lives, tp: 3, tpT: 0, kills: 0, ticket: 0, ticketProg: 0,
        elim: false, respawn: 0, inv: 0, lastHit: null, lastHitT: -99,
        punchT: 0, punchSide: 0, punchCD: 0, holdPunch: 0, charging: 0, headT: 0, headCD: 0,
        grab: null, grabbedBy: null, grabT: 0, escape: 0, grabCD: 0, thrown: 0, lifted: false,
        ledge: null, ledgeCD: 0, ledgeT: 0, airJ: 1, dashT: 0, dashCD: 0, guard: false,
        st: {}, buffs: {}, perm: [0, 0, 0], cot: [0, 0, 0], kbuf: null,
        item: null, ammo: 0, srT: 0, fireCD: 0, useT: 0,
        spCD: 0, rhythm: [], rhythmCD: 0, voice: false, positive: false, cathy: null, mtHP: 0,
        ctrl: null, ctrlBy: null, minion: false, crouchT: 0, chewT: 0,
        hist: [], posHist: [], lastC: {}, input: emptyInput(),
        timers: { pas: 20, yu: 45, g5: 10, lag: 4, chew: 4 },
        hitBy: {}, ai: { t: 0 }, onPlat: -1, dropT: 0, nextStun: 100,
      };
      this.players.push(p);
      return p;
    }
    start() {
      const n = this.players.length;
      const cand = this.tiles.filter((t) => !t.none && t.ring >= 1);
      const used = new Set();
      const order = this.players.slice().sort((a, b) => a.team - b.team);
      order.forEach((p, k) => {
        const a = (k / n) * Math.PI * 2, gx = Math.cos(a) * 7, gz = Math.sin(a) * 7;
        let best = null, bd = 1e9;
        for (const t of cand) { if (used.has(t)) continue; const d = len2(t.x - gx, t.z - gz); if (d < bd) { bd = d; best = t; } }
        used.add(best);
        p.x = best.x; p.z = best.z; p.y = best.top + 0.5; p.yaw = Math.atan2(-p.x, -p.z);
      });
      this.say('ファイト！', '#fde047');
      this.emit({ k: 'sfx', n: 'start' });
    }
    stat(p, k) { // 0 power,1 speed,2 weight
      let v = CHARS[p.char].stats[k] + p.perm[k] + p.cot[k];
      if (p.buffs.ken && p.buffs.ken.k === k) v += 1;
      if (p.buffs.mt) v += [1, -1, 2][k];
      if (p.minion) v = 1;
      return clamp(v, 1, 8);
    }
    has(p, s) { return p.st[s] && p.st[s].t > 0; }
    powerMul(p) {
      let m = 0.7 + 0.15 * this.stat(p, 0);
      if (this.has(p, 'majigire')) m *= 1.5;
      if (this.has(p, 'hiroyuki')) m *= 0.7;
      return m;
    }
    weightDiv(p) { return 0.7 + 0.15 * this.stat(p, 2); }
    canAct(p) { return !p.elim && p.respawn <= 0 && p.stun <= 0 && p.hitstun <= 0 && !p.grabbedBy && p.thrown <= 0 && !this.has(p, 'naeochi') && p.crouchT <= 0 && !p.ctrl && !p.bound; }
    disabled(p, a) { return this.has(p, 'keyboard') && p.st.keyboard.dis === a; }

    applyStatus(p, key, chance = 1, opt = {}) {
      if (p === 'mars') return;
      if (!p || p.elim) return false;
      if (!opt.force) {
        if (p.char === 'wikitto' && !opt.food) return false;
        if (p.minion) return false;
        if (p.buffs.detox) return false;
        if (key === 'gamechu' && p.char === 'hiro') return false;
        let f = RES[CHARS[p.char].res];
        if (CHARS[p.char].weak.includes(key)) f = Math.min(1, f + 0.15);
        if (p.cathy && p.cathy.n > 0) { this.cathyAbsorb(p); return false; }
        if (rnd() > chance * f) return false;
      }
      const d = STATUS[key];
      const cur = p.st[key];
      if (cur && cur.t > 0) { cur.lv = Math.min(3, cur.lv + 1); cur.t = (opt.dur || d.dur) + 5 * (cur.lv - 1); }
      else p.st[key] = { t: opt.dur || d.dur, lv: 1 };
      if (key === 'takawarai') p.stun = Math.max(p.stun, 2);
      if (key === 'naeochi') p.tp = Math.max(0, p.tp - 2);
      if (key === 'keyboard') p.st.keyboard.dis = pick(['punch', 'grab', 'jump', 'dash']);
      if (key === 'kyouki' && !p.st.kyouki.dis) p.st.kyouki.ph = rnd() * 3;
      this.emit({ k: 'txt', id: p.id, s: d.name + '！', c: d.color });
      this.emit({ k: 'sfx', n: 'status' });
      return true;
    }
    statusMars(chance) {
      if (!this.mars || this.mars.repel) return;
      if (rnd() < chance * 0.45) {
        this.mars.sc++;
        this.emit({ k: 'txt', mars: 1, s: '状態異常 ' + this.mars.sc + '/7', c: '#c084fc' });
        if (this.mars.sc >= 7 && !this.mars.true) this.marsDefeated();
      }
    }
    cathyAbsorb(p) {
      p.cathy.n--;
      this.emit({ k: 'txt', id: p.id, s: 'キャシー塚本が身代わり！', c: '#fda4af' });
      this.emit({ k: 'hit', x: p.x, y: p.y + 1, z: p.z, p: 0.5 });
      if (p.cathy.n <= 0) { p.cathy = null; this.emit({ k: 'txt', id: p.id, s: 'キャシー塚本 消滅', c: '#9ca3af' }); }
    }

    // 攻撃ヒット
    hit(t, a, heroAdd, kb, dx, dz, up = 0.35, o = {}) {
      if (!t || t.elim || t.respawn > 0) return false;
      if (t.inv > 0 && !o.force) return false;
      if (a && a.id === t.id) return false;
      if (a && a.minion && t.minion) return false;
      if (this.ally(a, t)) return false;
      if (a && this.has(a, 'tapioka') && t.char === 'wikitto') { this.emit({ k: 'txt', id: a.id, s: '無垢すぎて殴れない…', c: '#f9a8d4' }); return false; }
      const L = len2(dx, dz) || 1; dx /= L; dz /= L;
      if (t.cathy && t.cathy.n > 0 && !o.noCathy) { this.cathyAbsorb(t); return true; }
      // ガード
      if (t.guard && !o.unblock && a) {
        const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
        if (fx * -dx + fz * -dz > 0.3) {
          heroAdd *= 0.15; kb *= 0.3;
          this.emit({ k: 'guard', x: t.x, y: t.y + 1, z: t.z });
        }
      }
      if (t.buffs.rhythmrev) { heroAdd = 0; kb *= 0.35; }
      if (t.buffs.mt) { t.mtHP -= heroAdd; heroAdd *= 0.5; if (t.mtHP <= 0) { delete t.buffs.mt; this.emit({ k: 'txt', id: t.id, s: 'MT大破！', c: '#f87171' }); this.emit({ k: 'boom', x: t.x, y: t.y + 1, z: t.z }); } }
      if (t.ledge) { t.ledge = null; t.ledgeCD = 0.6; }
      if (t.grab) this.release(t, false);
      t.hero = clamp(t.hero + heroAdd, 0, 999);
      // スマブラ風：ヘロヘロ値が高いほど青天井で吹っ飛ぶ
      const k = Math.min(70, (kb * KB_MUL * (0.75 + t.hero / 48)) / this.weightDiv(t));
      const upk = k > 12 ? Math.max(up, 0.42) : up;
      t.vx = t.vx * 0.3 + dx * k; t.vz = t.vz * 0.3 + dz * k; t.vy = Math.max(t.vy, 0) * 0.3 + k * upk + (k > 4 ? 2 : 0);
      t.ground = false; t.onPlat = -1;
      t.hitstun = Math.max(t.hitstun, 0.1 + Math.min(0.7, k * 0.018));
      if (k > 18) this.emit({ k: 'smash', id: t.id, x: t.x, y: t.y + 1, z: t.z, p: k });
      if (a) { t.lastHit = a.id; t.lastHitT = this.t; }
      this.emit({ k: 'hit', x: t.x, y: t.y + 1.1, z: t.z, p: Math.min(2, k / 8), id: t.id });
      // 100%, 150%, 200%… のラインを超えるたびに短く気絶
      if (t.hero >= (t.nextStun || 100) && t.stun <= 0) {
        t.nextStun = Math.floor(t.hero / 50) * 50 + 50;
        t.stun = 1.3;
        this.emit({ k: 'txt', id: t.id, s: '気絶！', c: '#fde047' }); this.emit({ k: 'sfx', n: 'stun' });
      }
      // ヒロユキ構文：反論カウンター
      if (a && this.has(t, 'hiroyuki') && !o.counter) {
        this.emit({ k: 'txt', id: t.id, s: '論破！', c: '#ffd23b' });
        this.hit(a, t, 6, 7, -dx, -dz, 0.3, { counter: true });
      }
      return true;
    }

    targetsInFront(p, range, cos, extra = 0) {
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), out = [];
      for (const q of this.players) {
        if (q === p || q.elim || q.respawn > 0) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = len2(dx, dz);
        if (d > range + R + extra || Math.abs(q.y - p.y) > 1.6) continue;
        if (d > 0.01 && (dx * fx + dz * fz) / d < cos) continue;
        out.push(q);
      }
      return out;
    }
    marsInFront(p, range) {
      const m = this.mars; if (!m || m.repel || m.gone) return false;
      const dx = m.x - p.x, dz = m.z - p.z, d = len2(dx, dz);
      return d < range + 2.4 && p.y < 7;
    }
    damageMars(p, dmg) {
      const m = this.mars; if (!m) return;
      if (dmg === 'monitor') {
        this.emit({ k: 'txt', mars: 1, s: '惑星の威厳：モニターパンチ無効！', c: '#fca5a5' });
        if (rnd() < 0.5 && p) { p.detoxSeal = true; this.emit({ k: 'txt', id: p.id, s: 'デジタルデトックス封印', c: '#9ca3af' }); }
        return;
      }
      m.hp -= dmg * 0.25; m.flash = 0.15;
      this.emit({ k: 'hit', x: m.x + (p ? (p.x - m.x) * 0.5 : 0), y: 3, z: m.z + (p ? (p.z - m.z) * 0.5 : 0), p: 1 });
      if (m.hp <= 0) {
        if (m.true) { m.down = 5; m.hp = 0; this.emit({ k: 'txt', mars: 1, s: '何度でも蘇るさ', c: '#f87171' }); }
        else this.marsDefeated();
      }
    }

    aimTarget(p, maxD = 40) {
      let best = null, bs = -9;
      const fx = Math.sin(p.input.ay), fz = Math.cos(p.input.ay);
      for (const q of this.players) {
        if (q === p || q.elim || q.respawn > 0 || this.ally(p, q)) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = len2(dx, dz);
        if (d > maxD) continue;
        const s = (dx * fx + dz * fz) / (d || 1) - d * 0.004;
        if (s > bs) { bs = s; best = q; }
      }
      return best;
    }
    // チーム戦で味方どうしか（フレンドリーファイアありなら常にfalse）
    ally(a, b) { return !!(a && b && a !== b && this.teamMode && !this.ff && a.team >= 0 && a.team === b.team && !a.minion && !b.minion); }
    others(p) { return this.players.filter((q) => q !== p && !q.elim && q.respawn <= 0 && !this.ally(p, q)); }

    // ---------- 掴み ----------
    release(p, throwIt) {
      const t = this.players.find((q) => q.id === p.grab);
      p.grab = null; p.grabCD = 1.1;
      if (!t) return;
      t.grabbedBy = null; t.escape = 0;
      if (throwIt) {
        let pw = (4 + (p.grabT > 0.5 ? 2 : 0)) * this.powerMul(p);
        if (this.has(p, 'kyouki')) pw *= 2;
        const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        t.inv = 0;
        this.hit(t, p, 8, pw, fx, fz, 0.5, { unblock: true, noCathy: false });
        t.thrown = 0.3;
        p.tp = Math.min(30, p.tp + 1);
        this.emit({ k: 'sfx', n: 'throw' });
      } else { t.vx += Math.sin(p.yaw) * 2; t.vz += Math.cos(p.yaw) * 2; }
    }

    // ---------- スキル ----------
    useSkill(p, idx) {
      const sk = CHARS[p.char].skills[idx];
      if (!sk || p.tp < sk.tp) { this.emit({ k: 'deny', id: p.id }); return; }
      if (sk.id === 'positive' && p.positive) { this.emit({ k: 'txt', id: p.id, s: 'もう使った', c: '#9ca3af' }); return; }
      p.tp -= sk.tp;
      this.emit({ k: 'skill', id: p.id, s: sk.name, c: '#' + CHARS[p.char].color.toString(16).padStart(6, '0') });
      this.emit({ k: 'sfx', n: 'skill' });
      const O = this.others(p);
      const all = (fn) => O.forEach(fn);
      switch (sk.id) {
        case 'modifier': all((q) => this.applyStatus(q, pick(RANDOM_POOL))); this.statusMars(1); break;
        case 'surume': this.applyStatus(p, 'hagotae', 1, { force: true }); break;
        case 'kirinuki': this.applyStatus(p, 'hiroyuki', 1, { force: true }); break;
        case 'kichige':
          this.emit({ k: 'wave', x: p.x, y: p.y, z: p.z, r: 10, c: 0xff4444 });
          all((q) => { const dx = q.x - p.x, dz = q.z - p.z; if (len2(dx, dz) < 10) this.hit(q, p, 20, 6, dx, dz, 0.5, { unblock: true }); q.tp = Math.max(0, q.tp - 2); });
          if (this.marsInFront(p, 10)) this.damageMars(p, 3);
          this.applyStatus(p, 'majigire', 1, { force: true, dur: 30 });
          break;
        case 'subaka': p.cathy = { n: 2, t: 40, save: 1 }; this.emit({ k: 'txt', id: p.id, s: 'キャシー塚本 召喚！', c: '#fda4af' }); break;
        case 'soundboard': all((q) => { const c = q.char === 'nimo' ? 1 : 0.7; if (rnd() < c) { this.applyStatus(q, 'lag', q.char === 'nimo' ? 1 : 1); this.applyStatus(q, 'nanchou'); } }); this.statusMars(0.7); break;
        case 'role': { const q = this.aimTarget(p); if (q) this.applyStatus(q, RANDOM_POOL[p.input.sel % RANDOM_POOL.length]); else this.statusMars(1); break; }
        case 'chudoku': this.players.forEach((q) => !q.elim && !this.ally(p, q) && this.applyStatus(q, 'gamechu', 0.8)); this.statusMars(0.8); break;
        case 'rasher': this.applyStatus(p, 'musicbot', 1, { force: true }); break;
        case 'rhythmrev': p.buffs.rhythmrev = 40; break;
        case 'goreisan': p.st = {}; this.emit({ k: 'txt', id: p.id, s: 'スッキリ！', c: '#86efac' }); break;
        case 'mousou':
          if (rnd() < 0.75) { p.buffs.tpx2 = 60; p.buffs.ken = { k: 0, t: 60 }; this.emit({ k: 'txt', id: p.id, s: '楽しい妄想！TP2倍＆パワーUP', c: '#fbcfe8' }); }
          else { if (p.tp >= 3) p.tp -= 3; else { p.tp = 0; p.hero = clamp(p.hero + 40, 0, 999); } this.emit({ k: 'txt', id: p.id, s: '嫌な事を思い出した…', c: '#94a3b8' }); }
          break;
        case 'rinri': this.applyStatus(p, 'kyouki', 1, { force: true }); break;
        case 'mic':
          this.emit({ k: 'wave', x: p.x, y: p.y, z: p.z, r: 5, c: 0xc4b5fd });
          all((q) => { this.applyStatus(q, 'nanchou'); const dx = q.x - p.x, dz = q.z - p.z; if (len2(dx, dz) < 5) this.hit(q, p, 5, 6, dx, dz, 0.3); });
          this.statusMars(1); break;
        case 'sniper':
          all((q) => {
            if (q.char !== 'wikitto') this.applyStatus(q, 'majigire', 0.8);
            if (rnd() < 0.01) { this.emit({ k: 'txt', id: q.id, s: 'ヘッドショット！！', c: '#f43f5e' }); q.lives = 1; q.lastHit = p.id; q.lastHitT = this.t; q.vy = 40; q.vx = (rnd() - 0.5) * 30; q.vz = (rnd() - 0.5) * 30; q.hitstun = 3; }
          });
          this.statusMars(0.8); break;
        case 'fish':
          all((q) => { if (rnd() < 0.4) { const a = rnd() * 6.28; q.vy = 0; this.hit(q, p, 35, 6, Math.cos(a), Math.sin(a), 1.1, { unblock: true }); this.emit({ k: 'txt', id: q.id, s: '釣られた！', c: '#38bdf8' }); } });
          break;
        case 'tenjou': {
          const q = this.aimTarget(p);
          if (!q) break;
          const st = Object.keys(q.st).filter((k) => q.st[k].t > 0);
          if (st.length || rnd() < 0.3) {
            q.ctrlBy = p.id; p.ctrl = { id: q.id, t: 5, had: st.length ? pick(st) : null };
            this.emit({ k: 'txt', id: q.id, s: '操作を乗っ取られた！', c: '#a78bfa' });
          } else this.emit({ k: 'txt', id: p.id, s: '失敗…', c: '#9ca3af' });
          break;
        }
        case 'build': {
          const fx = p.x, fz = p.z, fy = p.y;
          const life = 25;
          this.boxes.push({ x: fx, z: fz, w: 1.4, d: 1.4, top: fy - 0.05, bot: fy - 0.6, life, kind: 'build' });
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + p.yaw;
            const cx = fx + Math.sin(a) * 2.2, cz = fz + Math.cos(a) * 2.2;
            const along = Math.abs(Math.sin(a)) > 0.7;
            this.boxes.push({ x: cx, z: cz, w: along ? 0.3 : 1.2, d: along ? 1.2 : 0.3, top: fy + 1.0, bot: fy - 0.6, life, kind: 'build' });
          }
          if (rnd() < 0.6) { p.hero = Math.max(0, p.hero - 25); p.tp = Math.min(30, p.tp + 3); this.emit({ k: 'txt', id: p.id, s: '建築完了！ヘロヘロ-25% TP+3', c: '#fde047' }); }
          else {
            const who = pick(this.players.filter((q) => q !== p)) || p;
            this.emit({ k: 'txt', id: p.id, s: CHARS[who.char].name + 'に爆破された！', c: '#f97316' });
            this.emit({ k: 'boom', x: fx, y: fy + 1, z: fz });
            this.boxes = this.boxes.filter((b) => b.kind !== 'build' || len2(b.x - fx, b.z - fz) > 3);
            this.applyStatus(p, pick(['naeochi', 'keyboard', 'kyouki']), 1, { force: true });
          }
          break;
        }
        case 'edit':
          if (rnd() < 2 / 3) { all((q) => this.hit(q, p, 18, 2.2, q.x - p.x, q.z - p.z, 0.3, { unblock: true })); if (this.mars) this.damageMars(p, 3); }
          else { p.hero = clamp(p.hero + 20, 0, 999); this.emit({ k: 'txt', id: p.id, s: '撮影データが消し飛んだ', c: '#9ca3af' }); }
          break;
        case 'snipe': {
          const q = this.aimTarget(p);
          if (q) { this.emit({ k: 'beam', a: [p.x, p.y + 1.3, p.z], b: [q.x, q.y + 1, q.z], c: 0xff2244 }); this.hit(q, p, 40, 9, q.x - p.x, q.z - p.z, 0.45, { unblock: true }); if (q.char !== 'wikitto') this.applyStatus(q, 'majigire'); }
          else if (this.mars) this.damageMars(p, 6);
          break;
        }
        case 'mt': p.buffs.mt = 20; p.mtHP = 60; this.emit({ k: 'txt', id: p.id, s: 'MT搭乗！', c: '#94a3b8' }); break;
        case 'sherpa': p.hero = Math.max(0, p.hero - 35); p.buffs.tpx2 = 40; this.emit({ k: 'txt', id: p.id, s: '補給完了！', c: '#86efac' }); break;
        case 'muku': { const q = this.aimTarget(p); if (q) this.applyStatus(q, 'tapioka', 1, { dur: 8 }); break; }
        case 'positive': p.positive = true; p.perm = p.perm.map((v) => v + 1); this.emit({ k: 'txt', id: p.id, s: '全ステータスUP！', c: '#fde047' }); break;
      }
    }

    special(p) {
      const sp = CHARS[p.char].passive.special;
      if (!sp || sp === 'rhythm') return;
      if (p.spCD > 0) { this.emit({ k: 'deny', id: p.id }); return; }
      if (sp === 'bike') { p.buffs.bike = 6; p.spCD = 70; this.emit({ k: 'txt', id: p.id, s: 'バイク召喚！', c: '#fb923c' }); this.emit({ k: 'sfx', n: 'bike' }); }
      if (sp === 'weapon') { if (p.item) this.dropItem(p); const w = ['ar', 'sr', 'sg'][p.input.sel % 3]; this.giveItem(p, w); p.spCD = 55; }
      if (sp === 'scythe') {
        const ay = p.input.ay, ap = clamp(p.input.ap, -0.4, 1.2);
        const s = 19;
        p.vx = Math.sin(ay) * Math.cos(ap) * s; p.vz = Math.cos(ay) * Math.cos(ap) * s; p.vy = Math.sin(ap) * s + 4;
        p.yaw = ay; p.ledge = null; p.dashT = 0.3; p.spCD = 90; p.scy = 0.4;
        this.emit({ k: 'txt', id: p.id, s: '大鎌！', c: '#ef4444' }); this.emit({ k: 'sfx', n: 'dash' });
      }
    }

    // ---------- アイテム ----------
    giveItem(p, type) {
      p.item = type; p.ammo = ITEMS[type].ammo || 1;
      this.emit({ k: 'txt', id: p.id, s: ITEMS[type].name + ' ゲット', c: '#e5e7eb' });
      this.emit({ k: 'sfx', n: 'pickup' });
    }
    dropItem(p) {
      if (!p.item) return;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      this.proj.push({ id: this.nextId++, k: 'item', type: p.item, ammo: p.ammo, x: p.x + fx, y: p.y + 1.3, z: p.z + fz, vx: fx * 14 + p.vx * 0.5, vy: 3, vz: fz * 14 + p.vz * 0.5, own: p.id, life: 3 });
      p.item = null; p.ammo = 0;
    }
    spawnItem(type) {
      const c = this.tiles.filter((t) => t.on && !t.gone);
      if (!c.length) return;
      const t = pick(c);
      this.items.push({ id: this.nextId++, type, x: t.x + (rnd() - 0.5), y: t.top + 4, z: t.z + (rnd() - 0.5), vy: 0 });
    }
    useItem(p) {
      const it = p.item; if (!it) return;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      switch (it) {
        case 'detox': if (p.detoxSeal) { this.emit({ k: 'txt', id: p.id, s: '封印されている！', c: '#9ca3af' }); return; } p.st = {}; p.buffs.detox = 10; this.emit({ k: 'txt', id: p.id, s: 'デトックス！', c: '#86efac' }); break;
        case 'goreisan': p.st = {}; this.emit({ k: 'txt', id: p.id, s: '五苓散！', c: '#fef3c7' }); break;
        case 'energy': p.buffs.energy = 15; p.buffs.shake = 3; this.emit({ k: 'txt', id: p.id, s: 'エナドリ！', c: '#a3e635' }); break;
        case 'chair': p.buffs.chair = 3; this.emit({ k: 'txt', id: p.id, s: 'ゲーミングチェア突進！', c: '#ef4444' }); break;
        case 'lan': this.proj.push({ id: this.nextId++, k: 'lan', x: p.x + fx, y: p.y + 1.3, z: p.z + fz, vx: fx * 18, vy: 2.5, vz: fz * 18, own: p.id, life: 2 }); break;
        case 'sst': case 'sst2': {
          if (!this.mars || this.mars.repel) { this.emit({ k: 'txt', id: p.id, s: 'Marsがいない', c: '#9ca3af' }); return; }
          if (this.mars.true) { this.emit({ k: 'txt', id: p.id, s: 'Mars（真）には効かない！', c: '#f87171' }); return; }
          const ok = it === 'sst2' || rnd() < 0.3;
          this.emit({ k: 'beam', a: [p.x, p.y + 1.3, p.z], b: [this.mars.x, 4, this.mars.z], c: it === 'sst2' ? 0xf43f5e : 0x22d3ee });
          if (ok) this.marsRepel(p); else this.emit({ k: 'txt', id: p.id, s: 'SST 失敗…', c: '#9ca3af' });
          break;
        }
        default: return; // 武器はクリックで使う
      }
      p.item = null; p.ammo = 0;
    }
    fireWeapon(p, kind) {
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const sx = p.x, sy = p.y + 1.25, sz = p.z;
      const ray = (maxD, rad) => {
        let best = null, bd = maxD;
        for (const q of this.players) {
          if (q === p || q.elim || q.respawn > 0) continue;
          const dx = q.x - sx, dz = q.z - sz, along = dx * fx + dz * fz;
          if (along < 0 || along > bd) continue;
          const perp = Math.abs(dx * fz - dz * fx);
          if (perp < rad && Math.abs(q.y + 0.9 - sy) < 1.4) { bd = along; best = q; }
        }
        let mars = false;
        if (this.mars && !this.mars.repel) {
          const dx = this.mars.x - sx, dz = this.mars.z - sz, along = dx * fx + dz * fz, perp = Math.abs(dx * fz - dz * fx);
          if (along > 0 && along < bd && perp < 2.4) { mars = true; bd = along; best = null; }
        }
        return { q: best, d: bd, mars };
      };
      if (kind === 'ar') {
        const r = ray(28, 0.6); const e = [sx + fx * r.d, sy, sz + fz * r.d];
        this.emit({ k: 'beam', a: [sx + fx * 0.6, sy, sz + fz * 0.6], b: e, c: 0xfde68a, thin: 1 });
        if (r.q) this.hit(r.q, p, 1.8, 1.5, fx, fz, 0.15);
        if (r.mars) this.damageMars(p, 0.5);
        this.emit({ k: 'sfx', n: 'ar' });
      } else if (kind === 'sr') {
        const r = ray(60, 0.5); const e = [sx + fx * r.d, sy, sz + fz * r.d];
        this.emit({ k: 'beam', a: [sx + fx * 0.6, sy, sz + fz * 0.6], b: e, c: 0x93c5fd });
        if (r.q) this.hit(r.q, p, 35, 10, fx, fz, 0.4, { unblock: true });
        if (r.mars) this.damageMars(p, 5);
        this.emit({ k: 'sfx', n: 'sr' });
      } else if (kind === 'sg') {
        for (const q of this.players) {
          if (q === p || q.elim) continue;
          const dx = q.x - sx, dz = q.z - sz, d = len2(dx, dz);
          if (d < 6.5 && (dx * fx + dz * fz) / (d || 1) > 0.8 && Math.abs(q.y - p.y) < 2) this.hit(q, p, 25, 7 * (1 - d / 6.5) + 3, dx, dz, 0.4, { unblock: true });
        }
        if (this.marsInFront(p, 6)) this.damageMars(p, 3);
        this.emit({ k: 'blast', x: sx + fx, y: sy, z: sz + fz, yaw: p.yaw });
        this.emit({ k: 'sfx', n: 'sg' });
      }
      p.ammo--;
      if (p.ammo <= 0) { p.item = null; }
    }

    // ---------- 撃墜 ----------
    ringOut(p) {
      if (p.elim || p.respawn > 0) return;
      if (p.grab) this.release(p, false);
      if (p.grabbedBy) { const g = this.players.find((q) => q.id === p.grabbedBy); if (g) g.grab = null; p.grabbedBy = null; }
      if (p.ctrlBy) { const g = this.players.find((q) => q.id === p.ctrlBy); if (g) g.ctrl = null; p.ctrlBy = null; }
      this.emit({ k: 'ko', id: p.id, x: p.x, y: Math.max(p.y, -8), z: p.z });
      this.emit({ k: 'sfx', n: 'ko' });
      const killer = this.t - p.lastHitT < 8 ? this.players.find((q) => q.id === p.lastHit) : null;
      if (killer && killer !== p && !killer.elim && !this.ally(killer, p)) {
        killer.kills++; killer.tp = Math.min(30, killer.tp + 2); killer.ticketProg++;
        if (killer.ticketProg >= 3) { killer.ticketProg = 0; killer.ticket++; this.emit({ k: 'txt', id: killer.id, s: 'アイテム交換券ゲット！[T]', c: '#fbbf24' }); }
      }
      if (p.item && ITEMS[p.item].cookie) { this.items.push({ id: this.nextId++, type: p.item, x: 0, y: 6, z: 3, vy: 0 }); }
      p.item = null; p.ammo = 0;
      if (p.minion) { p.elim = true; p.minion = false; return; }
      p.lives--;
      let keepHero = -1;
      if (p.lives <= 0 && p.char === 'wikitto' && !p.voice && p.tp >= 10) {
        p.voice = true; p.tp -= 10; p.lives = 1; keepHero = Math.min(999, Math.max(80, p.hero + 70));
        this.emit({ k: 'txt', id: p.id, s: 'きれいな声で持ちこたえた！', c: '#f9a8d4' });
      }
      p.hero = keepHero > 0 ? keepHero : 0; p.nextStun = keepHero > 0 ? Math.floor(keepHero / 50) * 50 + 50 : 100; p.stun = 0; p.st = {}; p.buffs = {}; p.cot = [0, 0, 0]; p.cathy = null; p.ledge = null; p.ctrl = null;
      p.vx = p.vy = p.vz = 0;
      if (p.lives <= 0) {
        p.elim = true; p.lives = 0;
        this.say(CHARS[p.char].name + '（' + p.name + '） 脱落！', '#f87171');
      } else p.respawn = 3;
    }
    doRespawn(p) {
      const c = this.tiles.filter((t) => t.on && !t.gone && t.ring >= 1);
      const t = c.length ? pick(c) : { x: 0, z: 0, top: 0 };
      p.x = t.x; p.z = t.z; p.y = t.top + 7; p.vx = p.vy = p.vz = 0;
      p.inv = this.t >= T.GACHI ? 0 : 2;
      this.emit({ k: 'txt', id: p.id, s: '復帰！', c: '#a7f3d0' });
    }

    // ---------- Mars ----------
    spawnMars(isTrue) {
      this.mars = { x: 0, z: 0, hp: 90, max: 90, sc: 0, t0: this.t, atk: 4, roll: 20, oshimai: 0.1, edo: false, true: !!isTrue, flash: 0, down: 0, repel: false, slam: 0 };
      this.players.forEach((p) => { if (!p.elim) p.lives = this.lives; });
      for (const t of this.tiles) if (t.ring >= 4) { if (t.none || t.gone) this.emit({ k: 'crumble', x: t.x, z: t.z }); t.none = false; t.gone = false; t.on = true; t.base = 0; t.top = 0; t.shake = 0; t.blink = 0; }
      this.say(isTrue ? 'Mars（真）「は！や！く！終わらせろやァ！！！」' : 'Mars襲来「お前ら遅すぎやねん！！！ﾊﾖ終われ！」', '#f87171');
      this.emit({ k: 'sfx', n: 'mars' });
      this.sstT = 5;
    }
    marsDefeated() {
      const win = this.players.filter((p) => !p.elim && !p.minion);
      this.emit({ k: 'boom', x: 0, y: 4, z: 0, big: 1 });
      this.finish({ type: 'mars', winners: win.map((p) => p.id), text: 'Marsを撃退！生き残った全員の勝利！' });
    }
    marsRepel(p) {
      this.mars.repel = true;
      this.emit({ k: 'boom', x: this.mars.x, y: 4, z: this.mars.z, big: 1 });
      this.say((p ? CHARS[p.char].name : '') + 'がクッキー☆アイテムでMarsを撃退！ゲームは続く…', '#22d3ee');
      this.marsRepelled = true;
      setTimeout(() => {}, 0);
      this.mars = null;
      this.players.forEach((q) => { if (q.minion) { q.elim = true; q.minion = false; } });
    }
    updateMars(dt) {
      const m = this.mars; if (!m) return;
      m.flash = Math.max(0, m.flash - dt);
      if (m.down > 0) { m.down -= dt; if (m.down <= 0) m.hp = m.max; return; }
      // 叩きつけ
      m.atk -= dt;
      if (m.atk <= 0) {
        m.atk = m.true ? 2.6 : 3.6; m.slam = 0.6;
        this.emit({ k: 'wave', x: m.x, y: 0, z: m.z, r: 7.5, c: 0xff5533 });
        this.emit({ k: 'sfx', n: 'slam' });
        for (const p of this.players) {
          if (p.elim || p.minion || p.respawn > 0) continue;
          const dx = p.x - m.x, dz = p.z - m.z, d = len2(dx, dz);
          if (d < 7.5 && p.y < 2.5) this.hit(p, null, m.true ? 22 : 15, m.true ? 12 : 9, dx, dz, 0.6, { unblock: true });
        }
      }
      m.slam = Math.max(0, m.slam - dt);
      // 20秒ごとの抽選
      m.roll -= dt;
      if (m.roll <= 0) {
        m.roll = 20;
        const alive = this.players.filter((p) => !p.elim && !p.minion && p.respawn <= 0);
        if (rnd() < 0.1 && alive.length) {
          const v = pick(alive); v.stun = Math.max(v.stun, 30); v.gBug = 30; v.gFree = 0;
          this.say('テラフォーマー：ムキムキのGが' + CHARS[v.char].name + 'を担いだ！（殴って助けろ）', '#a16207');
        }
        if (rnd() < 0.1 && rnd() < 0.5) {
          for (let k = 0; k < 2 && alive.length; k++) {
            const v = alive.splice((rnd() * alive.length) | 0, 1)[0];
            this.emit({ k: 'meteor', x: v.x, z: v.z });
            setTimeout(() => {}, 0);
            v.meteor = 1.2;
          }
          this.say('隕石[イトカワ]投下！', '#f97316');
        }
        if (rnd() < 0.05) {
          this.say('流星群！！', '#fb7185');
          for (const p of this.players) if (!p.elim && !p.minion) { p.meteor = 0.8 + rnd() * 1.5; p.shower = 1; this.emit({ k: 'meteor', x: p.x, z: p.z }); }
        }
        if (!m.edo && rnd() < 0.1) {
          const dead = this.players.filter((p) => p.elim);
          if (dead.length) {
            m.edo = true;
            dead.forEach((p) => { p.elim = false; p.minion = true; p.lives = 1; p.respawn = 0.5; p.st = {}; p.hero = 0; });
            this.say('穢土転生：脱落者がMarsの手下として復活！', '#a855f7');
          }
        }
        if (!m.true && this.t - m.t0 >= 180) {
          if (rnd() < m.oshimai) {
            this.finish({ type: 'crash', winners: [], text: '★おしまい★（ﾁｬﾝﾁｬﾝ!）全員のPCがクラッシュした' });
            return;
          }
          this.emit({ k: 'txt', mars: 1, s: '★おしまい★まで…' + Math.round(m.oshimai * 100) + '%', c: '#fca5a5' });
          m.oshimai += 0.1;
        }
      }
    }

    // ---------- イベント ----------
    rollEvent() {
      const r = rnd();
      const alive = this.players.filter((p) => !p.elim);
      if (r < 0.12) {
        const its = alive.map((p) => [p.item, p.ammo]);
        for (let i = its.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [its[i], its[j]] = [its[j], its[i]]; }
        alive.forEach((p, k) => { p.item = its[k][0]; p.ammo = its[k][1]; });
        this.say('イベント：アイテムシャッフル！', '#c4b5fd');
      } else if (r < 0.17) {
        const pool = this.itemPool.filter((k) => !['ar', 'sr', 'sg'].includes(k)); if (!pool.length || !this.itemRate) return;
        for (let k = 0; k < Math.max(2, alive.length); k++) this.spawnItem(pick(pool));
        this.say('イベント：アイテム配布！', '#fde68a');
      } else if (r < 0.22) {
        this.blackout = 15; this.say('イベント：停電！', '#64748b'); this.emit({ k: 'sfx', n: 'blackout' });
      } else if (r < 0.29) {
        this.say('イベント：食中毒！全員に5G', '#a16207');
        alive.forEach((p) => this.applyStatus(p, 'g5', 1, { force: true, food: true, dur: p.char === 'wikitto' ? 40 : 15 }));
      }
    }

    say(text, color) { this.banner = { s: text, c: color, t: this.t }; this.emit({ k: 'banner', s: text, c: color }); }
    emit(e) { this.fx.push(e); }
    finish(res) {
      if (this.over) return;
      this.over = true; this.result = res;
      this.emit({ k: 'sfx', n: 'end' });
    }

    // ---------- 入力処理 ----------
    edge(p, key) {
      const v = p.input.c[key] || 0, last = p.lastC[key] || 0;
      p.lastC[key] = v;
      return v !== last && v > 0;
    }
    getInput(p) {
      // ラグ：0.4秒遅れの入力を使う
      p.hist.push(p.input);
      if (p.hist.length > 40) p.hist.shift();
      if (this.has(p, 'lag') && p.hist.length > 24) return p.hist[p.hist.length - 25];
      return p.input;
    }

    // ---------- 更新 ----------
    step(dt) {
      if (this.over) return;
      this.t += dt; this.tick++;
      const t = this.t;
      // 時間進行
      if (t < T.GACHI) {
        const gi = Math.floor(t / 60);
        if (gi !== this.gimmickT) { this.gimmickT = gi; this.setGimmick(pick(['wind', 'ice', 'conveyor', 'crumble', 'lagbridge', 'rack'].filter((g) => g !== this.gimmick))); }
      } else if (this.phase === 'gimmick') {
        this.phase = 'gachi'; this.setGimmick('none'); this.say('ガチ乱闘期！ステージが崩れていく', '#f97316');
        this.emit({ k: 'sfx', n: 'phase' });
      }
      if (t >= T.MARS && this.phase !== 'mars' && this.phase !== 'curtain' && !this.marsRepelled) { this.phase = 'mars'; this.spawnMars(false); }
      if (t >= T.CURTAIN && this.marsRepelled && !this.curtain) { this.curtain = true; this.phase = 'curtain'; this.spawnMars(true); }
      if (t >= T.END && this.curtain) { this.finish({ type: 'bed', winners: [], text: '【GO TO BED】21分経過、ゲーム強制終了' }); return; }
      // イベント
      this.eventT -= dt;
      if (this.eventT <= 0) { this.eventT = 30; this.rollEvent(); }
      if (this.blackout > 0) { this.blackout -= dt; if (this.blackout <= 0) { this.players.forEach((p) => { if (!p.elim) p.tp = Math.min(30, p.tp + 5); }); this.say('停電復旧：みんな休めた（TP+5）', '#fde68a'); } }
      // アイテム湧き
      this.itemT -= dt;
      if (this.itemT <= 0) { const rt = this.itemRate; this.itemT = [99, 14, 7, 3.5][rt] + rnd() * [0, 6, 5, 2.5][rt]; if (rt && this.itemPool.length && this.items.length < [0, 2, 4, 7][rt]) this.spawnItem(pick(this.itemPool)); }
      if (this.mars) {
        this.sstT -= dt;
        const hasSST = this.items.some((i) => ITEMS[i.type].cookie) || this.players.some((p) => p.item && ITEMS[p.item].cookie);
        if (this.sstT <= 0 && !hasSST && !this.mars.true) { this.sstT = 40; this.spawnItem('sst'); this.say('クッキー☆アイテム「SST」が出現！', '#22d3ee'); }
      }
      this.updatePlats(dt);
      this.updateStage(dt);
      this.updateMars(dt);
      if (this.over) return;

      for (const p of this.players) this.updatePlayer(p, dt);
      this.collidePlayers();
      this.updateItems(dt);
      this.updateProj(dt);

      // 勝敗
      const alive = this.players.filter((p) => !p.elim && !p.minion);
      if (this.teamMode) {
        const teams = new Set(alive.map((p) => p.team));
        if (new Set(this.players.map((p) => p.team)).size >= 2 && teams.size <= 1) {
          if (teams.size === 1) { const t = [...teams][0]; this.finish({ type: 'win', team: t, winners: this.players.filter((p) => p.team === t).map((p) => p.id), text: GD.TEAMS[t].name + 'チームの勝利！' }); }
          else this.finish({ type: 'draw', winners: [], text: '全滅…引き分け' });
        }
      } else if (this.players.length >= 2 && alive.length <= 1) {
        if (alive.length === 1) this.finish({ type: 'win', winners: [alive[0].id], text: CHARS[alive[0].char].name + '（' + alive[0].name + '）の優勝！' });
        else this.finish({ type: 'draw', winners: [], text: '全滅…引き分け' });
      }
    }

    updatePlayer(p, dt) {
      const c = CHARS[p.char];
      if (p.elim) return;
      // タイマー類
      for (const k in p.st) { p.st[k].t -= dt; if (p.st[k].t <= 0) delete p.st[k]; }
      for (const k in p.buffs) { if (typeof p.buffs[k] === 'number') { p.buffs[k] -= dt; if (p.buffs[k] <= 0) delete p.buffs[k]; } }
      if (p.buffs.ken) { p.buffs.ken.t -= dt; if (p.buffs.ken.t <= 0) delete p.buffs.ken; }
      if (p.cathy) { p.cathy.t -= dt; if (p.cathy.t <= 0) p.cathy = null; }
      p.inv = Math.max(0, p.inv - dt); p.hitstun = Math.max(0, p.hitstun - dt); p.thrown = Math.max(0, p.thrown - dt);
      p.punchCD -= dt; p.headCD -= dt; p.grabCD -= dt; p.ledgeCD -= dt; p.dashCD -= dt; p.fireCD -= dt; p.spCD = Math.max(0, p.spCD - dt);
      p.punchT = Math.max(0, p.punchT - dt); p.headT = Math.max(0, p.headT - dt); p.crouchT = Math.max(0, p.crouchT - dt);
      p.dashT = Math.max(0, p.dashT - dt); p.scy = Math.max(0, (p.scy || 0) - dt); p.rhythmCD = Math.max(0, p.rhythmCD - dt);
      if (p.bound) { p.bound -= dt; if (p.bound <= 0) p.bound = 0; }
      if (p.stun > 0) { p.stun -= dt; if (p.stun <= 0) { p.stun = 0; p.gBug = 0; } }
      if (p.meteor) { p.meteor -= dt; if (p.meteor <= 0) { p.meteor = 0; this.emit({ k: 'boom', x: p.x, y: p.y, z: p.z }); this.hit(p, null, p.shower ? 80 : 40, 8, rnd() - 0.5, rnd() - 0.5, 0.9, { unblock: true }); if (!p.shower || rnd() < 0.2) p.stun = Math.max(p.stun, 5); p.shower = 0; } }

      if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) this.doRespawn(p); return; }

      // TP自然回復
      p.tpT += dt;
      const tpI = p.buffs.tpx2 ? 2.5 : 5;
      if (p.tpT >= tpI) { p.tpT = 0; p.tp = Math.min(30, p.tp + 1); }
      // ヘロヘロ自然回復
      // パッシブ
      p.timers.pas -= dt;
      if (p.char === 'kenken' && p.timers.pas <= 0) { p.timers.pas = 15; const k = (rnd() * 3) | 0; p.buffs.ken = { k, t: 13 }; this.emit({ k: 'txt', id: p.id, s: ['パワー', 'スピード', '重さ'][k] + 'UP', c: '#93c5fd' }); }
      if (p.char === 'cotton' && p.timers.pas <= 0) { p.timers.pas = 14; const k = (rnd() * 3) | 0; if (p.cot[k] < 3) { p.cot[k]++; this.emit({ k: 'txt', id: p.id, s: ['パワー', 'スピード', '重さ'][k] + '+1', c: '#e5e7eb' }); } }
      if (p.char === 'yururu') { p.timers.yu -= dt; if (p.timers.yu <= 0) { p.timers.yu = 45; this.applyStatus(p, pick(['lag', 'keyboard', 'g5', 'nanchou']), 1, { force: true, dur: 6 }); } }
      // 5G：腹痛
      if (this.has(p, 'g5')) { p.timers.g5 -= dt; if (p.timers.g5 <= 0) { p.timers.g5 = 10; p.crouchT = 2; this.emit({ k: 'txt', id: p.id, s: 'お腹が…', c: '#a16207' }); } }
      // 歯ごたえ
      if (this.has(p, 'hagotae')) { p.timers.chew -= dt; if (p.timers.chew <= 0) { p.timers.chew = 4; p.hitstun = Math.max(p.hitstun, 0.3); } }
      // ラグ：巻き戻り
      p.posHist.push([p.x, p.y, p.z]); if (p.posHist.length > 60) p.posHist.shift();
      if (this.has(p, 'lag')) { p.timers.lag -= dt; if (p.timers.lag <= 0) { p.timers.lag = 4; if (p.ground && p.posHist.length > 50) { const o = p.posHist[0]; p.x = o[0]; p.y = o[1]; p.z = o[2]; this.emit({ k: 'txt', id: p.id, s: 'ラグ！', c: '#45d0ff' }); } } }
      // テラフォーマー：仲間が殴ると解放
      if (p.gBug > 0) { p.gBug -= dt; if ((p.gFree || 0) >= 2) { p.gBug = 0; p.stun = 0; this.emit({ k: 'txt', id: p.id, s: 'Gから解放！', c: '#a7f3d0' }); } }

      // ---------- 入力 ----------
      let inp = this.getInput(p);
      // 天上天下：乗っ取り中は操作者の入力で動く
      if (p.ctrlBy) {
        const q = this.players.find((x) => x.id === p.ctrlBy);
        if (q && q.ctrl && q.ctrl.t > 0) inp = q.input; else p.ctrlBy = null;
      }
      if (p.ctrl) {
        p.ctrl.t -= dt;
        if (p.ctrl.t <= 0) {
          const q = this.players.find((x) => x.id === p.ctrl.id);
          if (q) { q.ctrlBy = null; this.applyStatus(q, 'majigire', 1, { force: q.char !== 'wikitto' }); if (p.ctrl.had && q.st[p.ctrl.had]) { q.st[p.ctrl.had].lv = Math.min(3, q.st[p.ctrl.had].lv + 1); q.st[p.ctrl.had].t += 5; } }
          p.ctrl = null;
        }
      }
      const ctrlled = !!p.ctrlBy;
      // エッジ検出（自分の入力用カウンタ）
      if (!p.cInit) { p.cInit = true; p.lastC = { ...(inp.c || {}) }; }
      if (ctrlled && !p.ccInit) { p.ccInit = true; p.lastCC = { ...(inp.c || {}) }; }
      if (!ctrlled) p.ccInit = false;
      const E = (k) => { const v = inp.c[k] || 0, l = (ctrlled ? p.lastCC || (p.lastCC = {}) : p.lastC)[k] || 0; (ctrlled ? p.lastCC : p.lastC)[k] = v; return v !== l && v > 0; };
      const ePunch = E('punch'), eJump = E('jump'), eHead = E('head'), eUse = E('use'), eDrop = E('drop'), eV = E('v'), eG = E('g');
      const eSk = [E('s1'), E('s2'), E('s3'), E('s4')];
      const b = inp.b || {};
      if (inp.buy && inp.buy.seq !== p.lastBuy) {
        p.lastBuy = inp.buy.seq;
        if (p.ticket > 0 && this.shopList.includes(inp.buy.item) && (inp.buy.item !== 'sst' || this.mars)) { p.ticket--; if (p.item) this.dropItem(p); this.giveItem(p, inp.buy.item); }
      }
      // 掴まれている：もがく
      if (p.grabbedBy) {
        const g = this.players.find((q) => q.id === p.grabbedBy);
        if (!g || g.grab !== p.id) { p.grabbedBy = null; }
        else if (p.stun <= 0 && !p.ctrlBy) {
          if (ePunch || eJump || eHead || E('grabc')) p.escape++;
          let need = 4 + Math.floor(p.hero / 50); if (this.has(g, 'hagotae')) need *= 2; if (this.has(g, 'kyouki')) need = 20;
          if (p.escape >= need) { this.release(g, false); this.emit({ k: 'txt', id: p.id, s: '振りほどいた！', c: '#a7f3d0' }); }
        }
      }
      const act = this.canAct(p);
      // 移動方向
      let mx = inp.mx || 0, mz = inp.mz || 0;
      const ml = len2(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
      if (this.has(p, 'kyouki') && p.char !== 'yururu' && ((this.t + p.st.kyouki.ph) % 3) < 1.2) { mx = -mx; mz = -mz; }
      if (this.has(p, 'majigire') && p.char !== 'yururu' && ml < 0.1 && act) { mx = Math.sin(p.yaw) * 0.45; mz = Math.cos(p.yaw) * 0.45; }

      // 崖つかまり中
      if (p.ledge) {
        p.ledgeT += dt;
        p.vx = p.vy = p.vz = 0;
        const L = p.ledge;
        p.x = L.x; p.z = L.z; p.y = L.top - 1.45;
        if (!this.solidAlive(L)) { p.ledge = null; }
        else if (act && eJump && !this.disabled(p, 'jump')) {
          p.x = L.x - L.nx * 0.9; p.z = L.z - L.nz * 0.9; p.y = L.top + 0.05; p.ledge = null; p.vy = 3;
          this.emit({ k: 'sfx', n: 'climb' });
        } else if ((act && b.dash) || p.ledgeT > 5 || !act) { p.ledge = null; p.ledgeCD = 0.6; }
        else if (act && eV) { p.ledge = null; this.special(p); }
        if (p.ledge) return;
      }

      // 向き
      const speed = (5 + 0.75 * this.stat(p, 1)) * (p.buffs.energy ? 1.35 : 1) * (p.buffs.bike ? 1.7 : 1);
      let sp = speed;
      if (p.grab) sp *= 0.65;
      if (p.guard) sp *= 0.3;
      if (p.charging > 0.35) sp *= 0.5;
      if (this.has(p, 'tapioka')) { const w = this.players.find((q) => q.char === 'wikitto' && !q.elim); if (w && len2(w.x - p.x, w.z - p.z) < 4) sp *= 0.6; }
      if (p.bound) sp *= 0.4;
      if (p.item === 'sr' && p.srT > 0) sp *= 0.4;

      if (p.buffs.chair) { mx = Math.sin(p.yaw); mz = Math.cos(p.yaw); sp = 15; }
      if (!act) { mx = 0; mz = 0; }
      if (act && (ml > 0.1 || p.buffs.chair)) {
        const target = Math.atan2(mx, mz);
        if (!(p.charging > 0.35 || p.srT > 0 || p.buffs.chair)) p.yaw = lerpAngle(p.yaw, target, Math.min(1, dt * 14));
      }
      if (act && (ePunch || b.punch) && (inp.ay !== undefined) && (p.item && ITEMS[p.item].weapon && p.item !== 'monitor')) p.yaw = inp.ay;
      // 物理
      const ice = this.gimmick === 'ice' && p.ground;
      const acc = p.ground ? (ice ? 6 : 50) : 24;
      const tvx = mx * sp, tvz = mz * sp;
      if (p.dashT <= 0 && p.hitstun <= 0 && p.thrown <= 0) {
        p.vx += clamp(tvx - p.vx, -acc * dt, acc * dt);
        p.vz += clamp(tvz - p.vz, -acc * dt, acc * dt);
      } else if (p.ground) { p.vx *= 1 - Math.min(1, dt * 3); p.vz *= 1 - Math.min(1, dt * 3); }
      // ギミックの力
      if (this.gimmick === 'wind') { p.vx += Math.cos(this.windDir) * 7 * dt; p.vz += Math.sin(this.windDir) * 7 * dt; }
      if (this.gimmick === 'conveyor' && p.ground && p.groundTile) { const dir = p.groundTile.j % 2 ? 1 : -1; p.x += dir * 3.2 * dt; }
      // ジャンプ
      if (p.ground) p.airJ = 1;
      if (act && eJump && p.ground && p.onPlat >= 0 && b.guard) { p.dropT = 0.35; p.ground = false; p.onPlat = -1; p.y -= 0.05; }
      else if (act && eJump && (p.ground || p.airJ > 0) && !this.disabled(p, 'jump')) {
        if (!p.ground) { p.airJ--; p.vx *= 0.5; p.vz *= 0.5; p.vx += mx * 5; p.vz += mz * 5; this.emit({ k: 'djump', id: p.id, x: p.x, y: p.y, z: p.z }); }
        p.vy = (p.ground ? 9.8 : 10.8) * (this.has(p, 'hagotae') ? 0.7 : 1) * (p.buffs.mt ? 0.8 : 1);
        p.ground = false; this.emit({ k: 'sfx', n: 'jump' });
      }
      // ダッシュ
      if (act && b.dash && p.dashCD <= 0 && !this.disabled(p, 'dash') && !p.grab) {
        const dx = ml > 0.1 ? mx : Math.sin(p.yaw), dz = ml > 0.1 ? mz : Math.cos(p.yaw), dl = len2(dx, dz) || 1;
        p.vx = (dx / dl) * 14; p.vz = (dz / dl) * 14; p.dashT = 0.18; p.dashCD = 0.9;
        this.emit({ k: 'sfx', n: 'dash' });
      }
      // ガード
      p.guard = act && b.guard && !(this.has(p, 'majigire') && p.char !== 'yururu') && !p.grab;

      // 武器：「使う」ボタンで撃つ・振る
      const weapon = p.item && ITEMS[p.item].weapon ? p.item : null;
      const useHeld = !!(b.use || inp.useHold);
      if (weapon && act && (eUse || useHeld) && weapon !== 'monitor') p.yaw = inp.ay;
      if (act && weapon) {
        if (weapon === 'ar') { if (useHeld && p.fireCD <= 0) { p.fireCD = 0.14; this.fireWeapon(p, 'ar'); } }
        else if (weapon === 'sr') {
          if (useHeld) p.srT += dt;
          else if (p.srT > 0) { if (p.srT > 0.6) this.fireWeapon(p, 'sr'); p.srT = 0; }
        } else if (weapon === 'sg') { if (eUse && p.fireCD <= 0) { p.fireCD = 0.7; this.fireWeapon(p, 'sg'); } }
        else if (weapon === 'monitor' && eUse && p.fireCD <= 0) {
          p.fireCD = 0.55; p.punchT = 0.3; p.punchSide = 1; p.yaw = lerpAngle(p.yaw, inp.ay, 0.6);
          let any = false;
          for (const q of this.targetsInFront(p, 1.5, 0.3)) any = this.hit(q, p, 35, 7 * this.powerMul(p), q.x - p.x, q.z - p.z, 0.45, { unblock: true }) || any;
          if (this.marsInFront(p, 1.6)) { this.damageMars(p, 'monitor'); any = true; }
          this.emit({ k: 'sfx', n: any ? 'hit2' : 'swing2' });
          if (any) { p.ammo--; if (p.ammo <= 0) p.item = null; }
        }
      } else p.srT = 0;

      // パンチ（いつでも素手）
      if (act && !p.guard && !this.disabled(p, 'punch')) {
        {
          if (ePunch && p.punchCD <= 0) {
            p.punchT = 0.25; p.punchSide ^= 1; p.punchCD = 0.3; p.punchHit = false; p.charging = 0; p.holdPunch = 1;
            p.yaw = lerpAngle(p.yaw, inp.ay, 0.5);
            if (p.ground) { p.vx += Math.sin(p.yaw) * 2.2; p.vz += Math.cos(p.yaw) * 2.2; } // 踏み込み
            if (!p.ground) { p.vx += Math.sin(p.yaw) * 6; p.vz += Math.cos(p.yaw) * 6; p.dropkick = 0.35; }
            this.emit({ k: 'sfx', n: 'swing' });
          }
          if (b.punch && p.holdPunch) p.charging += dt;
          if (!b.punch && p.holdPunch) {
            if (p.charging > 0.35) { p.punchT = 0.3; p.punchHit = false; p.charged = Math.min(1, p.charging); p.punchCD = 0.45; p.yaw = lerpAngle(p.yaw, inp.ay, 0.7); if (p.ground) { p.vx += Math.sin(p.yaw) * 5; p.vz += Math.cos(p.yaw) * 5; } this.emit({ k: 'sfx', n: 'swing2' }); }
            p.holdPunch = 0; p.charging = 0;
          }
          // ヒット判定（モーション中盤）
          if (p.punchT > 0 && p.punchT < 0.17 && !p.punchHit) {
            p.punchHit = true;
            const chg = p.charged || 0; p.charged = 0;
            let heroAdd = 8 + chg * 11, kb = 3.0 + chg * 6.5;
            if (p.dropkick > 0) { heroAdd += 3; kb += 1.5; }
            // 3連続で当てるとコンボの締め（大きく吹っ飛ぶ）
            const comboOk = this.t - (p.comboT || -9) < 0.9;
            const fin = !chg && comboOk && (p.combo || 0) >= 2;
            if (fin) { heroAdd += 4; kb *= 2.1; }
            const pm = this.powerMul(p);
            // 音楽ボット：ビートに合うと強化
            if (this.has(p, 'musicbot')) { const ph = (this.t % 0.5); if (ph < 0.12 || ph > 0.38) { const m = p.char === 'hiro' ? 2 : 1.5; heroAdd *= m; kb *= m; this.emit({ k: 'txt', id: p.id, s: '♪Perfect', c: '#ff7ad9' }); } }
            this.emit({ k: 'swing', id: p.id, s: p.punchSide, c: chg > 0.3 ? 1 : 0, f: fin ? 1 : 0, x: p.x, y: p.y, z: p.z, yw: p.yaw });
            let any = false;
            for (const q of this.targetsInFront(p, 1.75 + chg * 0.4, 0.05)) {
              if (q.gBug > 0) q.gFree = (q.gFree || 0) + 1;
              const ok = this.hit(q, p, heroAdd * (chg ? 1.2 : 1), kb * pm, q.x - p.x, q.z - p.z, fin ? 0.5 : 0.3 + chg * 0.25);
              if (ok && !fin && !chg) q.hitstun = Math.max(q.hitstun, 0.32); // 連打がつながる
              any = ok || any;
            }
            if (this.marsInFront(p, 1.9)) { this.damageMars(p, chg > 0.3 || fin ? 2 : 1); any = true; }
            if (any) {
              p.combo = fin || chg ? 0 : (comboOk ? (p.combo || 0) + 1 : 1); p.comboT = this.t;
              if (fin) this.emit({ k: 'txt', id: p.id, s: 'コンボ！', c: '#fbbf24' });
              this.emit({ k: 'sfx', n: chg > 0.3 || fin ? 'hit2' : 'hit' });
            }
          }
        }
      } else if (!b.punch) { p.holdPunch = 0; p.charging = 0; }
      if (p.dropkick) p.dropkick = Math.max(0, p.dropkick - dt);

      // 頭突き
      if (act && eHead && p.headCD <= 0) {
        p.headT = 0.3; p.headCD = 1.1;
        let any = false;
        for (const q of this.targetsInFront(p, 1.0, 0.5)) any = this.hit(q, p, 13, 2.0 * this.powerMul(p), q.x - p.x, q.z - p.z, 0.25) || any;
        if (this.marsInFront(p, 1.2)) { this.damageMars(p, 2); any = true; }
        if (any) this.emit({ k: 'sfx', n: 'hit2' }); else this.emit({ k: 'sfx', n: 'swing' });
      }

      // 掴み
      if (act && b.grab && !p.grab && p.grabCD <= 0 && !this.disabled(p, 'grab')) {
        p.grabCD = 0.5; // 空振りにも隙
        const cands = this.targetsInFront(p, 0.9, 0.3).filter((q) => !q.grabbedBy && q.inv <= 0 && !q.grab && !this.ally(p, q));
        if (cands.length) {
          const q = cands[0];
          if (q.cathy && q.cathy.n > 0) { this.cathyAbsorb(q); p.grabCD = 0.6; }
          else {
            p.grab = q.id; p.grabT = 0; q.grabbedBy = p.id; q.escape = 0; q.ledge = null;
            if (q.grab) this.release(q, false);
            this.emit({ k: 'sfx', n: 'grab' });
          }
        }
      }
      if (p.grab) {
        const q = this.players.find((x) => x.id === p.grab);
        if (!q || q.elim || q.respawn > 0 || !act && p.stun > 0) { if (q) q.grabbedBy = null; p.grab = null; }
        else {
          p.grabT += dt;
          const lift = p.grabT > 0.5;
          const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
          q.x = p.x + fx * 0.85; q.z = p.z + fz * 0.85; q.y = p.y + (lift ? 1.5 : 0.25);
          q.vx = p.vx; q.vy = 0; q.vz = p.vz; q.yaw = p.yaw + Math.PI;
          if (!b.grab || !act) this.release(p, act);
          else if (p.grabT > 3.5) this.release(p, false);
        }
      }

      // アイテム使用・投げ
      if (act && eUse && p.item && !ITEMS[p.item].weapon && p.item !== 'sst') this.useItem(p);
      if (act && eDrop) this.dropItem(p);
      // SST改造：E長押し＋TP20
      if (p.item === 'sst') {
        if (useHeld && act) {
          p.useT += dt;
          if (p.useT > 1 && !p.useUpg) { p.useUpg = true; if (p.tp >= 20) { p.tp -= 20; p.item = 'sst2'; this.emit({ k: 'txt', id: p.id, s: '改造SST"Super Savage Terminator"完成！', c: '#f43f5e' }); } else this.emit({ k: 'txt', id: p.id, s: '改造にはTP20が必要', c: '#9ca3af' }); }
        } else { if (p.useT > 0 && p.useT <= 1 && act) this.useItem(p); p.useT = 0; p.useUpg = false; }
      } else { p.useT = 0; p.useUpg = false; }

      // スキル
      if (act) for (let k = 0; k < 4; k++) if (eSk[k]) this.useSkill(p, k);
      if (act && eV) this.special(p);
      // リズム（ヒロ）
      if (p.char === 'hiro' && eG && act) {
        const now = this.t, r = p.rhythm;
        if (r.length && (now - r[r.length - 1] < 0.38 || now - r[r.length - 1] > 0.62)) r.length = 0;
        r.push(now);
        this.emit({ k: 'beat', id: p.id, n: r.length });
        if (r.length >= 8) { r.length = 0; if (p.rhythmCD <= 0) { p.rhythmCD = 15; if (p.item) this.dropItem(p); this.giveItem(p, pick(this.itemPool.length ? this.itemPool : GD.SPAWN_ITEMS)); } else this.emit({ k: 'txt', id: p.id, s: 'クールダウン中', c: '#9ca3af' }); }
      }

      // バイク・チェア体当たり
      if (p.buffs.bike || p.buffs.chair) {
        for (const q of this.players) {
          if (q === p || q.elim || q.respawn > 0) continue;
          if (len2(q.x - p.x, q.z - p.z) < 1.3 && Math.abs(q.y - p.y) < 1.5 && (p.hitBy[q.id] || 0) < this.t) {
            p.hitBy[q.id] = this.t + 0.7;
            this.hit(q, p, p.buffs.chair ? 20 : 15, p.buffs.chair ? 8 : 7, q.x - p.x, q.z - p.z, 0.5, { unblock: true });
          }
        }
      }

      this.integrate(p, dt);
    }

    solidAlive(L) { if (L.tile) return L.tile.on && !L.tile.gone; return this.boxes.includes(L.box); }

    integrate(p, dt) {
      if (p.grabbedBy) { p.ground = false; this.checkFall(p); return; }
      p.vy += GRAV * dt * (p.scy > 0 ? 0.3 : 1);
      if (p.vy < -30) p.vy = -30;
      const oy = p.y;
      if (p.onPlat >= 0 && this.plats[p.onPlat]) { p.x += this.plats[p.onPlat].dx; p.z += this.plats[p.onPlat].dz; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.ground = false; p.groundTile = null; p.onPlat = -1;
      if (p.dropT > 0) p.dropT -= dt;
      // 浮き床：下からすり抜けて、上には乗れる
      if (p.vy <= 0.01 && !(p.dropT > 0)) this.plats.forEach((q, i) => {
        if (Math.abs(p.x - q.x) < q.w + R * 0.3 && Math.abs(p.z - q.z) < q.d + R * 0.3 && oy >= q.y - 0.12 && p.y <= q.y + 0.02) {
          p.y = q.y; p.vy = 0; p.ground = true; p.onPlat = i;
        }
      });
      const S = this.solids();
      for (const s of S) {
        const cx = clamp(p.x, s.x - s.w, s.x + s.w), cz = clamp(p.z, s.z - s.d, s.z + s.d);
        const dx = p.x - cx, dz = p.z - cz, d = len2(dx, dz);
        const inside = d < 0.001;
        // 着地
        if (p.onPlat >= 0 && s.top < p.y - 0.05) continue;
        if ((inside || d < R * 0.6) && p.vy <= 0.01 && oy >= s.top - 0.25 && p.y <= s.top + 0.02) {
          p.y = s.top; p.vy = 0; p.ground = true; p.groundTile = s.tile || null;
          continue;
        }
        // 横の押し出し
        if (d < R && p.y < s.top - 0.05 && p.y + H > s.bot) {
          if (inside) continue;
          const push = (R - d) / d; p.x += dx * push; p.z += dz * push;
          const n = (p.vx * dx + p.vz * dz) / d; if (n < 0) { p.vx -= (n * dx) / d; p.vz -= (n * dz) / d; }
        }
      }
      // 摩擦
      if (p.ground) {
        const fr = this.gimmick === 'ice' ? 0.6 : 10;
        if (p.hitstun > 0 || p.thrown > 0 || p.dashT > 0) { p.vx *= 1 - Math.min(1, dt * fr * 0.4); p.vz *= 1 - Math.min(1, dt * fr * 0.4); }
      } else {
        // 崖つかまり判定
        if (p.vy < 0 && p.ledgeCD <= 0 && p.stun <= 0 && !p.grabbedBy && p.thrown <= 0 && !p.grab && p.respawn <= 0 && !this.has(p, 'naeochi')) {
          for (const s of S) {
            const hy = p.y + 1.45;
            if (hy < s.top - 0.5 || hy > s.top + 0.3) continue;
            const cx = clamp(p.x, s.x - s.w, s.x + s.w), cz = clamp(p.z, s.z - s.d, s.z + s.d);
            const dx = p.x - cx, dz = p.z - cz, d = len2(dx, dz);
            if (d < 0.05 || d > R + 0.8) continue;
            // 端の上に他のブロックがある場合は除く（タイル同士の継ぎ目）
            const ex = cx + (dx / d) * 0.3, ez = cz + (dz / d) * 0.3;
            if (S.some((o) => o !== s && Math.abs(ex - o.x) < o.w && Math.abs(ez - o.z) < o.d && Math.abs(o.top - s.top) < 0.4)) continue;
            p.ledge = { x: cx + (dx / d) * (R + 0.05), z: cz + (dz / d) * (R + 0.05), top: s.top, nx: dx / d, nz: dz / d, tile: s.tile, box: s.tile ? null : s };
            p.ledgeT = 0; p.airJ = 1; p.yaw = Math.atan2(-dx, -dz); p.vx = p.vy = p.vz = 0;
            this.emit({ k: 'sfx', n: 'ledge' });
            break;
          }
        }
      }
      this.checkFall(p);
    }
    checkFall(p) {
      const lim = HALF + 30;
      if (p.y < KILL_Y || Math.abs(p.x) > lim || Math.abs(p.z) > lim || p.y > 60) this.ringOut(p);
    }

    collidePlayers() {
      const P = this.players;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j];
        if (a.elim || b.elim || a.respawn > 0 || b.respawn > 0) continue;
        if (a.grab === b.id || b.grab === a.id) continue;
        if (Math.abs(a.y - b.y) > 1.5) continue;
        const ra = a.buffs.mt ? 0.75 : R, rb = b.buffs.mt ? 0.75 : R;
        const dx = b.x - a.x, dz = b.z - a.z, d = len2(dx, dz), m = ra + rb;
        if (d < m && d > 0.0001) {
          const push = (m - d) / 2 / d;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        }
      }
      // Mars本体との衝突
      if (this.mars) for (const p of P) {
        if (p.elim) continue;
        const dx = p.x - this.mars.x, dz = p.z - this.mars.z, d = len2(dx, dz), m = 2.2 + R;
        if (d < m && p.y < 6 && d > 0.001) { p.x = this.mars.x + (dx / d) * m; p.z = this.mars.z + (dz / d) * m; }
      }
    }

    updateItems(dt) {
      const S = this.surfaces();
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.vy += GRAV * dt * 0.6; it.y += it.vy * dt;
        for (const s of S) if (Math.abs(it.x - s.x) < s.w && Math.abs(it.z - s.z) < s.d && it.y < s.top + 0.3 && it.y > s.top - 0.8) { it.y = s.top + 0.3; it.vy = 0; }
        if (it.y < KILL_Y) { this.items.splice(i, 1); continue; }
        for (const p of this.players) {
          if (p.elim || p.respawn > 0 || p.item || p.minion) continue;
          if (len2(p.x - it.x, p.z - it.z) < 1.0 && Math.abs(p.y + 0.5 - it.y) < 1.4) { this.giveItem(p, it.type); this.items.splice(i, 1); break; }
        }
      }
    }
    updateProj(dt) {
      for (let i = this.proj.length - 1; i >= 0; i--) {
        const pr = this.proj[i];
        pr.life -= dt; pr.vy += GRAV * dt * 0.5;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
        let done = pr.life <= 0 || pr.y < KILL_Y;
        for (const q of this.players) {
          if (done || q.id === pr.own || q.elim || q.respawn > 0) continue;
          if (this.ally(this.players.find((x) => x.id === pr.own), q)) continue;
          if (len2(q.x - pr.x, q.z - pr.z) < 0.8 && pr.y > q.y && pr.y < q.y + H + 0.3) {
            const own = this.players.find((x) => x.id === pr.own);
            if (pr.k === 'lan') { q.bound = 5; this.emit({ k: 'txt', id: q.id, s: 'LANケーブルで縛られた！', c: '#60a5fa' }); this.hit(q, own, 5, 2, pr.vx, pr.vz, 0.1); }
            else this.hit(q, own, 10, 5, pr.vx, pr.vz, 0.3);
            done = true;
          }
        }
        if (!done && pr.k === 'item') {
          // 着地したらアイテムとして置く
          for (const s of this.solids()) if (Math.abs(pr.x - s.x) < s.w && Math.abs(pr.z - s.z) < s.d && pr.y < s.top + 0.3 && pr.y > s.top - 0.6 && pr.vy < 0) { this.items.push({ id: pr.id, type: pr.type, x: pr.x, y: s.top + 0.3, z: pr.z, vy: 0 }); done = true; break; }
        }
        if (done) this.proj.splice(i, 1);
      }
    }

    // ---------- 通信用スナップショット ----------
    snapshot() {
      const r2 = (v) => Math.round(v * 100) / 100;
      return {
        t: r2(this.t), g: this.gimmick, ph: this.phase, wd: r2(this.windDir), bo: this.blackout > 0 ? 1 : 0, lives: this.lives,
        mp: this.map, tmode: this.teamMode ? 1 : 0, sh: this.shopList,
        pl: this.plats.map((q) => [Math.round(q.x * 100) / 100, Math.round(q.z * 100) / 100, q.w, q.d, q.y]),
        tl: this.tiles.map((t) => (t.none ? -200 : t.gone ? -99 : t.on ? r2(t.top) : -50) + (t.shake > 0 ? 1000 : 0) + (t.blink > 2 || (t.warn && !t.gone) ? 2000 : 0)),
        bx: this.boxes.map((b) => [r2(b.x), r2(b.z), b.w, b.d, r2(b.top), r2(b.bot)]),
        it: this.items.map((i) => [i.id, i.type, r2(i.x), r2(i.y), r2(i.z)]),
        pr: this.proj.map((p) => [p.id, p.k === 'lan' ? 'lan' : p.type, r2(p.x), r2(p.y), r2(p.z)]),
        m: this.mars ? { hp: r2(this.mars.hp), sc: this.mars.sc, tr: this.mars.true ? 1 : 0, fl: this.mars.flash > 0 ? 1 : 0, sl: r2(this.mars.slam), dn: this.mars.down > 0 ? 1 : 0, os: r2(this.mars.oshimai), age: r2(this.t - this.mars.t0) } : null,
        p: this.players.map((p) => ({
          id: p.id, n: p.name, c: p.char, tm: p.team, x: r2(p.x), y: r2(p.y), z: r2(p.z), yw: r2(p.yaw), vy: r2(p.vy),
          h: Math.round(p.hero), l: p.lives, tp: p.tp, k: p.kills, tk: p.ticket, tkp: p.ticketProg,
          e: p.elim ? 1 : 0, rs: p.respawn > 0 ? r2(p.respawn) : 0, inv: p.inv > 0 ? 1 : 0, mi: p.minion ? 1 : 0, bot: p.bot ? 1 : 0,
          gr: p.ground ? 1 : 0, pt: r2(p.punchT), ps: p.punchSide, ch: r2(p.charging), hd: r2(p.headT), gb: p.grab || 0, gby: p.grabbedBy || 0,
          ld: p.ledge ? 1 : 0, sn: r2(p.stun), hs: p.hitstun > 0 ? 1 : 0, gd: p.guard ? 1 : 0, ds: p.dashT > 0 ? 1 : 0, sy: p.scy > 0 ? 1 : 0, cr: p.crouchT > 0 ? 1 : 0,
          st: Object.keys(p.st).map((k) => [k, r2(p.st[k].t), p.st[k].lv, p.st[k].dis || '']),
          bf: Object.keys(p.buffs).filter((k) => typeof p.buffs[k] === 'number' || k === 'ken').map((k) => [k, r2(typeof p.buffs[k] === 'number' ? p.buffs[k] : p.buffs[k].t), k === 'ken' ? p.buffs.ken.k : 0]),
          it: p.item || '', am: p.ammo, sr: r2(p.srT), sp: r2(p.spCD), ca: p.cathy ? p.cathy.n : 0, ct: p.ctrl ? 1 : 0, cb: p.ctrlBy ? 1 : 0,
          gB: p.gBug > 0 ? 1 : 0, bd: p.bound > 0 ? 1 : 0, pos: p.positive ? 1 : 0, vc: p.voice ? 1 : 0, mt: p.buffs.mt ? Math.round(p.mtHP) : 0, mo: p.meteor > 0 ? 1 : 0,
          sel: p.input.sel || 0, rh: p.rhythm.length,
        })),
        ov: this.over ? this.result : null,
      };
    }
  }

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  return { Game, emptyInput, N, TS, HALF, lerpAngle, setRng: (f) => (rng = f || Math.random) };
})();
