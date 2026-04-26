/* ═══════════════════════════════════════════════════════════════
   dependency-engine.js — 10개 의존성 원리 완전 구현

   원리 우선순위 (§3):
     P9 동반자 제약 > P4 이동 > P5 준비 > P1 재료→조리 >
     P10 상태 변화 > P7 주기성 > P3 오염→세정 >
     P2 사용→정리 > P6 소모→보충 > P8 감정 전이

   3가지 기능 축:
     1. inferDependency(a, b)     — 두 활동 간 선후 관계 판단
     2. inferMissingActivities()  — 빠진 후행/선행 활동 자동 삽입
     3. checkConstraints()        — P9 동반자, P7 주기성, P8 감정 전이 체크
   ═══════════════════════════════════════════════════════════════ */

import { L4_DB, L3_META, isRecovery, getL4 } from './types-v3.js';
import { inferDependencyString, inferDependencyTyped, DEP_RULES, validateRules, isPhysicallyDirty } from './dep-rules.js';

/* ═══ §1. 두 활동 간 선후 관계 추론 ════════════════════ */
/* Delegates to rule DSL. See dep-rules.js for all P1..P10 declarations. */

export function inferDependency(a, b) {
  return inferDependencyString(a, b);
}

// Backward-compat export
export { inferDependencyTyped, DEP_RULES, validateRules };

/* ═══ §2. 빠진 활동 자동 삽입 ══════════════════════════ */

export function inferMissingActivities(items) {
  const additions = [];
  const trackedTags = new Set(items.map(i => i.tag));
  const trackedL1 = new Set(items.map(i => i.l1));
  const trackedL2 = new Set(items.map(i => i.l2));
  const trackedL3 = new Set(items.map(i => i.l3));

  const addOnce = (l4, reason, strength, position = 'after') => {
    if (!l4 || trackedTags.has(l4.tag)) return;
    additions.push({ ...l4, _inferredBy: reason, _strength: strength, _position: position });
    trackedTags.add(l4.tag);
    trackedL1.add(l4.l1);
    trackedL2.add(l4.l2);
    trackedL3.add(l4.l3);
  };

  for (const item of items) {
    // P1: 집밥인데 조리 없음 → 조리 추가 (배달/외식 제외)
    if (item.l1 === 'eating' && !isEatingOut(item) && !trackedL2.has('food_prep')) {
      addOnce(L4_DB['simple_meal'] || L4_DB['standard_meal'],
        'P1 (재료→조리→제공)', 'soft', 'before');
    }

    // P2: 조리 후 정리
    if (item.l2 === 'food_prep' && !trackedL2.has('food_cleanup')) {
      addOnce(L4_DB['hand_wash_dish'] || L4_DB['quick_clear'],
        'P2 (사용→정리)', 'soft');
    }

    // P3: 운동/정원/수리 후 세정
    if (isPhysicallyDirty(item) && !trackedL3.has('shower') && !trackedL3.has('bath')) {
      addOnce(L4_DB['post_workout_shower'] || L4_DB['full_shower'],
        'P3 (오염→세정)', 'hard');
    }

    // P4: specific 장소 → 이동 자동 삽입 (BUG-E fix: destination-aware)
    if (item.loc === 'specific' && item.l1 !== 'traveling' && !trackedL1.has('traveling')) {
      const travelTo = pickTravelL4For(item);
      const travelBack = pickReturnL4For(item);
      if (travelTo) {
        addOnce({ ...travelTo, bg: false, stk: false }, 'P4 (이동→활동)', 'hard', 'before');
        // Return uses distinct L4 when available, otherwise synthetic __return
        const backTag = (travelBack && travelBack.tag !== travelTo.tag)
          ? travelBack.tag
          : travelTo.tag + '__return';
        if (!trackedTags.has(backTag)) {
          const backObj = (travelBack && travelBack.tag !== travelTo.tag)
            ? { ...travelBack, bg: false, stk: false, _isReturn: true }
            : { ...travelTo, tag: backTag, bg: false, stk: false, _isReturn: true };
          additions.push({
            ...backObj,
            _inferredBy: 'P4 (활동→복귀)', _strength: 'hard', _position: 'after',
          });
          trackedTags.add(backTag);
        }
      }
    }

    // P5: 운동 → 웜업/쿨다운 (phy ≥ 3인 강도 운동에만, 산책·요가 제외)
    if (item.l1 === 'sports' && item.l2 !== 'warmup_cooldown' && item.l2 !== 'mind_body'
        && item.phy >= 3) {
      if (!trackedL3.has('dynamic_warmup')) {
        addOnce(L4_DB['light_warmup'] || L4_DB['full_warmup'],
          'P5 (준비→본활동: 웜업)', 'hard', 'before');
      }
      if (!trackedL3.has('cooldown_stretch')) {
        addOnce(L4_DB['quick_cooldown'],
          'P5 (본활동→쿨다운)', 'soft');
      }
    }

    // P10: 세탁기 → 건조
    if (item.l3 === 'washing_machine' && !trackedL3.has('drying')) {
      addOnce(L4_DB['dryer_machine'] || L4_DB['line_dry'],
        'P10 (상태변화: 젖은 세탁물)', 'hard');
    }

    // P10: 건조 → 개기
    if (item.l3 === 'drying' && !trackedL3.has('folding')) {
      addOnce(L4_DB['neat_fold'] || L4_DB['quick_fold'],
        'P10 (상태변화: 마른 세탁물)', 'soft');
    }

    // P10: 코딩 → git
    if (item.l2 === 'coding_dev' && !trackedL2.has('version_control')) {
      addOnce(L4_DB['commit_push'], 'P10 (상태변화: 코드 변경)', 'soft');
    }
  }

  return additions;
}

/**
 * Pick an appropriate travel L4 for reaching a destination activity.
 * Replaces the original `errand_trip || nearby_store` fallback which
 * produced semantically wrong travel for all non-shopping destinations.
 *
 * Mapping (destination L1 → preferred travel L4):
 *   work              → driving_commute      (l3: commute_to_work)
 *   education         → bus_school           (l3: commute_to_school)
 *   sports            → drive_errand         (l3: errand_trip) — no gym-specific L4 exists
 *   purchases         → nearby_store         (l3: to_store)
 *   pro_services      → drive_errand         (hospital/dentist/etc.)
 *   gov_civic         → drive_errand
 *   social_leisure    → short_drive
 *   eating (out)      → drive_errand
 *   traveling         → (N/A; already travel)
 *   default           → drive_errand
 */
function pickTravelL4For(dest) {
  const mapByL1 = {
    work: 'driving_commute',
    education: 'bus_school',
    sports: 'drive_errand',
    purchases: 'nearby_store',
    pro_services: 'drive_errand',
    gov_civic: 'drive_errand',
    social_leisure: 'short_drive',
    eating: 'drive_errand',
    research: 'drive_errand',
    self_dev: 'drive_errand',
  };
  const preferred = mapByL1[dest.l1] || 'drive_errand';
  return L4_DB[preferred] || L4_DB['drive_errand'] || L4_DB['nearby_store'];
}

function pickReturnL4For(dest) {
  // Commuting has explicit return L4s
  const returnByL1 = {
    work: 'driving_return',
    education: 'bus_school_return',
  };
  const preferred = returnByL1[dest.l1];
  if (preferred && L4_DB[preferred]) return L4_DB[preferred];
  // Otherwise return uses same vehicle as outbound (tag suffixed)
  return pickTravelL4For(dest);
}

function isEatingOut(l4) {
  const outL2s = new Set([
    'breakfast_out','breakfast_grab','breakfast_skip_coffee',
    'lunch_out','lunch_desk','dinner_casual_out','dinner_special_out',
    'late_night_meal','cafe_coffee','drinks_alcohol',
  ]);
  return outL2s.has(l4.l2);
}

/* ═══ §3. 제약 조건 체크 ═══════════════════════════════ */

// P9: 동반자 제약
export function checkCompanionConstraint(activities, companionState = null) {
  if (!companionState || !companionState.active) {
    return { allowed: activities, blocked: [], warnings: [] };
  }
  const allowed = [], blocked = [], warnings = [];
  for (const act of activities) {
    if (act.l1 === 'caring_hh' || act.l1 === 'caring_nonhh') {
      allowed.push(act); continue;
    }
    if (act.stk || act.bg) {
      allowed.push(act);
    } else if (act.int) {
      allowed.push(act);
      warnings.push({ tag: act.tag, msg: `P9: ${companionState.type} 돌봄 중 중단 가능, 복귀 ${act.sw}분` });
    } else {
      blocked.push(act);
      warnings.push({ tag: act.tag, msg: `P9: ${companionState.type} 돌봄 중 병행 불가 (집중 필요)` });
    }
  }
  return { allowed, blocked, warnings };
}

// P7: 주기성 트리거
export function checkPeriodicTriggers(currentHour, lastExecutions = {}) {
  const triggered = [];
  if (currentHour >= 6 && currentHour <= 8)
    triggered.push({ tag: 'electric_brush', reason: 'P7: 아침 양치', priority: 'high' });
  if (currentHour >= 21 && currentHour <= 23)
    triggered.push({ tag: 'electric_brush', reason: 'P7: 취침 전 양치', priority: 'high' });
  if (currentHour >= 7 && currentHour <= 9)
    triggered.push({ tag: 'prescription_take', reason: 'P7: 아침 약 복용', priority: 'high' });
  if (currentHour >= 19 && currentHour <= 21)
    triggered.push({ tag: 'supplement_take', reason: 'P7: 저녁 영양제', priority: 'medium' });
  if (currentHour >= 7 && currentHour <= 9)
    triggered.push({ tag: 'dry_food', reason: 'P7: 아침 반려동물 사료', priority: 'high' });
  if (currentHour >= 17 && currentHour <= 19)
    triggered.push({ tag: 'wet_food', reason: 'P7: 저녁 반려동물 사료', priority: 'high' });
  return triggered;
}

// P8: 감정 전이 경고
export function checkEmotionalCarryover(orderedActivities) {
  const warnings = [];
  for (let i = 1; i < orderedActivities.length; i++) {
    const prev = orderedActivities[i - 1];
    const curr = orderedActivities[i];
    if (prev.emo >= 4 && curr.cog >= 3) {
      warnings.push({
        afterTag: prev.tag, affectedTag: curr.tag,
        msg: `P8: ${prev.tag}(emo:${prev.emo}) 직후 ${curr.tag}(cog:${curr.cog}) → ×1.2 보정`,
        multiplierSuggestion: 1.2,
      });
    }
    if (isRecovery(prev) && warnings.length > 0) {
      const last = warnings[warnings.length - 1];
      if (last.affectedTag === curr.tag) {
        last.multiplierSuggestion = 1.0;
        last.msg += ' (회복으로 해소)';
      }
    }
  }
  return warnings;
}

// P6: 회복 추천
export function suggestRecovery(orderedActivities, thresholds = {}) {
  const thr = { physical: thresholds.physical ?? 12, cognitive: thresholds.cognitive ?? 15, emotional: thresholds.emotional ?? 10 };
  const suggestions = [];
  let cumPhy = 0, cumCog = 0, cumEmo = 0;

  for (let i = 0; i < orderedActivities.length; i++) {
    const act = orderedActivities[i];
    cumPhy += act.phy; cumCog += act.cog; cumEmo += act.emo;
    if (isRecovery(act)) { cumPhy = Math.max(0, cumPhy-3); cumCog = Math.max(0, cumCog-3); cumEmo = Math.max(0, cumEmo-2); }

    if (cumPhy >= thr.physical) {
      suggestions.push({ afterStep: i, afterTag: act.tag, reason: `P6: 신체 ${cumPhy}≥${thr.physical}`, suggested: 'power_nap/snack', type: 'physical' });
      cumPhy -= 5;
    }
    if (cumCog >= thr.cognitive) {
      suggestions.push({ afterStep: i, afterTag: act.tag, reason: `P6: 인지 ${cumCog}≥${thr.cognitive}`, suggested: 'mental_rest/stretching', type: 'cognitive' });
      cumCog -= 5;
    }
    if (cumEmo >= thr.emotional) {
      suggestions.push({ afterStep: i, afterTag: act.tag, reason: `P6: 감정 ${cumEmo}≥${thr.emotional}`, suggested: 'meditation/산책', type: 'emotional' });
      cumEmo -= 3;
    }
  }
  return suggestions;
}

/* ═══ §4. 의존성 그래프 + 위상 정렬 ═══════════════════ */

/**
 * BUG-A fix: build graph with SEPARATE hard and soft edge sets.
 * - hard edges: causal (P-rules inferred via inferDependency)
 * - soft edges: user-input order preferences
 *
 * Topological sort uses hard edges as mandatory constraints.
 * Soft edges break ties in Kahn's algorithm queue only.
 * If a cycle exists among hard edges → error. Soft edges are
 * dropped silently when they conflict with hard edges.
 */
export function buildDepGraph(items) {
  // Legacy single-edge graph (kept for backward compat)
  const graph = new Map();
  items.forEach((_, i) => graph.set(i, new Set()));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const rel = inferDependency(items[i], items[j]);
      if (rel === 'before') graph.get(j).add(i);
      else if (rel === 'after') graph.get(i).add(j);
    }
  }
  return graph;
}

/** Build separate hard (causal) and soft (preference) adjacency sets.
 *  Uses rule strength from the DSL — hard rules create hard edges, soft rules create soft edges. */
export function buildDepGraphTyped(items) {
  const hard = new Map();
  const soft = new Map();
  items.forEach((_, i) => { hard.set(i, new Set()); soft.set(i, new Set()); });
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const r = inferDependencyTyped(items[i], items[j]);
      if (r.relation === 'none') continue;
      const bucket = r.strength === 'hard' ? hard : soft;
      if (r.relation === 'before') bucket.get(j).add(i);
      else if (r.relation === 'after') bucket.get(i).add(j);
    }
  }
  return { hard, soft };
}

/**
 * Detect cycles in hard-edge graph using DFS coloring.
 * Returns { hasCycle, nodes } where nodes lists one cycle if found.
 */
function detectCycle(items, graphHard) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(items.map((_, i) => [i, WHITE]));
  const parent = new Map();
  let cycleNodes = null;

  // Build outgoing-adjacency from predecessor-adjacency
  const outgoing = new Map();
  items.forEach((_, i) => outgoing.set(i, new Set()));
  for (const [node, preds] of graphHard) {
    for (const p of preds) outgoing.get(p).add(node);
  }

  function dfs(u) {
    if (cycleNodes) return;
    color.set(u, GRAY);
    for (const v of outgoing.get(u)) {
      if (color.get(v) === GRAY) {
        // back edge → cycle. Reconstruct.
        const path = [v];
        let cur = u;
        while (cur !== v && cur !== undefined) {
          path.push(cur);
          cur = parent.get(cur);
        }
        path.push(v);
        cycleNodes = path.reverse().map(idx => items[idx].tag);
        return;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
        if (cycleNodes) return;
      }
    }
    color.set(u, BLACK);
  }

  for (let i = 0; i < items.length; i++) {
    if (color.get(i) === WHITE) dfs(i);
    if (cycleNodes) break;
  }
  return { hasCycle: !!cycleNodes, nodes: cycleNodes };
}

export function optimizeOrder(items) {
  const { hard, soft } = buildDepGraphTyped(items);
  return topoSortWithTiebreak(items, hard, soft).ordered;
}

/* ═══ §5. 통합 분석 ═══════════════════════════════════ */

export function analyzeDependencies(inputTags, opts = {}) {
  const { inferMissing = true, respectInputOrder = false, companionState = null,
          currentHour = null, lastExecutions = {}, recoveryThresholds = {} } = opts;

  const items = inputTags.map(t => (typeof t === 'string' ? getL4(t) : t)).filter(Boolean);
  if (items.length === 0) return { ordered: [], inferred: [], constraints: null, depSummary: [] };

  const inferred = inferMissing ? inferMissingActivities(items) : [];
  const allItems = [...items, ...inferred];

  // BUG-A fix: build separate hard (causal) and soft (user-order) edge sets
  const { hard, soft } = buildDepGraphTyped(allItems);

  const userItemCount = items.length;
  for (let i = 0; i < userItemCount - 1; i++) {
    const j = i + 1;
    // Soft edge i→j: user wants j after i.
    // Only add if hard graph has no opposite edge (would conflict).
    if (!hard.get(i).has(j)) {
      soft.get(j).add(i);
    }
  }

  // Detect cycles in HARD edges only. Soft edges cannot create hard cycles.
  const cycleCheck = detectCycle(allItems, hard);

  let orderedResult;
  if (respectInputOrder) {
    orderedResult = { ordered: allItems, dropped: [], usedSoftEdges: 0 };
  } else {
    orderedResult = topoSortWithTiebreak(allItems, hard, soft);
  }

  const ordered = orderedResult.ordered;
  const constraints = checkCompanionConstraint(ordered, companionState);
  const periodicSuggestions = currentHour != null ? checkPeriodicTriggers(currentHour, lastExecutions) : [];
  const emotionalWarnings = checkEmotionalCarryover(ordered);
  const recoverySuggestions = suggestRecovery(ordered, recoveryThresholds);

  return {
    ordered,
    inferred: inferred.map(i => ({ tag: i.tag, by: i._inferredBy, strength: i._strength, position: i._position })),
    constraints, periodicSuggestions, emotionalWarnings, recoverySuggestions,
    depSummary: summarizeDeps(allItems, hard),
    cycleDetected: cycleCheck.hasCycle ? { nodes: cycleCheck.nodes } : null,
    droppedDuringSort: orderedResult.dropped,
    softEdgesHonored: orderedResult.usedSoftEdges,
  };
}

/* ── timeBound → 숫자 (시간대 순서) ──────────────────── */
const TIMEBOUND_ORDER = { morning: 1, business: 2, anytime: 3, evening: 4, night: 5 };

/* ── L1 → 하루 흐름 순서 (생활 리듬) ────────────────── */
const L1_FLOW_ORDER = {
  personal_care: 1, eating: 2, household: 3, traveling: 4,
  work: 5, education: 5, research: 5,
  purchases: 6, pro_services: 6, gov_civic: 6,
  sports: 7, self_dev: 7,
  social_leisure: 8, digital_creation: 8, financial: 8,
  online_social: 9, communication: 9,
  caring_hh: 3, caring_nonhh: 3,
  volunteer: 8, religious: 8,
  hh_services: 3,
};

/**
 * Topological sort with hard/soft edge separation.
 *
 * Algorithm:
 *   1. Compute in-degree from HARD edges only. Nodes with in-degree 0 are ready.
 *   2. Among ready nodes, use tiebreaker that includes soft-edge preferences
 *      (only select a node if its soft predecessors are already placed, when possible).
 *   3. If ready set is empty but items remain → HARD CYCLE. Break ties by
 *      dropping all soft predecessors for one stuck node; if still stuck, drop
 *      the oldest hard edge and record `dropped`.
 *   4. Final fallback: flush remaining items in input order. No item is ever lost.
 *
 * Returns { ordered, dropped, usedSoftEdges }.
 * `dropped` lists items whose hard constraints were violated to break a cycle.
 */
function topoSortWithTiebreak(items, hard, soft) {
  const N = items.length;
  const hardInDeg = new Map();
  items.forEach((_, i) => hardInDeg.set(i, hard.get(i).size));
  const hardOut = new Map();
  items.forEach((_, i) => hardOut.set(i, new Set()));
  for (const [node, preds] of hard) for (const p of preds) hardOut.get(p).add(node);

  const placed = new Set();
  const result = [];
  const dropped = [];
  let usedSoftEdges = 0;

  const isReady = (i) => !placed.has(i) && hardInDeg.get(i) === 0;

  const tiebreak = (a, b) => {
    const la = items[a], lb = items[b];

    // (0) Soft-edge preference: prefer node whose soft predecessors are all placed.
    const aSoftPendingCount = [...soft.get(a)].filter(p => !placed.has(p)).length;
    const bSoftPendingCount = [...soft.get(b)].filter(p => !placed.has(p)).length;
    if (aSoftPendingCount !== bSoftPendingCount) return aSoftPendingCount - bSoftPendingCount;

    // (1) Inferred P4 outbound travel first
    const aTravel = la._inferredBy?.includes('이동→활동');
    const bTravel = lb._inferredBy?.includes('이동→활동');
    if (aTravel !== bTravel) return aTravel ? -1 : 1;

    // (2) Inferred P5 warmup
    const aWarmup = la._inferredBy?.includes('웜업');
    const bWarmup = lb._inferredBy?.includes('웜업');
    if (aWarmup !== bWarmup) return aWarmup ? -1 : 1;

    // (3) timeBound
    const aTime = TIMEBOUND_ORDER[la.timeBound] || 3;
    const bTime = TIMEBOUND_ORDER[lb.timeBound] || 3;
    if (aTime !== bTime) return aTime - bTime;

    // (4) L1 flow
    const aFlow = L1_FLOW_ORDER[la.l1] || 8;
    const bFlow = L1_FLOW_ORDER[lb.l1] || 8;
    if (aFlow !== bFlow) return aFlow - bFlow;

    // (5) Recovery later
    if (isRecovery(la) !== isRecovery(lb)) return isRecovery(la) ? 1 : -1;

    // (6) Input order
    return a - b;
  };

  const placeOne = (idx, softConsumed) => {
    placed.add(idx);
    result.push(idx);
    if (softConsumed) usedSoftEdges += softConsumed;
    for (const succ of hardOut.get(idx)) {
      hardInDeg.set(succ, hardInDeg.get(succ) - 1);
    }
  };

  // Main loop
  while (result.length < N) {
    const ready = [];
    for (let i = 0; i < N; i++) if (isReady(i)) ready.push(i);

    if (ready.length > 0) {
      ready.sort(tiebreak);
      const pick = ready[0];
      const softSatisfied = [...soft.get(pick)].filter(p => placed.has(p)).length;
      placeOne(pick, softSatisfied);
      continue;
    }

    // Hard cycle: break it by emitting the unplaced item with smallest index.
    // Record the hard edges we had to violate.
    let brokeCycle = false;
    for (let i = 0; i < N; i++) {
      if (placed.has(i)) continue;
      const violated = [...hard.get(i)].filter(p => !placed.has(p));
      for (const p of violated) {
        dropped.push({ from: items[p].tag, to: items[i].tag, reason: 'HARD_CYCLE' });
        hard.get(i).delete(p);
        hardOut.get(p).delete(i);
      }
      hardInDeg.set(i, 0);
      brokeCycle = true;
      break;
    }
    if (!brokeCycle) break; // unreachable
  }

  return {
    ordered: result.map(idx => items[idx]),
    dropped,
    usedSoftEdges,
  };
}

function summarizeDeps(items, graph) {
  const edges = [];
  for (const [node, preds] of graph) {
    for (const p of preds) edges.push(`${items[p].tag} → ${items[node].tag}`);
  }
  return edges;
}
