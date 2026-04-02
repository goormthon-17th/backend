const express = require('express');
const { generateFromText, refineText } = require('./geminiService');

const router = express.Router();

/**
 * 프론트 텍스트 + 지시문(선택) → 지시에 따라 생성된 결과 텍스트
 * body: { "text": "...", "instruction": "..." }  — instruction 생략 시 서버 기본 지시문만 사용(없으면 원문만 전달)
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

/** 호환용 — instruction 없이 서버 기본만 */
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
