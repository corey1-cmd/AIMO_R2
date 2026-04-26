# Day 0.5 Baseline Report

**측정일**: 2026-04-24
**대상**: V3 파서 (`src/ai/parser-v3.js`) 단독 동작
**방법**: `regression-runner-v1.1.mjs --baseline` 실행 (3-layer 우회)
**Fixture**: `regression-v1.1.json` (213 케이스)

---

## 핵심 수치

전체 213 케이스 중 82건이 통과하여 38.5%의 baseline 통과율을 기록했습니다. Distortion(must_exclude_l1 위반 또는 reject_tags 적중)은 21건이 발생했으며, 이는 CI 블로커 수준입니다.

## 카테고리별 baseline

| 카테고리 | 통과율 |
|---|---:|
| A_clean_v3 | 39 / 60 (65%) |
| B_distortion_risk | 10 / 40 (25%) |
| C_abstract_single | 0 / 15 (0%) |
| D_context_compound | 13 / 25 (52%) |
| E_v3_happy_compound | 12 / 15 (80%) |
| F_legacy_bridge | 3 / 30 (10%) |
| G_ambiguous_inferred | 0 / 15 (0%) |
| H_academic_research | 5 / 13 (38%) |

## Day 0.5 Probe와 실측의 차이

Day 0.5에 사용한 probe 스크립트는 `matchL3`의 5단계 우선순위를 재현한 별도 구현이었습니다. 실제 파서와 비교했을 때 두 가지 차이가 드러났습니다. 첫째, probe는 정규화를 간소화하여 구현했기 때문에 "머리 감기", "손톱 깎기" 같은 복합 명사형 입력을 실제 파서보다 관대하게 매칭했습니다. 실제 파서는 더 엄격한 조사 제거 규칙을 적용하여 UNPARSED로 떨어뜨리며, 이 차이로 전체 매칭률이 probe의 59.2%에서 실측 38.5%로 낮아졌습니다. 둘째, probe가 관측하지 못한 distortion 5건이 실제 파서에서 추가로 발견되었습니다. 대부분 SYNONYMS 단계에서 발생한 오매핑으로, probe가 SYNONYMS 테이블을 정적 추출로 재구성할 때 일부가 누락된 경우였습니다. 두 차이 모두 probe가 실제 파서를 충분히 정확하게 모사하지 못했다는 의미이며, 이후 모든 측정은 runner를 통해 이루어졌습니다.

## Distortion 발생지 재분석

실측 21건의 distortion은 L3_partial 14건(67%), SYNONYMS 5건, L2_fallback 2건, L4_direct 0건으로 분포합니다. Day 0.5에서 확인된 패턴은 유지됩니다. L4_direct는 213 케이스 전체에서 한 건도 매칭되지 않았고, distortion의 3분의 2가 L3_partial에서 발생합니다.

## 설계 결정에 미친 영향

Baseline 데이터는 다음과 같이 설계에 반영되었습니다. FEEDBACK_REPORT가 설정한 `LEVEL_WEIGHT.L4_direct = 0.35`는 적용될 케이스가 없으므로 현재 회귀에서 효과를 측정할 수 없습니다. 이 값을 0.6으로 완화한 것은 정상 L4_direct 매칭이 미래에 생길 때를 대비한 방어적 조치일 뿐이며, 지금 회귀 결과에는 영향이 없습니다. Coherence validator의 1차 가드를 L3_partial에 배치한 것은 distortion의 3분의 2가 여기서 발생한다는 관측에 직접 근거합니다. L1_HINTS는 2차 보조 가드로 유지되었고, 추가로 L4 태그 오해 유도 기본값을 막는 3차 가드(`hotfix`, `activity_date`, `pet_grooming_self`)가 튜닝 단계에서 덧붙여졌습니다.
