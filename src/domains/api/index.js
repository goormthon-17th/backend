const express = require('express');
const config = require('../../config');
const aiRouter = require('../ai');
const databaseRouter = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ ok: true, message: 'backend is running', path: '/api' });
});

router.get('/test', (req, res) => {
    res.json({
        ok: true,
        endpoint: '/api/test',
        deployCheck: config.deployCheck,
        at: new Date().toISOString(),
    });
});

router.use('/ai', aiRouter);
router.use('/db', databaseRouter);

module.exports = router;
