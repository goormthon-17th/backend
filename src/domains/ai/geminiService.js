const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const { buildGeneratePrompt } = require('./refinePrompt');

/** @param {string} rawText */
async function generateFromText(rawText) {
    const apiKey = process.env.GEMINI_API_KEY;
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
        const prompt = buildGeneratePrompt(rawText);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return { ok: true, text };
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        return { ok: false, status: 502, error: msg };
    }
}

module.exports = { generateFromText };
