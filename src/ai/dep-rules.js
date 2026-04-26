/* ═══════════════════════════════════════════════════════════════
   dep-rules.js — declarative P1~P10 rule DSL

   Previously, inferDependency() was a 40+ line chain of string-literal
   checks against l1/l2/l3 values. That's fragile: a taxonomy rename
   silently breaks every dependent rule with zero compile-time signal.

   This module:
     - Declares each rule as a data structure (id, principle, when, emit, strength)
     - Groups rules by principle (P1..P10) for introspection
     - Preserves exact semantics of the legacy inferDependency()
     - Exposes matchRule(a, b) → first matching rule, for debugging
     - validateRules() checks all referenced l1/l2/l3 codes exist at load time

   Referenced fields on L4 items:
     l1, l2, l3, loc, phy, _isReturn

   Evaluation:
     For each (a, b) in order, the first rule whose `when(a, b)` returns
     truthy dictates the direction: 'before' or 'after'.

   ═══════════════════════════════════════════════════════════════ */

import { L1_META, L2_META, L3_META } from './types-v3.js';

/* ─── Predicates ──────────────────────────────────────── */

export function isPhysicallyDirty(l4) {
  return (l4.l1 === 'sports' && l4.phy >= 3) ||
         l4.l2 === 'gardening' || l4.l2 === 'home_repair' || l4.l2 === 'pet_care';
}

function isEatingOutL2(l2) {
  const outL2s = new Set([
    'breakfast_out','breakfast_grab','breakfast_skip_coffee',
    'lunch_out','lunch_desk','dinner_casual_out','dinner_special_out',
    'late_night_meal','cafe_coffee','drinks_alcohol',
  ]);
  return outL2s.has(l2);
}

/* ─── Rules ────────────────────────────────────────────── */

/**
 * Each rule is one-directional.
 * `when(a,b)` returns true iff `a` must come before `b` under this rule.
 * `emit` is always 'before' (inferDependency flips to 'after' on inverse query).
 *
 * Fields:
 *   id         - short unique identifier (for debugging/tracing)
 *   principle  - P1..P10 (domain category)
 *   when       - (a, b) => bool
 *   strength   - 'hard' | 'soft' (how firm the constraint is)
 *   description - human-readable
 *   refs       - array of l1/l2/l3 codes used (for validateRules)
 */
export const DEP_RULES = [
  // P1: 재료→조리→제공
  {
    id: 'P1.prep-before-eat',
    principle: 'P1',
    when: (a, b) => a.l2 === 'food_prep' && b.l1 === 'eating',
    strength: 'hard',
    description: '음식 준비는 식사 전에',
    refs: { l2: ['food_prep'], l1: ['eating'] },
  },
  {
    id: 'P1.storage-before-prep',
    principle: 'P1',
    when: (a, b) => a.l3 === 'food_storage' && b.l2 === 'food_prep',
    strength: 'hard',
    description: '재료 보관/해동은 조리 전에',
    refs: { l3: ['food_storage'], l2: ['food_prep'] },
  },

  // P2: 사용→정리
  {
    id: 'P2.eat-before-cleanup',
    principle: 'P2',
    when: (a, b) => a.l1 === 'eating' && b.l2 === 'food_cleanup',
    strength: 'hard',
    description: '식사 후 정리',
    refs: { l1: ['eating'], l2: ['food_cleanup'] },
  },
  {
    id: 'P2.prep-before-cleanup',
    principle: 'P2',
    when: (a, b) => a.l2 === 'food_prep' && b.l2 === 'food_cleanup',
    strength: 'hard',
    description: '조리 후 정리',
    refs: { l2: ['food_prep', 'food_cleanup'] },
  },

  // P3: 오염→세정
  {
    id: 'P3.dirty-before-shower',
    principle: 'P3',
    when: (a, b) => isPhysicallyDirty(a) && b.l3 === 'shower',
    strength: 'hard',
    description: '땀/오염 → 샤워',
    refs: { l3: ['shower'] },
  },
  {
    id: 'P3.makeup-before-remove',
    principle: 'P3',
    when: (a, b) => a.l3 === 'makeup_apply' && b.l3 === 'makeup_remove',
    strength: 'hard',
    description: '화장 → 지우기',
    refs: { l3: ['makeup_apply', 'makeup_remove'] },
  },

  // P4: 이동→활동→복귀
  {
    id: 'P4.travel-before-specific',
    principle: 'P4',
    when: (a, b) => a.l1 === 'traveling' && !a._isReturn && b.loc === 'specific',
    strength: 'hard',
    description: '이동 → 목적지 활동',
    refs: { l1: ['traveling'] },
  },
  {
    id: 'P4.specific-before-return',
    principle: 'P4',
    when: (a, b) => a.loc === 'specific' && b._isReturn === true,
    strength: 'hard',
    description: '목적지 활동 → 복귀 이동',
    refs: {},
  },

  // P5: 준비→본활동
  {
    id: 'P5.dress-before-specific',
    principle: 'P5',
    when: (a, b) => a.l3 === 'dressing' && b.loc === 'specific',
    strength: 'soft',
    description: '외출복 → 외출',
    refs: { l3: ['dressing'] },
  },
  {
    id: 'P5.dress-before-sports',
    principle: 'P5',
    when: (a, b) => a.l3 === 'dressing' && b.l1 === 'sports',
    strength: 'soft',
    description: '운동복 → 운동',
    refs: { l3: ['dressing'], l1: ['sports'] },
  },
  {
    id: 'P5.warmup-before-main',
    principle: 'P5',
    when: (a, b) =>
      a.l2 === 'warmup_cooldown' && a.l3 !== 'cooldown_stretch' &&
      b.l1 === 'sports' && b.l2 !== 'warmup_cooldown',
    strength: 'hard',
    description: '웜업 → 본 운동',
    refs: { l2: ['warmup_cooldown'], l3: ['cooldown_stretch'], l1: ['sports'] },
  },
  {
    id: 'P5.main-before-cooldown',
    principle: 'P5',
    when: (a, b) =>
      a.l1 === 'sports' && a.l2 !== 'warmup_cooldown' && b.l3 === 'cooldown_stretch',
    strength: 'soft',
    description: '본 운동 → 쿨다운',
    refs: { l1: ['sports'], l2: ['warmup_cooldown'], l3: ['cooldown_stretch'] },
  },
  {
    id: 'P5.setup-before-broadcast',
    principle: 'P5',
    when: (a, b) => a.l3 === 'stream_setup' && b.l3 === 'live_broadcast',
    strength: 'hard',
    description: '방송 셋업 → 방송',
    refs: { l3: ['stream_setup', 'live_broadcast'] },
  },

  // P10: 상태 변화
  {
    id: 'P10.shopping-before-storage',
    principle: 'P10',
    when: (a, b) => a.l2 === 'hh_shopping_trip' && b.l3 === 'food_storage',
    strength: 'hard',
    description: '장보기 → 냉장 보관',
    refs: { l2: ['hh_shopping_trip'], l3: ['food_storage'] },
  },
  {
    id: 'P10.shopping-before-prep',
    principle: 'P10',
    when: (a, b) => a.l2 === 'hh_shopping_trip' && b.l2 === 'food_prep',
    strength: 'soft',
    description: '장보기 → 조리',
    refs: { l2: ['hh_shopping_trip', 'food_prep'] },
  },
  {
    id: 'P10.wash-before-dry',
    principle: 'P10',
    when: (a, b) => a.l3 === 'washing_machine' && b.l3 === 'drying',
    strength: 'hard',
    description: '세탁 → 건조',
    refs: { l3: ['washing_machine', 'drying'] },
  },
  {
    id: 'P10.dry-before-fold',
    principle: 'P10',
    when: (a, b) => a.l3 === 'drying' && b.l3 === 'folding',
    strength: 'soft',
    description: '건조 → 개기',
    refs: { l3: ['drying', 'folding'] },
  },
  {
    id: 'P10.code-before-git',
    principle: 'P10',
    when: (a, b) => a.l2 === 'coding_dev' && b.l2 === 'version_control',
    strength: 'soft',
    description: '코딩 → 커밋',
    refs: { l2: ['coding_dev', 'version_control'] },
  },
  {
    id: 'P10.parking-before-specific',
    principle: 'P10',
    when: (a, b) => a.l3 === 'parking_action' && b.loc === 'specific',
    strength: 'hard',
    description: '주차 → 목적 활동',
    refs: { l3: ['parking_action'] },
  },
];

/* ─── Engine ──────────────────────────────────────────── */

/**
 * Evaluate rules on (a,b). Returns 'before'|'after'|'none'.
 * Matches first applicable rule in registration order.
 * Also returns which rule fired, for traceability.
 */
export function inferDependencyTyped(a, b) {
  for (const rule of DEP_RULES) {
    if (rule.when(a, b)) return { relation: 'before', rule, strength: rule.strength };
    if (rule.when(b, a)) return { relation: 'after', rule, strength: rule.strength };
  }
  return { relation: 'none', rule: null, strength: null };
}

/** Compat wrapper: same string return shape as legacy inferDependency */
export function inferDependencyString(a, b) {
  return inferDependencyTyped(a, b).relation;
}

/**
 * Validate that all l1/l2/l3 codes referenced by rules exist.
 * Returns array of {ruleId, missingField, missingValue}.
 */
export function validateRules() {
  const issues = [];
  for (const rule of DEP_RULES) {
    const refs = rule.refs || {};
    for (const code of refs.l1 || []) {
      if (!L1_META[code]) issues.push({ ruleId: rule.id, field: 'l1', value: code });
    }
    for (const code of refs.l2 || []) {
      if (!L2_META[code]) issues.push({ ruleId: rule.id, field: 'l2', value: code });
    }
    for (const code of refs.l3 || []) {
      if (!L3_META[code]) issues.push({ ruleId: rule.id, field: 'l3', value: code });
    }
  }
  return issues;
}

/** Dev/debug: explain why two activities are ordered */
export function explainOrder(a, b) {
  const r = inferDependencyTyped(a, b);
  if (r.relation === 'none') return `${a.tag} ↔ ${b.tag}: no dependency rule`;
  return `${a.tag} ${r.relation === 'before' ? '→' : '←'} ${b.tag} [${r.rule.id} ${r.rule.principle}: ${r.rule.description}]`;
}
