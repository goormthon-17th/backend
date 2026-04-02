const express = require('express');
const multer = require('multer');
const { generateFromText } = require('../ai/geminiService');
const { synthesizeToWav } = require('./geminiTts');
const { buildMultipartVoiceBody } = require('./multipartVoiceResponse');
const { transcribeWithClova } = require('./clovaStt');

const router = express.Router();

const MAX_BYTES = Number(process.env.VOICE_UPLOAD_MAX_BYTES) || 30 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
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

/**
 * POST /api/voice — 요청: multipart 필드 `audio`
 * 성공 시 응답도 multipart/form-data: `text`(정제 문자열), `audio`(WAV 파일, TTS 실패 시 생략)
 */
router.post('/', runSingleAudio, async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).type('text/plain; charset=utf-8').send('multipart field "audio" (single file) is required');
        return;
    }

    const stt = await transcribeWithClova({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
    });

    if (!stt.ok) {
        res.status(stt.status).type('text/plain; charset=utf-8').send(stt.error);
        return;
    }

    const refined = await generateFromText(stt.text);
    if (!refined.ok) {
        res.status(refined.status).type('text/plain; charset=utf-8').send(refined.error);
        return;
    }

    const tts = await synthesizeToWav(refined.text);
    const wavBuf = tts.ok ? tts.buffer : null;
    const ttsErr = tts.ok ? null : tts.error;
    const { boundary, body } = buildMultipartVoiceBody(refined.text, wavBuf, ttsErr);

    res.status(200).setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
    res.send(body);
});

module.exports = router;
