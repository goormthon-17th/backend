const express = require('express');
const { getPool } = require('../database/mysqlPool');

const router = express.Router();

function rowToPayload(row) {
    if (!row) {
        return {
            gem: null,
            invoke: null,
            secret: null,
            map: null,
            back: null,
        };
    }
    return {
        gem: row.gem != null ? String(row.gem) : null,
        invoke: row.invoke != null ? String(row.invoke) : null,
        secret: row.secret != null ? String(row.secret) : null,
        map: row.map != null ? String(row.map) : null,
        back: row.back != null ? String(row.back) : null,
    };
}

function mergeField(body, curRow, key) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
        return curRow ? curRow[key] : null;
    }
    const v = body[key];
    if (v === null) {
        return null;
    }
    return String(v);
}

/** GET /api/env — DB environment 행 1건 (없으면 null 필드) */
router.get('/', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    try {
        const [rows] = await pool.execute(
            'SELECT gem, `invoke`, secret, `map`, `back` FROM environment ORDER BY id ASC LIMIT 1',
        );
        res.json({ ok: true, ...rowToPayload(rows[0]) });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

/**
 * POST /api/env — gem, invoke, secret, map, back 중 넘긴 필드만 갱신(병합), 없으면 행 생성
 */
router.post('/', async (req, res) => {
    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    const body = req.body || {};

    try {
        const [rows] = await pool.execute(
            'SELECT id, gem, `invoke`, secret, `map`, `back` FROM environment ORDER BY id ASC LIMIT 1',
        );
        const cur = rows[0];

        const gem = mergeField(body, cur, 'gem');
        const invoke = mergeField(body, cur, 'invoke');
        const secret = mergeField(body, cur, 'secret');
        const mapVal = mergeField(body, cur, 'map');
        const back = mergeField(body, cur, 'back');

        if (!cur) {
            await pool.execute(
                'INSERT INTO environment (gem, `invoke`, secret, `map`, `back`) VALUES (?, ?, ?, ?, ?)',
                [gem, invoke, secret, mapVal, back],
            );
        } else {
            await pool.execute(
                'UPDATE environment SET gem = ?, `invoke` = ?, secret = ?, `map` = ?, `back` = ? WHERE id = ?',
                [gem, invoke, secret, mapVal, back, cur.id],
            );
        }

        const [after] = await pool.execute(
            'SELECT gem, `invoke`, secret, `map`, `back` FROM environment ORDER BY id ASC LIMIT 1',
        );
        res.json({ ok: true, ...rowToPayload(after[0]) });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
});

module.exports = router;
