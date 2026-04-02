const path = require('path');

module.exports = {
    port: Number(process.env.PORT) || 8080,
    deployCheck: 'deploy-verify-1',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    openapi: require(path.join(__dirname, '..', 'openapi.json')),
};
