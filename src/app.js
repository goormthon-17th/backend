const fs = require('fs');
const express = require('express');
const config = require('./config');
const { applyCors, applyBodyParser, applyJsonBodyErrorHandler, applyNotFound } = require('./shared/http');
const { register: registerDocumentation } = require('./domains/documentation');
const apiRouter = require('./domains/api');
const healthRouter = require('./domains/health');

function createApp() {
    const app = express();

    applyCors(app);
    applyBodyParser(app);

    registerDocumentation(app, config.openapi);

    try {
        fs.mkdirSync(config.uploadsDir, { recursive: true });
    } catch (_) {
        /* 시작 시 생성 실패는 업로드 시점에 재시도 */
    }
    app.use(config.uploadsPublicPath, express.static(config.uploadsDir));

    app.use('/api', apiRouter);
    app.use('/health', healthRouter);

    applyNotFound(app);
    applyJsonBodyErrorHandler(app);

    return app;
}

module.exports = { createApp };
