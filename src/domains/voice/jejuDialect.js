/** 프론트 `jejuDialect.ts`와 동일 — CLOVA boostings + 인식 결과 교정 */

const JEJU_BOOSTINGS = [
    '혼저옵서예',
    '혼저',
    '옵서',
    '게메',
    '마씸',
    '하영',
    '어멍',
    '아방',
    '할망',
    '하르방',
    '몬딱',
    '경',
    '경허민',
    '무사',
    '이시민',
    '없이',
    '고장',
    '도새기',
    '수눌음',
    '느',
    '뭣',
    '갑서',
    '옵데가',
    '허우다',
    '마씸',
    '우다',
    '수다',
];

const CORRECTION_MAP = {
    '혼자 옵서': '혼저옵서',
    혼자옵서예: '혼저옵서예',
    '혼저 옵서예': '혼저옵서예',
    '게 매': '게메',
    '게 메': '게메',
    하영: '하영',
    어멍: '어멍',
    아방: '아방',
    하르방: '하르방',
    할망: '할망',
    '몬 딱': '몬딱',
    몬딱: '몬딱',
};

function correctJejuDialect(text) {
    let result = text;
    for (const [wrong, correct] of Object.entries(CORRECTION_MAP)) {
        result = result.replaceAll(wrong, correct);
    }
    return result;
}

function jejuBoostingsForClova() {
    return JEJU_BOOSTINGS.map((word) => ({ word }));
}

module.exports = { correctJejuDialect, jejuBoostingsForClova };
