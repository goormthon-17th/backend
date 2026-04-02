/**
 * Gemini TTS (Preview) — REST generateContent, PCM → WAV
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 */

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';
const PCM_SAMPLE_RATE = 24000;
const PCM_CHANNELS = 1;
const PCM_BITS = 16;

/** raw PCM s16le mono → WAV */
function pcmToWav(pcm) {
    const dataSize = pcm.length;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(PCM_CHANNELS, 22);
    header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
    header.writeUInt32LE((PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BITS) / 8, 28);
    header.writeUInt16LE((PCM_CHANNELS * PCM_BITS) / 8, 32);
    header.writeUInt16LE(PCM_BITS, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcm]);
}

function pickInlineAudioPart(parts) {
    if (!Array.isArray(parts)) {
        return null;
    }
    for (const p of parts) {
        const id = p.inlineData || p.inline_data;
        if (id && id.data) {
            return id;
        }
    }
    return null;
}

/**
 * @param {string} textToSpeak — 정제된 레시피 등
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
async function synthesizeToWav(textToSpeak) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { ok: false, error: 'GEMINI_API_KEY is not set' };
    }
    const trimmed = String(textToSpeak || '').trim();
    if (!trimmed) {
        return { ok: false, error: 'empty text for TTS' };
    }

    const ttsPrompt =
        '다음 내용을 한국어로 차분하고 명확하게 낭독해 주세요. 내용만 읽고 부가 설명은 하지 마세요.\n\n' +
        trimmed;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TTS_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: ttsPrompt }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: TTS_VOICE },
                        },
                    },
                },
            }),
        });
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }

    let data;
    try {
        data = await response.json();
    } catch {
        return { ok: false, error: 'TTS response is not JSON' };
    }

    if (!response.ok) {
        const msg = data?.error?.message || JSON.stringify(data).slice(0, 500);
        return { ok: false, error: `TTS HTTP ${response.status}: ${msg}` };
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const inline = pickInlineAudioPart(parts);
    if (!inline?.data) {
        const fb = data?.promptFeedback || data?.candidates?.[0]?.finishReason;
        return { ok: false, error: `no audio in TTS response${fb ? `: ${JSON.stringify(fb)}` : ''}` };
    }

    let pcm;
    try {
        pcm = Buffer.from(inline.data, 'base64');
    } catch {
        return { ok: false, error: 'invalid TTS audio base64' };
    }

    const wav = pcmToWav(pcm);
    return { ok: true, buffer: wav };
}

module.exports = { synthesizeToWav, pcmToWav, TTS_MODEL, TTS_VOICE };
