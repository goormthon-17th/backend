const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

function userRowToPayload(row) {
    return {
        id: Number(row.id),
        login_id: row.login_id,
        password: row.password,
        nickname: row.nickname,
        role: row.role,
        created_at:
            row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}

/** POST /api/auth/register { loginId, password, nickname } */
router.post('/register', async (req, res) => {
    const { loginId, password, nickname } = req.body || {};
    if (!loginId || !password || !nickname) {
        res.status(400).json({ ok: false, error: 'loginId, password, nickname required' });
        return;
    }
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }
    const lid = String(loginId).trim();
    const pw = String(password);
    const nick = String(nickname).trim();
    if (!lid || !pw || !nick) {
        res.status(400).json({ ok: false, error: 'empty field' });
        return;
    }
    try {
        await pool.execute(
            'INSERT INTO `user` (login_id, password, nickname) VALUES (?, ?, ?)',
            [lid, pw, nick],
        );
        const [rows] = await pool.execute(
            'SELECT id, login_id, password, nickname, role, created_at FROM `user` WHERE login_id = ? LIMIT 1',
            [lid],
        );
        const row = rows[0];
        res.status(201).json({ ok: true, user: userRowToPayload(row) });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ ok: false, error: 'loginId already exists' });
            return;
        }
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** POST /api/auth/login { loginId, password } */
router.post('/login', async (req, res) => {
    const { loginId, password } = req.body || {};
    if (loginId === undefined || loginId === null || password === undefined || password === null) {
        res.status(400).json({ ok: false, error: 'loginId, password required' });
        return;
    }
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }
    const lid = String(loginId).trim();
    const pw = String(password);
    try {
        const [rows] = await pool.execute(
            'SELECT id, login_id, password, nickname, role, created_at FROM `user` WHERE login_id = ? LIMIT 1',
            [lid],
        );
        const row = rows[0];
        if (!row || row.password !== pw) {
            res.status(401).json({ ok: false, error: 'invalid loginId or password' });
            return;
        }
        const payload = userRowToPayload(row);
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
        res.json({ ok: true, token, user: payload });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
