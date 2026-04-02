const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
// K8s 등에서 이미 GEMINI_API_KEY가 있으면 dotenv 기본값은 덮어쓰지 않음 → .env의 올바른 키가 무시됨
const dotenvResult = require('dotenv').config({ path: envPath, override: true });

console.log('[env] .env path:', envPath);
console.log('[env] .env file exists:', fs.existsSync(envPath));
if (dotenvResult.error) {
    console.warn('[env] dotenv:', dotenvResult.error.message);
}
if (dotenvResult.parsed && Object.keys(dotenvResult.parsed).length > 0) {
    console.log('[env] keys loaded from file:', Object.keys(dotenvResult.parsed).sort().join(', '));
} else {
    console.log('[env] no key=value lines parsed from .env');
}
console.log('[env] GEMINI_API_KEY in process.env:', process.env.GEMINI_API_KEY ? 'set' : 'not set');
console.log('[env] dotenv override: true (.env가 기존 환경변수보다 우선)');

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
