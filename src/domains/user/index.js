const express = require('express');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/**
 * GET /api/users/:userId — 프로필 요약 (닉네임, 레시피 수, 레시피 좋아요 합계, 내가 구독 중인 사람 수)
 */
router.get('/:userId', async (req, res) => {
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
        const [rows] = await pool.execute(
            `SELECT
                u.nickname,
                COALESCE(rc.cnt, 0) AS recipe_count,
                COALESCE(rc.likes_sum, 0) AS recipe_likes_total,
                COALESCE(fc.cnt, 0) AS following_count
            FROM \`user\` u
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt, COALESCE(SUM(like_count), 0) AS likes_sum
                FROM recipe
                GROUP BY user_id
            ) rc ON rc.user_id = u.id
            LEFT JOIN (
                SELECT follower_id, COUNT(*) AS cnt
                FROM user_subscribe
                GROUP BY follower_id
            ) fc ON fc.follower_id = u.id
            WHERE u.id = ?
            LIMIT 1`,
            [userId],
        );

        if (!rows.length) {
            res.status(404).json({ ok: false, error: 'user not found' });
            return;
        }

        const row = rows[0];
        res.json({
            ok: true,
            user_id: userId,
            nickname: String(row.nickname),
            recipe_count: Number(row.recipe_count),
            recipe_likes_total: Number(row.recipe_likes_total),
            following_count: Number(row.following_count),
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
