const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../config');

const router = express.Router();

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const MAX_BYTES = Number(process.env.UPLOAD_MAX_IMAGE_BYTES) || 10 * 1024 * 1024;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            fs.mkdirSync(config.uploadsDir, { recursive: true });
            cb(null, config.uploadsDir);
        } catch (e) {
            cb(e);
        }
    },
    filename: (req, file, cb) => {
        let ext = path.extname(file.originalname || '').toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
            const mt = (file.mimetype || '').toLowerCase();
            if (mt === 'image/jpeg') {
                ext = '.jpg';
            } else if (mt === 'image/png') {
                ext = '.png';
            } else if (mt === 'image/webp') {
                ext = '.webp';
            } else if (mt === 'image/gif') {
                ext = '.gif';
            } else {
                ext = '.bin';
            }
        }
        const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        const mt = (file.mimetype || '').toLowerCase();
        if (ALLOWED_MIME.has(mt)) {
            cb(null, true);
            return;
        }
        cb(new Error('Only JPEG, PNG, WebP, GIF are allowed'));
    },
});

function runImageUpload(req, res, next) {
    upload.single('image')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    res.status(413).json({ ok: false, error: 'file too large', limitBytes: MAX_BYTES });
                    return;
                }
                res.status(400).json({ ok: false, error: err.message, code: err.code });
                return;
            }
            res.status(400).json({ ok: false, error: String(err.message || err) });
            return;
        }
        next();
    });
}

/**
 * POST /api/upload/image — multipart 필드명 `image` (jpeg/png/webp/gif)
 * 디스크 저장 후 브라우저용 경로 `/uploads/<파일명>` 및 선택적 절대 url 반환
 */
router.post('/image', runImageUpload, (req, res) => {
    if (!req.file) {
        res.status(400).json({ ok: false, error: 'multipart field "image" (single file) is required' });
        return;
    }

    const publicPath = `${config.uploadsPublicPath}/${req.file.filename}`.replace(/\/+/g, '/');
    const body = {
        ok: true,
        path: publicPath,
        filename: req.file.filename,
    };
    if (config.publicBaseUrl) {
        body.url = `${config.publicBaseUrl}${publicPath}`;
    }
    res.status(201).json(body);
});

module.exports = router;
/** 레시피 썸네일 등에서 동일 제한으로 multipart 저장 */
module.exports.runImageUpload = runImageUpload;
