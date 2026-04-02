const express = require('express');
const { generateFromText } = require('./geminiService');

const router = express.Router();

/**
 * body: { text, image_url, audio_url } — text는 STT 원문(Gemini), URL 둘은 레시피 저장용으로 함께 받음
 * (DB `recipe.image_url` / `recipe.audio_url`과 맞춤)
 */
router.post('/generate', async (req, res) => {
    const body = req.body || {};
    const raw = body.text;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "text"' });
        return;
    }
    const imageUrl = body.image_url != null ? String(body.image_url).trim() : '';
    const audioUrl = body.audio_url != null ? String(body.audio_url).trim() : '';
    if (imageUrl === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "image_url"' });
        return;
    }
    if (audioUrl === '') {
        res.status(400).json({ ok: false, error: 'JSON body must include non-empty "audio_url"' });
        return;
    }

    const result = await generateFromText(String(raw));
    if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
    }
    res.json({
        ok: true,
        resultText: result.text,
        image_url: imageUrl,
        audio_url: audioUrl,
    });
});

module.exports = router;
