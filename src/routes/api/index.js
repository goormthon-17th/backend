const express = require('express');
const config = require('../../config');

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

router.use('/ai', require('./ai.routes'));
router.use('/db', require('./db.routes'));

module.exports = router;
