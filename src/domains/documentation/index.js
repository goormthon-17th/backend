const swaggerUi = require('swagger-ui-express');

function register(app, openapi) {
    app.use(
        '/api/docs',
        swaggerUi.serve,
        swaggerUi.setup(openapi, {
            customSiteTitle: 'API Docs',
        }),
    );
    app.get('/openapi.json', (req, res) => {
        res.json(openapi);
    });
}

module.exports = { register };
