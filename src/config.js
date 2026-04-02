const path = require('path');

module.exports = {
    port: Number(process.env.PORT) || 8080,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    /** 해커톤용. 운영에서는 JWT_SECRET 환경변수 필수 */
    jwtSecret: process.env.JWT_SECRET || 'hackathon-insecure-jwt-secret',
    openapi: require(path.join(__dirname, '..', 'openapi.json')),
};
