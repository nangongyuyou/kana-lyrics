// Minimal static server for previewing the built page. Usage: node serve.js <folder> [port]
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const PORT = +(process.argv[3] || 5178);
http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json' }[path.extname(f).toLowerCase()] || 'text/html; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
