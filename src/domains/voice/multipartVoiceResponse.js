const crypto = require('crypto');

/**
 * 브라우저 fetch().then((r) => r.formData()) 로 파싱 가능한 multipart/form-data 응답 본문
 * @param {string} text — 정제 텍스트
 * @param {Buffer | null} wavBuffer — TTS WAV (없으면 audio 파트 생략)
 * @param {string | null} ttsError — TTS 실패 시 사유 (선택 필드 tts_error)
 * @param {string | null} imageUrl — 정규화된 절대 image_url 에코 (선택)
 * @param {number | null} recipeId — DB 저장 시 생성된 recipe id (선택 필드 recipe_id)
 */
function buildMultipartVoiceBody(text, wavBuffer, ttsError, imageUrl, recipeId) {
    const boundary = `----VoiceOut${crypto.randomBytes(16).toString('hex')}`;
    const chunks = [];

    chunks.push(
        Buffer.from(
            `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="text"\r\n` +
                `Content-Type: text/plain; charset=utf-8\r\n\r\n`,
            'utf8',
        ),
        Buffer.from(text, 'utf8'),
        Buffer.from('\r\n', 'utf8'),
    );

    const urlEcho = imageUrl != null && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : '';
    if (urlEcho) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="image_url"\r\n` +
                    `Content-Type: text/plain; charset=utf-8\r\n\r\n`,
                'utf8',
            ),
            Buffer.from(urlEcho, 'utf8'),
            Buffer.from('\r\n', 'utf8'),
        );
    }

    if (recipeId != null && Number.isFinite(Number(recipeId)) && Number(recipeId) > 0) {
        const idStr = String(Math.floor(Number(recipeId)));
        chunks.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="recipe_id"\r\n` +
                    `Content-Type: text/plain; charset=utf-8\r\n\r\n`,
                'utf8',
            ),
            Buffer.from(idStr, 'utf8'),
            Buffer.from('\r\n', 'utf8'),
        );
    }

    if (wavBuffer && wavBuffer.length > 0) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="audio"; filename="recipe.wav"\r\n` +
                    `Content-Type: audio/wav\r\n\r\n`,
                'utf8',
            ),
            wavBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
        );
    } else {
        if (ttsError) {
            chunks.push(
                Buffer.from(
                    `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="tts_error"\r\n` +
                        `Content-Type: text/plain; charset=utf-8\r\n\r\n`,
                    'utf8',
                ),
                Buffer.from(ttsError, 'utf8'),
                Buffer.from('\r\n', 'utf8'),
            );
        }
        chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
    }

    return {
        boundary,
        body: Buffer.concat(chunks),
    };
}

module.exports = { buildMultipartVoiceBody };
