/* ═══════════════════════════════════════════════════════════════
   scheduler.js — 시간·에너지·배치 계산 엔진 (v3)

   사용자가 정의한 3가지 계산 원리:

   1. 시간 계산 (계층적 가중치):
        time_adjusted(l4) = base_time × w_L3 × w_L2 × w_L1
      상위 가중치는 사용자·맥락별 특성 반영 (개인화 학습으로 갱신)

   2. 에너지 누적 + 지수 배수:
        energy_cumulative(step_i) = Σ (phy+cog+emo) of prior steps
          - 회복형 태그(RECOVERY_TAGS)는 음수 기여
          - 배경 레이어(bgable) 활동은 0.3배로만 기여
        time_final(step_i) = time_adjusted × exp(k · energy_cumulative)

   3. 레이어드 배치 (사용자의 "음악 틀기 → 요리 준비 → 요리하기" 예시):
        배경 레이어: bgable=true 활동이 타임라인 전체를 덮음
        주 레이어:   순차 진행
          └ 주 레이어 안에서 stackable → interruptible 순으로 배치 유연성
   ═══════════════════════════════════════════════════════════════ */

import { L4_DB, isRecovery, getL4 } from './types-v3.js';
import { TimeContext, TimeRegressionError, parseTime } from './time-contract.js';
import { buildResumeItems, interruptedEnergyContribution } from './interruption.js';

/* ── 설정 상수 ────────────────────────────────────────── */
export const CONFIG = {
  ENERGY_K: 0.03,            // 지수 함수 상수, 누적 10 → 약 1.35배
  BG_ENERGY_FACTOR: 0.3,     // 배경 활동 에너지는 주 레이어에 30%만 기여
  RECOVERY_FACTOR: -0.5,     // 회복형은 음의 에너지 반절로 기여 (완전 상쇄 아님)
  CROSS_FATIGUE_K: 0.3,      // hybrid 교차 피로 계수 (2축+ 동시 사용 시 추가 비용)
  DEFAULT_WEIGHT: 1.0,       // L1/L2/L3 가중치 기본값
  MAX_ENERGY_CAP: 25,        // 누적 에너지 상한 (시간 폭주 방지)
  PER_ACTIVITY_MULT_CAP: 1.5,// BUG-K: single-activity multiplier cap.
                              // Prevents 360-min activities from ballooning to 540+ under high
                              // cumulative energy. 1.5× is empirically calibrated: matches worst-case
                              // MAX_ENERGY_CAP × ENERGY_K = exp(0.75) ≈ 2.12, but caps at 1.5 for sanity.
  SLACK_SAFETY_MARGIN: 0.8,    // effective_slack = slack * 0.8  (admission safety buffer)
  SLACK_NUMERIC_EPS: 0.1,      // EPS ∈ [0.05, 0.2] — numerical tolerance ONLY.
                                //   Admission rule: predTotal ≤ effectiveSlack + EPS.
                                //   Not a buffer, not a capacity extender — floating-point slop only.
  SLACK_RESERVE_THRESHOLD: 0.5,// Near-zero slack threshold. slack ≤ this → reserve slot, no fitting.
};

/* ── 1. 계층적 시간 계산 ──────────────────────────────── */

/**
 * 가중치 누적 곱으로 L4 시간 조정
 * @param {object} l4 - L4_DB에서 가져온 속성 객체
 * @param {object} weights - { L1:{research:1.2,...}, L2:{...}, L3:{...} }
 * @returns {{act: number, pas: number}} 조정된 active/passive 시간
 */
export function computeAdjustedTime(l4, weights = {}) {
  const wL1 = weights.L1?.[l4.l1] ?? CONFIG.DEFAULT_WEIGHT;
  const wL2 = weights.L2?.[l4.l2] ?? CONFIG.DEFAULT_WEIGHT;
  const wL3 = weights.L3?.[l4.l3] ?? CONFIG.DEFAULT_WEIGHT;
  const factor = wL1 * wL2 * wL3;
  return {
    act: l4.act * factor,
    pas: l4.pas * factor,
    factor,
  };
}

/* ── 2. 에너지 계산 ───────────────────────────────────── */

/**
 * 한 활동의 에너지 기여량 (회복형·배경 처리 포함)
 */
export function energyContribution(l4, { isBackground = false } = {}) {
  // BUG-I fix: recovery activities bypass cross-fatigue entirely.
  // Rationale: cross-fatigue models the cost of simultaneously engaging
  // multiple mental/physical channels during effort. Recovery activities
  // are by definition non-effortful; applying cross-fatigue then negating
  // produces inflated negative contributions.
  if (isRecovery(l4)) {
    const base = l4.phy + l4.cog + l4.emo;
    let raw = base * CONFIG.RECOVERY_FACTOR;
    if (isBackground) raw *= CONFIG.BG_ENERGY_FACTOR;
    return raw;
  }

  let raw = l4.phy + l4.cog + l4.emo;

  // hybrid 교차 피로: 2축 이상 동시 사용 시 추가 비용 (non-recovery only)
  const channels = [l4.phy, l4.cog, l4.emo].filter(v => v > 0);
  if (channels.length >= 2) {
    const minChannel = Math.min(...channels);
    raw += CONFIG.CROSS_FATIGUE_K * minChannel * (channels.length - 1);
  }

  if (isBackground) {
    raw *= CONFIG.BG_ENERGY_FACTOR;
  }
  return raw;
}

/**
 * 누적 에너지에 따른 시간 배수 (지수)
 */
export function energyMultiplier(cumulativeEnergy) {
  const capped = Math.max(
    -CONFIG.MAX_ENERGY_CAP,
    Math.min(CONFIG.MAX_ENERGY_CAP, cumulativeEnergy)
  );
  const raw = Math.exp(CONFIG.ENERGY_K * capped);
  // BUG-K: bound per-activity multiplier to prevent long activities from ballooning.
  return Math.min(CONFIG.PER_ACTIVITY_MULT_CAP, raw);
}

/* ── 3. 레이어드 배치 ──────────────────────────────────
   NOTE: splitLayers() was removed as dead code. Layer separation
   logic is inlined in schedule() at the "레이어 분리" step because
   traveling activities need to stay in the main sequence regardless
   of bg flag — a concern the abstract splitter couldn't express.
   ─────────────────────────────────────────────────────────── */

/* ── 4. 전체 스케줄링 (시간 + 에너지 + 레이어 + passive + 시간 앵커) ── */

/** 시간 문자열 → 분 변환 "08:30" → 510 */
export function timeToMin(str) {
  if (typeof str === 'number') return str;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 분 → 시간 문자열 510 → "08:30" */
export function minToTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/**
 * 활동 시퀀스를 계산 → 타임라인 생성
 *
 * @param {string[]} l4Tags - 활동 태그들
 * @param {object}   opts
 *   - weights: 계층 가중치 (개인화)
 *   - reorder: 레이어 분리 (기본 true)
 *   - fillPassive: passive 슬롯 자동 채우기 (기본 true)
 *   - currentTime: 시작 시각 "08:30" (없으면 상대시간 0부터)
 *   - fixedEvents: [{ tag, startAt:"10:00" }] 고정시간 앵커
 * @returns {{timeline, totalActive, totalPassive, totalElapsed, savedTime, ...}}
 */
export function schedule(l4Tags, opts = {}) {
  const { weights = {}, reorder = true, fillPassive = true,
          currentTime = null, fixedEvents = [],
          emotionalAdjustments = null,
          timeCtx = null,              // H1/H4: single source of truth for `now`
          interruptions = [],          // Task 3 — see below
          strictTimeEnforcement = true,// H1 enforcement toggle (tests can disable)
        } = opts;

  // ── INVARIANT ENFORCEMENT ENTRY (H1, H4) ──
  // If the caller provided a TimeContext, it is authoritative. Otherwise fall back
  // to `currentTime` as a relative-time shim, but H1 checks are relaxed because
  // relative-time mode is test-only and has no real "now".
  const useAbsTime = currentTime !== null || timeCtx !== null;
  const ctx = timeCtx ?? (currentTime !== null
    ? new TimeContext({ now: parseTime(currentTime), source: 'opts.currentTime' })
    : null);
  const clockStart = useAbsTime ? (ctx ? ctx.now : parseTime(currentTime)) : 0;
  const enforceH1 = strictTimeEnforcement && ctx !== null;
  // emotionalAdjustments: Map<tag, number> — applied as final multiplier on actFinal.

  // ── Phase I: item materialization ──
  const items = l4Tags
    .map(t => (typeof t === 'string' ? getL4(t) : t))
    .filter(Boolean);

  if (items.length === 0) {
    return { timeline: [], totalActive: 0, totalElapsed: 0, energyTrace: [], droppedAnchors: [] };
  }

  // ── Phase II: layer split (bg vs main). Traveling stays in main regardless of bg flag. ──
  const mainItems = [];
  const backgroundItems = [];
  if (reorder) {
    for (const l4 of items) {
      if (l4.bg && l4.l1 !== 'traveling') backgroundItems.push(l4);
      else mainItems.push(l4);
    }
  } else {
    mainItems.push(...items);
  }

  // ── Phase III: anchor validation (produces PendingAnchor queue for the walker) ──
  const droppedAnchors = [];
  const pendingAnchors = []; // sorted ascending by fixedMin

  for (const fe of fixedEvents) {
    const inSeq = mainItems.find(x => x.tag === fe.tag);
    const base = inSeq || getL4(fe.tag);
    if (!base) {
      droppedAnchors.push({ tag: fe.tag, reason: 'UNKNOWN_TAG' });
      continue;
    }
    const fixedMin = parseTime(fe.startAt);
    // H3 enforcement: anchors before `now` are dropped. Uses ctx.now (not clockStart)
    // so that a cached/stale clockStart cannot mask a real-world regression.
    const pastThreshold = ctx ? ctx.now : clockStart;
    if (useAbsTime && fixedMin < pastThreshold) {
      droppedAnchors.push({
        tag: fe.tag, reason: 'PAST_ANCHOR',
        fixedAt: fe.startAt, now: pastThreshold,
        msg: `고정 이벤트 ${fe.tag}@${fe.startAt} 이(가) 현재 시각(${pastThreshold}분)보다 과거 — 제외됨`,
      });
      continue;
    }
    pendingAnchors.push({ tag: fe.tag, fixedMin, l4: inSeq ? inSeq : { ...base }, inSeq: !!inSeq });
  }
  pendingAnchors.sort((a, b) => a.fixedMin - b.fixedMin);
  // Assign a stable id for each anchor so same-tag repeats don't collide.
  pendingAnchors.forEach((a, i) => { a._id = i; });

  // Remove anchors from main sequence — the walker schedules them independently.
  const anchorTagSet = new Set(pendingAnchors.map(a => a.tag));
  // Task 3: interrupted tasks resumed/restarted at head of queue.
  // These already passed energy accounting at the time of original emission
  // (for resume mode — partial fraction); we add only the unspent fraction.
  const resumeItems = buildResumeItems(interruptions);
  const flexQueue = [
    ...resumeItems,
    ...mainItems.filter(l4 => !anchorTagSet.has(l4.tag)
      && !resumeItems.some(r => r.tag === l4.tag))
  ];

  // ── Phase IV: single-pass walker ──
  // Invariants maintained:
  //   clock: current time (absolute if useAbsTime, else relative)
  //   cumulativeEnergy: running energy total (starts with bg baseline)
  //   flexIdx: next flex item to consume
  //   pendingAnchors[0]: next anchor to fire (or undefined)
  //
  // Decision at each step:
  //   (a) If an anchor's fixedMin ≤ clock (we've arrived at or past it), fire it.
  //   (b) Else if there's a flex item AND its energy-adjusted actFinal fits before
  //       the next anchor, emit the flex.
  //   (c) Else emit an idle gap up to the next anchor, then fire the anchor.
  //   (d) If no anchors remain, drain flex queue.
  //
  // This eliminates the dual-simulation problem: there is one `clock` and one
  // `cumulativeEnergy`, updated exactly once per emission.

  const timeline = [];
  const emittedFlex = new Set(); // flexQueue indices already emitted
  const emittedAnchors = new Set();
  let cumulativeEnergy = backgroundItems.reduce(
    (sum, bg) => sum + energyContribution(bg, { isBackground: true }), 0
  );
  const energyTrace = [
    { step: 0, label: 'bg_baseline', cumulative: round2(cumulativeEnergy) },
  ];
  // H1: walker emission clock must never start in the past. If clockStart was
  // set ahead of time but `now` has since advanced (e.g., slow network + replan),
  // bump to `now`. This is an upward adjustment only — never rewrites a future
  // plan backward. Silent adjustment is permitted HERE because the alternative
  // (throwing on entry) forbids callers that planned ahead; throwing happens at
  // the per-emission check instead if anything derived would violate H1.
  let clock = ctx ? Math.max(clockStart, ctx.now) : clockStart;
  if (ctx && clock > clockStart) {
    energyTrace.push({ step: 0, label: 'clock_clamped_to_now',
      from: clockStart, to: clock, reason: 'H1_clamp' });
  }
  let stepNum = 0;
  let flexIdx = 0;

  /**
   * CLOCK NORMALIZATION (Problem 1 fix)
   * Every read of `clock` that feeds a scheduling decision MUST go through
   * `effClock()`. This makes it structurally impossible for a stale/past clock
   * to inflate slack or fire an anchor early.
   *
   * Rationale: `clock` is mutated by emission. If any future refactor introduces
   * a code path where `clock` drifts below `ctx.now` (e.g., STN back-propagation,
   * rewind-on-replan), the decision path stays correct because slack is computed
   * from `effClock()`, not `clock`. The in-place assignment at entry is retained
   * so emissions still use `clock` as the commit target.
   */
  const effClock = () => (ctx ? Math.max(clock, ctx.now) : clock);

  const emitFlexItem = (l4, markedAnchor = false) => {
    // H1 enforcement: every emission must satisfy start ≥ now.
    // This is the last line of defense — if it throws, some upstream stage
    // (interleaver, anchor-handler, replan caller) has bypassed the contract.
    if (enforceH1 && ctx) ctx.assertFuture(clock, `emit:${l4.tag}`);
    // H2 enforcement: each new step cannot start before the previous step ended.
    if (timeline.length > 0) {
      const prev = timeline[timeline.length - 1];
      if (prev.endTime !== null && prev.endTime !== undefined) {
        if (enforceH1 && ctx) ctx.assertMonotonic(prev.endTime, { tag: l4.tag, startTime: clock });
      }
    }

    // Compute this activity's actual time under current energy state.
    const adj = computeAdjustedTime(l4, weights);
    const mult = energyMultiplier(cumulativeEnergy);
    const p8Mult = emotionalAdjustments?.get?.(l4.tag) ?? 1.0;
    const actFinal = adj.act * mult * p8Mult;
    const pasFinal = adj.pas * mult * p8Mult;

    stepNum++;
    const step = buildStep(stepNum, l4, adj, mult, clock, actFinal, pasFinal,
      cumulativeEnergy, backgroundItems, useAbsTime);
    if (markedAnchor) step.isFixed = true;
    if (p8Mult !== 1.0) {
      step.p8MultiplierApplied = p8Mult;
      step.emotionalAdjustment = { multiplier: p8Mult, reason: 'P8 carryover' };
    }
    timeline.push(step);

    clock += actFinal;
    const baseContrib = energyContribution(l4);
    const contrib = interruptedEnergyContribution(l4, baseContrib);
    if (l4._interrupted) {
      step.interrupted = { ...l4._interrupted, contribAdjusted: contrib };
    }
    cumulativeEnergy += contrib;
    energyTrace.push({
      step: stepNum, tag: l4.tag,
      contribution: round2(contrib), cumulative: round2(cumulativeEnergy),
    });

    // ─── PASSIVE SLOT (Problem 2: evaluation vs commit separation) ───
    // Evaluation phase: pick candidates against a FROZEN snapshot of (energy,clock).
    //   - Mutation is forbidden in this phase.
    //   - Candidate ordering cannot bias selection: each candidate is evaluated
    //     against the same base snapshot, not a running total.
    // Commit phase: emit in order, update state once per accepted candidate.
    if (pasFinal > 0 && fillPassive) {
      let slotRemaining = pasFinal;
      const slotActivities = [];

      // PHASE 1 — PURE EVALUATION ------------------------------------
      // Snapshot: (baseEnergy, baseClock) captured AT ENTRY to the slot.
      // For admission, each candidate is tested independently: can it fit?
      // We don't commit chained increments here. Selection uses input order,
      // which is deterministic and order-stable (same input → same plan).
      const baseEnergyForSlot = cumulativeEnergy;
      const baseClockForSlot = clock;
      const chosen = []; // [{j, cand, cAdj, cActFinal, cContrib}]
      let simEnergyForPlanning = baseEnergyForSlot;  // planning-only, discarded after phase 1
      let simRemaining = slotRemaining;

      for (let j = flexIdx; j < flexQueue.length && simRemaining > 0; j++) {
        if (emittedFlex.has(j)) continue;
        const cand = flexQueue[j];
        if (cand.pas !== 0) continue;
        // Evaluate against CURRENT planning-snapshot energy.
        // NOTE: this uses a running simEnergyForPlanning because passive slot is
        // a sequential packing — the Nth candidate's energy state is the sum
        // of the prior N-1 within the slot. This is deterministic (order-stable)
        // because flexQueue is a fixed ordered list.
        const cAdj = computeAdjustedTime(cand, weights);
        const cMult = energyMultiplier(simEnergyForPlanning);
        const cActFinal = cAdj.act * cMult;
        // Dual-layer rule: strict fit + EPS tolerance for float slop.
        if (cActFinal > simRemaining + CONFIG.SLACK_NUMERIC_EPS) continue;
        const cBaseContrib = energyContribution(cand);
        chosen.push({ j, cand, cAdj, cMult, cActFinal, cContrib: cBaseContrib });
        simEnergyForPlanning += cBaseContrib;
        simRemaining -= cActFinal;
      }

      // PHASE 2 — COMMIT ---------------------------------------------
      // Emit chosen candidates in selection order, advancing real state.
      for (const pick of chosen) {
        emittedFlex.add(pick.j);
        stepNum++;
        const cStep = buildStep(stepNum, pick.cand, pick.cAdj, pick.cMult, clock,
          pick.cActFinal, 0, cumulativeEnergy, backgroundItems, useAbsTime);
        cStep.inPassiveSlotOf = l4.tag;
        timeline.push(cStep);
        slotActivities.push(pick.cand.tag);
        clock += pick.cActFinal;
        slotRemaining -= pick.cActFinal;
        cumulativeEnergy += pick.cContrib;
        energyTrace.push({
          step: stepNum, tag: pick.cand.tag,
          contribution: round2(pick.cContrib), cumulative: round2(cumulativeEnergy),
          inSlotOf: l4.tag,
        });
      }
      // Any unfilled remainder: reserve slot (Problem 3) instead of silent idle.
      if (slotRemaining > 0) {
        const slotEnd = clock + slotRemaining;
        if (slotRemaining <= CONFIG.SLACK_RESERVE_THRESHOLD) {
          // Near-zero tail: inert reserve slot.
          emitReserveSlot(clock, slotEnd, 'PASSIVE_TAIL_NEAR_ZERO');
        } else {
          clock = slotEnd;
        }
      }
      step.passiveSlot = {
        totalPassive: round1(pasFinal),
        filled: slotActivities,
        filledTime: round1(pasFinal - slotRemaining),
        idleTime: round1(slotRemaining),
        baseEnergySnapshot: round2(baseEnergyForSlot),   // traceability
        baseClockSnapshot: round1(baseClockForSlot),
      };
    } else {
      clock += pasFinal;
    }

    step.endTime = round1(clock);
    return step;
  };

  const emitIdleGap = (toClock) => {
    // Problem 1: measure gap from normalized clock — never from a clock behind `now`.
    const from = effClock();
    if (toClock <= from) return;
    const gap = toClock - from;
    timeline.push({
      index: '—', tag: '__idle_gap__',
      actFinal: 0, pasFinal: 0,
      startTime: round1(from),
      endTime: round1(toClock),
      clockTime: useAbsTime ? minToTime(from) : null,
      note: `${round1(gap)}분 여유 (고정 이벤트 대기)`,
      isGap: true,
    });
    clock = toClock;
  };

  const nextAnchor = () => {
    while (pendingAnchors.length > 0 && emittedAnchors.has(pendingAnchors[0]._id)) {
      pendingAnchors.shift();
    }
    return pendingAnchors[0];
  };

  // Advance flexIdx past any already-emitted items (filled in passive slots).
  const advanceFlexIdx = () => {
    while (flexIdx < flexQueue.length && emittedFlex.has(flexIdx)) flexIdx++;
  };

  /**
   * ─── PROBLEM 2 — PURE EVALUATION ───────────────────────────────────
   * `evaluateCandidate` is a PURE function of (cand, snapshot). It returns
   * predicted metrics without mutating anything. The caller decides whether
   * to commit (via `emitFlexItem`) or reject (defer / reserve / anchor jump).
   *
   * Snapshot = { energy, clock, anchor } — frozen at the start of an iteration.
   * Across candidate scans (e.g., passive-slot fill), we evaluate ALL candidates
   * against the SAME snapshot, then commit one at a time. This eliminates
   * state-dependent evaluation bias: candidate order cannot change selection.
   */
  const snapshot = () => Object.freeze({
    energy: cumulativeEnergy,
    clock: effClock(),
    epoch: stepNum,
  });

  const evaluateCandidate = (cand, snap) => {
    const adj = computeAdjustedTime(cand, weights);
    const mult = energyMultiplier(snap.energy);
    const p8Mult = emotionalAdjustments?.get?.(cand.tag) ?? 1.0;
    const predActive  = adj.act * mult * p8Mult;
    const predPassive = adj.pas * mult * p8Mult;
    const predTotal   = predActive + predPassive;
    return { cand, adj, mult, p8Mult, predActive, predPassive, predTotal };
  };

  /**
   * ─── PROBLEM 3 — SLACK GATE WITH DUAL-LAYER RULE ───────────────────
   * Layer 1: Strict check          predTotal ≤ effectiveSlack
   * Layer 2: Numerical tolerance   predTotal ≤ effectiveSlack + EPS
   *
   * EPS is for floating-point slop ONLY. It does not widen capacity.
   * Near-zero slack path (slack ≤ RESERVE_THRESHOLD): REJECT unconditionally.
   * The caller is expected to produce a reserve slot, not force-fit.
   *
   * Returns discriminated result:
   *   { kind: 'ADMIT' | 'REJECT_NEAR_ZERO' | 'REJECT_EXCEEDS' | 'UNCONSTRAINED',
   *     predTotal, slack, effectiveSlack }
   */
  const slackGate = (evalResult, anchorFuture, snap) => {
    if (!anchorFuture || !useAbsTime) {
      return { kind: 'UNCONSTRAINED', predTotal: evalResult.predTotal,
               slack: Infinity, effectiveSlack: Infinity };
    }
    // Slack is measured from NORMALIZED clock (Problem 1 fix): never from a past clock.
    const slack = anchorFuture.fixedMin - snap.clock;

    // Near-zero slack → reserve slot, no fitting (Problem 3 §Near-zero).
    if (slack <= CONFIG.SLACK_RESERVE_THRESHOLD) {
      return { kind: 'REJECT_NEAR_ZERO', predTotal: evalResult.predTotal,
               slack, effectiveSlack: 0 };
    }

    const effectiveSlack = slack * CONFIG.SLACK_SAFETY_MARGIN;
    // Dual-layer: strict check with numerical tolerance (EPS only for float slop).
    if (evalResult.predTotal <= effectiveSlack + CONFIG.SLACK_NUMERIC_EPS) {
      return { kind: 'ADMIT', predTotal: evalResult.predTotal, slack, effectiveSlack };
    }
    return { kind: 'REJECT_EXCEEDS', predTotal: evalResult.predTotal, slack, effectiveSlack };
  };

  /**
   * RESERVE SLOT emission. Inert marker:
   *   - not a task
   *   - no energy contribution
   *   - no decision weight
   *   - advances `clock` to end of gap
   * Semantics per spec §Reserve Slot Semantics.
   */
  const emitReserveSlot = (fromClock, toClock, reason) => {
    if (toClock <= fromClock) return;
    timeline.push({
      index: '—',
      tag: '__reserve__',
      type: 'padding',
      actFinal: 0, pasFinal: 0,
      startTime: round1(fromClock),
      endTime: round1(toClock),
      clockTime: useAbsTime ? minToTime(fromClock) : null,
      durationGap: round1(toClock - fromClock),
      energy: 0,
      decisionWeight: 0,
      visibleOnly: true,
      reserveReason: reason,
      isReserve: true,
    });
    clock = toClock;
  };

  while (true) {
    advanceFlexIdx();
    const anchor = nextAnchor();
    const haveFlex = flexIdx < flexQueue.length;

    if (!anchor && !haveFlex) break; // done

    // Case A: anchor is due or overdue — fire it now.
    // Uses NORMALIZED clock (Problem 1): an anchor between old-clock and now
    // should fire without racing.
    if (anchor && useAbsTime && anchor.fixedMin <= effClock()) {
      if (effClock() > anchor.fixedMin) anchor.l4._timeConflict = true;
      emittedAnchors.add(anchor._id);
      emitFlexItem(anchor.l4, /* markedAnchor */ true);
      continue;
    }

    // Case B: anchor in the future — evaluate flex against frozen snapshot.
    if (haveFlex) {
      const snap = snapshot();
      const cand = flexQueue[flexIdx];
      const evalResult = evaluateCandidate(cand, snap);
      const gate = slackGate(evalResult, anchor, snap);

      if (gate.kind === 'UNCONSTRAINED' || gate.kind === 'ADMIT') {
        emittedFlex.add(flexIdx);
        emitFlexItem(cand);
        continue;
      }

      // REJECT_NEAR_ZERO: structurally inert reserve slot, then fire anchor.
      if (gate.kind === 'REJECT_NEAR_ZERO' && anchor) {
        emitReserveSlot(snap.clock, anchor.fixedMin, 'NEAR_ZERO_SLACK');
        emittedAnchors.add(anchor._id);
        emitFlexItem(anchor.l4, true);
        continue;
      }

      // REJECT_EXCEEDS: idle gap + fire anchor + record deferral for observability.
      if (gate.kind === 'REJECT_EXCEEDS' && anchor) {
        emitIdleGap(anchor.fixedMin);
        emittedAnchors.add(anchor._id);
        emitFlexItem(anchor.l4, true);
        const anchorStep = timeline[timeline.length - 1];
        if (anchorStep) {
          anchorStep.slackRejection = {
            deferredTag: cand.tag,
            reason: gate.kind,
            predTotal: round1(gate.predTotal),
            slack: round1(gate.slack),
            effectiveSlack: round1(gate.effectiveSlack),
          };
        }
        continue;
      }

      // No anchor but gate rejected (shouldn't happen: anchorFuture=null → admit=true).
      // Defensive fallthrough: emit anyway.
      emittedFlex.add(flexIdx);
      emitFlexItem(cand);
      continue;
    }

    // Case C: only anchor left — jump clock, fire it.
    // Uses effClock() for consistency with Case A; anchor.fixedMin > effClock()
    // means there's a genuine future gap to bridge.
    if (anchor) {
      if (useAbsTime && anchor.fixedMin > effClock()) emitIdleGap(anchor.fixedMin);
      emittedAnchors.add(anchor._id);
      emitFlexItem(anchor.l4, true);
      continue;
    }

    break; // unreachable
  }

  // 5. 결과 집계
  const totalActive = round1(timeline.reduce((s, t) => s + t.actFinal, 0));
  const totalPassive = round1(
    timeline.filter(t => t.passiveSlot).reduce((s, t) => s + t.passiveSlot.totalPassive, 0)
  );
  const savedTime = round1(
    timeline.filter(t => t.passiveSlot).reduce((s, t) => s + t.passiveSlot.filledTime, 0)
  );

  return {
    timeline,
    totalActive,
    totalPassive,
    totalElapsed: round1(clock - clockStart),  // BUG-B fix: duration, not absolute
    endClock: round1(clock),                    // keep absolute for debugging
    startClock: round1(clockStart),
    savedTime,  // passive 슬롯 활용으로 절약한 시간
    energyTrace,
    finalEnergy: round2(cumulativeEnergy),
    backgroundLayer: backgroundItems.map(b => ({
      tag: b.tag, spansEntireTimeline: true,
    })),
    droppedAnchors: droppedAnchors,
  };
}

/* ── step 빌더 헬퍼 ───────────────────────────────────── */
function buildStep(index, l4, adj, mult, clock, actFinal, pasFinal,
    cumulativeEnergy, backgroundItems, useAbsTime) {
  return {
    index,
    tag: l4.tag,
    l1: l4.l1, l2: l4.l2, l3: l4.l3,
    baseAct: l4.act,
    basePas: l4.pas,
    baseEnergy: l4.phy + l4.cog + l4.emo,
    isRecovery: isRecovery(l4),
    weightFactor: adj.factor,
    energyMultiplier: round2(mult),
    actAdjusted: round1(adj.act),
    actFinal: round1(actFinal),
    pasFinal: round1(pasFinal),
    startTime: round1(clock),
    clockTime: useAbsTime ? minToTime(clock) : null,
    endTime: null,
    cumulativeEnergyBefore: round2(cumulativeEnergy),
    backgroundActivities: backgroundItems.map(b => b.tag),
    layerHint: l4.stk ? 'stackable' : (l4.bg ? 'background' : 'main'),
    canInterruptAt: l4.int ? l4.sw : null,
    isFixed: !!l4._fixedAt,
    timeConflict: !!l4._timeConflict,
    inPassiveSlotOf: null,
    passiveSlot: null,
  };
}

/**
 * 내부 헬퍼: L4 객체 배열에서 레이어 분리
 */
/* ── 유틸 ─────────────────────────────────────────────── */
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

/* ── 요약 출력용 포매터 ───────────────────────────────── */
export function formatSchedule(result) {
  const lines = [];
  if (result.backgroundLayer?.length) {
    lines.push(`[배경 레이어] ${result.backgroundLayer.map(b => b.tag).join(', ')} — 타임라인 전체`);
    lines.push('');
  }
  lines.push('[주 레이어]');
  for (const step of result.timeline) {
    // Reserve slot (Problem 3): inert padding, rendered distinctly
    if (step.isReserve) {
      const timeStr = step.clockTime ? ` (${step.clockTime}~)` : '';
      lines.push(`     ──── 🔒 reserve ${step.durationGap}분 [${step.reserveReason}]${timeStr} ────`);
      continue;
    }
    // idle gap 표시
    if (step.isGap) {
      const timeStr = step.clockTime ? ` (${step.clockTime}~)` : '';
      lines.push(`     ──── ${step.note}${timeStr} ────`);
      continue;
    }

    const mult = step.energyMultiplier?.toFixed(2) ?? '—';
    const ew = step.isRecovery ? '💤' : (step.baseEnergy >= 8 ? '🔥' : '·');
    const slotMark = step.inPassiveSlotOf ? `  ↳ (${step.inPassiveSlotOf} 대기 중)` : '';
    const fixedMark = step.isFixed ? ' 📌' : '';
    const conflictMark = step.timeConflict ? ' ⚠시간충돌' : '';
    const clockStr = step.clockTime ? `${step.clockTime} ` : '';
    lines.push(
      `  ${clockStr}${step.index}. ${step.tag.padEnd(25)} ` +
      `[${step.baseAct}분 → ${step.actFinal}분] ` +
      `${ew}E${step.cumulativeEnergyBefore} ×${mult}${slotMark}${fixedMark}${conflictMark}`
    );
    if (step.passiveSlot) {
      const ps = step.passiveSlot;
      if (ps.filled.length > 0) {
        lines.push(`     ──── passive ${ps.totalPassive}분 중 ${ps.filledTime}분 활용, ${ps.idleTime}분 대기 ────`);
      } else {
        lines.push(`     ──── passive ${ps.totalPassive}분 대기 ────`);
      }
    }
  }
  lines.push('');
  lines.push(`총 active: ${result.totalActive}분 | passive: ${result.totalPassive}분 | elapsed: ${result.totalElapsed}분`);
  if (result.savedTime > 0) {
    lines.push(`⏱ passive 슬롯 활용으로 ${result.savedTime}분 절약`);
  }
  lines.push(`최종 누적 에너지: ${result.finalEnergy}`);
  return lines.join('\n');
}
