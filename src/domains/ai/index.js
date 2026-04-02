const express = require('express');
const { generateFromText } = require('./geminiService');

const router = express.Router();

/** body: { "text": "..." } — 프롬프트는 서버 고정(refinePrompt.js) */
router.post('/generate', async (req, res) => {
    const raw = req.body && req.body.text;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "text"' });
        return;
    }
    const result = await generateFromText(String(raw));
    if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
    }
    res.json({ ok: true, resultText: result.text });
});

module.exports = router;
