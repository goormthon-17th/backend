const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { buildRefinePrompt } = require('./refinePrompt');

/**
 * @param {string} rawText
 * @returns {Promise<{ ok: true, refinedText: string } | { ok: false, status: number, error: string }>}
 */
async function refineText(rawText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            ok: false,
            status: 503,
            error: 'GEMINI_API_KEY is not set (use env or Kubernetes secret gemini-secret)',
        };
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: config.geminiModel });
        const prompt = buildRefinePrompt(rawText);
        const result = await model.generateContent(prompt);
        const refinedText = result.response.text();
        return { ok: true, refinedText };
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        return { ok: false, status: 502, error: msg };
    }
}

module.exports = { refineText };
