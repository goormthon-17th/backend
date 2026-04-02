const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/**
 * Authorization: Bearer <token> 또는 body.jwt — 유효하면 페이로드의 id → user_id, 아니면 1
 */
function resolveUserId(req) {
    const tryVerify = (token) => {
        if (!token || typeof token !== 'string') return null;
        const t = token.trim();
        if (!t) return null;
        try {
            const p = jwt.verify(t, config.jwtSecret);
            if (p && p.id != null && Number.isFinite(Number(p.id)) && Number(p.id) > 0) {
                return Number(p.id);
            }
        } catch (_) {
            /* ignore */
        }
        return null;
    };

    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        const id = tryVerify(auth.slice(7));
        if (id != null) return id;
    }

    const body = req.body || {};
    if (typeof body.jwt === 'string') {
        const id = tryVerify(body.jwt);
        if (id != null) return id;
    }

    return 1;
}

/** POST /api/recipes { raw_text?, refined_text?, audio_url?, jwt? } + 선택 Authorization */
router.post('/', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const body = req.body || {};
    const rawText = body.raw_text != null ? String(body.raw_text) : null;
    const refinedText = body.refined_text != null ? String(body.refined_text) : null;
    const audioUrl = body.audio_url != null ? String(body.audio_url) : null;

    const userId = resolveUserId(req);

    try {
        const [r] = await pool.execute(
            'INSERT INTO recipe (user_id, raw_text, refined_text, audio_url) VALUES (?, ?, ?, ?)',
            [userId, rawText, refinedText, audioUrl],
        );
        const insertId = r.insertId;
        res.status(201).json({
            ok: true,
            id: insertId,
            user_id: userId,
        });
    } catch (e) {
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.errno === 1452) {
            res.status(400).json({
                ok: false,
                error: 'invalid user_id (user not found). Ensure user exists or use login JWT.',
            });
            return;
        }
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
