// ===== データ定義：キャラクター・状態異常・アイテム =====
'use strict';
window.GD = (function () {
  const RES = { low: 1.0, slow: 0.85, normal: 0.7, shigh: 0.55, high: 0.4, iron: 0 };

  const STATUS = {
    majigire: { name: 'マジギレ', color: '#ff3b3b', dur: 15 },
    kyouki:   { name: '不定の狂気', color: '#b04bff', dur: 15 },
    lag:      { name: 'ラグ', color: '#45d0ff', dur: 15 },
    nanchou:  { name: '難聴', color: '#9aa7b8', dur: 15 },
    g5:       { name: '5G', color: '#8b5a2b', dur: 15 },
    gamechu:  { name: 'ゲーム中毒', color: '#36e07a', dur: 15 },
    hagotae:  { name: '歯ごたえ', color: '#e8c07a', dur: 15 },
    hiroyuki: { name: 'ヒロユキ構文', color: '#ffd23b', dur: 15 },
    musicbot: { name: '音楽ボット', color: '#ff7ad9', dur: 20 },
    takawarai:{ name: '高笑い', color: '#ffe066', dur: 6 },
    naeochi:  { name: '萎え落ち', color: '#6b7280', dur: 5 },
    keyboard: { name: 'キーボードクラッシャー', color: '#ff9f43', dur: 15 },
    tapioka:  { name: 'タピオカパン', color: '#f7c6e0', dur: 15 },
  };
  const STATUS_KEYS = Object.keys(STATUS);
  const RANDOM_POOL = ['majigire', 'kyouki', 'lag', 'nanchou', 'g5', 'gamechu', 'hagotae', 'hiroyuki', 'takawarai', 'naeochi', 'keyboard'];

  const ITEMS = {
    ar:      { name: 'AR', color: 0x4b5563, weapon: true, ammo: 14, desc: '連射で押し出す' },
    sr:      { name: 'SR', color: 0x1f2937, weapon: true, ammo: 2, desc: '溜め撃ちで大ふっとび' },
    sg:      { name: 'SG', color: 0x7c4a1e, weapon: true, ammo: 4, desc: '近距離で特大ふっとび' },
    monitor: { name: 'モニター', color: 0x111827, weapon: true, ammo: 5, desc: '振り回してモニターパンチ' },
    detox:   { name: 'デジタルデトックス', color: 0x86efac, desc: '状態異常を解除＋10秒無効' },
    lan:     { name: 'LANケーブル', color: 0x3b82f6, desc: '投げて相手を縛る' },
    chair:   { name: 'ゲーミングチェア', color: 0xef4444, desc: '乗って突進' },
    energy:  { name: 'エナドリ', color: 0xa3e635, desc: '15秒スピードアップ' },
    goreisan:{ name: '五苓散', color: 0xfef3c7, desc: '状態異常を回復' },
    sst:     { name: 'SST', color: 0x22d3ee, cookie: true, desc: 'Marsに使うと30%で撃退（TP20で改造）' },
    sst2:    { name: '改造SST', color: 0xf43f5e, cookie: true, desc: 'Marsを確定で撃退' },
  };
  const SPAWN_ITEMS = ['ar', 'sr', 'sg', 'monitor', 'detox', 'lan', 'chair', 'energy', 'goreisan'];
  const SHOP_ITEMS = ['ar', 'sr', 'sg', 'monitor', 'detox', 'lan', 'chair', 'energy', 'goreisan', 'sst'];

  // stats: power, speed, weight (1-5)
  const CHARS = {
    kenken: {
      name: 'kenken', color: 0x3b82f6, sub: 0x1e3a8a, acc: 'glasses',
      desc: '多分リーダー？本当にやばい時は正気に戻る。',
      stats: [3, 3, 3], res: 'normal', weak: [],
      passive: { name: 'Java&Pythonプログラマー', desc: '30秒ごとにランダムなステータスが15秒間1段階上がる' },
      skills: [
        { id: 'modifier', name: 'モディファイア', tp: 5, desc: '他の全員にランダムな状態異常' },
        { id: 'surume', name: 'イーティングスルメイカ', tp: 6, desc: '自分に歯ごたえ（掴み保持2倍）' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文（自動反論）' },
        { id: 'kichige', name: 'キチゲ解放', tp: 8, desc: '全員を衝撃波で吹き飛ばしTP-2、自分は30秒マジギレ' },
      ],
    },
    ayu: {
      name: 'ayu', color: 0xf97316, sub: 0x7c2d12, acc: 'helmet',
      desc: 'ボケ担当の生粋のルーニーでトロール。鯖主で管理者権限持ち。',
      stats: [2, 3, 2], res: 'high', weak: [],
      passive: { name: '高校生だぞおめぇ！', desc: '[V] バイクを召喚して10秒乗る（CT60秒）', special: 'bike', cd: 60 },
      skills: [
        { id: 'subaka', name: 'サブ垢召喚', tp: 6, desc: 'キャシー塚本が100秒間身代わり（3回まで）' },
        { id: 'soundboard', name: 'サウンドボード爆撃', tp: 8, desc: '他の全員に70%でラグ＋難聴（にもは確定）' },
        { id: 'role', name: 'ロール付与', tp: 8, desc: '狙った相手にホイールで選んだ状態異常', aim: true },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    hiro: {
      name: 'ヒロ', color: 0x10b981, sub: 0x064e3b, acc: 'headphones',
      desc: '無口で落ち着いている。一番まともだが笑い方が一番狂っている。',
      stats: [3, 3, 3], res: 'shigh', weak: ['takawarai'],
      passive: { name: '音ゲーマー', desc: '[G] 0.5秒間隔で8回刻むとアイテム入手。ゲーム中毒無効', special: 'rhythm' },
      skills: [
        { id: 'chudoku', name: '中毒者勧誘', tp: 8, desc: '全員に80%でゲーム中毒' },
        { id: 'rasher', name: 'ラッシャー・ゲオメトリア', tp: 7, desc: '自分に音楽ボット（リズム攻撃強化）' },
        { id: 'rhythmrev', name: 'リズムレボリューション', tp: 14, desc: '40秒間ヘロヘロ値がたまらない' },
      ],
    },
    cotton: {
      name: 'コットン', color: 0xf5f5f4, sub: 0x9ca3af, acc: 'bandana',
      desc: '比較的まともで理性もあるが情緒が不安定。胃腸が弱い。',
      stats: [4, 4, 4], res: 'low', weak: ['majigire', 'gamechu', 'g5'],
      passive: { name: 'C#プログラマー', desc: '20秒ごとにランダムなステータス+1（場外でリセット）' },
      skills: [
        { id: 'modifier', name: 'モディファイア', tp: 5, desc: '他の全員にランダムな状態異常' },
        { id: 'goreisan', name: '五苓散投与', tp: 7, desc: '自分の状態異常を回復' },
        { id: 'mousou', name: 'スーパー妄想', tp: 4, desc: '50%で60秒TP2倍／50%でTP-3' },
        { id: 'rinri', name: '倫理EXAM', tp: 6, desc: '自分に不定の狂気（掴み・投げ2倍）' },
      ],
    },
    takara: {
      name: 'タカラソド', color: 0x8b5cf6, sub: 0x3b0764, acc: 'cap',
      desc: '真面目という訳ではないがまともな方。最近PCを新調したらしい。',
      stats: [4, 3, 3], res: 'slow', weak: [],
      passive: { name: 'ウェポンランダマイザー', desc: '[V] 40秒ごとにホイールで選んだAR/SR/SGを呼び出す', special: 'weapon', cd: 40 },
      skills: [
        { id: 'mic', name: 'マイク接近', tp: 8, desc: '他の全員に難聴＋近くの相手を押し出す' },
        { id: 'sniper', name: '狙撃手見習い', tp: 8, desc: '他の全員に80%でマジギレ、1%で即ライフ0' },
        { id: 'fish', name: 'おさかなフィッシュ', tp: 5, desc: '他の全員を40%で釣り上げて放り投げる' },
        { id: 'tenjou', name: '天上天下唯我独尊', tp: 15, desc: '狙った相手を30%で5秒操作（状態異常中なら確定）', aim: true },
      ],
    },
    yururu: {
      name: 'ゆるる', color: 0xeab308, sub: 0x713f12, acc: 'hardhat',
      desc: 'フットワークが軽いが、同時にかなりの凝り性。',
      stats: [4, 4, 3], res: 'shigh', weak: [],
      passive: { name: 'キチguy', desc: 'マジギレ・不定の狂気のデメリット無効。30秒ごとにランダムなデバフ' },
      skills: [
        { id: 'build', name: '建築タイム', tp: 8, desc: '周りに壁と足場を建築。2/3でライフ+1&TP+5、1/3で爆破される' },
        { id: 'kichige', name: 'キチゲ解放', tp: 8, desc: '全員を衝撃波で吹き飛ばす' },
        { id: 'rinri', name: '倫理EXAM', tp: 6, desc: '自分に不定の狂気' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    nimo: {
      name: 'にも', color: 0x111827, sub: 0xdc2626, acc: 'hood',
      desc: '口が悪く煽りまくる。マウスのフリック速度が異常。実はかなりの努力家。',
      stats: [4, 5, 3], res: 'low', weak: ['lag', 'nanchou', 'majigire'],
      passive: { name: 'ライバルの大鎌', desc: '[V] 向いている方向へ一気に移動（空中復帰可、CT45秒）', special: 'scythe', cd: 45 },
      skills: [
        { id: 'edit', name: '高速動画編集', tp: 5, desc: '2/3で全員ヘロヘロ+40%、1/3で自分+20%' },
        { id: 'snipe', name: '超々精密射撃', tp: 8, desc: '狙った相手を大きくふっとばしマジギレ', aim: true },
        { id: 'kichige', name: 'キチゲ解放', tp: 8, desc: '全員を衝撃波で吹き飛ばす' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    wikitto: {
      name: 'うぃきっと', color: 0xf9a8d4, sub: 0xbe185d, acc: 'ribbon',
      desc: '声は幼いがayuと同い年。よく声が可愛いと言われる。',
      stats: [2, 2, 2], res: 'iron', weak: [],
      passive: { name: 'きれいな声', desc: 'ライフが0になる場外のとき、一度だけ浮かび上がって耐える' },
      skills: [
        { id: 'mt', name: 'MT搭乗', tp: 8, desc: '40秒間メカに乗る（パワー・重さ大幅アップ）' },
        { id: 'sherpa', name: '補給シェルパ', tp: 6, desc: 'ヘロヘロ値0、40秒TP2倍' },
        { id: 'muku', name: '無垢', tp: 6, desc: '狙った相手にタピオカパン', aim: true },
        { id: 'positive', name: 'ポジティブ思考', tp: 7, desc: '全ステータス+1（1回のみ）' },
      ],
    },
  };
  const CHAR_KEYS = Object.keys(CHARS);

  const GIMMICKS = {
    none:     { name: 'ノーマル' },
    wind:     { name: '強風のビル屋上' },
    ice:      { name: 'すべる冷凍庫' },
    conveyor: { name: 'ベルトコンベア工場' },
    crumble:  { name: '崩れるブロック建築' },
    lagbridge:{ name: 'ラグいブリッジ' },
    rack:     { name: 'サーバーラック倉庫' },
  };

  const T = { GACHI: 180, MARS: 540, CURTAIN: 1080, END: 1260 };

  // マップ：11×11のマスごとに、床の高さ（null＝床なし）を返す
  // マップ：11×11のマスごとに床の高さ（null＝床なし）＋浮き床（plats：下からすり抜けて乗れる）
  // 浮き床の座標はワールド座標（1マス=2.6m、中央が0、端が±14.3）。mv があると動く
  const P = (x, z, y, w = 2.6, d = 2.6, mv) => ({ x, z, y, w: w / 2, d: d / 2, mv });
  const MAPS = {
    arena: { name: '浮遊アリーナ', desc: '王道の戦場。左右と上に浮き床', tile: (i, j) => {
        const r = Math.min(i, j, 10 - i, 10 - j);
        if (r === 0 && (i === 0 || i === 10) && (j <= 1 || j >= 9)) return null; // 角を欠けさせる
        return (Math.abs(i - 5) <= 1 && Math.abs(j - 5) <= 1) ? 0.5 : 0;
      },
      plats: [P(-6.5, 0, 2.8, 4.2, 2.6), P(6.5, 0, 2.8, 4.2, 2.6), P(0, 0, 5.4, 4.2, 2.6), P(0, -7, 2.8, 2.6, 2.6), P(0, 7, 2.8, 2.6, 2.6)] },
    islands: { name: 'ふたごの島', desc: '丘のある2つの島と、間を行き来する動く床', tile: (i, j) => {
        if (!(((i <= 4 || i >= 6) && j >= 2 && j <= 8) || (i === 5 && j === 5))) return null;
        const c = i <= 4 ? 2 : 8;
        if (Math.abs(i - c) <= 0 && Math.abs(j - 5) <= 0) return 2.0;
        return Math.abs(i - c) <= 1 && Math.abs(j - 5) <= 1 ? 1.0 : 0;
      },
      plats: [P(0, -4.5, 1.6, 2.4, 2.4, { az: 1, r: 4.5, sp: 0.55 }), P(-7.8, 0, 4.4, 2.6, 2.6), P(7.8, 0, 4.4, 2.6, 2.6)] },
    donut: { name: 'ドーナツ広場', desc: '大穴を囲む高い土手。穴の上を回る床', tile: (i, j) => {
        const c = Math.max(Math.abs(i - 5), Math.abs(j - 5));
        if (c < 2) return null;
        if (c === 2) return 1.1;
        return c === 5 && (Math.abs(i - 5) === 5) === (Math.abs(j - 5) === 5) ? 0.6 : 0;
      },
      plats: [P(0, 0, 2.4, 2.4, 2.4, { circle: true, r: 2.6, sp: 0.7 }), P(-9, -9, 2.6, 2.6, 2.6), P(9, 9, 2.6, 2.6, 2.6)] },
    pyramid: { name: 'ピラミッド', desc: '3段の段差と四方の浮き床', tile: (i, j) => { const r = Math.min(i, j, 10 - i, 10 - j); return r >= 4 ? 2.2 : r >= 2 ? 1.1 : 0; },
      plats: [P(-10.4, 0, 3.4), P(10.4, 0, 3.4), P(0, -10.4, 3.4), P(0, 10.4, 3.4), P(0, 0, 5.6, 2.6, 2.6)] },
    cross: { name: '十字路', desc: '高い中央の塔、細い十字、四隅の小島', tile: (i, j) => {
        const arm = Math.abs(i - 5) <= 1 || Math.abs(j - 5) <= 1, corner = (i <= 1 || i >= 9) && (j <= 1 || j >= 9);
        if (!arm && !corner) return null;
        if (Math.abs(i - 5) <= 1 && Math.abs(j - 5) <= 1) return 1.2;
        return corner ? 0.8 : 0;
      },
      plats: [P(-7.8, -7.8, 2.2, 2.6, 2.6, { ax: 1, r: 2.6, sp: 0.6 }), P(7.8, 7.8, 2.2, 2.6, 2.6, { ax: 1, r: 2.6, sp: 0.6, ph: 3.14 }), P(0, 0, 4.2, 2.6, 2.6)] },
    scatter: { name: 'とびとび足場', desc: '高さの違う2×2の足場16個と動く床', tile: (i, j) => (i % 3 !== 2 && j % 3 !== 2 ? ((Math.floor(i / 3) + Math.floor(j / 3)) % 3) * 0.9 : null),
      plats: [P(0, -3.9, 2.0, 2.0, 2.0, { ax: 1, r: 7, sp: 0.45 }), P(-3.9, 0, 2.6, 2.0, 2.0, { az: 1, r: 7, sp: 0.4, ph: 1.6 })] },
  };
  const MAP_KEYS = Object.keys(MAPS);
  const TEAMS = [
    { name: '赤', css: '#ef4444', hex: 0xef4444 }, { name: '青', css: '#3b82f6', hex: 0x3b82f6 },
    { name: '緑', css: '#22c55e', hex: 0x22c55e }, { name: '黄', css: '#eab308', hex: 0xeab308 },
  ];

  return { RES, STATUS, STATUS_KEYS, RANDOM_POOL, ITEMS, SPAWN_ITEMS, SHOP_ITEMS, CHARS, CHAR_KEYS, GIMMICKS, T, MAPS, MAP_KEYS, TEAMS };
})();
