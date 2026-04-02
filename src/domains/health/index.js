const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
    res.type('text/plain').send('ok');
});

module.exports = router;
