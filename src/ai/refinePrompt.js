/**
 * Gemini에 넣을 지시문(역할, 출력 형식 등). 비워 두면 입력 텍스트만 모델에 전달됩니다.
 */
const REFINE_INSTRUCTION = '';

function buildRefinePrompt(rawText) {
    const instruction = typeof REFINE_INSTRUCTION === 'string' ? REFINE_INSTRUCTION.trim() : '';
    if (!instruction) {
        return rawText;
    }
    return `${instruction}\n\n---\n\n${rawText}`;
}

module.exports = { buildRefinePrompt, REFINE_INSTRUCTION };
