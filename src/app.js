const express = require('express');
const config = require('./config');
const { applyCors, applyBodyParser, applyNotFound } = require('./shared/http');
const { register: registerDocumentation } = require('./domains/documentation');
const apiRouter = require('./domains/api');
const healthRouter = require('./domains/health');
const publicTestRouter = require('./domains/publicTest');

function createApp() {
    const app = express();

    applyCors(app);
    applyBodyParser(app);

    registerDocumentation(app, config.openapi);

    app.use('/api', apiRouter);
    app.use('/health', healthRouter);
    app.use('/test', publicTestRouter);

    applyNotFound(app);

    return app;
}

module.exports = { createApp };
