const { getPool } = require('./mysqlPool');

/** 요청 JSON body.code 가 이 값과 같을 때만 TRUNCATE 허용 */
const CLEAR_BODY_CODE = '1234';

/** 화이트리스트 — 이 이름만 TRUNCATE 허용 */
const TABLES = {
    user: '`user`',
    recipe: '`recipe`',
    recipe_like: '`recipe_like`',
    recipe_review: '`recipe_review`',
    user_subscribe: '`user_subscribe`',
};

function assertClearBody(req, res) {
    const b = req.body;
    if (b == null || typeof b !== 'object' || Array.isArray(b)) {
        res.status(400).json({
            ok: false,
            error: 'Send JSON body: { "code": "1234" }',
        });
        return false;
    }
    if (String(b.code) !== CLEAR_BODY_CODE) {
        res.status(403).json({ ok: false, error: 'invalid or missing code' });
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
    router.post('/clear/user', (req, res) => {
        if (!assertClearBody(req, res)) return;
        truncateTable('user', res);
    });
    router.post('/clear/recipe', (req, res) => {
        if (!assertClearBody(req, res)) return;
        truncateTable('recipe', res);
    });
    router.post('/clear/recipe-like', (req, res) => {
        if (!assertClearBody(req, res)) return;
        truncateTable('recipe_like', res);
    });
    router.post('/clear/recipe-review', (req, res) => {
        if (!assertClearBody(req, res)) return;
        truncateTable('recipe_review', res);
    });
    router.post('/clear/user-subscribe', (req, res) => {
        if (!assertClearBody(req, res)) return;
        truncateTable('user_subscribe', res);
    });
}

module.exports = { mountClearRoutes, TABLES };
