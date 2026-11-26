// ===== CPUプレイヤー =====
'use strict';
window.AI = (function () {
  const len2 = (x, z) => Math.sqrt(x * x + z * z);
  const press = (inp, k) => { inp.c[k] = (inp.c[k] || 0) + 1; };

  function groundAt(g, x, z, y) {
    for (const s of g.surfaces()) if (Math.abs(x - s.x) < s.w && Math.abs(z - s.z) < s.d && s.top <= y + 1.6 && s.top > y - 6) return s;
    return null;
  }

  function think(g, p, dt) {
    const inp = p.input;
    const A = p.ai;
    inp.b = {};
    inp.c = inp.c || {};
    A.t -= dt;
    const lvl = p.cpu || 2;
    const react = [0.45, 0.25, 0.12][lvl - 1] || 0.25;
    if (p.elim || p.respawn > 0) { inp.mx = inp.mz = 0; return; }

    // 掴まれている → 連打
    if (p.grabbedBy) { if (Math.random() < 0.25 + lvl * 0.1) press(inp, 'punch'); inp.mx = inp.mz = 0; return; }
    // 崖
    if (p.ledge) { A.ledge = (A.ledge || 0) + dt; if (A.ledge > 0.25 + Math.random() * 0.5) { press(inp, 'jump'); A.ledge = 0; } return; }

    // ステージ外：中央へ戻る
    const below = groundAt(g, p.x, p.z, p.y);
    if (!p.ground && !below) {
      // 一番近い床へ戻る
      let tx = 0, tz = 0, bd = 1e9;
      for (const t of g.tiles) { if (!t.on || t.gone) continue; const dd = len2(t.x - p.x, t.z - p.z) - (t.top <= p.y + 1.2 ? 0 : 3); if (dd < bd) { bd = dd; tx = t.x; tz = t.z; } }
      const dx = tx - p.x, dz = tz - p.z, d = len2(dx, dz) || 1;
      inp.mx = dx / d; inp.mz = dz / d; inp.ay = Math.atan2(dx, dz); inp.ap = 0.5;
      if (p.airJ > 0 && (p.vy < -1 || p.y < -0.5) && Math.random() < 0.2 + lvl * 0.15) press(inp, 'jump');
      if (p.char === 'nimo' && p.spCD <= 0 && p.y < -1) press(inp, 'v');
      return;
    }

    // 目標選び
    if (A.t <= 0 || !A.target) {
      A.t = react + Math.random() * 0.3;
      let best = null, bd = 1e9;
      for (const q of g.players) {
        if (q === p || q.elim || q.respawn > 0) continue;
        if (p.minion === q.minion && p.minion) continue;
        if (g.ally(p, q)) continue;
        if (!p.minion && q.minion && Math.random() < 0.5) continue;
        const d = len2(q.x - p.x, q.z - p.z) + (q.stun > 0 ? -4 : 0) + (q.ledge ? -3 : 0);
        if (d < bd) { bd = d; best = q; }
      }
      A.target = best ? best.id : null;
      A.goMars = g.mars && !p.minion && Math.random() < 0.35;
      // アイテム
      A.itemGoal = null;
      if (!p.item) {
        let bi = null, bdi = 9;
        for (const it of g.items) { const d = len2(it.x - p.x, it.z - p.z); if (d < bdi) { bdi = d; bi = it; } }
        if (bi && (GD.ITEMS[bi.type].cookie || Math.random() < 0.6)) A.itemGoal = bi.id;
      }
      // スキル
      const sk = GD.CHARS[p.char].skills;
      if (Math.random() < 0.18 + lvl * 0.05) {
        const k = (Math.random() * sk.length) | 0;
        if (p.tp >= sk[k].tp) press(inp, 's' + (k + 1));
      }
      if (GD.CHARS[p.char].passive.special && GD.CHARS[p.char].passive.special !== 'scythe' && p.spCD <= 0 && Math.random() < 0.15) { inp.sel = (Math.random() * 11) | 0; press(inp, 'v'); }
      if (p.item && !GD.ITEMS[p.item].weapon && !GD.ITEMS[p.item].cookie && Math.random() < 0.3) press(inp, 'use');
      if (p.item && GD.ITEMS[p.item].cookie && g.mars) press(inp, 'use');
      if (p.ticket > 0) inp.buy = { seq: (inp.buy ? inp.buy.seq : 0) + 1, item: g.mars ? 'sst' : GD.SHOP_ITEMS[(Math.random() * 9) | 0] };
    }
    const t = g.players.find((q) => q.id === A.target);
    let gx = p.x, gz = p.z, want = 0;
    if (A.itemGoal) {
      const it = g.items.find((i) => i.id === A.itemGoal);
      if (it) { gx = it.x; gz = it.z; want = 0; } else A.itemGoal = null;
    }
    if (!A.itemGoal && A.goMars && g.mars) { gx = g.mars.x; gz = g.mars.z; want = 2.9; }
    else if (!A.itemGoal && t) { gx = t.x; gz = t.z; want = 0.95; }

    // 掴んでいる → 一番近い場外方向へ運んで投げる
    if (p.grab) {
      const ex = Math.abs(p.x) > Math.abs(p.z) ? Math.sign(p.x) : 0, ez = ex ? 0 : Math.sign(p.z) || 1;
      inp.mx = ex; inp.mz = ez; inp.ay = Math.atan2(ex, ez);
      const edgeD = Sim.HALF - Math.max(Math.abs(p.x), Math.abs(p.z));
      const ringShrink = g.t >= GD.T.GACHI ? Math.min(3, Math.floor((g.t - GD.T.GACHI) / 30)) * Sim.TS : 0;
      inp.b.grab = !(edgeD - ringShrink < 2.2 || p.grabT > 3.8);
      return;
    }

    let dx = gx - p.x, dz = gz - p.z;
    const d = len2(dx, dz) || 1;
    let mx = 0, mz = 0;
    if (d > want) { mx = dx / d; mz = dz / d; }
    // 端のチェック
    const ax = p.x + mx * 2.2, az = p.z + mz * 2.2;
    const ahead = (mx || mz) ? groundAt(g, ax, az, p.y) : true;
    if ((mx || mz) && !ahead) {
      const far = groundAt(g, p.x + mx * 3.8, p.z + mz * 3.8, p.y);
      if (far && far.top <= p.y + 0.9 && p.ground && !p.grab) {
        // 隙間をジャンプで越える
        if (len2(gx - p.x, gz - p.z) > 2.5 || A.goMars || A.itemGoal) press(inp, 'jump');
        else { mx = 0; mz = 0; }
      } else if (p.ground) {
        // 端から離れる
        const cx = -p.x, cz = -p.z, cl = len2(cx, cz) || 1;
        mx = cx / cl * 0.7 + mx * 0.1; mz = cz / cl * 0.7 + mz * 0.1;
        if (!groundAt(g, p.x + mx * 1.5, p.z + mz * 1.5, p.y)) { mx = -mx; mz = -mz; }
      }
    } else if (ahead && ahead !== true && ahead.top > p.y + 0.3 && p.ground) press(inp, 'jump'); // 段差を登る
    inp.mx = mx; inp.mz = mz;
    inp.ay = Math.atan2(dx, dz); inp.ap = 0;

    if (t && !A.itemGoal) {
      const td = len2(t.x - p.x, t.z - p.z);
      const W = p.item && GD.ITEMS[p.item].weapon && p.item !== 'monitor' ? p.item : null;
      if (W === 'ar' && td < 20) inp.b.punch = true;
      else if (W === 'sr' && td < 35) { A.sr = (A.sr || 0) + dt; inp.b.punch = A.sr < 0.8; if (A.sr > 1) A.sr = 0; }
      else if (W === 'sg' && td < 4.5) press(inp, 'punch');
      else if (td < 1.5 && Math.abs(t.y - p.y) < 1.4) {
        if ((t.stun > 0 || t.hero > 80 || t.ledge) && !t.grabbedBy && Math.random() < 0.15 + lvl * 0.1) inp.b.grab = true;
        else if (Math.random() < 0.05 + lvl * 0.04) {
          if (Math.random() < 0.15) press(inp, 'head');
          else if (Math.random() < 0.2 && lvl > 1) { A.charge = 0.6; }
          else press(inp, 'punch');
        }
        if (t.punchT > 0 && Math.random() < lvl * 0.12) inp.b.guard = true;
      }
      if (A.charge > 0) { A.charge -= dt; inp.b.punch = A.charge > 0; if (A.charge > 0.55) press(inp, 'punch'); }
      if (p.ground && td < 6 && Math.random() < 0.004 * lvl) inp.b.dash = true;
    }
    if (A.goMars && g.mars && d < 3.4 && Math.random() < 0.4) press(inp, 'punch');
    if (p.char === 'hiro' && Math.random() < 0.02) { /* 気まぐれにリズム */ }
  }
  return { think };
})();
