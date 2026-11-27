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
    ar:      { name: 'AR', color: 0x4b5563, weapon: true, ammo: 14, desc: '[使う]長押しで連射' },
    sr:      { name: 'SR', color: 0x1f2937, weapon: true, ammo: 2, desc: '[使う]長押しで溜め、離して撃つ' },
    sg:      { name: 'SG', color: 0x7c4a1e, weapon: true, ammo: 4, desc: '[使う]で近距離に特大ふっとび' },
    monitor: { name: 'モニター', color: 0x111827, weapon: true, ammo: 5, desc: '[使う]で振り回してモニターパンチ' },
    detox:   { name: 'デジタルデトックス', color: 0x86efac, desc: '状態異常を解除＋10秒無効' },
    lan:     { name: 'LANケーブル', color: 0x3b82f6, desc: '投げて相手を縛る' },
    chair:   { name: 'ゲーミングチェア', color: 0xef4444, desc: '乗って突進' },
    energy:  { name: 'エナドリ', color: 0xa3e635, desc: '15秒スピードアップ' },
    goreisan:{ name: '五苓散', color: 0xfef3c7, desc: '状態異常を回復' },
    sst:     { name: 'SST', color: 0x22d3ee, cookie: true, desc: 'Marsに使うと30%で撃退（[使う]長押し＋TP20で改造）' },
    sst2:    { name: '改造SST', color: 0xf43f5e, cookie: true, desc: 'Marsを確定で撃退' },
  };
  const SPAWN_ITEMS = ['ar', 'sr', 'sg', 'monitor', 'detox', 'lan', 'chair', 'energy', 'goreisan'];
  const SHOP_ITEMS = ['ar', 'sr', 'sg', 'monitor', 'detox', 'lan', 'chair', 'energy', 'goreisan', 'sst'];

  // stats: power, speed, weight (1-5)
  const CHARS = {
    kenken: {
      name: 'kenken', color: 0x3b82f6, sub: 0x1e3a8a, acc: 'glasses',
      desc: '多分リーダー？本当にやばい時は正気に戻る。',
      stats: [4, 4, 4], res: 'normal', weak: [],
      passive: { name: 'Java&Pythonプログラマー', desc: '15秒ごとにランダムなステータスが13秒間1段階上がる' },
      skills: [
        { id: 'modifier', name: 'モディファイア', tp: 5, desc: '他の全員にランダムな状態異常' },
        { id: 'surume', name: 'イーティングスルメイカ', tp: 6, desc: '自分に歯ごたえ（掴み保持2倍）' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文（自動反論）' },
        { id: 'kichige', name: 'キチゲ解放', tp: 12, desc: '全員を衝撃波で吹き飛ばしTP-2、自分は30秒マジギレ' },
      ],
    },
    ayu: {
      name: 'ayu', color: 0xf97316, sub: 0x7c2d12, acc: 'helmet',
      desc: 'ボケ担当の生粋のルーニーでトロール。鯖主で管理者権限持ち。',
      stats: [2, 3, 2], res: 'high', weak: [],
      passive: { name: '高校生だぞおめぇ！', desc: '[V] バイクを召喚して6秒乗る（CT70秒）', special: 'bike', cd: 70 },
      skills: [
        { id: 'subaka', name: 'サブ垢召喚', tp: 9, desc: 'キャシー塚本が40秒間、攻撃・掴み・状態異常を2回まで肩代わり' },
        { id: 'soundboard', name: 'サウンドボード爆撃', tp: 8, desc: '他の全員に70%でラグ＋難聴（にもは確定）' },
        { id: 'role', name: 'ロール付与', tp: 8, desc: '狙った相手にホイールで選んだ状態異常', aim: true },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    hiro: {
      name: 'ヒロ', color: 0x10b981, sub: 0x064e3b, acc: 'headphones',
      desc: '無口で落ち着いている。一番まともだが笑い方が一番狂っている。',
      stats: [4, 4, 4], res: 'shigh', weak: ['takawarai'],
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
      stats: [5, 4, 5], res: 'slow', weak: ['g5'],
      passive: { name: 'C#プログラマー', desc: '14秒ごとにランダムなステータス+1（最大+3、場外でリセット）' },
      skills: [
        { id: 'modifier', name: 'モディファイア', tp: 5, desc: '他の全員にランダムな状態異常' },
        { id: 'goreisan', name: '五苓散投与', tp: 7, desc: '自分の状態異常を回復' },
        { id: 'mousou', name: 'スーパー妄想', tp: 4, desc: '75%で60秒TP2倍＆パワー+1／25%でTP-3' },
        { id: 'rinri', name: '倫理EXAM', tp: 6, desc: '自分に不定の狂気（掴み・投げ2倍）' },
      ],
    },
    takara: {
      name: 'タカラソド', color: 0x8b5cf6, sub: 0x3b0764, acc: 'cap',
      desc: '真面目という訳ではないがまともな方。最近PCを新調したらしい。',
      stats: [4, 3, 3], res: 'slow', weak: [],
      passive: { name: 'ウェポンランダマイザー', desc: '[V] 55秒ごとにホイールで選んだAR/SR/SGを呼び出す', special: 'weapon', cd: 55 },
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
      stats: [5, 4, 4], res: 'shigh', weak: [],
      passive: { name: 'キチguy', desc: 'マジギレ・不定の狂気のデメリット無効。45秒ごとに6秒のランダムなデバフ' },
      skills: [
        { id: 'build', name: '建築タイム', tp: 10, desc: '周りに壁と足場を25秒建築。3/5でヘロヘロ-25%&TP+3、2/5で爆破されて状態異常' },
        { id: 'kichige', name: 'キチゲ解放', tp: 12, desc: '全員を衝撃波で吹き飛ばす' },
        { id: 'rinri', name: '倫理EXAM', tp: 6, desc: '自分に不定の狂気' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    nimo: {
      name: 'にも', color: 0x111827, sub: 0xdc2626, acc: 'hood',
      desc: '口が悪く煽りまくる。マウスのフリック速度が異常。実はかなりの努力家。',
      stats: [4, 4, 2], res: 'low', weak: ['lag', 'nanchou', 'majigire'],
      passive: { name: 'ライバルの大鎌', desc: '[V] 向いている方向へ一気に移動（空中復帰可、CT90秒）', special: 'scythe', cd: 90 },
      skills: [
        { id: 'edit', name: '高速動画編集', tp: 7, desc: '2/3で全員ヘロヘロ+18%、1/3で自分+20%' },
        { id: 'snipe', name: '超々精密射撃', tp: 8, desc: '狙った相手を大きくふっとばしマジギレ', aim: true },
        { id: 'kichige', name: 'キチゲ解放', tp: 12, desc: '全員を衝撃波で吹き飛ばす' },
        { id: 'kirinuki', name: '切り抜き視聴', tp: 10, desc: '自分にヒロユキ構文' },
      ],
    },
    wikitto: {
      name: 'うぃきっと', color: 0xf9a8d4, sub: 0xbe185d, acc: 'ribbon',
      desc: '声は幼いがayuと同い年。よく声が可愛いと言われる。',
      stats: [3, 2, 3], res: 'iron', weak: [],
      passive: { name: 'きれいな声', desc: 'ライフが0になる場外のとき、TPが10以上あればTP10を使って一度だけ耐える（ヘロヘロ値+70%、最低80%で復帰）' },
      skills: [
        { id: 'mt', name: 'MT搭乗', tp: 14, desc: '20秒間メカに乗る（パワー・重さアップ、壊れると降りる）' },
        { id: 'sherpa', name: '補給シェルパ', tp: 8, desc: 'ヘロヘロ値-35%、40秒TP2倍' },
        { id: 'muku', name: '無垢', tp: 9, desc: '狙った相手に8秒のタピオカパン（うぃきっとを攻撃できない）', aim: true },
        { id: 'positive', name: 'ポジティブ思考', tp: 14, desc: '全ステータス+1（1回のみ）' },
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
    // ---- ライバル風のアリーナ（遮蔽物のある対戦マップ）----
    colosseum: { name: 'コロシアム', desc: '左右対称の闘技場。木箱の陰で駆け引き', rivals: true,
      style: { cover: 'crate', min: 1.4, deco: 'colosseum', sky: 0x7cc7ff },
      tile: (i, j) => {
        const r = Math.min(i, j, 10 - i, 10 - j);
        if (r === 0 && (i <= 1 || i >= 9) && (j <= 1 || j >= 9)) return null;
        if ((i === 2 || i === 8) && (j === 2 || j === 8)) return 1.6;          // 四隅の木箱
        if ((i === 5 && (j === 2 || j === 8)) || (j === 5 && (i === 2 || i === 8))) return 0.8; // 低い塀
        if (Math.abs(i - 5) <= 1 && Math.abs(j - 5) <= 1) return (i === 5 && j === 5) ? 1.6 : 0.4;
        return 0;
      },
      plats: [P(-7.8, -7.8, 3.6, 2.4, 2.4), P(7.8, 7.8, 3.6, 2.4, 2.4), P(-7.8, 7.8, 3.6, 2.4, 2.4), P(7.8, -7.8, 3.6, 2.4, 2.4)] },
    docks: { name: '港のコンテナ', desc: 'コンテナの通路と海。クレーンの床が行き来する', rivals: true,
      style: { cover: 'container', min: 1.4, deco: 'docks', sky: 0x9bd3ff },
      tile: (i, j) => {
        if (i < 1 || i > 9) return null;
        if (i === 5 && j >= 3 && j <= 7) return null;                           // 真ん中は海
        if ((i === 3 || i === 7) && ((j >= 1 && j <= 3) || (j >= 7 && j <= 9))) return 1.8; // コンテナ
        if ((i === 1 || i === 9) && j === 5) return 0.9;
        if ((i === 4 || i === 6) && (j === 0 || j === 10)) return 0.9;
        return 0;
      },
      plats: [P(0, 0, 0.3, 2.4, 2.4, { az: 1, r: 4.2, sp: 0.5 }), P(0, -11, 4.2, 2.6, 2.4, { ax: 1, r: 9, sp: 0.32 })] },
    construction: { name: '工事現場', desc: '3階建ての足場と鉄骨。穴に注意', rivals: true,
      style: { cover: 'concrete', min: 1.0, deco: 'construction', sky: 0xffd6a5 },
      tile: (i, j) => {
        if ((i === 4 && j === 4) || (i === 6 && j === 6) || ((i === 0 || i === 10) && j === 5) || ((j === 0 || j === 10) && i === 5)) return null;
        if (i >= 8 && j <= 2) return 2.4; if (i <= 2 && j >= 8) return 2.4;
        if (i >= 6 && j <= 4) return 1.2; if (i <= 4 && j >= 6) return 1.2;
        return 0;
      },
      plats: [P(0, 0, 3.8, 9, 1.0), P(0, 0, 5.6, 1.0, 9), P(-7.8, -7.8, 1.8, 2.4, 2.4, { az: 1, r: 3, sp: 0.6 }), P(7.8, 7.8, 1.8, 2.4, 2.4, { ax: 1, r: 3, sp: 0.6, ph: 1.5 })] },
    station: { name: '駅のホーム', desc: '2つのホームの間を電車が走る。陸橋で渡れる', rivals: true,
      style: { cover: 'pillar', min: 1.4, deco: 'station', sky: 0xb9e6ff },
      tile: (i, j) => {
        if (j === 5) return null;                                               // 線路
        if (j === 4 || j === 6) return i % 2 === 0 ? 0 : null;                  // 枕木のすき間
        if ((i === 2 || i === 5 || i === 8) && (j === 1 || j === 9)) return 2.4; // 柱
        if ((i === 3 && j === 2) || (i === 7 && j === 8)) return 1.0;           // ベンチ
        return 0.6;
      },
      plats: [P(0, 0, 0.9, 7.8, 2.2, { ax: 1, r: 9.5, sp: 0.3 }), P(-10.4, 0, 3.0, 2.6, 8), P(10.4, 0, 3.0, 2.6, 8)] },
    westown: { name: '西部の町', desc: '大通りと建物の屋根。たるの陰に隠れろ', rivals: true,
      style: { cover: 'wood', min: 1.4, deco: 'westown', sky: 0xffc98a },
      tile: (i, j) => {
        const side = i <= 2 || i >= 8;
        if (side && (j === 3 || j === 7)) return i === 0 || i === 10 ? null : 0; // 路地
        if (side) return (i === 1 || i === 9) && j === 5 ? 2.6 : 1.8;           // 建物（真ん中は高い）
        if ((i === 4 && j === 2) || (i === 6 && j === 8) || (i === 6 && j === 2) || (i === 4 && j === 8)) return 0.9; // たる
        if (i === 5 && j === 5) return 0.7;                                      // 井戸
        return 0;
      },
      plats: [P(0, -10.4, 3.2, 5.2, 2.2), P(0, 10.4, 3.2, 5.2, 2.2), P(0, 0, 4.6, 2.2, 2.2, { ax: 1, r: 5, sp: 0.45 })] },
    onyx: { name: 'オニキス', desc: 'ひし形の黒いステージ。回る床とネオンの穴', rivals: true,
      style: { cover: 'neon', min: 0.5, deco: 'onyx', sky: 0x2a1a4a },
      tile: (i, j) => {
        const d = Math.abs(i - 5) + Math.abs(j - 5);
        if (d > 6) return null;
        if (d === 3 && i !== 5 && j !== 5) return null;                          // ネオンの穴
        if (d === 0) return 1.2;
        if (d === 6 && (i === 5 || j === 5)) return 1.0;
        return d <= 1 ? 0.6 : 0;
      },
      plats: [P(0, 0, 2.8, 2.2, 2.2, { circle: true, r: 6, sp: 0.5 }), P(0, 0, 4.4, 2.2, 2.2, { circle: true, r: 6, sp: 0.5, ph: 3.14 })] },
  };
  const MAP_KEYS = Object.keys(MAPS);
  const TEAMS = [
    { name: '赤', css: '#ef4444', hex: 0xef4444 }, { name: '青', css: '#3b82f6', hex: 0x3b82f6 },
    { name: '緑', css: '#22c55e', hex: 0x22c55e }, { name: '黄', css: '#eab308', hex: 0xeab308 },
  ];

  return { RES, STATUS, STATUS_KEYS, RANDOM_POOL, ITEMS, SPAWN_ITEMS, SHOP_ITEMS, CHARS, CHAR_KEYS, GIMMICKS, T, MAPS, MAP_KEYS, TEAMS };
})();
