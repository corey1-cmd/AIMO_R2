/* ═══════════════════════════════════════════════════════════════
 * Layer 2 — Coherence Validator
 *
 * 목적: V3 파서가 반환한 매칭이 입력의 의미와 일치하는지 검증.
 *       불일치 시 reject → legacy_bridge 또는 UNPARSED 로 흐름.
 *
 * 구조 (senior 2 approved):
 *   1차. L3_partial 가드 — baseline distortion 87.5% 가 여기서 발생
 *        짧은 접사성 키워드("관리", "정리" 등)가 parent L1 과 맥락 불일치 시 차단
 *   2차. L1_HINTS regex — L2_fallback / SYNONYMS 등 잔여 케이스 방어
 *
 * 주의:
 *   - L1_HINTS 에 fake sentinel (_medical_work_) 쓰지 않음 (시니어3 수정안 4)
 *   - 대신 명시적 reject 플래그 사용
 *   - "경쟁사 분석" 같은 관점 의존 케이스는 regression v1.1 any_of 로 해결됨
 *     (validator 에서 처리 안 함)
 * ═══════════════════════════════════════════════════════════════ */

/* ─── 1차 가드: L3_partial 화이트리스트 ───────────────────────────
 * "baseline 에서 드러난 문제 L3 들":
 *   pet_grooming_self (한국어 "관리") — 12건 distortion
 *   food_storage      (한국어 "정리") — 3건 distortion
 *
 * 이 L3 들이 L3_partial 단계에서 잡혔을 때, 입력에 해당 L3 의
 * 의미 영역 단어가 없으면 reject.
 *
 * 구조: L3 code → { allow_when: token regex, reject_reason }
 */
const L3_PARTIAL_GUARD = {
  pet_grooming_self: {
    // 반려동물 그루밍의 실제 맥락 단어
    allow_when: /(반려|강아지|개|고양이|펫|털|빗|목욕|미용)/,
    reject_reason: 'pet_grooming_self_without_pet_context',
  },
  food_storage: {
    // 식품 보관·정리의 실제 맥락 단어
    allow_when: /(냉장|냉동|식재료|식품|음식|반찬|밑반찬|김치|보관|저장)/,
    reject_reason: 'food_storage_without_food_context',
  },
};

/* ─── 2차 가드: L1_HINTS regex ────────────────────────────────────
 * 입력에 도메인 힌트 단어가 있으면 기대되는 L1.
 * 일치하지 않으면 reject.
 * 명시적 reject 플래그(reject=true) = 해당 힌트의 도메인이 V3 에 없음을 의미.
 */
const L1_HINTS = [
  // 개발·IT. \b 경계는 한글에서 무용하므로 제거.
  { pattern: /(GPU|API|DB|서버|배포|CI|CD|커밋|머지|리팩터|리팩토링|PR|MR|릴리즈|스프린트|로그|쿼리|스키마|디버깅)/i, l1: 'digital_creation' },
  { pattern: /(코드|버그|프론트엔드|백엔드|앱|웹|소프트웨어)/, l1: 'digital_creation' },

  { pattern: /(샤워|세안|양치|면도|머리감|샴푸|목욕|화장|스킨케어|선크림)/, l1: 'personal_care' },
  { pattern: /(낮잠|쪽잠|수면|취침|기상|늦잠|눈감)/, l1: 'personal_care' },

  { pattern: /(빨래|설거지|청소기|걸레|쓰레기|분리수거|정리정돈|진공)/, l1: 'household' },
  { pattern: /(정원|화초|화분|식물)/, l1: 'household' },

  { pattern: /(아침|점심|저녁|간식|야식|커피|식사|요리|반찬)/, l1: 'eating' },

  { pattern: /(달리기|조깅|헬스|요가|필라테스|스트레칭|수영|등산|러닝|사이클|웨이트)/, l1: 'sports' },

  { pattern: /(출근|퇴근|지하철|버스|기차|비행기|이동)/, l1: 'traveling' },

  { pattern: /(수업|강의|과제|시험|예습|복습|인강|강의안|교과서)/, l1: 'education' },

  { pattern: /(논문|실험|레퍼런스|초록|학회|피어리뷰|지도교수|랩미팅|문헌)/, l1: 'research' },

  { pattern: /(처방|조제|드레싱|바이탈|환자|차팅|투약|시술|의무기록|회진|간호)/, reject: true, reason: 'medical_gap_in_v3' },

  { pattern: /(댓글|팔로워|구독자|인스타|SNS|소셜|커뮤니티|트위터|페이스북)/, l1: 'online_social' },

  { pattern: /(정산|세금계산서|매입매출|경비|견적|송금|입금|결제|회계)/, l1: 'financial' },

  { pattern: /(면접|채용|1on1|원온원|스탠드업|킥오프)/, l1: 'work' },

  // 업무 일반. "로드맵", "CRM", "스프린트 플래닝", "경쟁사" 등 baseline에서 잘못 매핑된 단어들.
  { pattern: /(로드맵|CRM|KPI|OKR|스프린트|스탠드업|스크럼|칸반|경쟁사|시장조사|마켓)/, l1: 'work' },
];

/* ─── 주 검증 함수 ────────────────────────────────────────────────
 *
 * @param {string} rawInput - 사용자 원본 입력
 * @param {object} match - 파서 결과 { level, l1, l3, l4, ... }
 * @returns {object} { ok: boolean, reason?: string, hint_l1?: string }
 */
/* ─── 3차 가드: L4 태그 오해 유도 방지 ───────────────────────────
 * parser-v3의 pickL4FromL3가 L3 내 "첫 번째" 또는 "기본값" L4를 고르는데,
 * 그 기본값이 오해 유도적인 경우(예: deploy_release L3에서 hotfix 선택)
 * 를 차단합니다.
 *
 * 구조: { tag: "hotfix", require_in_input: regex }
 *   → 입력에 해당 regex가 매칭되지 않으면 이 tag로 매핑되는 것을 거부.
 */
const MISLEADING_L4_DEFAULTS = {
  hotfix: /(긴급|핫픽스|장애|인시던트|크리티컬|hotfix)/i,
  activity_date: /(데이트|연인|만남|소개팅)/,
  pet_grooming_self: /(반려|강아지|고양이|펫|털|빗질)/,
};

export function validateCoherence(rawInput, match) {
  if (!match || !match.l1) {
    return { ok: true, reason: null };
  }

  const input = String(rawInput || '');

  // ─── 3차 가드: L4 태그 오해 유도 기본값 ───────────────────────
  // SYNONYMS, L3_partial, L2_fallback 어디서 왔든 tag가 위험 목록에 있으면 확인.
  if (match.l4 && MISLEADING_L4_DEFAULTS[match.l4]) {
    const requiredContext = MISLEADING_L4_DEFAULTS[match.l4];
    if (!requiredContext.test(input)) {
      return {
        ok: false,
        reason: `misleading_default_${match.l4}`,
        layer: 'L4_tag_guard',
      };
    }
  }

  // ─── 1차 가드: L3_partial 단계에서 잡힌 것 중 짧은 접사성 key 인 경우 ───
  if (match.level === 'L3_partial' && match.l3) {
    const guard = L3_PARTIAL_GUARD[match.l3];
    if (guard) {
      // 이 L3 는 가드 대상. 맥락 단어가 입력에 없으면 reject.
      if (!guard.allow_when.test(input)) {
        return {
          ok: false,
          reason: guard.reject_reason,
          layer: 'L3_partial_guard',
        };
      }
    }
  }

  // ─── 2차: L1_HINTS 검증 ───────────────────────────────────────
  for (const hint of L1_HINTS) {
    if (!hint.pattern.test(input)) continue;

    // 이 hint 의 도메인이 V3 에 없음 → 무조건 reject
    if (hint.reject) {
      return {
        ok: false,
        reason: hint.reason || 'hint_explicit_reject',
        layer: 'L1_HINTS',
      };
    }

    // 매칭 L1 이 hint 가 기대하는 L1 과 다름 → reject
    if (match.l1 !== hint.l1) {
      return {
        ok: false,
        reason: `hint_expects_${hint.l1}_but_got_${match.l1}`,
        layer: 'L1_HINTS',
        hint_l1: hint.l1,
      };
    }

    // 첫 매치 hint 와 일치하면 통과
    return { ok: true, reason: null, matched_hint: hint.l1 };
  }

  // 힌트 전혀 없으면 통과 (오버가드 방지)
  return { ok: true, reason: null };
}

/* 디버깅 편의용 */
export const _INTERNAL = {
  L3_PARTIAL_GUARD,
  L1_HINTS,
};
