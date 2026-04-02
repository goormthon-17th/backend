const express = require('express');
const swaggerUi = require('swagger-ui-express');

const PORT = Number(process.env.PORT) || 8080;
const DEPLOY_CHECK = 'deploy-verify-1';

const openapi = require('./openapi.json');

const app = express();

app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
        customSiteTitle: 'API Docs',
    }),
);

app.get('/openapi.json', (req, res) => {
    res.json(openapi);
});

app.get('/api/test', (req, res) => {
    res.json({
        ok: true,
        endpoint: '/api/test',
        deployCheck: DEPLOY_CHECK,
        at: new Date().toISOString(),
    });
});

app.get('/test', (req, res) => {
    res.json({
        ok: true,
        endpoint: '/test',
        deployCheck: DEPLOY_CHECK,
        at: new Date().toISOString(),
    });
});

app.get('/api', (req, res) => {
    res.json({ ok: true, message: 'backend is running', path: '/api' });
});

app.get('/health', (req, res) => {
    res.type('text/plain').send('ok');
});

app.use((req, res, next) => {
    const p = req.path.split('?')[0];
    if (p.startsWith('/api/') && p !== '/api/test' && !p.startsWith('/api/docs')) {
        res.status(404).json({ ok: false, error: 'not found', path: p });
        return;
    }
    next();
});

app.use((req, res) => {
    res.status(404).type('text/plain').send('not found');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`listening on 0.0.0.0:${PORT}`);
});
