function mountNotFound(app) {
    app.use((req, res, next) => {
        const pth = req.path.split('?')[0];
        if (
            pth.startsWith('/api/') &&
            pth !== '/api/test' &&
            pth !== '/api/db/ping' &&
            !pth.startsWith('/api/docs') &&
            !pth.startsWith('/api/ai/')
        ) {
            res.status(404).json({ ok: false, error: 'not found', path: pth });
            return;
        }
        next();
    });

    app.use((req, res) => {
        res.status(404).type('text/plain').send('not found');
    });
}

module.exports = { mountNotFound };
