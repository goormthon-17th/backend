/** PUBLIC_BASE_URL 미설정 시 음성·이미지 절대 URL 접두 (배포 호스트) */
const DEFAULT_PUBLIC_BASE = 'https://goormthon-4.goorm.training';

/**
 * `/uploads/...` 등 상대 경로 → 공개 https URL. 이미 http(s)면 그대로.
 */
function normalizePublicImageUrl(pathOrUrl) {
    const s = String(pathOrUrl || '').trim();
    if (!s) {
        return '';
    }
    if (/^https?:\/\//i.test(s)) {
        return s;
    }
    const base = String(process.env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE).replace(/\/$/, '');
    if (s.startsWith('/')) {
        return `${base}${s}`;
    }
    return `${base}/${s.replace(/^\/+/, '')}`;
}

module.exports = { normalizePublicImageUrl, DEFAULT_PUBLIC_BASE };
