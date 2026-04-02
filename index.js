require('dotenv').config();

const { createApp } = require('./src/app');
const config = require('./src/config');
const { ensureSchema } = require('./src/domains/database/ensureSchema');

const app = createApp();

(async () => {
    try {
        await ensureSchema();
    } catch (e) {
        console.error('[db] ensureSchema failed:', e.message || e);
        process.exit(1);
    }
    app.listen(config.port, '0.0.0.0', () => {
        console.log(`listening on 0.0.0.0:${config.port}`);
    });
})();
