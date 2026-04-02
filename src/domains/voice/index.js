const express = require('express');
const multer = require('multer');
const { generateFromText } = require('../ai/geminiService');
const { getPool } = require('../database/mysqlPool');
const { resolveUserId } = require('../../shared/resolveUserId');
const { normalizePublicImageUrl } = require('../../shared/imageUrl');
const { synthesizeToWav } = require('./geminiTts');
const { buildMultipartVoiceBody } = require('./multipartVoiceResponse');
const { transcribeWithClova } = require('./clovaStt');

const router = express.Router();

const MAX_BYTES = Number(process.env.VOICE_UPLOAD_MAX_BYTES) || 30 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1, fieldSize: 4096 },
});

function runSingleAudio(req, res, next) {
    upload.single('audio')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    res.status(413).type('text/plain; charset=utf-8').send('file too large');
                    return;
                }
                res.status(400).type('text/plain; charset=utf-8').send(err.message);
                return;
            }
            next(err);
            return;
        }
        next();
    });
}

function parseOptionalImageUrl(req) {
    const raw = req.body && (req.body.image_url ?? req.body.imageUrl);
    if (raw === undefined || raw === null) {
        return '';
    }
    const s = String(raw).trim();
    return s;
}

/**
 * POST /api/voice — 요청: multipart 필드 `audio`, 선택 `image_url`(또는 imageUrl) 문자열
 * 성공 시 응답 multipart: `text`, 선택 `image_url` 에코, `audio`(WAV)
 */
router.post('/', runSingleAudio, async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).type('text/plain; charset=utf-8').send('multipart field "audio" (single file) is required');
        return;
    }

    const imageUrlIn = parseOptionalImageUrl(req);
    if (imageUrlIn && !/^https?:\/\//i.test(imageUrlIn) && !imageUrlIn.startsWith('/')) {
        res.status(400)
            .type('text/plain; charset=utf-8')
            .send('image_url must be http(s) URL or absolute path starting with /');
        return;
    }

    const imageUrlAbsolute = imageUrlIn ? normalizePublicImageUrl(imageUrlIn) : '';

    const stt = await transcribeWithClova({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
    });

    if (!stt.ok) {
        res.status(stt.status).type('text/plain; charset=utf-8').send(stt.error);
        return;
    }

    const textForRefine =
        imageUrlAbsolute !== ''
            ? `${stt.text}\n\n[사용자 제공 레시피/음식 이미지 URL]\n${imageUrlAbsolute}`
            : stt.text;

    const refined = await generateFromText(textForRefine);
    if (!refined.ok) {
        res.status(refined.status).type('text/plain; charset=utf-8').send(refined.error);
        return;
    }

    let savedRecipeId = null;
    if (imageUrlAbsolute) {
        const pool = getPool();
        if (pool) {
            try {
                const userId = resolveUserId(req);
                const [ins] = await pool.execute(
                    'INSERT INTO recipe (user_id, raw_text, refined_text, image_url) VALUES (?, ?, ?, ?)',
                    [userId, stt.text, refined.text, imageUrlAbsolute],
                );
                savedRecipeId = ins.insertId || null;
            } catch (e) {
                console.error('[voice] recipe insert:', e.message || e);
            }
        }
    }

    const tts = await synthesizeToWav(refined.text);
    const wavBuf = tts.ok ? tts.buffer : null;
    const ttsErr = tts.ok ? null : tts.error;
    const { boundary, body } = buildMultipartVoiceBody(
        refined.text,
        wavBuf,
        ttsErr,
        imageUrlAbsolute || null,
        savedRecipeId,
    );

    res.status(200).setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
    res.send(body);
});

module.exports = router;
