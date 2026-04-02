const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const { buildGeneratePrompt } = require('./refinePrompt');

/**
 * @param {string} rawText
 * @param {string|undefined|null} clientInstruction 프론트 지시문(선택)
 * @returns {Promise<{ ok: true, text: string } | { ok: false, status: number, error: string }>}
 */
async function generateFromText(rawText, clientInstruction) {
    const apiKey = process.env.GEMINI_API_KEY || config.defaultGeminiApiKey;
    if (!apiKey) {
        return {
            ok: false,
            status: 503,
            error: 'GEMINI_API_KEY is not set',
        };
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: config.geminiModel });
        const prompt = buildGeneratePrompt(rawText, clientInstruction);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return { ok: true, text };
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        return { ok: false, status: 502, error: msg };
    }
}

/** @deprecated generateFromText(raw, undefined) — 응답 필드명만 refinedText */
async function refineText(rawText) {
    const r = await generateFromText(rawText, undefined);
    if (!r.ok) return r;
    return { ok: true, refinedText: r.text };
}

module.exports = { generateFromText, refineText };
