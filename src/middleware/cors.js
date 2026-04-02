const cors = require('cors');

function mountCors(app) {
    const corsOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : true;
    app.use(
        cors({
            origin: corsOrigins,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }),
    );
}

module.exports = { mountCors };
