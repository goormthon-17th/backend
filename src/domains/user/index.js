const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

/** Authorization: Bearer … 또는 JWT만 (레시피 API와 동일) */
function extractBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') {
        return null;
    }
    const v = headerValue.trim();
    const m = v.match(/^Bearer\s+(\S+)/i);
    if (m) {
        return m[1].trim() || null;
    }
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
        /* 무효·만료 토큰 */
    }
    return 1;
}

/**
 * GET /api/users/following — 내가 구독 중인 유저 최대 20명 (구독한 순서 최신). JWT 없으면 follower 1
 * 각 항목: user_id, nickname, profile_image_url(유저), recipe_image_url(대표 레시피 썸네일)
 */
router.get('/following', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const followerId = resolveUserId(req);

    try {
        const [rows] = await pool.execute(
            `SELECT
                u.id AS user_id,
                u.nickname,
                u.profile_image_url,
                (
                    SELECT r.image_url FROM recipe r
                    WHERE r.user_id = u.id
                      AND r.image_url IS NOT NULL
                      AND TRIM(r.image_url) <> ''
                    ORDER BY r.created_at DESC, r.id DESC
                    LIMIT 1
                ) AS recipe_image_url
            FROM user_subscribe s
            INNER JOIN \`user\` u ON u.id = s.following_id
            WHERE s.follower_id = ?
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 20`,
            [followerId],
        );

        const users = rows.map((row) => ({
            user_id: Number(row.user_id),
            nickname: String(row.nickname),
            profile_image_url:
                row.profile_image_url != null && String(row.profile_image_url).trim() !== ''
                    ? String(row.profile_image_url)
                    : null,
            recipe_image_url:
                row.recipe_image_url != null && String(row.recipe_image_url).trim() !== ''
                    ? String(row.recipe_image_url)
                    : null,
        }));

        res.json({ ok: true, users });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/**
 * POST /api/users/:userId/subscribe — 구독 토글 (user_subscribe: follower=나, following=경로 userId). JWT 없으면 follower 1
 */
router.post('/:userId/subscribe', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const followingId = Number(req.params.userId);
    if (!Number.isInteger(followingId) || followingId < 1) {
        res.status(400).json({ ok: false, error: 'invalid userId' });
        return;
    }

    const followerId = resolveUserId(req);
    if (followerId === followingId) {
        res.status(400).json({ ok: false, error: 'cannot subscribe to yourself' });
        return;
    }

    try {
        const [exists] = await pool.execute('SELECT id FROM `user` WHERE id = ? LIMIT 1', [followingId]);
        if (!exists.length) {
            res.status(404).json({ ok: false, error: 'user not found' });
            return;
        }

        const [delResult] = await pool.execute(
            'DELETE FROM user_subscribe WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId],
        );

        if (delResult.affectedRows > 0) {
            res.status(200).json({
                ok: true,
                subscribed: false,
                follower_id: followerId,
                following_id: followingId,
            });
            return;
        }

        try {
            await pool.execute(
                'INSERT INTO user_subscribe (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId],
            );
        } catch (insertErr) {
            if (insertErr.code === 'ER_NO_REFERENCED_ROW_2' || insertErr.errno === 1452) {
                res.status(400).json({ ok: false, error: 'invalid follower (user not found)' });
                return;
            }
            if (insertErr.code === 'ER_DUP_ENTRY' || insertErr.errno === 1062) {
                res.json({
                    ok: true,
                    subscribed: true,
                    follower_id: followerId,
                    following_id: followingId,
                });
                return;
            }
            throw insertErr;
        }

        res.status(201).json({
            ok: true,
            subscribed: true,
            follower_id: followerId,
            following_id: followingId,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/**
 * GET /api/users/:userId — 프로필 요약 + is_subscribed(조회 주체가 이 유저를 구독 중인지)
 * JWT 없거나 무효면 조회 주체는 user id 1 (다른 API와 동일)
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

    const viewerId = resolveUserId(req);

    try {
        const [rows] = await pool.execute(
            `SELECT
                u.nickname,
                u.profile_image_url,
                COALESCE(rc.cnt, 0) AS recipe_count,
                COALESCE(rc.likes_sum, 0) AS recipe_likes_total,
                COALESCE(fc.cnt, 0) AS following_count,
                EXISTS (
                    SELECT 1 FROM user_subscribe s
                    WHERE s.follower_id = ? AND s.following_id = u.id
                ) AS is_subscribed
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
            [viewerId, userId],
        );

        if (!rows.length) {
            res.status(404).json({ ok: false, error: 'user not found' });
            return;
        }

        const row = rows[0];
        const isSubscribed = Number(row.is_subscribed) === 1;

        res.json({
            ok: true,
            user_id: userId,
            nickname: String(row.nickname),
            profile_image_url:
                row.profile_image_url != null && String(row.profile_image_url).trim() !== ''
                    ? String(row.profile_image_url)
                    : null,
            recipe_count: Number(row.recipe_count),
            recipe_likes_total: Number(row.recipe_likes_total),
            following_count: Number(row.following_count),
            is_subscribed: isSubscribed,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
