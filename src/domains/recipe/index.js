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

/** refined_text에 제목 줄이 없으면 첫 비어 있지 않은 줄에서 표시용 이름 추출 */
function deriveRecipeName(refinedText) {
    if (refinedText == null) {
        return null;
    }
    const s = String(refinedText).trim();
    if (!s) {
        return null;
    }
    const stripBold = (t) =>
        String(t)
            .replace(/\*\*([^*]*)\*\*/g, '$1')
            .trim();
    const m = s.match(/레시피\s*제목\s*[:：]\s*([^\r\n]+)/i);
    if (m) {
        const n = stripBold(m[1]);
        return n || null;
    }
    const first = s.split(/\r?\n/).find((line) => line.trim());
    if (!first) {
        return null;
    }
    const n = stripBold(first.replace(/^\d+\.\s*/, ''));
    return n || null;
}

function nullableUrl(v) {
    if (v == null || String(v).trim() === '') {
        return null;
    }
    return String(v).trim();
}

const RECIPE_LIST_SQL =
    'SELECT r.id, r.user_id, u.nickname AS author_nickname, u.profile_image_url AS author_profile_image_url, r.refined_text, r.like_count, r.image_url AS recipe_image_url, YEAR(r.created_at) AS y, MONTH(r.created_at) AS m, DAY(r.created_at) AS d FROM recipe r INNER JOIN `user` u ON u.id = r.user_id';

function mapRecipeListRows(rows) {
    return rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        nickname: row.author_nickname != null ? String(row.author_nickname) : null,
        profile_image_url: nullableUrl(row.author_profile_image_url),
        recipe_name: deriveRecipeName(row.refined_text),
        created_at: {
            year: Number(row.y),
            month: Number(row.m),
            day: Number(row.d),
        },
        like_count: Number(row.like_count),
        refined_text: row.refined_text != null ? String(row.refined_text) : null,
        recipe_image_url: nullableUrl(row.recipe_image_url),
    }));
}

/** GET /api/recipes/latest — 최신순 최대 20개 */
router.get('/latest', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    try {
        const [rows] = await pool.execute(
            `${RECIPE_LIST_SQL} ORDER BY r.created_at DESC, r.id DESC LIMIT 20`,
        );
        res.json({ ok: true, recipes: mapRecipeListRows(rows) });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** GET /api/recipes/by-likes — 좋아요 수 내림차순 최대 20개 (동점이면 최신순) */
router.get('/by-likes', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    try {
        const [rows] = await pool.execute(
            `${RECIPE_LIST_SQL} ORDER BY r.like_count DESC, r.created_at DESC, r.id DESC LIMIT 20`,
        );
        res.json({ ok: true, recipes: mapRecipeListRows(rows) });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** GET /api/recipes/user/:userId — 해당 유저가 등록한 레시피 (최신순, 필드는 /latest 와 동일) */
router.get('/user/:userId', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId < 1) {
        res.status(400).json({ ok: false, error: 'invalid userId' });
        return;
    }

    try {
        const [users] = await pool.execute('SELECT id FROM `user` WHERE id = ? LIMIT 1', [userId]);
        if (!users.length) {
            res.status(404).json({ ok: false, error: 'user not found' });
            return;
        }

        const [rows] = await pool.execute(
            `${RECIPE_LIST_SQL} WHERE r.user_id = ? ORDER BY r.created_at DESC, r.id DESC`,
            [userId],
        );
        res.json({
            ok: true,
            user_id: userId,
            recipes: mapRecipeListRows(rows),
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** POST /api/recipes { raw_text?, refined_text?, image_url? } — 선택 Authorization: Bearer (audio는 프론트 mock) */
router.post('/', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const body = req.body || {};
    const rawText = body.raw_text != null ? String(body.raw_text) : null;
    const refinedText = body.refined_text != null ? String(body.refined_text) : null;
    const imageUrl = body.image_url != null ? String(body.image_url) : null;

    const userId = resolveUserId(req);

    try {
        const [r] = await pool.execute(
            'INSERT INTO recipe (user_id, raw_text, refined_text, image_url) VALUES (?, ?, ?, ?)',
            [userId, rawText, refinedText, imageUrl],
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
 * POST /api/recipes/:recipeId/like — 토글: 없으면 INSERT·+1, 있으면 DELETE·−1 (트랜잭션 없음)
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

    const userId = resolveUserId(req);

    try {
        const [exists] = await pool.execute('SELECT id FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
        if (!exists.length) {
            res.status(404).json({ ok: false, error: 'recipe not found' });
            return;
        }

        const [delResult] = await pool.execute(
            'DELETE FROM recipe_like WHERE user_id = ? AND recipe_id = ?',
            [userId, recipeId],
        );

        if (delResult.affectedRows > 0) {
            await pool.execute(
                'UPDATE recipe SET like_count = IF(like_count > 0, like_count - 1, 0) WHERE id = ?',
                [recipeId],
            );
            const [after] = await pool.execute('SELECT like_count FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
            res.status(200).json({
                ok: true,
                liked: false,
                like_count: Number(after[0].like_count),
                user_id: userId,
            });
            return;
        }

        try {
            await pool.execute('INSERT INTO recipe_like (user_id, recipe_id) VALUES (?, ?)', [
                userId,
                recipeId,
            ]);
        } catch (insertErr) {
            if (insertErr.code === 'ER_NO_REFERENCED_ROW_2' || insertErr.errno === 1452) {
                res.status(400).json({ ok: false, error: 'invalid user_id (user not found)' });
                return;
            }
            throw insertErr;
        }

        await pool.execute('UPDATE recipe SET like_count = like_count + 1 WHERE id = ?', [recipeId]);
        const [after] = await pool.execute('SELECT like_count FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
        res.status(201).json({
            ok: true,
            liked: true,
            like_count: Number(after[0].like_count),
            user_id: userId,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
