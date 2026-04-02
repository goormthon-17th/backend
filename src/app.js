const express = require('express');
const config = require('./config');
const { mountCors } = require('./middleware/cors');
const { mountSwagger } = require('./middleware/swagger');
const { mountNotFound } = require('./middleware/notFound');
const apiRouter = require('./routes/api');
const healthRouter = require('./routes/health');
const ingressTestRouter = require('./routes/ingressTest');

function createApp() {
    const app = express();

    mountCors(app);
    app.use(express.json());

    mountSwagger(app, config.openapi);

    app.use('/api', apiRouter);
    app.use('/health', healthRouter);
    app.use('/test', ingressTestRouter);

    mountNotFound(app);

    return app;
}

module.exports = { createApp };
