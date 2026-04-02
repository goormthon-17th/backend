const express = require('express');
const config = require('../../config');

/** Ingress에서 /test 만 열었을 때 */
const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        ok: true,
        endpoint: '/test',
        deployCheck: config.deployCheck,
        at: new Date().toISOString(),
    });
});

module.exports = router;
