const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const swaggerUi = require('swagger-ui-express');

const PORT = Number(process.env.PORT) || 8080;
const DEPLOY_CHECK = 'deploy-verify-1';

const openapi = require('./openapi.json');

function createPool() {
    const user = process.env.MYSQL_USER;
    if (!user) return null;
    return mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'mydb',
        waitForConnections: true,
        connectionLimit: 5,
    });
}

let pool;
function getPool() {
    if (!pool) pool = createPool();
    return pool;
}

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
    : true;
app.use(
    cors({
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
);

app.use(express.json());

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

/** 테이블 `test` 컬럼 `test` 조회 */
app.get('/api/test-table', async (req, res) => {
    const p = getPool();
    if (!p) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set (local dev: set or run MySQL)' });
        return;
    }
    try {
        const [rows] = await p.query('SELECT id, `test` FROM `test` ORDER BY id DESC LIMIT 100');
        res.json({ ok: true, rows });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** 테이블 `test`에 한 행 추가. body: { "test": "값" } */
app.post('/api/test-table', async (req, res) => {
    const p = getPool();
    if (!p) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }
    const value = req.body && req.body.test;
    if (value === undefined || value === null || String(value).trim() === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "test" string' });
        return;
    }
    try {
        const [result] = await p.query('INSERT INTO `test` (`test`) VALUES (?)', [String(value)]);
        res.status(201).json({ ok: true, insertId: result.insertId });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

app.get('/api', (req, res) => {
    res.json({ ok: true, message: 'backend is running', path: '/api' });
});

app.get('/health', (req, res) => {
    res.type('text/plain').send('ok');
});

app.use((req, res, next) => {
    const pth = req.path.split('?')[0];
    if (
        pth.startsWith('/api/') &&
        pth !== '/api/test' &&
        pth !== '/api/test-table' &&
        !pth.startsWith('/api/docs')
    ) {
        res.status(404).json({ ok: false, error: 'not found', path: pth });
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
