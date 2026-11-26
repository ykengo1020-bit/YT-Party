// ===== メイン：画面遷移・入力・ロビー・同期 =====
'use strict';
(function () {
  const { CHARS, CHAR_KEYS, STATUS, ITEMS, SHOP_ITEMS, RANDOM_POOL, T } = GD;
  const $ = (id) => document.getElementById(id);
  const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
  const SCREENS = ['title', 'select', 'lobby', 'vote'];
  const screen = (id) => SCREENS.forEach((s) => show(s, s === id));

  const S = {
    mode: 'title', role: 'solo', name: '', char: 'kenken',
    lobby: { members: [], lives: 2, cpu: 3, lvl: 2, mode: 0, teams: 2, ff: 0, cpuTeams: [], items: GD.SPAWN_ITEMS.slice(), itemRate: 2 },
    game: null, myPid: 0, peerMap: new Map(),
    snaps: [], fxQ: [], netAcc: 0, inAcc: 0, acc: 0,
    lastSnap: null, ended: false, paused: false, shopOpen: false,
  };
  let thumbs = {};
  const input = { mx: 0, mz: 0, ay: 0, ap: 0, b: {}, c: {}, sel: 0, useHold: false, buy: null };
  const keys = {};
  const cam = { yaw: 0, pitch: 0.42 };

  // ---------- 初期化 ----------
  Render.init($('c'));
  Settings.init();
  Settings.onChange((st) => { Render.applySettings(st); Sfx.setVolumes(st.master, st.bgm, st.sfx); updateKeyTexts(); S.faceSet = false; });
  thumbs = Render.thumbnails();
  Render.previewChar();
  S.name = localStorage.getItem('yb_name') || ('プレイヤー' + ((Math.random() * 90 + 10) | 0));
  S.char = localStorage.getItem('yb_char') || 'kenken';
  if (!CHARS[S.char]) S.char = 'kenken';
  $('name').value = S.name;

  function toast(s, ms = 2200) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }
  function saveName() { S.name = ($('name').value || 'プレイヤー').slice(0, 10); localStorage.setItem('yb_name', S.name); }

  // ---------- キャラ選択 ----------
  let selCb = null, selCur = null;
  function buildCards() {
    const g = $('cards'); g.innerHTML = '';
    for (const k of CHAR_KEYS) {
      const C = CHARS[k];
      const d = document.createElement('div'); d.className = 'card'; d.dataset.k = k;
      d.innerHTML = `<img src="${thumbs[k]}"><div class="nm">${C.name}</div><div class="bars">${['パワー', 'スピード', '重さ'].map((n, i) => `<div class="bar">${n}<i><b style="width:${C.stats[i] * 20}%"></b></i></div>`).join('')}</div>`;
      d.onclick = () => { if (selCur !== k) selSkill = 0; selCur = k; Sfx.init(); Sfx.play('click'); renderSel(); };
      g.appendChild(d);
    }
  }
  let selSkill = 0;
  const SP_VID = { ayu: 1, nimo: 1, takara: 1, hiro: 1, wikitto: 1 };
  function renderSel() {
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.k === selCur));
    const C = CHARS[selCur];
    const resName = { low: '低い', slow: 'やや低い', normal: '普通', shigh: 'やや高い', high: '高い', iron: '鉄壁' }[C.res];
    const hasSp = !!SP_VID[selCur];
    if (selSkill === 'p' && !hasSp) selSkill = 0;
    if (selSkill !== 'p' && selSkill >= C.skills.length) selSkill = 0;
    $('detail').innerHTML = `<div>
        <div class="vbox"><video id="skVid" muted loop playsinline autoplay></video></div>
        <div class="row" style="align-items:baseline;gap:12px"><h3 style="flex:0 0 auto;margin:0">${C.name}</h3><div class="d">${C.desc}</div></div>
        <div class="d" style="margin:4px 0 6px">状態異常耐性：<b>${resName}</b>${C.weak.length ? '（' + C.weak.map((w) => STATUS[w].name).join('・') + 'にかかりやすい）' : ''}</div></div>
      <div><div class="tiny" style="margin-bottom:2px">技をクリックすると上に動画が出ます</div>
        <div class="sk ${hasSp ? 'click' : ''} ${selSkill === 'p' ? 'on' : ''}" data-s="p">${hasSp ? '<span class="play">▶ 動画</span>' : ''}<b>パッシブ【${C.passive.name}】</b><br>${C.passive.desc}</div>
        ${C.skills.map((sk, i) => `<div class="sk click ${selSkill === i ? 'on' : ''}" data-s="${i}"><span class="play">▶ 動画</span><span class="key">${Settings.key('s' + (i + 1))}</span><span class="tp">TP${sk.tp}</span><b>${sk.name}</b><br>${sk.desc}</div>`).join('')}</div>`;
    const v = $('skVid');
    v.src = selSkill === 'p' ? `media/skills/sp_${selCur}.mp4` : `media/skills/sk_${selCur}_${selSkill}.mp4`;
    v.poster = v.src.replace('.mp4', '.jpg');
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
    $('detail').querySelectorAll('.sk.click').forEach((el) => (el.onclick = () => { selSkill = el.dataset.s === 'p' ? 'p' : +el.dataset.s; Sfx.play('click'); renderSel(); }));
  }
  function openSelect(cb) {
    selCb = cb; selCur = S.char; buildCards(); renderSel(); screen('select');
  }
  $('bSelOk').onclick = () => { S.char = selCur; localStorage.setItem('yb_char', S.char); Sfx.play('pickup'); if (selCb) selCb(selCur); };

  // ---------- タイトル ----------
  $('bSolo').onclick = () => { Sfx.init(); saveName(); S.role = 'solo'; openSelect(() => enterLobby()); };
  $('bHost').onclick = async () => {
    Sfx.init(); saveName(); $('tErr').textContent = '部屋を作っています…';
    try {
      const code = await Net.host();
      S.role = 'host'; S.code = code; $('tErr').textContent = '';
      setupHostNet();
      openSelect(() => enterLobby());
    } catch (e) { $('tErr').textContent = e.message || String(e); Net.close(); }
  };
  $('bJoin').onclick = async () => {
    Sfx.init(); saveName();
    const code = $('roomIn').value.trim().toUpperCase();
    if (code.length < 4) { $('tErr').textContent = '部屋コードを入れてください'; return; }
    $('tErr').textContent = '接続中…';
    setupClientNet();
    try {
      await Net.join(code);
      S.role = 'client'; S.code = code; $('tErr').textContent = '';
      openSelect((c) => { Net.sendHost({ t: 'char', char: c }); screen('lobby'); renderLobby(); });
      Net.sendHost({ t: 'hello', name: S.name, char: S.char });
    } catch (e) { $('tErr').textContent = e.message || String(e); Net.close(); }
  };
  $('roomIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('bJoin').click(); });
  $('bHelp').onclick = () => show('help'); $('bRules').onclick = () => openRules();
  $('bRules2').onclick = () => openRules();
  $('bSet').onclick = () => Settings.open(); $('bSet2').onclick = () => Settings.open();
  // ---------- ルール説明（動画つき）----------
  const K = (a) => '<kbd>' + Settings.key(a) + '</kbd>';
  const RULES = [
    { v: 'rule_punch', t: '殴ってヘロヘロ値を上げる', x: () => `${K('punch')}でパンチ。当てるたびに相手の<b>ヘロヘロ値（%）</b>が上がります。<b>3連続で当てるとコンボ</b>になり、3発目で大きく吹っ飛ばせます。<br>${K('punch')}を長押しすると<b>溜めパンチ</b>。手が光ったら離すと大きく吹っ飛ばせます。空中で押すとドロップキック。<br>ヘロヘロ値は時間では減らず、<b>100%を超えて999%まで</b>溜まります（落ちると0%に戻る）。` },
    { v: 'rule_smash', t: 'ヘロヘロ値が高いほど遠くへ吹っ飛ぶ', x: () => `ヘロヘロ値が高い相手ほど、同じ攻撃でも遠くまで飛びます。100%前後の溜めパンチなら中央からでも場外まで飛ぶことも。<br><b>場外に落ちるとライフ-1</b>。ライフ（1〜3、ロビーで選ぶ）が0になると脱落、<b>最後の一人が優勝</b>です。<br>落ちてもライフが残っていれば3秒後に空から復帰します。` },
    { v: 'rule_grab', t: '掴んで、持ち上げて、投げる', x: () => `${K('grab')}を長押しすると目の前の相手を掴みます。<b>0.5秒以上掴むと持ち上げ</b>、ボタンを離すと向いている方向へ投げます。<br>掴んだまま場外のほうへ歩いて行って投げるのが一番の勝ち筋。<br>掴まれた側は ${K('punch')} や ${K('jump')} を連打すると振りほどけます。` },
    { v: 'rule_stun', t: '100%・150%・200%…で気絶', x: () => `ヘロヘロ値が<b>100%・150%・200%…と50%刻みのラインを超えるたびに約1.3秒気絶</b>します（頭の上に星）。<br>気絶した相手は掴んで運び放題。ヘロヘロ値が高いほど、掴まれたときに振りほどくのも大変になります。` },
    { v: 'rule_ledge', t: '二段ジャンプと崖つかまりで復帰', x: () => `空中でもう1回 ${K('jump')} が使えます（<b>二段ジャンプ</b>。宙返りしながら高く跳ぶ）。地面・浮き床・崖につかまると回復します。<br>ステージの端に手が届くと<b>自動で崖につかまり</b>ます。${K('jump')}で登る、${K('dash')}で手を離す。<br>崖につかまっている相手は殴ると手を離します。` },
    { v: 'rule_guard', t: 'ガードと頭突き', x: () => `${K('guard')}を長押しすると<b>正面からのパンチをほぼ防げます</b>（青い火花）。ただし掴みは防げません。<br>${K('head')}は頭突き。届く距離は短いけれどヘロヘロ値が大きく上がります。` },
    { v: 'rule_item', t: 'アイテム', x: () => `ステージにはアイテムが湧きます。手ぶらで触れると拾います。<br><b>どのアイテムも ${K('use')} で使う</b>（武器なら撃つ・振る）、${K('drop')}で投げる。武器を持っていても ${K('punch')} は素手のパンチです。<br><table><tr><td>AR</td><td>長押しで連射して押し出す</td></tr><tr><td>SR</td><td>長押しで溜めて、離すと撃つ。大ふっとび</td></tr><tr><td>SG</td><td>近距離で特大ふっとび</td></tr><tr><td>モニター</td><td>振り回してモニターパンチ</td></tr><tr><td>LANケーブル</td><td>投げて相手を5秒縛る</td></tr><tr><td>ゲーミングチェア</td><td>乗って突進</td></tr><tr><td>エナドリ／五苓散／デトックス</td><td>スピードアップ／状態異常回復／状態異常無効</td></tr></table>` },
    { v: null, t: '浮き床と地形', x: () => `ステージには高低差と<b>浮き床</b>があります。浮き床は<b>下からジャンプですり抜けて上に乗れます</b>。<br>浮き床から降りたいときは ${K('guard')} を押しながら ${K('jump')}。<br>動く浮き床は乗っている人を一緒に運びます。段差は普通のジャンプで登れる高さです。` },
    { v: null, t: 'チーム戦', x: () => `ロビーでホストが<b>「チーム戦」</b>を選ぶと、2〜4チームに分かれて戦えます。<br>自分のカードをクリックするとチームが変わります（ホストはCPUも含めて全員を変えられる）。<br>「味方への攻撃：当たらない」なら、味方にはパンチ・掴み・スキルが当たりません。「当たる」にすると巻き込み注意。<br><b>相手チームを全員脱落させたチームの勝ち</b>。足元の輪と名前の色が自分のチームの色です。` },
    { v: null, t: 'TP・スキル・交換券', x: () => `<b>TPは5秒ごとに1ずつ</b>自動で貯まります（最大30）。相手を落とすと+2、投げると+1。<br>${K('s1')}〜${K('s4')}でキャラごとのスキル（TPを消費）、${K('v')}でキャラ固有アクション。<br>スキルの中身はキャラ選択画面で<b>動画つきで確認</b>できます。<br>相手を3回落とすと<b>アイテム交換券</b>。${K('shop')}で好きなアイテムと交換できます。` },
    { v: null, t: '状態異常', x: () => `スキルで状態異常にかかることがあります。重ねがけされると段階（Lv）が上がり長引きます。<table>${GD.STATUS_KEYS.map((k) => `<tr><td><span class="chip" style="background:${STATUS[k].color}">${STATUS[k].name}</span></td><td>${STATUS_DESC[k]}</td></tr>`).join('')}</table>` },
    { v: 'rule_gachi', t: '時間で変わるステージ', x: () => `<table><tr><td><b>0:00〜3:00</b></td><td>ギミック期。1分ごとにギミックが変わる（強風・すべる床・ベルトコンベア・崩れる床・消える床・上下する床）</td></tr><tr><td><b>3:00〜</b></td><td>ガチ乱闘期。外周が赤く光ってから30秒ごとに崩れていく。復帰直後の無敵なし</td></tr></table>30秒ごとにイベント抽選：アイテムシャッフル／アイテム配布／停電（真っ暗→全員TP+5）／食中毒（全員5G）。` },
    { v: 'rule_mars', t: '9:00 Mars襲来', x: () => `決着がつかないまま9分経つと<b>Mars</b>が降ってきます。周りを叩きつけたり、隕石や流星群を落としてきます。<br>勝つ方法は2つ：<b>耐久値90を削り切る</b>か、<b>3分以内に状態異常を7回当てる</b>。勝てば生き残った全員の勝利。<br>3分を過ぎると毎20秒「★おしまい★」の抽選が始まり、当たると全員敗北です。` },
    { v: 'rule_cookie', t: 'クッキー☆アイテム', x: () => `Mars戦中は<b>SST</b>が出現します。${K('use')}でMarsに使うと<b>30%で撃退</b>（勝利ではなく、ゲームが続く）。<br>${K('use')}長押し＋TP20で<b>改造SST</b>に改造すると確定で撃退できます。<br>撃退すると18:00に<b>Mars（真）</b>が乱入。21:00までに優勝者が出なければ強制終了です。` },
  ];
  const STATUS_DESC = {
    majigire: 'パンチ1.5倍。でもガードできず、手を離すと勝手に前進', kyouki: '掴み・投げ2倍で振りほどかれない。ときどき操作が反転', lag: '入力が0.4秒遅れ、ときどき少し前の位置に戻る',
    nanchou: '音がほぼ聞こえず、名札と画面外の矢印が消える', g5: '10秒ごとにお腹を抱えて2秒動けない', gamechu: '画面の半分が別ゲーで埋まる',
    hagotae: '掴みが振りほどかれにくい。ときどき噛んで固まる、ジャンプが低い', hiroyuki: '殴られると自動で「論破！」して押し返す。自分のパンチは弱くなる',
    musicbot: 'BGMのビートに合わせて殴ると強化（ヒロは2倍）', takawarai: '笑いが止まらず2秒動けない', naeochi: '5秒棒立ち。TP-2',
    keyboard: 'パンチ・掴み・ジャンプ・ダッシュのどれか1つが使えない', tapioka: 'うぃきっとを攻撃できない。近くにいると動きが遅い',
  };
  let rulePage = 0;
  function openRules() { show('rules'); drawRules(); if (document.pointerLockElement) document.exitPointerLock(); }
  function drawRules() {
    const r = RULES[rulePage];
    $('rbNav').innerHTML = RULES.map((x, i) => `<button class="${i === rulePage ? 'on' : ''}" data-i="${i}"><span class="n">${i + 1}</span>${x.t}${x.v ? '<span class="v">▶</span>' : ''}</button>`).join('');
    $('rbNav').querySelectorAll('button').forEach((b) => (b.onclick = () => { rulePage = +b.dataset.i; Sfx.play('click'); drawRules(); }));
    $('rbTitle').textContent = r.t; $('rbText').innerHTML = r.x();
    const v = $('rbVid');
    show('rbNone', !r.v); v.classList.toggle('hidden', !r.v);
    if (r.v) { v.src = `media/rules/${r.v}.mp4`; v.poster = `media/rules/${r.v}.jpg`; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
    else { v.removeAttribute('src'); v.load(); $('rbNone').textContent = r.t; }
    $('rbPage').textContent = `${rulePage + 1} / ${RULES.length}`;
    $('rbPrev').disabled = rulePage === 0; $('rbNext').disabled = rulePage === RULES.length - 1;
  }
  $('rbPrev').onclick = () => { if (rulePage > 0) { rulePage--; drawRules(); } };
  $('rbNext').onclick = () => { if (rulePage < RULES.length - 1) { rulePage++; drawRules(); } };

  // 操作説明などのキー表示を設定に合わせる
  function updateKeyTexts() {
    const raw = (a) => Settings.get().keys[a];
    const cap = (a) => { const c = raw(a), l = Settings.key(a); return `<span class="cap ${c && c.startsWith('Mouse') ? 'm' : ''} ${l.length > 3 ? 'wide' : ''}">${esc(l)}</span>`; };
    const row = (keys, t, sub) => `<div class="hrow"><div class="ks">${keys}</div><div class="t">${t}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
    const card = (title, color, body) => `<div class="hcard"><h4 style="background:${color}">${title}</h4><div class="hb">${body}</div></div>`;
    const plus = '<i>＋</i>';
    // マウスの図：割り当てられているボタンに色をつける
    const mb = (n) => Object.keys(Settings.get().keys).filter((a) => raw(a) === 'Mouse' + n).map((a) => (Settings.ACTIONS.find((x) => x[0] === a) || [0, a])[1].replace(/（.*?）/g, '')).join('／') || '—';
    const mouseSvg = `<svg width="62" height="88" viewBox="0 0 62 88"><rect x="3" y="3" width="56" height="82" rx="28" fill="#fff" stroke="#15121f" stroke-width="4"/><path d="M31 3 V38 M3 38 H59" stroke="#15121f" stroke-width="3"/><path d="M5 36 V30 A26 26 0 0 1 29 5 V36 Z" fill="#ff4d8d"/><path d="M33 5 A26 26 0 0 1 57 30 V36 H33 Z" fill="#3be2ff"/><rect x="27" y="12" width="8" height="16" rx="4" fill="#ffd23b" stroke="#15121f" stroke-width="2.5"/></svg>`;
    $('helpKeys').innerHTML = [
      card('移動', '#3b82f6',
        `<div class="hrow"><div class="wasd">${cap('fwd')}${cap('left')}${cap('back')}${cap('right')}</div><div class="t">移動<small>カメラの向きが「前」</small></div></div>` +
        row(cap('jump'), 'ジャンプ', '空中でもう1回＝二段ジャンプ。崖では登る') +
        row(cap('dash'), 'ダッシュ', '崖につかまっているときは手を離す') +
        row(cap('guard') + plus + cap('jump'), '浮き床から降りる')),
      card('攻撃', '#ef4444',
        row(cap('punch'), 'パンチ', '左右交互。3連続で当てるとコンボで大きく吹っ飛ぶ') +
        row(cap('punch') + '<i>長押し</i>', '溜めパンチ', '手が光ったら離す') +
        row(cap('head'), '頭突き', '届く距離は短いがヘロヘロ値が大きく上がる') +
        row(cap('guard') + '<i>長押し</i>', 'ガード', '正面のパンチを防ぐ（掴みは防げない）')),
      card('掴み・投げ', '#f97316',
        row(cap('grab') + '<i>長押し</i>', '掴む', '0.5秒以上で持ち上げる') +
        row('<i>離す</i>', '投げる', '向いている方向へ。場外の近くで投げると強い') +
        row(cap('punch') + '<i>連打</i>', '掴まれたら振りほどく', 'ジャンプの連打でもOK。ヘロヘロ値が高いほど大変')),
      card('スキル', '#7c5cff',
        row(cap('s1') + cap('s2') + cap('s3') + cap('s4'), 'スキル', 'TPを使う。TPは5秒ごとに1ずつ貯まる') +
        row(cap('v'), 'キャラ固有アクション', 'ayuのバイク・にもの大鎌・タカラソドの武器呼び出し') +
        row('<span class="cap wide">ホイール</span>', '選ぶ', 'ロール付与の状態異常・呼び出す武器') +
        row(cap('g') + '<i>×8</i>', 'リズム（ヒロ専用）', '0.5秒間隔で刻むとアイテム')),
      card('アイテム', '#16a34a',
        row('<i>触れる</i>', '拾う', '手ぶらのときに近づくだけ') +
        row(cap('use'), '使う', 'どのアイテムもこのボタン。AR・SRは長押し、SRは離して撃つ') +
        row(cap('use') + '<i>長押し</i>', 'SSTを改造', 'TP20を使って確定で撃退できる改造SSTに') +
        row(cap('drop'), '投げる', '投げたアイテムは当たると少しダメージ') +
        row(cap('shop'), '交換所', '相手を3回落とすと交換券がもらえる')),
      card('カメラ・その他', '#64748b',
        `<div class="hrow"><div class="ks mouse">${mouseSvg}</div><div class="t">マウス<small><b style="color:#e11d74">左</b> ${mb(0)}<br><b style="color:#0891b2">右</b> ${mb(2)}<br><b style="color:#b45309">ホイール</b> 選ぶ</small></div></div>` +
        row(cap('camL') + cap('camR'), 'カメラを回す', 'マウスでも回せる（画面をクリックで固定）') +
        row(cap('help') + cap('mute'), '操作説明 ／ 音オンオフ') +
        row('<span class="cap wide">Esc</span>', 'メニュー', '設定・ルール説明・タイトルへ')),
    ].join('');
    $('helpTip').innerHTML = 'キーやマウス感度は「設定」から好きなように変えられます。この画面の表示も変えたキーに合わせて変わります。';
    $('hint').textContent = `[${Settings.key('help')}] 操作説明　[${Settings.key('mute')}] 音　[Esc] 設定・メニュー`;
  }
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.ov').classList.add('hidden')));

  // ---------- ロビー ----------
  function enterLobby() {
    const L = S.lobby;
    if (S.role !== 'client') {
      const me = L.members.find((m) => m.key === 'me');
      if (me) { me.char = S.char; me.name = S.name; } else L.members.unshift({ key: 'me', name: S.name, char: S.char });
    }
    screen('lobby'); renderLobby(); pushLobby();
  }
  function pushLobby() { if (S.role === 'host') Net.broadcast({ t: 'lobby', L: lobbyPublic() }); }
  function lobbyPublic() {
    const L = S.lobby; fixTeams();
    return { members: L.members.map((m) => ({ key: m.key, name: m.name, char: m.char, team: m.team | 0 })), lives: L.lives, cpu: L.cpu, lvl: L.lvl, mode: L.mode, teams: L.teams, ff: L.ff, cpuTeams: L.cpuTeams, items: L.items, itemRate: L.itemRate, playing: S.mode === 'game' && !S.ended };
  }
  // チーム：人数が少ないチームへ自動で入れる。範囲外のチームは直す
  function cpuCount() { const L = S.lobby; return Math.max(0, Math.min(L.cpu, 8 - L.members.length)); }
  function smallestTeam(extra = []) {
    const L = S.lobby, n = Array(L.teams).fill(0);
    L.members.forEach((m) => { if (m.team < L.teams) n[m.team]++; });
    extra.forEach((t) => n[t]++);
    return n.indexOf(Math.min(...n));
  }
  function fixTeams() {
    const L = S.lobby;
    L.members.forEach((m) => { if (m.team === undefined || m.team >= L.teams) m.team = smallestTeam(); });
    const cpus = [];
    for (let i = 0; i < cpuCount(); i++) {
      let t = L.cpuTeams[i];
      if (t === undefined || t >= L.teams) t = smallestTeam(cpus);
      cpus.push(t);
    }
    L.cpuTeams = cpus;
  }
  function rebalance() { const L = S.lobby; L.members.forEach((m, k) => (m.team = k % L.teams)); L.cpuTeams = []; fixTeams(); }
  function cycleTeam(key) {
    const L = S.lobby;
    if (key.startsWith('cpu:')) { const i = +key.slice(4); L.cpuTeams[i] = ((L.cpuTeams[i] | 0) + 1) % L.teams; }
    else { const m = L.members.find((x) => x.key === key); if (m) m.team = ((m.team | 0) + 1) % L.teams; }
    Sfx.play('click'); renderLobby(); pushLobby();
  }
  function renderLobby() {
    const L = S.lobby;
    const isHost = S.role !== 'client';
    if (isHost) fixTeams();
    const team = !!L.mode;
    const myKey = S.role === 'client' ? Net.myId : 'me';
    $('lbTitle').textContent = S.role === 'solo' ? 'CPU戦の準備' : isHost ? 'ロビー（あなたがホスト）' : 'ロビー';
    show('codeBox', S.role !== 'solo');
    $('code').textContent = S.code || '-----';
    show('hostOpts', isHost);
    show('teamOpts', isHost && team);
    $('bStart').classList.toggle('hidden', !isHost);
    const badge = (t) => (team ? `<div class="tbadge" style="background:${GD.TEAMS[t].css}">${GD.TEAMS[t].name}チーム</div>` : '');
    const tstyle = (t) => (team ? `style="border-color:${GD.TEAMS[t].css};box-shadow:0 0 0 3px ${GD.TEAMS[t].css}55"` : '');
    const canClick = (key) => team && (isHost || key === myKey);
    const list = L.members.map((m) => `<div class="mem ${canClick(m.key) ? 'tclick' : ''} ${m.key === myKey ? 'mine' : ''}" data-key="${esc(m.key)}" ${tstyle(m.team | 0)}>${badge(m.team | 0)}<img src="${thumbs[m.char]}"><div>${esc(m.name)}${m.key === myKey ? '（あなた）' : ''}</div><div class="who">${CHARS[m.char].name}</div></div>`);
    const cpuN = Math.min(L.cpu, 8 - L.members.length);
    for (let i = 0; i < cpuN; i++) { const t = (L.cpuTeams && L.cpuTeams[i]) | 0; list.push(`<div class="mem cpu ${team && isHost ? 'tclick' : ''}" data-key="cpu:${i}" ${tstyle(t)}>${badge(t)}<img src="${thumbs[CHAR_KEYS[(i * 3 + 1) % 8]]}" style="opacity:.35"><div>CPU ${i + 1}</div><div class="who">ランダム</div></div>`); }
    $('members').innerHTML = list.join('');
    $('members').querySelectorAll('.tclick').forEach((el) => (el.onclick = () => {
      if (S.role === 'client') { Net.sendHost({ t: 'team' }); Sfx.play('click'); }
      else cycleTeam(el.dataset.key);
    }));
    const modeTxt = team ? `チーム戦（${L.teams}チーム・味方への攻撃${L.ff ? 'あり' : 'なし'}）` : '個人戦';
    $('lbNote').textContent = S.role === 'client'
      ? (L.playing ? '今は試合中です。終わったら次の試合から一緒に遊べます' : `ホストのスタート待ち… ${modeTxt}・ライフ${L.lives}${team ? '・自分のカードをクリックでチーム変更' : ''}`)
      : S.role === 'host' ? `参加者 ${L.members.length}人 ／ 最大8人（CPU含む）　${modeTxt}${team ? '・カードをクリックでチーム変更' : ''}` : (team ? 'カードをクリックでチーム変更' : '');
    ['segLives', 'segCpu', 'segLvl', 'segMode', 'segTeams', 'segFF', 'segRate'].forEach((id, i) => { const v = [L.lives, L.cpu, L.lvl, L.mode, L.teams, L.ff, L.itemRate][i]; $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === v)); });
    // 出るアイテム
    $('itemToggles').innerHTML = GD.SPAWN_ITEMS.map((k) => `<button class="itog ${L.items.includes(k) ? 'on' : ''}" data-k="${k}" ${isHost ? '' : 'disabled'} title="${ITEMS[k].desc}">${ITEMS[k].name}</button>`).join('');
    $('itemToggles').querySelectorAll('.itog').forEach((b) => (b.onclick = () => {
      const k = b.dataset.k; L.items = L.items.includes(k) ? L.items.filter((x) => x !== k) : L.items.concat(k);
      Sfx.play('click'); renderLobby(); pushLobby();
    }));
    $('itemNone').onclick = () => { L.items = []; renderLobby(); pushLobby(); };
    $('itemAll').onclick = () => { L.items = GD.SPAWN_ITEMS.slice(); renderLobby(); pushLobby(); };
    $('itemSummary').textContent = L.itemRate === 0 || !L.items.length ? 'アイテムなし' : `${L.items.length}種類・出現量${['なし', '少なめ', '普通', '多め'][L.itemRate]}`;
  }
  function seg(id, key, after) { $(id).querySelectorAll('button').forEach((b) => (b.onclick = () => { S.lobby[key] = +b.dataset.v; if (after) after(); Sfx.play('click'); renderLobby(); pushLobby(); })); }
  seg('segRate', 'itemRate'); seg('segMode', 'mode', rebalance); seg('segTeams', 'teams', rebalance); seg('segFF', 'ff');
  seg('segLives', 'lives'); seg('segCpu', 'cpu'); seg('segLvl', 'lvl');
  $('bChar').onclick = () => openSelect((c) => { if (S.role === 'client') { Net.sendHost({ t: 'char', char: c }); screen('lobby'); renderLobby(); } else enterLobby(); });
  $('bCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(S.code); toast('コピーしました：' + S.code); };
  $('bLeave').onclick = () => { if (S.role === 'host' && S.lobby.members.length > 1 && !confirm('部屋を閉じますか？（みんなの接続が切れます）')) return; toTitle(); };
  $('bStart').onclick = () => beginVote();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- ネット（ホスト側）----------
  function setupHostNet() {
    Net.on('join', (pid) => { /* helloを待つ */ });
    Net.on('data', (pid, d) => {
      if (!d || !d.t) return;
      if (d.t === 'hello') {
        if (S.lobby.members.length >= 8) { Net.send(pid, { t: 'full' }); return; }
        S.lobby.members.push({ key: pid, name: String(d.name || '?').slice(0, 10), char: CHARS[d.char] ? d.char : 'kenken', team: smallestTeam() });
        renderLobby(); pushLobby(); Sfx.play('pickup');
        toast(d.name + ' が参加しました' + (S.mode === 'game' && !S.ended ? '（次の試合から）' : ''));
      } else if (d.t === 'team') {
        if (S.lobby.mode && !(S.mode === 'game' && !S.ended)) cycleTeam(pid);
      } else if (d.t === 'char') {
        const m = S.lobby.members.find((x) => x.key === pid); if (m && CHARS[d.char]) { m.char = d.char; renderLobby(); pushLobby(); }
      } else if (d.t === 'mvote') {
        if (S.vote && GD.MAP_KEYS.concat('random').includes(d.map)) { S.vote.votes[pid] = d.map; voteUpdate(); }
      } else if (d.t === 'i') {
        const p = S.game && S.game.players.find((x) => x.id === S.peerMap.get(pid));
        if (p && !p.bot) p.input = sanitize(d.i);
      }
    });
    Net.on('leave', (pid) => {
      const i = S.lobby.members.findIndex((m) => m.key === pid);
      if (i >= 0) { toast(S.lobby.members[i].name + ' が抜けました'); S.lobby.members.splice(i, 1); }
      if (S.game) { const p = S.game.players.find((x) => x.id === S.peerMap.get(pid)); if (p) { p.bot = true; p.cpu = 2; p.name += '(CPU)'; } }
      if (S.vote) { delete S.vote.votes[pid]; voteUpdate(); }
      renderLobby(); pushLobby();
    });
  }
  function sanitize(i) {
    const o = { mx: +i.mx || 0, mz: +i.mz || 0, ay: +i.ay || 0, ap: +i.ap || 0, b: {}, c: {}, sel: (i.sel | 0), useHold: !!i.useHold, buy: null };
    for (const k of ['jump', 'punch', 'grab', 'dash', 'guard', 'head', 'use']) o.b[k] = !!(i.b && i.b[k]);
    for (const k of ['jump', 'punch', 'head', 'use', 'drop', 's1', 's2', 's3', 's4', 'v', 'g', 'grabc']) o.c[k] = (i.c && i.c[k]) | 0;
    if (i.buy && typeof i.buy.item === 'string') o.buy = { seq: i.buy.seq | 0, item: i.buy.item };
    return o;
  }
  // ---------- ネット（参加者側）----------
  function setupClientNet() {
    Net.on('data', (pid, d) => {
      if (!d || !d.t) return;
      if (d.t === 'lobby') {
        Object.assign(S.lobby, d.L);
        if (S.mode === 'game' && S.ended) { endGameView(); S.mode = 'lobby'; }
        if (S.mode !== 'game' && $('select').classList.contains('hidden') && !S.voteView) { S.mode = 'lobby'; screen('lobby'); }
        renderLobby();
      } else if (d.t === 'vote') {
        openVote(d.left);
      } else if (d.t === 'votes') {
        if (S.voteView) { S.voteView.tally = d.tally; S.voteView.left = d.left; S.voteView.voters = d.voters; drawVote(); }
      } else if (d.t === 'voteEnd') {
        if (S.voteView) { S.voteView.win = d.map; S.voteView.tally = d.tally; S.voteView.left = 0; drawVote(); }
      } else if (d.t === 'start') {
        S.voteView = null;
        S.myPid = d.you; Render.setMyId(d.you); S.snaps = []; S.fxQ = []; beginGameView();
      } else if (d.t === 's') {
        S.snaps.push({ at: performance.now(), s: d.s });
        if (S.snaps.length > 30) S.snaps.shift();
        if (d.f && d.f.length) S.fxQ.push(...d.f);
      } else if (d.t === 'busy') { $('tErr').textContent = 'その部屋は試合中です。終わるまで待ってね'; toTitle(true); }
      else if (d.t === 'full') { $('tErr').textContent = '部屋が満員です'; toTitle(true); }
    });
    Net.on('leave', () => { toast('ホストとの接続が切れました', 3500); toTitle(); });
  }

  // ---------- マップ投票 ----------
  const mapImg = {};
  GD.MAP_KEYS.forEach((k) => (mapImg[k] = Render.mapPreview(k)));
  const VOTE_SEC = 12;
  function beginVote() {
    const L = S.lobby;
    if (L.members.length + Math.min(L.cpu, 8 - L.members.length) < 2) { toast('CPUを1人以上にするか、友達を呼んでね'); return; }
    if (L.mode) { fixTeams(); const ts = new Set(L.members.map((m) => m.team).concat(L.cpuTeams)); if (ts.size < 2) { toast('チーム戦は2チーム以上に分かれてね（カードをクリックでチーム変更）'); return; } }
    S.vote = { votes: {}, end: performance.now() + VOTE_SEC * 1000, done: false };
    openVote(VOTE_SEC);
    if (S.role === 'host') Net.broadcast({ t: 'vote', left: VOTE_SEC });
    clearInterval(S.voteTimer);
    S.voteTimer = setInterval(voteUpdate, 250);
    voteUpdate();
  }
  function tallyVotes() {
    const t = {}; for (const k of GD.MAP_KEYS.concat('random')) t[k] = 0;
    for (const v of Object.values(S.vote.votes)) t[v]++;
    return t;
  }
  function voteUpdate() {
    const V = S.vote; if (!V || V.done) return;
    const left = Math.max(0, (V.end - performance.now()) / 1000);
    const tally = tallyVotes();
    const humans = S.lobby.members.length, voted = Object.keys(V.votes).length;
    if (S.role === 'host') Net.broadcast({ t: 'votes', tally, left, voters: voted + '/' + humans });
    if (S.voteView) { S.voteView.tally = tally; S.voteView.left = left; S.voteView.voters = voted + '/' + humans; drawVote(); }
    if (left <= 0 || voted >= humans) {
      V.done = true; clearInterval(S.voteTimer);
      // 一番多いマップ（同票はランダム）。「ランダム」が勝ったら全マップから抽選
      let best = -1, cands = [];
      for (const [k, n] of Object.entries(tally)) { if (n > best) { best = n; cands = [k]; } else if (n === best) cands.push(k); }
      let win = cands[(Math.random() * cands.length) | 0];
      if (best === 0 || win === 'random') win = GD.MAP_KEYS[(Math.random() * GD.MAP_KEYS.length) | 0];
      if (S.role === 'host') Net.broadcast({ t: 'voteEnd', map: win, tally });
      if (S.voteView) { S.voteView.win = win; S.voteView.left = 0; drawVote(); }
      Sfx.play('start');
      setTimeout(() => { S.vote = null; startGame(win); }, 1800);
    }
  }
  function openVote(left) {
    S.voteView = { mine: null, tally: {}, left, voters: '', win: null };
    if (document.pointerLockElement) document.exitPointerLock();
    show('result', false); show('hud', false);
    screen('vote');
    $('voteGrid').innerHTML = GD.MAP_KEYS.concat('random').map((k) => {
      const M = GD.MAPS[k];
      return `<div class="card mapc" data-k="${k}">${M ? `<img src="${mapImg[k]}">` : '<div class="rnd">？</div>'}<div class="nm">${M ? M.name : 'ランダム'}</div><div class="d tiny">${M ? M.desc : 'どれになるかはお楽しみ'}</div><div class="cnt" id="vc_${k}"></div></div>`;
    }).join('');
    $('voteGrid').querySelectorAll('.mapc').forEach((c) => (c.onclick = () => castVote(c.dataset.k)));
    drawVote();
  }
  function castVote(k) {
    const V = S.voteView; if (!V || V.win) return;
    V.mine = k; Sfx.play('click');
    if (S.role === 'client') Net.sendHost({ t: 'mvote', map: k });
    else if (S.vote) { S.vote.votes.me = k; voteUpdate(); }
    drawVote();
  }
  function drawVote() {
    const V = S.voteView; if (!V) return;
    $('voteT').textContent = V.win ? '決定！ ' + GD.MAPS[V.win].name : '残り ' + Math.ceil(V.left) + '秒';
    $('voteN').textContent = V.voters ? '投票済み ' + V.voters : '';
    document.querySelectorAll('.mapc').forEach((c) => {
      const k = c.dataset.k;
      c.classList.toggle('sel', V.mine === k);
      c.classList.toggle('win', V.win === k);
      c.classList.toggle('lose', !!V.win && V.win !== k);
      const n = (V.tally && V.tally[k]) || 0;
      $('vc_' + k).innerHTML = '●'.repeat(n) || '&nbsp;';
    });
  }

  // ---------- 試合開始 ----------
  function startGame(map) {
    const L = S.lobby;
    fixTeams();
    const g = new Sim.Game({ lives: L.lives, map, teamMode: !!L.mode, ff: !!L.ff, items: L.items, itemRate: L.itemRate });
    S.peerMap.clear();
    for (const m of L.members) {
      const p = g.addPlayer({ name: m.name, char: m.char, team: m.team | 0 });
      if (m.key === 'me') S.myPid = p.id; else S.peerMap.set(m.key, p.id);
    }
    const cpuN = Math.min(L.cpu, 8 - L.members.length);
    const used = new Set(L.members.map((m) => m.char));
    const pool = CHAR_KEYS.filter((k) => !used.has(k));
    for (let i = 0; i < cpuN; i++) {
      const ch = pool.length ? pool.splice((Math.random() * pool.length) | 0, 1)[0] : CHAR_KEYS[(Math.random() * 8) | 0];
      g.addPlayer({ name: 'CPU' + (i + 1), char: ch, bot: true, cpu: L.lvl, team: L.cpuTeams[i] | 0 });
    }
    if (g.players.length < 2) { toast('CPUを1人以上にするか、友達を呼んでね'); screen('lobby'); return; }
    if (L.mode && new Set(g.players.map((p) => p.team)).size < 2) { toast('チーム戦は2チーム以上に分かれてね'); screen('lobby'); return; }
    g.start();
    S.voteView = null;
    S.game = g;
    Render.setMyId(S.myPid);
    if (S.role === 'host') for (const [pid, id] of S.peerMap) Net.send(pid, { t: 'start', you: id });
    beginGameView();
  }
  function beginGameView() {
    S.mode = 'game'; S.ended = false; S.acc = 0; S.netAcc = 0;
    SCREENS.forEach((s) => show(s, false)); show('result', false);
    show('hud'); Render.clear();
    $('board').innerHTML = '';
    const me = () => (S.lastSnap ? S.lastSnap.p.find((p) => p.id === S.myPid) : null);
    S.faceSet = false;
    cam.yaw = 0; cam.pitch = 0.42;
    Sfx.bgm(true);
    requestLock();
    setTimeout(() => { if (S.mode === 'game' && document.pointerLockElement !== canvas) { show('pause'); $('pauseNote').textContent = '画面をクリック（または「つづける」）で操作開始'; } }, 400);
  }
  function endGameView() { clearInterval(S.resTimer); $('arrows').innerHTML = ''; arrowEls.clear(); show('hud', false); show('result', false); show('gamechu', false); $('vig').className = ''; document.body.classList.remove('kyouki'); Sfx.bgm(false); }
  function toTitle(keepErr) {
    if (!keepErr) $('tErr').textContent = '';
    Net.close();
    S.mode = 'title'; S.role = 'solo'; S.game = null; S.lobby.members = []; S.ended = false;
    S.vote = null; S.voteView = null; clearInterval(S.voteTimer);
    endGameView(); show('pause', false); show('shop', false);
    Render.clear(); Render.previewChar(); screen('title');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- 入力 ----------
  const canvas = $('c');
  // マウスの加速を切った生の移動量でロック（対応ブラウザのみ。だめなら普通にロック）
  function requestLock() {
    if (S.mode !== 'game' || S.ended || S.shopOpen || !canvas.requestPointerLock) return;
    try {
      const r = canvas.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) { /* noop */ } });
    } catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* noop */ } }
  }
  let lockAt = 0;
  canvas.addEventListener('click', () => { Sfx.init(); requestLock(); });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    lockAt = performance.now();
    if (S.mode === 'game' && !S.ended && !locked && !S.shopOpen && $('help').classList.contains('hidden') && $('settings').classList.contains('hidden') && $('rules').classList.contains('hidden')) { show('pause'); $('pauseNote').textContent = S.role === 'solo' ? 'ゲームは一時停止しています' : 'オンライン対戦中はゲームは止まりません'; S.paused = S.role === 'solo'; }
    if (locked) { show('pause', false); S.paused = false; }
  });
  $('bResume').onclick = () => { show('pause', false); S.paused = false; requestLock(); };
  $('bHelp2').onclick = () => show('help');
  $('bSet3').onclick = () => Settings.open();
  $('helpSet').onclick = () => { $('help').classList.add('hidden'); Settings.open(); };
  $('bQuit').onclick = () => { if (S.role === 'host' && !confirm('部屋を閉じますか？（みんなの接続が切れます）')) return; toTitle(); };
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    // ロック直後と、ブラウザが時々送ってくる異常に大きな移動量は無視する（視点が飛ぶ対策）
    if (performance.now() - lockAt < 120) return;
    if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
    const st = Settings.get();
    cam.yaw -= e.movementX * 0.0026 * st.sens;
    cam.pitch = Math.max(-0.15, Math.min(1.25, cam.pitch + e.movementY * 0.0022 * st.sens * (st.invertY ? -1 : 1)));
  });
  const bump = (k) => { input.c[k] = (input.c[k] || 0) + 1; };
  const HOLD = { jump: 'jump', dash: 'dash', punch: 'punch', grab: 'grab', guard: 'guard', use: 'use' };
  // コード（キー or マウスボタン）が押された／離された
  function press(code) {
    if (Settings.isCapturing()) return;
    if (S.mode !== 'game') return;
    if (S.shopOpen) {
      if (Settings.get().keys.shop === code || code === 'Escape') closeShop();
      const n = code.startsWith('Digit') ? (code === 'Digit0' ? 10 : +code.slice(5)) : 0;
      const SL = (S.lastSnap && S.lastSnap.sh) || SHOP_ITEMS;
      if (n >= 1 && n <= SL.length) buy(SL[n - 1]);
      return;
    }
    if (keys[code]) return; keys[code] = true;
    for (const a of Settings.actionsFor(code)) {
      if (HOLD[a]) input.b[a] = true;
      if (a === 'jump') bump('jump');
      if (a === 'punch') bump('punch');
      if (a === 'grab') bump('grabc');
      if (a === 'head') bump('head');
      if (a === 'use') { bump('use'); input.useHold = true; }
      if (a === 'drop') bump('drop');
      if (a === 'v') bump('v');
      if (a === 'g') { bump('g'); Sfx.play('beat'); }
      if (/^s[1-4]$/.test(a)) bump(a);
      if (a === 'shop') openShop();
      if (a === 'help') $('help').classList.toggle('hidden');
      if (a === 'mute') toast(Sfx.toggleMute() ? '音：オフ' : '音：オン', 900);
    }
  }
  function release(code) {
    keys[code] = false;
    for (const a of Settings.actionsFor(code)) {
      if (HOLD[a]) input.b[a] = false;
      if (a === 'use') input.useHold = false;
    }
  }
  document.addEventListener('mousedown', (e) => {
    if (S.mode !== 'game' || document.pointerLockElement !== canvas) return;
    press('Mouse' + e.button);
  });
  document.addEventListener('mouseup', (e) => release('Mouse' + e.button));
  document.addEventListener('contextmenu', (e) => { if (S.mode === 'game') e.preventDefault(); });
  document.addEventListener('wheel', (e) => { if (S.mode === 'game') { input.sel = (input.sel + (e.deltaY > 0 ? 1 : -1) + 110) % 11; Sfx.play('click'); } });
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (S.mode === 'game' && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    press(e.code);
  });
  document.addEventListener('keyup', (e) => release(e.code));
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.b = {}; input.useHold = false; });
  function buildInput() {
    const K = Settings.get().keys;
    let f = 0, r = 0;
    if (keys[K.fwd]) f += 1; if (keys[K.back]) f -= 1;
    if (keys[K.right]) r += 1; if (keys[K.left]) r -= 1;
    if (keys[K.camL]) cam.yaw += 0.04 * Settings.get().sens; if (keys[K.camR]) cam.yaw -= 0.04 * Settings.get().sens;
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
    input.mx = fx * f + rx * r; input.mz = fz * f + rz * r;
    input.ay = cam.yaw; input.ap = Math.max(-0.4, Math.min(1.2, 0.7 - cam.pitch));
    return input;
  }
  // 交換所
  function openShop() {
    const me = S.lastSnap && S.lastSnap.p.find((p) => p.id === S.myPid);
    if (!me || me.tk <= 0) { toast('アイテム交換券がありません（相手を3回落とすともらえる）', 1500); return; }
    S.shopOpen = true; show('shop');
    if (document.pointerLockElement) document.exitPointerLock();
    $('shopTk').textContent = '交換券 ×' + me.tk;
    const SL = S.lastSnap.sh || SHOP_ITEMS;
    $('shopGrid').innerHTML = SL.map((k, i) => `<div class="it" data-k="${k}"><span>${(i + 1) % 10}</span>${ITEMS[k].name}<div class="tiny">${ITEMS[k].desc}</div></div>`).join('');
    $('shopGrid').querySelectorAll('.it').forEach((d) => (d.onclick = () => buy(d.dataset.k)));
  }
  function closeShop() { S.shopOpen = false; show('shop', false); requestLock(); }
  function buy(item) { input.buy = { seq: (input.buy ? input.buy.seq : 0) + 1, item }; Sfx.play('pickup'); closeShop(); }

  // ---------- HUD ----------
  let bannerT = 0;
  function banner(s, c) {
    const d = document.createElement('div'); d.className = 'banner'; d.textContent = s; d.style.color = c || '#fff';
    const box = $('banners'); box.innerHTML = ''; box.appendChild(d); bannerT = 3;
    if (s.length > 22) d.style.fontSize = '28px';
  }
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const PH = { gimmick: 'ギミック期', gachi: 'ガチ乱闘期', mars: 'Mars襲来', curtain: 'カーテンコール' };
  function hud(s, dt) {
    const sc = Math.min(1, window.innerWidth / 1380, window.innerHeight / 760);
    document.documentElement.style.setProperty('--hs', sc.toFixed(3));
    const me = s.p.find((p) => p.id === S.myPid);
    $('hT').textContent = fmt(s.t);
    $('hPh').textContent = PH[s.ph] + (s.ph === 'gimmick' ? '：' + GD.GIMMICKS[s.g].name : '');
    let nx = '';
    if (s.t < T.GACHI) nx = 'ガチ乱闘まで ' + fmt(T.GACHI - s.t);
    else if (s.t < T.MARS && !s.m) nx = 'Mars襲来まで ' + fmt(T.MARS - s.t);
    else if (s.ph === 'mars' && !s.m && s.t < T.CURTAIN) nx = 'Mars（真）乱入まで ' + fmt(T.CURTAIN - s.t);
    else if (s.ph === 'curtain') nx = '強制終了まで ' + fmt(Math.max(0, T.END - s.t));
    $('hNx').textContent = nx;
    // Mars
    show('marsbar', !!s.m);
    if (s.m) {
      $('mName').textContent = s.m.tr ? 'Mars（真）' : 'Mars';
      $('mHp').style.width = Math.max(0, (s.m.hp / 90) * 100) + '%';
      $('mSub').textContent = s.m.tr ? '何度でも蘇る…21:00までに優勝者を出せ' : `耐久 ${Math.ceil(s.m.hp)}/90　状態異常 ${s.m.sc}/7　${s.m.age > 180 ? '★おしまい★ ' + Math.round(s.m.os * 100) + '%' : 'おしまいまで ' + fmt(Math.max(0, 180 - s.m.age))}`;
    }
    // スコアボード
    const row = (p) => {
      const col = '#' + CHARS[p.c].color.toString(16).padStart(6, '0');
      return `<div class="r ${p.e ? 'out' : ''} ${p.id === S.myPid ? 'mine' : ''}"><span class="dot" style="background:${col}"></span>${esc(p.n)}${p.mi ? '（手下）' : ''}<span class="h">${'●'.repeat(p.l)} ${p.e ? '脱落' : p.h + '%'}</span></div>`;
    };
    const sorted = s.p.slice().sort((a, b) => (a.e - b.e) || (b.l - a.l) || (b.k - a.k));
    let rows = '';
    if (s.tmode) {
      const ts = [...new Set(s.p.map((p) => p.tm))].sort();
      rows = ts.map((t) => { const ps = sorted.filter((p) => p.tm === t); const left = ps.filter((p) => !p.e).length;
        return `<div class="thead" style="background:${GD.TEAMS[t].css}">${GD.TEAMS[t].name}チーム <span>残り${left}人</span></div>` + ps.map(row).join(''); }).join('');
    } else rows = sorted.map(row).join('');
    $('board').innerHTML = `<div class="tiny">${s.tmode ? 'チーム戦 ／ ' : ''}ライフ ${s.lives} ／ 撃墜でTP+2</div>` + rows;
    if (!me) return;
    if (!S.faceSet) { $('hFace').src = thumbs[me.c]; S.faceSet = true; renderSkills(me); }
    const hc = me.h < 50 ? '#ffffff' : me.h < 100 ? '#ffd23b' : me.h < 150 ? '#ff9f43' : '#ff3b3b';
    $('hHero').innerHTML = `<span style="color:${hc}">${me.h}</span><small style="color:${hc}">%</small>`;
    $('hLives').innerHTML = Array.from({ length: s.lives }, (_, i) => `<i class="${i < me.l ? '' : 'off'}"></i>`).join('');
    $('hKills').textContent = '撃墜 ' + me.k;
    $('hTp').style.width = (me.tp / 30) * 100 + '%'; $('hTpN').textContent = 'TP ' + me.tp + '/30';
    // スキル
    const C = CHARS[me.c];
    C.skills.forEach((sk, i) => { const el = $('sk' + i); if (!el) return; el.classList.toggle('na', me.tp < sk.tp); el.classList.toggle('ready', me.tp >= sk.tp); });
    if (C.passive.special && C.passive.special !== 'rhythm') {
      const c = $('spCD');
      if (c) { c.classList.toggle('hidden', me.sp <= 0); c.textContent = Math.ceil(me.sp); }
    }
    if (C.passive.special === 'rhythm') { const c = $('spCD'); if (c) { c.classList.toggle('hidden', me.rh === 0); c.textContent = me.rh + '/8'; } }
    $('hItem').textContent = me.it ? ITEMS[me.it].name + (ITEMS[me.it].weapon ? ' ×' + me.am : '') : 'なし';
    $('hTk').textContent = me.tk ? `交換券 ×${me.tk}　[T]で使う` : `交換券まで あと${3 - me.tkp}撃墜`;
    // 選択表示
    let sel = '';
    if (me.c === 'ayu') sel = 'ロール付与：' + STATUS[RANDOM_POOL[input.sel % RANDOM_POOL.length]].name + '（ホイールで変更）';
    if (me.c === 'takara') sel = '呼び出す武器：' + ['AR', 'SR', 'SG'][input.sel % 3] + '（ホイールで変更）';
    if (me.it === 'sst') sel = 'SST：Eで使う（30%）／E長押し＋TP20で改造';
    show('hSel', !!sel); $('hSel').textContent = sel;
    // 状態異常
    $('sts').innerHTML = me.st.map((x) => `<span class="chip" style="background:${STATUS[x[0]].color}">${STATUS[x[0]].name}${x[2] > 1 ? ' Lv' + x[2] : ''} ${Math.ceil(x[1])}s${x[0] === 'keyboard' ? '（' + { punch: 'パンチ', grab: '掴み', jump: 'ジャンプ', dash: 'ダッシュ' }[x[3]] + '不可）' : ''}</span>`).join('')
      + me.bf.filter((b) => ['bike', 'chair', 'mt', 'rhythmrev', 'tpx2', 'energy', 'detox'].includes(b[0])).map((b) => `<span class="chip" style="background:#3b82f6">${{ bike: 'バイク', chair: 'チェア', mt: 'MT', rhythmrev: 'リズムレボリューション', tpx2: 'TP2倍', energy: 'エナドリ', detox: 'デトックス' }[b[0]]} ${Math.ceil(b[1])}s</span>`).join('')
      + (me.ca ? `<span class="chip" style="background:#fda4af">キャシー塚本 ×${me.ca}</span>` : '')
      + (me.bd ? `<span class="chip" style="background:#3b82f6">縛られ中</span>` : '')
      + (me.cb ? `<span class="chip" style="background:#7c3aed">操作を乗っ取られ中！</span>` : '')
      + (me.ct ? `<span class="chip" style="background:#7c3aed">相手を操作中（WASD）</span>` : '');
    // 復帰／脱落
    show('hResp', me.e || me.rs > 0);
    $('hResp').innerHTML = me.e ? '脱落…<div style="font-size:22px">観戦中</div>' : '復帰まで ' + Math.ceil(me.rs);
    // 画面効果
    const has = (k) => me.st.some((x) => x[0] === k);
    $('vig').className = has('majigire') ? 'maji' : '';
    document.body.classList.toggle('kyouki', has('kyouki') && me.c !== 'yururu');
    show('gamechu', has('gamechu') && me.c !== 'hiro');
    Sfx.setDeaf(has('nanchou'));
    Render.setHideTags(has('nanchou'));
    drawArrows(s, me, has('nanchou'));
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banners').innerHTML = ''; }
  }
  // 画面外のプレイヤー矢印
  const arrowEls = new Map();
  function drawArrows(s, me, off) {
    const box = $('arrows'); const seen = new Set();
    const W = window.innerWidth, H = window.innerHeight, M = 46;
    if (Settings.get().arrows && !off && !me.e) for (const p of s.p) {
      if (p.id === S.myPid || p.e || p.rs > 0) continue;
      const v = Render.project(p.x, p.y + 1, p.z);
      const onScreen = !v.behind && v.x > 0 && v.x < W && v.y > 0 && v.y < H;
      if (onScreen) continue;
      let dx = v.x - W / 2, dy = v.y - H / 2; if (v.behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1) dy = 1; }
      const k = Math.min((W / 2 - M) / Math.abs(dx || 1e-3), (H / 2 - M) / Math.abs(dy || 1e-3));
      let el = arrowEls.get(p.id);
      if (!el) { el = document.createElement('div'); el.className = 'ar'; box.appendChild(el); arrowEls.set(p.id, el); }
      el.style.left = W / 2 + dx * k + 'px'; el.style.top = H / 2 + dy * k + 'px';
      el.style.background = s.tmode ? GD.TEAMS[p.tm].css : '#' + CHARS[p.c].color.toString(16).padStart(6, '0');
      el.style.setProperty('--r', Math.atan2(dy, dx) + 'rad');
      el.textContent = p.h + '%';
      seen.add(p.id);
    }
    for (const [id, el] of arrowEls) if (!seen.has(id)) { el.remove(); arrowEls.delete(id); }
  }
  function renderSkills(me) {
    const C = CHARS[me.c];
    let h = C.skills.map((sk, i) => `<div class="skill" id="sk${i}"><span class="k">${Settings.key('s' + (i + 1))}</span><div class="n">${sk.name}</div><div class="c">TP ${sk.tp}</div></div>`).join('');
    if (C.passive.special) h += `<div class="skill sp" id="skV"><span class="k">${Settings.key(C.passive.special === 'rhythm' ? 'g' : 'v')}</span><div class="n">${C.passive.name}</div><div class="c">${C.passive.special === 'rhythm' ? 'リズム' : 'CT ' + C.passive.cd + '秒'}</div><div class="cd hidden" id="spCD"></div></div>`;
    $('hSk').innerHTML = h;
  }

  // ゲーム中毒の別ゲー画面
  const gc = $('gamechu').querySelector('canvas'), gx = gc.getContext('2d');
  const blocks = [];
  function drawGamechu(dt) {
    if ($('gamechu').classList.contains('hidden')) return;
    if (Math.random() < 0.08) blocks.push({ x: (Math.random() * 10 | 0) * 40, y: -40, c: ['#f43f5e', '#22d3ee', '#facc15', '#a3e635', '#c084fc'][(Math.random() * 5) | 0], v: 120 + Math.random() * 200 });
    gx.fillStyle = '#0b0b14'; gx.fillRect(0, 0, 400, 600);
    for (let i = blocks.length - 1; i >= 0; i--) { const b = blocks[i]; b.y += b.v * dt; gx.fillStyle = b.c; gx.fillRect(b.x + 2, b.y, 36, 36); if (b.y > 600) blocks.splice(i, 1); }
    gx.fillStyle = '#fff'; gx.font = 'bold 26px sans-serif'; gx.fillText('SCORE ' + ((performance.now() / 10) | 0), 120, 580);
  }

  // ---------- 結果 ----------
  function showResult(res, s) {
    if (S.ended) return;
    S.ended = true;
    if (document.pointerLockElement) document.exitPointerLock();
    show('pause', false);
    $('resT').textContent = res.text;
    const rows = s.p.slice().sort((a, b) => (res.winners.includes(b.id) - res.winners.includes(a.id)) || (a.e - b.e) || (b.l - a.l) || (b.k - a.k));
    $('resTb').innerHTML = `<tr><th>#</th>${s.tmode ? '<th>チーム</th>' : ''}<th>プレイヤー</th><th>キャラ</th><th>撃墜</th><th>ライフ</th></tr>` + rows.map((p, i) => `<tr class="${res.winners.includes(p.id) ? 'win' : ''}"><td>${i + 1}</td>${s.tmode ? `<td><span class="tbadge" style="position:static;background:${GD.TEAMS[p.tm].css}">${GD.TEAMS[p.tm].name}</span></td>` : ''}<td>${esc(p.n)}</td><td>${CHARS[p.c].name}</td><td>${p.k}</td><td>${p.e ? '脱落' : p.l}</td></tr>`).join('');
    const isHost = S.role !== 'client';
    $('bResLobby').classList.toggle('hidden', !isHost);
    $('bResLobby').textContent = S.role === 'solo' ? 'もう一回！' : 'すぐロビーへ';
    $('bResTitle').textContent = S.role === 'solo' ? 'タイトルへ' : S.role === 'host' ? '部屋を閉じる' : '部屋を抜ける';
    setTimeout(() => show('result'), 1200);
    Sfx.bgm(false);
    // オンラインでは部屋はそのまま。少ししたら全員ロビーへ戻る
    clearInterval(S.resTimer);
    if (S.role !== 'solo') {
      const until = performance.now() + 11200;
      const tick = () => {
        const left = Math.ceil((until - performance.now()) / 1000);
        $('resNote').textContent = left > 0 ? `部屋はそのままです。${left}秒後に全員ロビーへ戻ります` : 'ロビーへ戻っています…';
        if (left <= 0) { clearInterval(S.resTimer); if (S.role === 'host' && S.ended && S.mode === 'game') backToLobby(); }
      };
      tick(); S.resTimer = setInterval(tick, 250);
    } else $('resNote').textContent = '';
  }
  function backToLobby() { clearInterval(S.resTimer); endGameView(); S.mode = 'lobby'; S.game = null; enterLobby(); }
  $('bResTitle').onclick = () => { if (S.role === 'host' && !confirm('部屋を閉じますか？（みんなの接続が切れます）')) return; toTitle(); };
  $('bResLobby').onclick = () => backToLobby();

  // ---------- メインループ ----------
  let last = performance.now();
  const STEP = 1 / 60;
  function interp(now) {
    const rt = now - 90;
    const B = S.snaps;
    if (!B.length) return null;
    let a = B[0], b = B[B.length - 1];
    for (let i = B.length - 1; i > 0; i--) { if (B[i - 1].at <= rt) { a = B[i - 1]; b = B[i]; break; } }
    if (a === b) return b.s;
    const k = Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at || 1)));
    const s = JSON.parse(JSON.stringify(b.s));
    const pa = new Map(a.s.p.map((p) => [p.id, p]));
    for (const p of s.p) {
      const q = pa.get(p.id); if (!q || Math.abs(q.x - p.x) > 6) continue;
      p.x = q.x + (p.x - q.x) * k; p.y = q.y + (p.y - q.y) * k; p.z = q.z + (p.z - q.z) * k; p.yw = Sim.lerpAngle(q.yw, p.yw, k);
    }
    return s;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (S.mode !== 'game') { Render.idle(dt); return; }
    const inp = buildInput();
    let snap = null, events = [];
    if (S.role === 'client') {
      S.inAcc += dt;
      if (S.inAcc > 1 / 30) { S.inAcc = 0; Net.sendHost({ t: 'i', i: inp }); }
      snap = interp(now);
      events = S.fxQ.splice(0);
    } else {
      const g = S.game;
      const me = g.players.find((p) => p.id === S.myPid);
      if (me) me.input = { ...inp, b: { ...inp.b }, c: { ...inp.c } };
      if (!S.paused) {
        S.acc += dt;
        while (S.acc >= STEP) {
          S.acc -= STEP;
          for (const p of g.players) if (p.bot || p.minion) AI.think(g, p, STEP);
          g.step(STEP);
        }
      }
      events = g.fx.splice(0);
      snap = g.snapshot();
      if (S.role === 'host') {
        S.pendFx = (S.pendFx || []).concat(events.filter((e) => e.k !== 'sfx' || true));
        S.netAcc += dt;
        if (S.netAcc >= 0.05) { S.netAcc = 0; Net.broadcast({ t: 's', s: snap, f: S.pendFx }); S.pendFx = []; }
      }
    }
    if (!snap) { Render.idle(dt); return; }
    S.lastSnap = snap;
    for (const e of events) {
      if (e.k === 'sfx') Sfx.play(e.n);
      else if (e.k === 'banner') banner(e.s, e.c);
      else if (e.k === 'deny' && e.id === S.myPid) { Sfx.play('deny'); }
      else if (e.k === 'beat' && e.id === S.myPid && e.n > 1) { /* ok */ }
    }
    Render.update(snap, events, dt, { camYaw: cam.yaw, camPitch: cam.pitch });
    hud(snap, dt);
    drawGamechu(dt);
    if (snap.ov && !S.ended) showResult(snap.ov, snap);
  }
  Settings.apply();
  requestAnimationFrame(frame);
  window.__S = S; window.__cam = cam; // デバッグ用
})();
