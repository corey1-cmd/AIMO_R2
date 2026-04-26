/* ═══════════════════════════════════════════════════════════════
   analyze-v3.js — 통합 분석 파이프라인 (TimeContext-enabled)

   Public API:
     analyze(text, opts)              — 기존 복수 태스크 스케줄링 (변경 없음)
     analyzeSingle(input)             — 신규. 단일 입력 분석 (3-layer 파이프라인)
     replan(prevResult, newNow, ...)  — Task 1 (H4)
     filterExpiredAnchors(...)        — Task 2

   analyzeSingle()의 파이프라인 (patch-v5):
     ① prefilter       → NEEDS_CONTEXT 면 즉시 리턴
     ② parser probe    → 5단계 매칭 레벨 관측
     ③ coherence       → L3_partial 가드 + L1_HINTS 검증
     ④ confidence      → 레벨·coherence 기반 점수 산출
     ⑤ legacy_bridge   → coherence 실패 시 폴백
   ═══════════════════════════════════════════════════════════════ */

import { parseInput } from './parser-v3.js';
import { analyzeDependencies } from './dependency-engine.js';
import { schedule, formatSchedule } from './scheduler.js';
import { TimeContext, TimeRegressionError, parseTime, nowContext } from './time-contract.js';
import { L4_DB, L3_META, L2_META } from './types-v3.js';

import { prefilter } from './layers/prefilter.js';
import { validateCoherence } from './layers/coherence.js';
import { scoreMatch, statusFromConfidence } from './layers/confidence.js';
import { legacyBridge, validateBridge } from './layers/legacy_fallback.js';

// ─── 기동 시 bridge 유효성 검증 ─────────────────────────────────
const _bridgeIssues = validateBridge();
if (_bridgeIssues.length > 0) {
  console.error('[legacy_bridge] 유효하지 않은 target_l2:', _bridgeIssues);
}

// ─── 매칭 레벨 관측을 위한 내부 인덱스 (parser-v3 과 동일 로직) ───
const L3_BY_KOREAN = new Map();
for (const [l3code, meta] of Object.entries(L3_META)) {
  if (!meta.name) continue;
  const cleaned = meta.name.replace(/\([^)]+\)/g, '').trim();
  for (const p of cleaned.split(/[·,/]/).map(s => s.trim()).filter(Boolean)) {
    if (!L3_BY_KOREAN.has(p)) L3_BY_KOREAN.set(p, l3code);
  }
}
const L2_BY_KOREAN = new Map();
for (const [l2code, meta] of Object.entries(L2_META)) {
  if (!meta.name) continue;
  const cleaned = meta.name.replace(/\([^)]+\)/g, '').trim();
  for (const p of cleaned.split(/[·,/]/).map(s => s.trim()).filter(Boolean)) {
    if (!L2_BY_KOREAN.has(p)) L2_BY_KOREAN.set(p, l2code);
  }
}

// parser-v3 의 SYNONYMS 를 정적 import 로는 가져올 수 없으므로 (파일 내 const)
// 이 probe 는 parseInput 호출 후 매칭된 l4 의 L1 을 그대로 사용한다.
// "매칭 레벨" 은 normalized 텍스트를 다시 한 번 조회하여 추정한다.

function normalizeKoreanLite(text) {
  let t = String(text || '').trim();
  const suffixes = [
    /하고\s*싶[어다]$/, /하고\s*싶$/,
    /(할래|할게|하자|하지|해야지|해야|해야됨|해야 됨)$/,
    /(하기|하고|한다|해서|하러|하면서|해도|해야)$/,
    /(시키기|시키고|시켜)$/,
    /(을|를|이|가|은|는|에서|에|의|로|으로|도|만|까지|부터)$/,
  ];
  let prev;
  do {
    prev = t;
    for (const rx of suffixes) t = t.replace(rx, '').trim();
  } while (prev !== t);
  return t;
}

/**
 * 파서 결과에 매칭 레벨을 덧붙여 반환합니다.
 * parser-v3 에 직접 래스 필드를 추가하지 않고, 여기서 추론하는 방식입니다.
 */
function inferMatchLevel(originalInput, parserDetail) {
  if (!parserDetail || !parserDetail.matched || !parserDetail.l4) {
    return null; // unmatched
  }

  const normalized = normalizeKoreanLite(originalInput);
  const l4tag = parserDetail.l4;
  const l3code = parserDetail.l3;

  // L4 direct: normalized 가 L4 tag 와 완전 일치
  if (L4_DB[normalized] && normalized === l4tag) {
    return 'L4_direct';
  }

  // L3 exact: normalized 가 해당 L3 의 한국어 이름과 완전 일치
  if (L3_BY_KOREAN.has(normalized) && L3_BY_KOREAN.get(normalized) === l3code) {
    return 'L3_exact';
  }

  // L3 partial: normalized 가 해당 L3 의 이름 일부를 포함 (정확 일치 아님)
  const l3meta = L3_META[l3code];
  if (l3meta && l3meta.name) {
    const l3NameParts = l3meta.name.replace(/\([^)]+\)/g, '').trim().split(/[·,/]/).map(s => s.trim()).filter(Boolean);
    for (const part of l3NameParts) {
      if (normalized.includes(part) && normalized !== part) {
        return 'L3_partial';
      }
    }
  }

  // SYNONYMS 또는 기타 루트 — parser 내부에서 결정된 것
  return 'SYNONYMS';
}

function resolveContext(opts) {
  if (opts.timeCtx instanceof TimeContext) return opts.timeCtx;
  if (opts.now != null) return new TimeContext({ now: parseTime(opts.now), source: 'opts.now' });
  if (opts.currentTime != null) {
    return new TimeContext({ now: parseTime(opts.currentTime), source: 'opts.currentTime' });
  }
  return null;
}

export function filterExpiredAnchors(anchors, ctx, { runningTask = null } = {}) {
  if (!ctx) return { kept: anchors, dropped: [] };
  const kept = [];
  const dropped = [];
  const seenAtMinute = new Set();
  const runningEndsAt = runningTask?.endsAt ?? null;

  for (const a of anchors) {
    const fixedAt = typeof a.startAt === 'string' ? parseTime(a.startAt) : a.fixedAt ?? a.startAt;

    if (fixedAt < ctx.now) {
      dropped.push({ tag: a.tag, fixedAt, reason: 'STRICT_PAST', category: 'expired' });
      continue;
    }
    if (runningEndsAt != null && fixedAt < runningEndsAt) {
      dropped.push({
        tag: a.tag, fixedAt, reason: 'OVERLAPPED_BY_RUNNING',
        category: 'expired', runningEndsAt,
      });
      continue;
    }
    if (seenAtMinute.has(fixedAt)) {
      dropped.push({
        tag: a.tag, fixedAt, reason: 'COLLAPSED_AFTER_DELAY', category: 'expired',
      });
      continue;
    }
    seenAtMinute.add(fixedAt);
    kept.push(a);
  }
  return { kept, dropped };
}

export function analyze(text, opts = {}) {
  const { weights = {}, inferMissing = true, optimize = true } = opts;

  const parsed = parseInput(text);
  if (parsed.tags.length === 0) {
    return {
      input: text,
      error: 'No activities recognized',
      unmatched: parsed.unmatched,
    };
  }

  const dep = analyzeDependencies(parsed.tags, {
    inferMissing,
    respectInputOrder: !optimize,
    companionState: opts.companionState || null,
    currentHour: opts.currentHour ?? null,
    recoveryThresholds: opts.recoveryThresholds || {},
  });

  const p8Map = new Map();
  for (const w of (dep.emotionalWarnings || [])) {
    if (w.affectedTag && w.multiplierSuggestion && w.multiplierSuggestion !== 1.0) {
      p8Map.set(w.affectedTag, w.multiplierSuggestion);
    }
  }

  const ctx = resolveContext(opts);
  const inputAnchors = opts.fixedEvents || [];
  const { kept: keptAnchors, dropped: prefilterDropped } = filterExpiredAnchors(
    inputAnchors, ctx, { runningTask: opts.runningTask }
  );

  const sched = schedule(dep.ordered, {
    weights, reorder: true,
    timeCtx: ctx,
    currentTime: ctx ? null : (opts.currentTime || null),
    fixedEvents: keptAnchors,
    emotionalAdjustments: p8Map.size > 0 ? p8Map : null,
    interruptions: opts.interruptions || [],
    runningTask: opts.runningTask || null,
    strictTimeEnforcement: opts.strictTimeEnforcement !== false,
  });

  const allDroppedAnchors = [...prefilterDropped, ...(sched.droppedAnchors || [])];

  return {
    input: text,
    parsed: parsed.tags,
    parsedDetails: parsed.details,
    unmatched: parsed.unmatched,
    inferred: dep.inferred,
    finalOrder: dep.ordered.map(o => o.tag),
    dependencies: dep.depSummary,
    constraints: dep.constraints,
    periodicSuggestions: dep.periodicSuggestions,
    emotionalWarnings: dep.emotionalWarnings,
    recoverySuggestions: dep.recoverySuggestions,
    schedule: { ...sched, droppedAnchors: allDroppedAnchors },
    summary: formatSchedule(sched),
    ctx,
    _originalOpts: opts,
  };
}

/**
 * 단일 입력 분석 — 3-layer 파이프라인 (patch-v5 신규).
 *
 * @param {string} rawInput - 사용자 원본 입력
 * @param {object} opts - { baseline: boolean } — baseline 모드는 파서 원본만 실행
 * @returns {object} {
 *   status: 'MATCHED' | 'INFERRED' | 'UNPARSED' | 'NEEDS_CONTEXT',
 *   l1, l2?, l3?, l4?, tag?, confidence, source?, hint?, reason?
 * }
 */
export function analyzeSingle(rawInput, opts = {}) {
  const { baseline = false } = opts;

  // ─── Layer 1: Pre-filter ───────────────────────────────────
  if (!baseline) {
    const pre = prefilter(rawInput);
    if (pre.status === 'NEEDS_CONTEXT') {
      return {
        status: 'NEEDS_CONTEXT',
        confidence: 0,
        reason: pre.reason,
        hint: pre.hint,
        source: 'prefilter',
      };
    }
  }

  // ─── Layer 2: V3 파서 호출 (단일 태스크 모드) ─────────────
  let parserResult;
  try {
    parserResult = parseInput(rawInput);
  } catch (e) {
    return { status: 'UNPARSED', confidence: 0, reason: 'parser_error', error: String(e) };
  }

  const detail = parserResult.details?.[0] || null;

  // 파서가 전혀 매칭 못함
  if (!detail || !detail.matched) {
    if (!baseline) {
      const bridged = legacyBridge(rawInput);
      if (bridged) return bridged;
    }
    return {
      status: 'UNPARSED',
      confidence: 0,
      reason: 'no_match',
      source: 'parser',
    };
  }

  // 매칭 레벨 추론 + L4 기반 L1/L4 복원
  const matchLevel = inferMatchLevel(rawInput, detail);
  const l4entry = detail.l4 ? L4_DB[detail.l4] : null;
  const match = {
    level: matchLevel,
    l3: detail.l3,
    l4: detail.l4,
    tag: detail.l4,
    l1: l4entry?.l1 || null,
    l2: l4entry?.l2 || null,
  };

  // baseline 모드: 레이어 건너뛰고 파서 결과만 반환
  if (baseline) {
    return {
      status: match.l1 ? 'MATCHED' : 'UNPARSED',
      confidence: match.l1 ? 1.0 : 0,
      l1: match.l1, l2: match.l2, l3: match.l3, l4: match.l4, tag: match.tag,
      level: match.level,
      source: 'parser_baseline',
    };
  }

  // ─── Layer 3: Coherence Validator ────────────────────────
  const coherence = validateCoherence(rawInput, match);

  if (!coherence.ok) {
    // Coherence 실패 → legacy_bridge 시도
    const bridged = legacyBridge(rawInput);
    if (bridged) return bridged;

    // bridge 에도 없으면 UNPARSED
    return {
      status: 'UNPARSED',
      confidence: 0,
      reason: coherence.reason,
      layer: coherence.layer,
      source: 'coherence_fail',
      // 디버깅 정보: 파서가 뭘 반환하려 했는지
      rejected_match: { l1: match.l1, l3: match.l3, l4: match.l4, level: match.level },
    };
  }

  // ─── Layer 4: Confidence Scoring ─────────────────────────
  const confidence = scoreMatch(match, coherence, rawInput);
  const status = statusFromConfidence(confidence);

  // Confidence 가 너무 낮으면 (UNPARSED threshold 아래) bridge 시도
  if (status === 'UNPARSED') {
    const bridged = legacyBridge(rawInput);
    if (bridged) return bridged;
  }

  return {
    status,
    confidence,
    l1: match.l1,
    l2: match.l2,
    l3: match.l3,
    l4: match.l4,
    tag: match.tag,
    level: match.level,
    source: 'parser_v3',
  };
}

export function replan(prevResult, newNow, optsDelta = {}) {
  if (!prevResult || !prevResult.ctx) {
    throw new TimeRegressionError('REPLAN_REQUIRES_CTX', {
      msg: 'Previous result has no TimeContext; cannot enforce H4',
    });
  }
  const newCtx = prevResult.ctx.advance({
    now: parseTime(newNow),
    source: optsDelta._source || 'replan',
  });
  const merged = { ...(prevResult._originalOpts || {}), ...optsDelta, timeCtx: newCtx };
  return analyze(prevResult.input, merged);
}

export { TimeContext, TimeRegressionError, nowContext };
