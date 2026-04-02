const path = require('path');

const uploadsDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'uploads');

module.exports = {
    port: Number(process.env.PORT) || 8080,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    /** 해커톤용. 운영에서는 JWT_SECRET 환경변수 필수 */
    jwtSecret: process.env.JWT_SECRET || 'hackathon-insecure-jwt-secret',
    openapi: require(path.join(__dirname, '..', 'openapi.json')),
    /** 이미지 업로드 절대 경로 (K8s PVC 등은 UPLOAD_DIR 로 지정) */
    uploadsDir,
    /** 브라우저에서 접근하는 URL 경로 접두사 */
    uploadsPublicPath: '/uploads',
    /** 절대 URL이 필요할 때 (예: https://api.example.com). 비우면 응답에는 path만 채움 */
    publicBaseUrl: String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
};
