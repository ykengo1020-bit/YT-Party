// ===== 設定（キー割り当て・感度・音量・画質）=====
'use strict';
window.Settings = (function () {
  const ACTIONS = [
    ['fwd', '前へ移動', 'KeyW'], ['back', '後ろへ移動', 'KeyS'], ['left', '左へ移動', 'KeyA'], ['right', '右へ移動', 'KeyD'],
    ['jump', 'ジャンプ／崖を登る', 'Space'], ['dash', 'ダッシュ', 'ShiftLeft'],
    ['punch', 'パンチ（長押しで溜め）', 'Mouse0'], ['grab', '掴む（長押し）・離して投げる', 'Mouse2'],
    ['head', '頭突き', 'KeyF'], ['guard', 'ガード（長押し）', 'KeyC'],
    ['s1', 'スキル1', 'Digit1'], ['s2', 'スキル2', 'Digit2'], ['s3', 'スキル3', 'Digit3'], ['s4', 'スキル4', 'Digit4'],
    ['v', 'キャラ固有アクション', 'KeyV'], ['g', 'リズム（ヒロ専用）', 'KeyG'],
    ['use', 'アイテムを使う（武器も）', 'KeyE'], ['drop', 'アイテムを投げる', 'KeyQ'], ['shop', 'アイテム交換所', 'KeyT'],
    ['camL', 'カメラを左に回す', 'KeyZ'], ['camR', 'カメラを右に回す', 'KeyX'],
    ['help', '操作説明', 'KeyH'], ['mute', '音のオン／オフ', 'KeyM'],
  ];
  const DEF = {
    keys: Object.fromEntries(ACTIONS.map((a) => [a[0], a[2]])),
    sens: 1.0, invertY: false, camDist: 9.5, fov: 60,
    master: 70, bgm: 40, sfx: 90,
    shadows: true, res: 1.0, shake: true, tags: true, arrows: true,
  };
  let S = load();
  function load() {
    try {
      const j = JSON.parse(localStorage.getItem('yb_settings') || '{}');
      return { ...DEF, ...j, keys: { ...DEF.keys, ...(j.keys || {}) } };
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem('yb_settings', JSON.stringify(S)); } catch (e) { /* noop */ } apply(); }
  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function apply() { listeners.forEach((f) => f(S)); }

  const NAMES = { Space: 'Space', ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl', ControlRight: '右Ctrl', AltLeft: '左Alt', AltRight: '右Alt', Tab: 'Tab', CapsLock: 'CapsLock', Enter: 'Enter', Backspace: 'BackSpace',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse0: '左クリック', Mouse1: 'ホイールクリック', Mouse2: '右クリック', Mouse3: 'マウス戻る', Mouse4: 'マウス進む',
    Backquote: '半角/全角', Minus: '-', Equal: '^', BracketLeft: '@', BracketRight: '[', Semicolon: ';', Quote: ':', Backslash: ']', Comma: ',', Period: '.', Slash: '/', IntlRo: '\\', IntlYen: '¥' };
  function label(code) {
    if (!code) return '（なし）';
    if (NAMES[code]) return NAMES[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'テンキー' + code.slice(6);
    return code;
  }
  function key(action) { return label(S.keys[action]); }
  function actionsFor(code) { return Object.keys(S.keys).filter((a) => S.keys[a] === code); }

  // ---------- 画面 ----------
  let capturing = null;
  function build() {
    const $ = (id) => document.getElementById(id);
    const el = $('setBody');
    const tab = el.dataset.tab || 'keys';
    document.querySelectorAll('#setTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const slider = (k, name, min, max, step, fmt) => `<div class="srow"><span>${name}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${S[k]}" data-k="${k}"><b id="v_${k}">${fmt(S[k])}</b></div>`;
    const check = (k, name) => `<div class="srow"><span>${name}</span><label class="sw"><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}><i></i></label><b></b></div>`;
    const F = { sens: (v) => (+v).toFixed(2) + '倍', camDist: (v) => (+v).toFixed(1) + 'm', fov: (v) => v + '°', pct: (v) => v + '%', res: (v) => Math.round(v * 100) + '%' };
    if (tab === 'keys') {
      el.innerHTML = '<div class="tiny" style="margin-bottom:8px">ボタンをクリックしてから、割り当てたいキーかマウスボタンを押してください（Escで取り消し）。同じキーが他にあると入れ替わります。</div><div class="keygrid">' +
        ACTIONS.map(([a, n]) => `<div class="krow"><span>${n}</span><button class="kbtn ${capturing === a ? 'cap' : ''}" data-a="${a}">${capturing === a ? 'キーを押して…' : label(S.keys[a])}</button></div>`).join('') + '</div>';
      el.querySelectorAll('.kbtn').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); capturing = b.dataset.a; build(); }));
    } else if (tab === 'cam') {
      el.innerHTML = slider('sens', 'マウス感度', 0.2, 3, 0.05, F.sens) + check('invertY', '上下を反転する') + slider('camDist', 'カメラの距離', 6, 16, 0.5, F.camDist) + slider('fov', '視野角', 45, 90, 1, F.fov) + check('shake', '画面の揺れ');
    } else if (tab === 'snd') {
      el.innerHTML = slider('master', '全体の音量', 0, 100, 1, F.pct) + slider('bgm', 'BGM', 0, 100, 1, F.pct) + slider('sfx', '効果音', 0, 100, 1, F.pct);
    } else if (tab === 'gfx') {
      el.innerHTML = check('shadows', '影を表示する') + slider('res', '描画解像度（下げると軽くなる）', 0.5, 1.5, 0.05, F.res) + check('tags', '名前とヘロヘロ値を頭上に表示') + check('arrows', '画面外のプレイヤーを矢印で表示');
    }
    el.querySelectorAll('input[type=range]').forEach((r) => (r.oninput = () => { const k = r.dataset.k; S[k] = +r.value; const f = F[k] || F.pct; $('v_' + k).textContent = f(S[k]); save(); }));
    el.querySelectorAll('input[type=checkbox]').forEach((c) => (c.onchange = () => { S[c.dataset.k] = c.checked; save(); }));
  }
  function capture(code) {
    if (!capturing) return false;
    if (code !== 'Escape') {
      const old = S.keys[capturing];
      for (const a of Object.keys(S.keys)) if (a !== capturing && S.keys[a] === code) S.keys[a] = old; // 入れ替え
      S.keys[capturing] = code;
      save();
    }
    capturing = null; build();
    return true;
  }
  function init() {
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll('#setTabs button').forEach((b) => (b.onclick = () => { capturing = null; $('setBody').dataset.tab = b.dataset.t; build(); }));
    $('setReset').onclick = () => { if (!confirm('すべての設定を初期値に戻しますか？')) return; S = JSON.parse(JSON.stringify(DEF)); save(); build(); };
    window.addEventListener('keydown', (e) => { if (capturing) { e.preventDefault(); e.stopImmediatePropagation(); capture(e.code); } }, true);
    window.addEventListener('mousedown', (e) => { if (capturing && !e.target.classList.contains('kbtn') && !e.target.closest('#setTabs')) { e.preventDefault(); e.stopImmediatePropagation(); capture('Mouse' + e.button); } }, true);
    window.addEventListener('contextmenu', (e) => { if (document.getElementById('settings') && !document.getElementById('settings').classList.contains('hidden')) e.preventDefault(); });
  }
  function open() { capturing = null; document.getElementById('settings').classList.remove('hidden'); build(); }
  function isCapturing() { return !!capturing; }
  return { get: () => S, save, onChange, apply, label, key, actionsFor, ACTIONS, init, open, isCapturing };
})();
