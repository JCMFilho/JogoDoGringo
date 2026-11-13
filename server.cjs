const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.json':'application/json', '.svg':'image/svg+xml' };
const port = Number(process.env.PORT) || 4173;
function createServer() { return http.createServer((req,res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (requested === '/help') { res.writeHead(308, {'Location':'/help/'}).end(); return; }
  const file = path.resolve(root, '.' + (requested.endsWith('/') ? requested + 'index.html' : requested));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error,content) => {
    if (error) { res.writeHead(404).end('Arquivo não encontrado'); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'}).end(content);
  });
}); }
if (require.main === module) {
  const server = createServer();
  server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}
module.exports = {createServer};
