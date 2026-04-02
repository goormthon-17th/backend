const jwt = require('jsonwebtoken');
const config = require('../config');

function extractBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') {
        return null;
    }
    const v = headerValue.trim();
    const m = v.match(/^Bearer\s+(\S+)/i);
    if (m) {
        return m[1].trim() || null;
    }
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) {
        return v;
    }
    return null;
}

/** JWT 없거나 무효면 1 (시스템/비로그인) */
function resolveUserId(req) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
        return 1;
    }
    try {
        const p = jwt.verify(token, config.jwtSecret);
        const raw = p && (p.id != null ? p.id : p.user_id);
        if (raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) {
            return Number(raw);
        }
    } catch (_) {
        /* 무효·만료 */
    }
    return 1;
}

module.exports = { resolveUserId, extractBearerToken };
