// 友情ブレイカーズ LANサーバー
// ・ゲームのファイルを http://<このPCのIP>:8080 で配信
// ・PeerJS の接続仲介サーバーを :9000 で起動（インターネット不要でLAN対戦できる）
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PeerServer } = require('peer');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT) || f.includes('LANサーバー')) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, '0.0.0.0');

PeerServer({ port: 9000, path: '/', host: '0.0.0.0' });

const ips = [];
for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
console.log('');
console.log('  友情ブレイカーズ LANサーバー起動中');
console.log('  ------------------------------------------------');
for (const ip of ips) console.log(`  同じWi-Fi/LANの人はブラウザでこれを開く →  http://${ip}:8080/?server=${ip}:9000`);
console.log(`  このPCで遊ぶ場合 →  http://localhost:8080/?server=localhost:9000`);
console.log('  ------------------------------------------------');
console.log('  この画面を閉じるとサーバーが止まります');
console.log('');
