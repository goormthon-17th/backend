/**
 * 서버 기본 지시문(프론트에서 instruction 안 보낼 때만 사용). 비우면 클라이언트 instruction도 없을 때 원문만 모델에 전달.
 */
const SERVER_DEFAULT_INSTRUCTION = '';

/**
 * @param {string} rawText
 * @param {string|undefined|null} clientInstruction 프론트에서 보낸 지시문(우선)
 * @returns {string} Gemini에 보낼 전체 프롬프트
 */
function buildGeneratePrompt(rawText, clientInstruction) {
    const fromClient =
        typeof clientInstruction === 'string' && clientInstruction.trim() !== ''
            ? clientInstruction.trim()
            : '';
    const fromServer =
        typeof SERVER_DEFAULT_INSTRUCTION === 'string' ? SERVER_DEFAULT_INSTRUCTION.trim() : '';
    const instruction = fromClient || fromServer;
    if (!instruction) {
        return rawText;
    }
    return `${instruction}\n\n---\n\n입력:\n${rawText}`;
}

/** @deprecated 호환용 — buildGeneratePrompt(raw, undefined) 와 동일 */
function buildRefinePrompt(rawText) {
    return buildGeneratePrompt(rawText, undefined);
}

module.exports = {
    buildGeneratePrompt,
    buildRefinePrompt,
    SERVER_DEFAULT_INSTRUCTION,
    REFINE_INSTRUCTION: SERVER_DEFAULT_INSTRUCTION,
};
