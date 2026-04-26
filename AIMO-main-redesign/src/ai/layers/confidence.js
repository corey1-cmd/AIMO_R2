/* ═══════════════════════════════════════════════════════════════
 * Layer 3 — Confidence Scoring
 *
 * 목적: 매칭 레벨과 문맥 검증 결과를 결합하여 최종 confidence 점수 산출.
 *       MATCHED / INFERRED / UNPARSED 3단계로 분류.
 *
 * 설계 결정 (senior 2 approved, Day 0.5 baseline 반영):
 *   - L4_direct: 0.6 (미래 방어용 완화값. 현재 baseline 0건)
 *   - L3_partial: 2단계 분기 (coherence 통과 → 1.0, 실패 → 차단)
 *   - L2_fallback: 0.4 (14건 중 1건 distortion. 낮지만 차단 아님)
 *   - confidence_cap 은 legacy_bridge 에서 floor 로 대체됨 (senior 3 수정안 5)
 *
 * 입력:
 *   - match: { level, l1, l3, l4, ... }  — parser 결과
 *   - coherenceResult: { ok, reason, layer, ... }  — validator 결과
 *   - rawInput: 사용자 원본 문자열
 *
 * 출력:
 *   - { confidence: 0.0~1.0, status: 'MATCHED' | 'INFERRED' | 'UNPARSED' }
 * ═══════════════════════════════════════════════════════════════ */

const LEVEL_WEIGHT = {
  L4_direct: 0.6,    // 미래 방어용 (현재 0건)
  L4_via_L3: 1.0,    // L3 매치 후 L4 default 선택은 정상 경로
  L3_exact: 1.0,     // A 카테고리 20건 통과 유지
  SYNONYMS: 0.9,     // 53건 중 1건만 distortion
  L3_partial_ok: 1.0,    // coherence 통과한 L3_partial
  L3_partial_fail: 0.0,  // coherence 실패한 L3_partial (차단)
  L2_fallback: 0.4,  // 14건 중 1건 distortion
};

const THRESHOLD_MATCHED = 0.7;
const THRESHOLD_INFERRED = 0.4;

/* 단일 토큰 추상 입력에 대한 추가 감점
 * 예: "분석" 단독 → 파서가 뭔가 매칭해도 max_confidence 제한
 *     regression G 카테고리 의도와 일치 (max_confidence 0.75) */
function isSingleTokenInput(rawInput) {
  const tokens = String(rawInput || '').trim().split(/\s+/).filter(Boolean);
  return tokens.length === 1;
}

/**
 * 매칭 결과와 coherence 검증 결과를 받아 confidence 산출.
 *
 * @param {object} match - { level, l1, l3, l4, ... } or null
 * @param {object} coherenceResult - { ok, reason, layer, ... } or null
 * @param {string} rawInput - 원본 사용자 입력
 * @returns {number} 0.0 ~ 1.0
 */
export function scoreMatch(match, coherenceResult, rawInput) {
  if (!match || !match.level) return 0;

  // coherence 실패 → L3_partial 은 완전 차단 (승인된 2단계)
  if (coherenceResult && !coherenceResult.ok) {
    if (match.level === 'L3_partial') {
      return 0; // UNPARSED 로 떨어뜨림
    }
    // L2_fallback / SYNONYMS coherence 실패는 감점
    // (완전 차단하면 정상 SYNONYMS 매칭도 죽음)
    return LEVEL_WEIGHT[match.level] ? LEVEL_WEIGHT[match.level] * 0.3 : 0;
  }

  // coherence 통과 → 기본 weight 적용
  let base;
  if (match.level === 'L3_partial') {
    base = LEVEL_WEIGHT.L3_partial_ok;
  } else {
    base = LEVEL_WEIGHT[match.level] ?? 0.3;
  }

  // 단일 토큰 입력에 대한 max cap — 단, 정확 매칭(L3_exact, L4_direct)은 제외.
  // "샤워"는 단일 토큰이지만 L3_exact로 매칭되면 정답이 확정됨.
  // Cap은 L3_partial이나 L2_fallback처럼 불확실한 매칭에만 적용.
  const IMPRECISE_LEVELS = new Set(['L3_partial', 'L2_fallback']);
  if (isSingleTokenInput(rawInput) && IMPRECISE_LEVELS.has(match.level) && base > 0.75) {
    base = 0.75;
  }

  return Math.round(base * 100) / 100;
}

/**
 * Confidence 값을 상태로 변환.
 */
export function statusFromConfidence(confidence) {
  if (confidence >= THRESHOLD_MATCHED) return 'MATCHED';
  if (confidence >= THRESHOLD_INFERRED) return 'INFERRED';
  return 'UNPARSED';
}

/* 디버깅 편의용 */
export const _INTERNAL = {
  LEVEL_WEIGHT,
  THRESHOLD_MATCHED,
  THRESHOLD_INFERRED,
};
