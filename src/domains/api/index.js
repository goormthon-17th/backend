const express = require('express');
const aiRouter = require('../ai');
const databaseRouter = require('../database');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ ok: true, message: 'backend is running', path: '/api' });
});

router.use('/ai', aiRouter);
router.use('/db', databaseRouter);

module.exports = router;
