const express = require('express');
const { refineText } = require('../../ai/geminiService');

const router = express.Router();

router.post('/refine', async (req, res) => {
    const raw = req.body && req.body.text;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "text"' });
        return;
    }
    const result = await refineText(String(raw));
    if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
    }
    res.json({ ok: true, refinedText: result.refinedText });
});

module.exports = router;
