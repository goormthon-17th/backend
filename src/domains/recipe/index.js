const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/**
 * JWT 페이로드: 로그인 응답과 동일하게 { id, login_id, ... } — recipe.user_id 컬럼에는 id 값 사용
 * Authorization: `Bearer <token>` 또는 Swagger 파라미터에 토큰만 넣은 경우 `<token>` 단독도 허용
 */
function extractBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') {
        return null;
    }
    const v = headerValue.trim();
    const m = v.match(/^Bearer\s+(\S+)/i);
    if (m) {
        return m[1].trim() || null;
    }
    // Swagger Try it out에서 JWT만 붙여넣으면 "Bearer " 없이 옴
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) {
        return v;
    }
    return null;
}

function resolveUserId(req) {
    const token = extractBearerToken(req.headers.authorization);
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

/**
 * POST /api/recipes/:recipeId/like — recipe_like 행 추가 + recipe.like_count +1 (중복 시 alreadyLiked)
 */
router.post('/:recipeId/like', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const recipeId = Number(req.params.recipeId);
    if (!Number.isInteger(recipeId) || recipeId < 1) {
        res.status(400).json({ ok: false, error: 'invalid recipeId' });
        return;
    }

    const [exists] = await pool.execute('SELECT id, like_count FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
    if (!exists.length) {
        res.status(404).json({ ok: false, error: 'recipe not found' });
        return;
    }

    const userId = resolveUserId(req);
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        try {
            await conn.execute('INSERT INTO recipe_like (user_id, recipe_id) VALUES (?, ?)', [
                userId,
                recipeId,
            ]);
        } catch (insertErr) {
            await conn.rollback();
            if (insertErr.code === 'ER_DUP_ENTRY' || insertErr.errno === 1062) {
                res.json({
                    ok: true,
                    alreadyLiked: true,
                    like_count: Number(exists[0].like_count),
                    user_id: userId,
                });
                return;
            }
            if (insertErr.code === 'ER_NO_REFERENCED_ROW_2' || insertErr.errno === 1452) {
                res.status(400).json({ ok: false, error: 'invalid user_id (user not found)' });
                return;
            }
            throw insertErr;
        }

        await conn.execute('UPDATE recipe SET like_count = like_count + 1 WHERE id = ?', [recipeId]);
        const [after] = await conn.execute('SELECT like_count FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
        await conn.commit();
        res.status(201).json({
            ok: true,
            alreadyLiked: false,
            like_count: Number(after[0].like_count),
            user_id: userId,
        });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ ok: false, error: String(e.message || e) });
    } finally {
        conn.release();
    }
});

module.exports = router;
