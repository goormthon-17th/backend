const cors = require('cors');
const express = require('express');

function applyCors(app) {
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
}

function applyBodyParser(app) {
    app.use(express.json());
}

/** JSON 파싱 실패 시 HTML 대신 JSON 400 (Swagger/클라이언트 디버깅용) */
function applyJsonBodyErrorHandler(app) {
    app.use((err, req, res, next) => {
        if (err.type === 'entity.parse.failed') {
            res.status(400).json({
                ok: false,
                error: 'Invalid JSON body',
                hint: 'Send Content-Type: application/json with a raw JSON object. Example: {"text":"STT text here"} — do not paste HTML or line breaks outside quoted strings.',
            });
            return;
        }
        next(err);
    });
}

function applyNotFound(app) {
    app.use((req, res, next) => {
        const pth = req.path.split('?')[0];
        if (
            pth.startsWith('/api/') &&
            pth !== '/api/db/ping' &&
            !pth.startsWith('/api/docs') &&
            !pth.startsWith('/api/ai/') &&
            !pth.startsWith('/api/auth/')
        ) {
            res.status(404).json({ ok: false, error: 'not found', path: pth });
            return;
        }
        next();
    });

    app.use((req, res) => {
        res.status(404).type('text/plain').send('not found');
    });
}

module.exports = { applyCors, applyBodyParser, applyJsonBodyErrorHandler, applyNotFound };
