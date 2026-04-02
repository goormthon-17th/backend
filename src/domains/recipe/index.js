const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/**
 * JWT 페이로드: 로그인 응답과 동일하게 { id, login_id, ... } — recipe.user_id 컬럼에는 id 값 사용 (키 이름은 user_id 아님)
 * Authorization: Bearer <token> (Bearer 대소문자 무관)
 */
function resolveUserId(req) {
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== 'string') {
        return 1;
    }
    const m = auth.match(/^Bearer\s+(\S+)/i);
    if (!m) {
        return 1;
    }
    const token = m[1].trim();
    if (!token) {
        return 1;
    }
    try {
        const p = jwt.verify(token, config.jwtSecret);
        const raw = p && (p.id != null ? p.id : p.user_id);
        if (raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) {
            return Number(raw);
        }
    } catch (_) {
        /* 무효·만료 토큰 → 비로그인과 동일 */
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
