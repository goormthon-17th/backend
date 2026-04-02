const express = require('express');
const { generateFromText } = require('./geminiService');

const router = express.Router();

/**
 * body: { "text": "...", "instruction": "..."? }
 * instruction 생략 시 서버 기본(제주 레시피) 프롬프트 사용
 */
router.post('/generate', async (req, res) => {
    const raw = req.body && req.body.text;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "text"' });
        return;
    }
    const instruction = req.body && req.body.instruction;
    const result = await generateFromText(String(raw), instruction);
    if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
    }
    res.json({ ok: true, resultText: result.text });
});

module.exports = router;
