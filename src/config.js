const path = require('path');

module.exports = {
    port: Number(process.env.PORT) || 8080,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    /** GEMINI_API_KEY 환경변수 없을 때 사용(요청에 따라 레포에 포함) */
    defaultGeminiApiKey: 'AIzaSyCZZ0DofWVnGtPfNAPUIe1KiG380bpbyIg',
    /** 해커톤용. 운영에서는 JWT_SECRET 환경변수 필수 */
    jwtSecret: process.env.JWT_SECRET || 'hackathon-insecure-jwt-secret',
    openapi: require(path.join(__dirname, '..', 'openapi.json')),
};
