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

function applyNotFound(app) {
    app.use((req, res, next) => {
        const pth = req.path.split('?')[0];
        if (
            pth.startsWith('/api/') &&
            pth !== '/api/test' &&
            pth !== '/api/db/ping' &&
            !pth.startsWith('/api/docs') &&
            !pth.startsWith('/api/ai/')
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

module.exports = { applyCors, applyBodyParser, applyNotFound };
