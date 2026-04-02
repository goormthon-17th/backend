const express = require('express');
const { resolveUserId } = require('../../shared/resolveUserId');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

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

/** SQL LIKE 패턴용 % _ \ 이스케이프 */
function escapeLikePattern(ch) {
    return String(ch).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * /latest 의 recipe_name 기준 — 키워드(공백 제거 연속) 전체 포함 또는 글자 하나라도 포함
 */
function recipeNameMatchesKeyword(recipeName, keyword) {
    if (recipeName == null || keyword == null) {
        return false;
    }
    const name = String(recipeName);
    const nl = name.toLowerCase();
    const kCompact = String(keyword).replace(/\s+/g, '').trim().toLowerCase();
    if (!kCompact) {
        return false;
    }
    if (nl.includes(kCompact)) {
        return true;
    }
    const uniq = [...new Set(Array.from(kCompact))];
    return uniq.some((ch) => nl.includes(ch));
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

function mapLikedByMeRows(rows) {
    return rows.map((row) => ({
        id: Number(row.id),
        recipe_name: deriveRecipeName(row.refined_text),
        refined_text: row.refined_text != null ? String(row.refined_text) : null,
        like_count: Number(row.like_count),
        image_url: nullableUrl(row.recipe_image_url),
        created_at: {
            year: Number(row.y),
            month: Number(row.m),
            day: Number(row.d),
        },
    }));
}

/** GET /api/recipes/liked — 내가 좋아요한 레시피 (좋아요 누른 순 최신). JWT 없으면 user_id=1 기준 */
router.get('/liked', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const userId = resolveUserId(req);

    try {
        const [rows] = await pool.execute(
            `SELECT
                r.id,
                r.refined_text,
                r.like_count,
                r.image_url AS recipe_image_url,
                YEAR(r.created_at) AS y,
                MONTH(r.created_at) AS m,
                DAY(r.created_at) AS d
            FROM recipe_like lk
            INNER JOIN recipe r ON r.id = lk.recipe_id
            WHERE lk.user_id = ?
            ORDER BY lk.created_at DESC, lk.id DESC
            LIMIT 200`,
            [userId],
        );
        res.json({ ok: true, recipes: mapLikedByMeRows(rows) });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/**
 * GET /api/recipes/search?q=
 * 표시용 이름(recipe_name)이 검색어와 일치: 연속 문자열 포함 또는(공백 제외) 한 글자라도 포함. 응답 형태는 /latest 와 동일
 */
router.get('/search', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const raw = req.query.q;
    const keyword = raw != null ? String(raw).trim() : '';
    if (!keyword) {
        res.status(400).json({ ok: false, error: 'query param q is required' });
        return;
    }
    if (keyword.length > 200) {
        res.status(400).json({ ok: false, error: 'q too long' });
        return;
    }

    const uniqChars = [...new Set(Array.from(keyword.replace(/\s/g, '')))].slice(0, 80);
    if (!uniqChars.length) {
        res.json({ ok: true, recipes: [] });
        return;
    }

    const likeClauseParts = [];
    const likeParams = [];
    for (const ch of uniqChars) {
        const pat = `%${escapeLikePattern(ch)}%`;
        likeClauseParts.push(
            '(COALESCE(r.refined_text, \'\') LIKE ? ESCAPE \'\\\\\' OR COALESCE(r.raw_text, \'\') LIKE ? ESCAPE \'\\\\\')',
        );
        likeParams.push(pat, pat);
    }

    const sql = `${RECIPE_LIST_SQL} WHERE (${likeClauseParts.join(' OR ')}) ORDER BY r.created_at DESC, r.id DESC LIMIT 400`;

    try {
        const [rows] = await pool.execute(sql, likeParams);
        const mapped = mapRecipeListRows(rows);
        const recipes = mapped.filter((r) => recipeNameMatchesKeyword(r.recipe_name, keyword));
        res.json({ ok: true, recipes });
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

function tinyToBool(v) {
    return Boolean(Number(v));
}

function mapReviewRow(row) {
    return {
        id: Number(row.id),
        user_id: Number(row.user_id),
        nickname: String(row.reviewer_nickname),
        content: row.content != null ? String(row.content) : null,
        is_liked: tinyToBool(row.is_liked),
        emo_1: tinyToBool(row.emo_1),
        emo_2: tinyToBool(row.emo_2),
        emo_3: tinyToBool(row.emo_3),
        created_at: {
            year: Number(row.cy),
            month: Number(row.cm),
            day: Number(row.cd),
        },
        updated_at: {
            year: Number(row.uy),
            month: Number(row.um),
            day: Number(row.ud),
        },
    };
}

const REVIEW_SELECT_YMD = `rv.id, rv.user_id, rv.content, rv.is_liked, rv.emo_1, rv.emo_2, rv.emo_3,
                YEAR(rv.created_at) AS cy, MONTH(rv.created_at) AS cm, DAY(rv.created_at) AS cd,
                YEAR(rv.updated_at) AS uy, MONTH(rv.updated_at) AS um, DAY(rv.updated_at) AS ud,
                u.nickname AS reviewer_nickname`;

/** JSON body 불리언: true/false, 1/0, "t"/"f" 등 */
function bodyBool(v, defaultVal = false) {
    if (v === true || v === 1) {
        return true;
    }
    if (v === false || v === 0) {
        return false;
    }
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 't') {
            return true;
        }
        if (s === 'false' || s === '0' || s === 'f' || s === '') {
            return false;
        }
    }
    if (v == null) {
        return defaultVal;
    }
    return Boolean(v);
}

/**
 * POST /api/recipes/:recipeId/reviews — 리뷰 작성·수정 (JWT 없으면 user_id 1, 동일 유저·레시피면 UPSERT)
 * body: content?, emo_1|emo1, emo_2|emo2, emo_3|emo3 (boolean)
 */
router.post('/:recipeId/reviews', async (req, res) => {
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

    const body = req.body || {};
    const rawContent = body.content != null ? String(body.content) : null;
    const content = rawContent != null && rawContent.trim() === '' ? null : rawContent;

    const emo1Raw = body.emo_1 !== undefined ? body.emo_1 : body.emo1;
    const emo2Raw = body.emo_2 !== undefined ? body.emo_2 : body.emo2;
    const emo3Raw = body.emo_3 !== undefined ? body.emo_3 : body.emo3;
    const emo1 = bodyBool(emo1Raw, false) ? 1 : 0;
    const emo2 = bodyBool(emo2Raw, false) ? 1 : 0;
    const emo3 = bodyBool(emo3Raw, false) ? 1 : 0;

    const userId = resolveUserId(req);

    try {
        const [exists] = await pool.execute('SELECT id FROM recipe WHERE id = ? LIMIT 1', [recipeId]);
        if (!exists.length) {
            res.status(404).json({ ok: false, error: 'recipe not found' });
            return;
        }

        const [ins] = await pool.execute(
            `INSERT INTO recipe_review (user_id, recipe_id, content, is_liked, emo_1, emo_2, emo_3)
             VALUES (?, ?, ?, 0, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               content = VALUES(content),
               emo_1 = VALUES(emo_1),
               emo_2 = VALUES(emo_2),
               emo_3 = VALUES(emo_3),
               updated_at = CURRENT_TIMESTAMP`,
            [userId, recipeId, content, emo1, emo2, emo3],
        );

        const header = ins;
        const created = header.affectedRows === 1;

        const [savedRows] = await pool.execute(
            `SELECT ${REVIEW_SELECT_YMD}
             FROM recipe_review rv
             INNER JOIN \`user\` u ON u.id = rv.user_id
             WHERE rv.user_id = ? AND rv.recipe_id = ?
             LIMIT 1`,
            [userId, recipeId],
        );
        const row = savedRows[0];

        const review = mapReviewRow(row);

        res.status(created ? 201 : 200).json({
            ok: true,
            created,
            recipe_id: recipeId,
            review,
        });
    } catch (e) {
        if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.errno === 1452) {
            res.status(400).json({ ok: false, error: 'invalid user_id (user not found)' });
            return;
        }
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/** GET /api/recipes/:recipeId — 레시피 상세 + 리뷰 전체 */
router.get('/:recipeId', async (req, res) => {
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

    try {
        const [rows] = await pool.execute(
            `SELECT r.id, r.user_id, r.raw_text, r.refined_text, r.image_url, r.like_count,
                YEAR(r.created_at) AS y, MONTH(r.created_at) AS m, DAY(r.created_at) AS d,
                u.nickname AS author_nickname, u.profile_image_url AS author_profile_image_url
            FROM recipe r
            INNER JOIN \`user\` u ON u.id = r.user_id
            WHERE r.id = ?
            LIMIT 1`,
            [recipeId],
        );

        if (!rows.length) {
            res.status(404).json({ ok: false, error: 'recipe not found' });
            return;
        }

        const rrow = rows[0];

        const [reviewRows] = await pool.execute(
            `SELECT ${REVIEW_SELECT_YMD}
            FROM recipe_review rv
            INNER JOIN \`user\` u ON u.id = rv.user_id
            WHERE rv.recipe_id = ?
            ORDER BY rv.created_at DESC, rv.id DESC`,
            [recipeId],
        );

        const reviews = reviewRows.map((row) => mapReviewRow(row));

        res.json({
            ok: true,
            id: Number(rrow.id),
            user_id: Number(rrow.user_id),
            nickname: rrow.author_nickname != null ? String(rrow.author_nickname) : null,
            profile_image_url: nullableUrl(rrow.author_profile_image_url),
            recipe_image_url: nullableUrl(rrow.image_url),
            recipe_name: deriveRecipeName(rrow.refined_text),
            created_at: {
                year: Number(rrow.y),
                month: Number(rrow.m),
                day: Number(rrow.d),
            },
            like_count: Number(rrow.like_count),
            refined_text: rrow.refined_text != null ? String(rrow.refined_text) : null,
            raw_text: rrow.raw_text != null ? String(rrow.raw_text) : null,
            reviews,
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
