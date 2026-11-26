// ===== オンライン通信（PeerJS / WebRTC P2P）=====
// ホストのブラウザがゲームを計算し、参加者は入力を送って状態を受け取る。
// 接続の仲介には PeerJS の無料公開サーバー(0.peerjs.com)を使う。
'use strict';
window.Net = (function () {
  const PREFIX = 'yujo-brk-';
  const ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  };
  let peer = null, role = null; // 'host' | 'client'
  // ?server=192.168.0.10:9000 のように指定すると、自分で立てたPeerJSサーバーを使う
  function peerOpts() {
    const o = { config: ICE, debug: 1 };
    const sv = new URLSearchParams(location.search).get('server') || localStorage.getItem('yb_server') || '';
    if (sv) { const [h, pt] = sv.split(':'); o.host = h; o.port = +(pt || 9000); o.path = '/'; o.secure = location.protocol === 'https:' && !/^(localhost|127\.|192\.168\.|10\.)/.test(h); }
    return o;
  }
  const conns = new Map(); // host: peerId -> conn
  let hostConn = null;
  const H = {}; // handlers
  function on(ev, fn) { H[ev] = fn; }
  function fire(ev, ...a) { if (H[ev]) H[ev](...a); }
  function code() {
    const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 5; i++) s += cs[(Math.random() * cs.length) | 0];
    return s;
  }
  function host() {
    return new Promise((res, rej) => {
      role = 'host';
      const c = code();
      peer = new Peer(PREFIX + c, peerOpts());
      const to = setTimeout(() => rej(new Error('接続サーバーに繋がりません（ネット接続を確認してください）')), 12000);
      peer.on('open', () => { clearTimeout(to); res(c); });
      peer.on('error', (e) => { clearTimeout(to); if (e.type === 'unavailable-id') { peer.destroy(); host().then(res, rej); } else { fire('error', e); rej(e); } });
      peer.on('connection', (conn) => {
        conn.on('open', () => { conns.set(conn.peer, conn); fire('join', conn.peer); });
        conn.on('data', (d) => fire('data', conn.peer, d));
        conn.on('close', () => { conns.delete(conn.peer); fire('leave', conn.peer); });
        conn.on('error', () => { conns.delete(conn.peer); fire('leave', conn.peer); });
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* noop */ } });
    });
  }
  function join(roomCode) {
    return new Promise((res, rej) => {
      role = 'client';
      peer = new Peer(undefined, peerOpts());
      const to = setTimeout(() => rej(new Error('部屋に繋がりません。コードを確認してください')), 15000);
      peer.on('open', () => {
        hostConn = peer.connect(PREFIX + roomCode.toUpperCase().trim(), { serialization: 'json', reliable: true });
        hostConn.on('open', () => { clearTimeout(to); res(); });
        hostConn.on('data', (d) => fire('data', 'host', d));
        hostConn.on('close', () => fire('leave', 'host'));
        hostConn.on('error', (e) => fire('error', e));
      });
      peer.on('error', (e) => { clearTimeout(to); if (e.type === 'peer-unavailable') rej(new Error('その部屋は見つかりません')); else rej(e); });
    });
  }
  function sendHost(d) { if (hostConn && hostConn.open) hostConn.send(d); }
  function send(pid, d) { const c = conns.get(pid); if (c && c.open) c.send(d); }
  function broadcast(d) { for (const c of conns.values()) if (c.open) c.send(d); }
  function close() {
    try { if (peer) peer.destroy(); } catch (e) { /* noop */ }
    peer = null; role = null; conns.clear(); hostConn = null;
  }
  return { on, host, join, send, sendHost, broadcast, close, get role() { return role; }, get count() { return conns.size; }, get myId() { return peer ? peer.id : null; } };
})();
