const express = require('express');
const { getPool } = require('../../services/mysqlPool');

const router = express.Router();

router.get('/ping', async (req, res) => {
    const p = getPool();
    if (!p) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }
    try {
        await p.query('SELECT 1');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
