const express = require('express');
const multer = require('multer');
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
                    res.status(413).json({
                        ok: false,
                        error: 'file too large',
                        limitBytes: MAX_BYTES,
                    });
                    return;
                }
                res.status(400).json({ ok: false, error: err.message, code: err.code });
                return;
            }
            next(err);
            return;
        }
        next();
    });
}

/**
 * POST /api/voice — multipart/form-data, 필드명 `audio`에 음성 파일 1개
 * Clova Speech (`NEXT_PUBLIC_CLOVA_*`)로 STT 후 `text` 반환
 */
router.post('/', runSingleAudio, async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({
            ok: false,
            error: 'multipart field "audio" (single file) is required',
        });
        return;
    }

    const stt = await transcribeWithClova({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
    });

    if (!stt.ok) {
        const body = { ok: false, error: stt.error };
        if (stt.raw !== undefined) {
            body.clova = stt.raw;
        }
        res.status(stt.status).json(body);
        return;
    }

    res.status(200).json({
        ok: true,
        text: stt.text,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
    });
});

module.exports = router;
