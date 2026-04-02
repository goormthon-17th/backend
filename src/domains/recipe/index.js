const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/**
 * Authorization: Bearer <token> (프론트는 스토리지의 토큰을 헤더에 붙이면 됨) — 유효 시 페이로드 id → user_id, 없으면 1
 */
function resolveUserId(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return 1;
    }
    const token = auth.slice(7).trim();
    if (!token) {
        return 1;
    }
    try {
        const p = jwt.verify(token, config.jwtSecret);
        if (p && p.id != null && Number.isFinite(Number(p.id)) && Number(p.id) > 0) {
            return Number(p.id);
        }
    } catch (_) {
        /* 무효 토큰 → 비로그인과 동일 */
    }
    return 1;
}

/** POST /api/recipes { raw_text?, refined_text?, audio_url? } — 선택 Authorization: Bearer */
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
