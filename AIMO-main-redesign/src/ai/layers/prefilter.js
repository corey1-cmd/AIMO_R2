/* ═══════════════════════════════════════════════════════════════
 * Layer 1 — Pre-filter
 *
 * 목적: 단독으로 입력되면 의도를 식별할 수 없는 추상 동사를
 *       파서 호출 전에 걸러내어 NEEDS_CONTEXT 상태로 반환.
 *
 * 범위 (senior 2 approved):
 *   8개 리스트. "작성"은 "논문 작성" 같은 내적 메모를 배제하지
 *   않기 위해 제외 (사용자가 자주 쓰는 단독 메모 형태).
 *
 * 비교연산자 없음. 토큰 정확 일치만 — 오버엔지니어링 회피.
 * ═══════════════════════════════════════════════════════════════ */

const ABSTRACT_VERBS = new Set([
  '관리', '정리', '처리', '수정',
  '확인', '점검', '검토', '분석',
]);

export function prefilter(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { status: 'OK' }; // 빈 입력은 파서가 처리
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && ABSTRACT_VERBS.has(tokens[0])) {
    return {
      status: 'NEEDS_CONTEXT',
      reason: 'abstract_single_verb',
      hint: `"${tokens[0]}" 앞에 구체적인 대상을 적어주세요 (예: 서류 ${tokens[0]}, 데이터 ${tokens[0]})`,
      token: tokens[0],
    };
  }
  return { status: 'OK' };
}

/* 테스트 편의용 export — 외부에서 리스트 확인 필요 시 사용 */
export const ABSTRACT_VERBS_LIST = [...ABSTRACT_VERBS];
