const http = require('http');

const PORT = Number(process.env.PORT) || 8080;

/** push 후 반영 여부 확인용 — 배포 테스트할 때마다 숫자만 바꿔도 됨 */
const DEPLOY_CHECK = 'deploy-verify-1';

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  if (pathname === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        ok: true,
        endpoint: '/api/test',
        deployCheck: DEPLOY_CHECK,
        at: new Date().toISOString(),
      })
    );
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, message: 'backend is running', path: pathname }));
    return;
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on 0.0.0.0:${PORT}`);
});
