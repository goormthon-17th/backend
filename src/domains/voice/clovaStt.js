const { correctJejuDialect, jejuBoostingsForClova } = require('./jejuDialect');

function getClovaConfig() {
    const invokeUrl = (process.env.NEXT_PUBLIC_CLOVA_INVOKE_URL || '').replace(/\/$/, '');
    const secretKey = process.env.NEXT_PUBLIC_CLOVA_SECRET_KEY || '';
    return { invokeUrl, secretKey, ok: Boolean(invokeUrl && secretKey) };
}

/**
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string }} file
 * @returns {Promise<{ ok: true, text: string, raw: object } | { ok: false, status: number, error: string, raw?: object }>}
 */
async function transcribeWithClova(file) {
    const { invokeUrl, secretKey, ok } = getClovaConfig();
    if (!ok) {
        return { ok: false, status: 503, error: 'NEXT_PUBLIC_CLOVA_INVOKE_URL / NEXT_PUBLIC_CLOVA_SECRET_KEY not set' };
    }

    const name = file.originalname || 'recording.webm';
    const type = file.mimetype || 'application/octet-stream';
    const blob = new Blob([file.buffer], { type });

    const params = {
        language: 'ko-KR',
        completion: 'sync',
        boostings: jejuBoostingsForClova(),
    };

    const form = new FormData();
    form.append('media', blob, name);
    form.append('params', JSON.stringify(params));

    const url = `${invokeUrl}/recognizer/upload`;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CLOVASPEECH-API-KEY': secretKey,
            },
            body: form,
        });
    } catch (e) {
        return { ok: false, status: 502, error: String(e.message || e) };
    }

    let data;
    try {
        data = await response.json();
    } catch {
        return { ok: false, status: 502, error: 'Clova response is not JSON', raw: undefined };
    }

    if (!response.ok) {
        const msg = data?.message || data?.error || data?.result || `Clova HTTP ${response.status}`;
        return { ok: false, status: response.status >= 400 && response.status < 600 ? response.status : 502, error: String(msg), raw: data };
    }

    const rawText = data.text != null ? String(data.text) : '';
    const text = correctJejuDialect(rawText);
    return { ok: true, text, raw: data };
}

module.exports = { transcribeWithClova, getClovaConfig };
