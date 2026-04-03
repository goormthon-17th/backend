const { getPool } = require('./mysqlPool');

/** 화이트리스트 — 이 이름만 TRUNCATE 허용 */
const TABLES = {
    user: '`user`',
    recipe: '`recipe`',
    recipe_like: '`recipe_like`',
    recipe_review: '`recipe_review`',
    user_subscribe: '`user_subscribe`',
};

function assertClearSecret(req, res) {
    const secret = process.env.TABLE_CLEAR_SECRET;
    if (!secret || String(secret).trim() === '') {
        res.status(503).json({
            ok: false,
            error: 'TABLE_CLEAR_SECRET is not set — table clear APIs are disabled',
        });
        return false;
    }
    const sent = req.get('x-table-clear-secret');
    if (sent !== secret) {
        res.status(403).json({ ok: false, error: 'invalid or missing X-Table-Clear-Secret header' });
        return false;
    }
    return true;
}

async function truncateTable(key, res) {
    const tableSql = TABLES[key];
    if (!tableSql) {
        res.status(400).json({ ok: false, error: 'unknown table key' });
        return;
    }

    const pool = getPool();
    if (!pool) {
        res.status(503).json({ ok: false, error: 'MYSQL_* env not set' });
        return;
    }

    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query(`TRUNCATE TABLE ${tableSql}`);
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        res.json({ ok: true, table: key });
    } catch (e) {
        try {
            await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (_) {
            /* ignore */
        }
        res.status(500).json({ ok: false, error: String(e.message || e) });
    }
}

function mountClearRoutes(router) {
    router.post('/clear/user', async (req, res) => {
        if (!assertClearSecret(req, res)) return;
        await truncateTable('user', res);
    });
    router.post('/clear/recipe', async (req, res) => {
        if (!assertClearSecret(req, res)) return;
        await truncateTable('recipe', res);
    });
    router.post('/clear/recipe-like', async (req, res) => {
        if (!assertClearSecret(req, res)) return;
        await truncateTable('recipe_like', res);
    });
    router.post('/clear/recipe-review', async (req, res) => {
        if (!assertClearSecret(req, res)) return;
        await truncateTable('recipe_review', res);
    });
    router.post('/clear/user-subscribe', async (req, res) => {
        if (!assertClearSecret(req, res)) return;
        await truncateTable('user_subscribe', res);
    });
}

module.exports = { mountClearRoutes, TABLES };
