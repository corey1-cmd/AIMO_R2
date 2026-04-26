/* ═══════════════════════════════════════════════════════════════
   engine.js — v3.1.0 AI Scheduler Adapter

   외부(UI)에는 기존 계약 그대로 제공:
     export { runAnalysis, BEHAVIOR_TYPES, BUCKET_LABELS }

   내부는 detnete-scheduler v3.1.0 사용:
     - tasks[] → "A 그리고 B 그리고 C" 자연어 입력으로 변환
     - analyze(text, {now, ...}) 호출
     - schedule.timeline → detente breakdown shape 으로 매핑
     - v3 가 파싱 실패하면 레거시 엔진(engine-legacy.js) 으로 폴백
   ═══════════════════════════════════════════════════════════════ */

import { uid } from './constants';
import { analyze } from './ai/analyze-v3.js';
import { runAnalysisLegacy } from './engine-legacy.js';

/* ── 기존 UI가 참조하는 상수 (그대로 유지) ── */
export const BEHAVIOR_TYPES = {
  ACTIVATION:  { label: "시작 행동",  icon: "⚡", color: "#4CAF50", order: 0 },
  MECHANICAL:  { label: "단순 실행",  icon: "⚙️", color: "#7B8EB8", order: 5 },
  COGNITIVE:   { label: "집중 사고",  icon: "🧠", color: "#9C5BB5", order: 3 },
  EVALUATIVE:  { label: "판단/평가",  icon: "🔍", color: "#D4956A", order: 4 },
};
export const BUCKET_LABELS = { MICRO: "마이크로", EXECUTION: "실행", DEEP: "딥워크" };

/* ── v3 L1 → detente 카테고리 매핑 ── */
const L1_CAT = {
  personal_care: "physical",
  hygiene: "physical",
  eating: "physical",
  household: "organize",
  food_prep: "physical",
  commute: "move",
  movement: "move",
  transportation: "move",
  exercise: "physical",
  sports: "physical",
  research: "create",
  writing_academic: "create",
  creative: "create",
  creative_work: "create",
  study: "organize",
  learning: "organize",
  reading: "organize",
  work: "digital",
  professional: "digital",
  meeting: "talk",
  communication: "talk",
  social: "talk",
  relationship: "talk",
  digital: "digital",
  tech: "digital",
  admin: "organize",
  finance: "organize",
  rest: "wait",
  leisure: "other",
  entertainment: "other",
  maintenance: "organize",
  errand: "move",
  medical: "wait",
  health: "physical",
};
function mapL1ToCategory(l1, l2) {
  if (L1_CAT[l1]) return L1_CAT[l1];
  if (l2 && L1_CAT[l2]) return L1_CAT[l2];
  return "other";
}

/* ── v3 태그 → 한국어 라벨 (주요 태그만 오버라이드, 나머지는 L3/태그 자체) ── */
const TAG_LABEL = {
  full_shower: "샤워", quick_shower: "간단 샤워",
  simple_meal: "식사 준비", yogurt_granola: "요거트/그래놀라",
  full_draft: "논문 초안 작성", paper_drafting: "논문 작성",
  email_batch: "이메일 처리", email_triage: "이메일 분류",
  regular_meeting: "정기 미팅", meeting_regular: "정기 미팅",
  brush_teeth: "양치",
  warmup: "워밍업",
  quick_nap: "짧은 낮잠",
  deep_clean: "대청소",
  light_clean: "가벼운 청소",
};
function tagToLabel(tag, l3) {
  if (TAG_LABEL[tag]) return TAG_LABEL[tag];
  // L3 기반 추정: paper_drafting → 논문 작성
  if (l3 && TAG_LABEL[l3]) return TAG_LABEL[l3];
  // Fallback: snake_case → 사람이 읽을 수 있게
  return String(tag).replace(/_/g, " ");
}

/* ── 행동 유형 추정 (v3의 baseEnergy, l1 기반) ── */
function inferBehaviorType(step) {
  const { l1, l2, baseEnergy = 0 } = step;

  // 평가/검토 성 활동
  if (["research", "study", "learning"].includes(l1) && baseEnergy >= 3) return "COGNITIVE";
  if (l2 && /writing|drafting|analysis|planning/.test(l2)) return "COGNITIVE";
  if (l1 === "writing_academic" || l1 === "creative") return "COGNITIVE";

  // 회의/대화
  if (l1 === "meeting" || l1 === "communication" || l1 === "social") return "EVALUATIVE";

  // 에너지 기반
  if (baseEnergy >= 3) return "COGNITIVE";
  if (baseEnergy <= 1) return "MECHANICAL";
  return "MECHANICAL";
}

/* ── 시간 버킷 (Simon 청킹과 동일 규칙) ── */
function assignBucket(min) {
  if (min <= 2) return "MICRO";
  if (min <= 7) return "EXECUTION";
  return "DEEP";
}
const LOAD_MAP = { MICRO: 1, EXECUTION: 2, DEEP: 3 };

/* ── Skinner-style decomposition template ──
   V3는 활동 하나를 단일 스텝으로 출력하지만 사용자는 "어디까지 했나"를 추적하려면
   세부 스텝이 필요하다. 레거시 엔진과 같은 철학으로 4-6단계로 쪼갬.
   
   tier 판정 기준 (에너지·지속시간 기반):
     simple  : baseEnergy ≤ 1 또는 시간 < 15분 → 3 sub-steps
     medium  : baseEnergy 2~3 또는 시간 15~60분 → 5 sub-steps
     hard    : baseEnergy ≥ 4 또는 시간 ≥ 60분 → 6 sub-steps
*/
const DECOMP_TEMPLATES = {
  COGNITIVE: {
    simple: [
      { s: "도구 열기",     bt: "ACTIVATION", fx: 0.5 },
      { s: "실행",          bt: "COGNITIVE",  f: 0.70 },
      { s: "마무리",        bt: "MECHANICAL", f: 0.30 },
    ],
    medium: [
      { s: "도구 열기",     bt: "ACTIVATION", fx: 0.5 },
      { s: "자료 훑기",     bt: "MECHANICAL", f: 0.15 },
      { s: "본 작업",       bt: "COGNITIVE",  f: 0.55 },
      { s: "검토·수정",     bt: "EVALUATIVE", f: 0.20 },
      { s: "저장·정리",     bt: "MECHANICAL", f: 0.10 },
    ],
    hard: [
      { s: "환경 준비",     bt: "ACTIVATION", fx: 0.5 },
      { s: "구조 파악",     bt: "EVALUATIVE", f: 0.12 },
      { s: "핵심 작업 1",   bt: "COGNITIVE",  f: 0.32 },
      { s: "핵심 작업 2",   bt: "COGNITIVE",  f: 0.30 },
      { s: "교차 검증",     bt: "EVALUATIVE", f: 0.16 },
      { s: "마무리",        bt: "MECHANICAL", f: 0.10 },
    ],
  },
  MECHANICAL: {
    simple: [
      { s: "준비",          bt: "ACTIVATION", fx: 0.5 },
      { s: "실행",          bt: "MECHANICAL", f: 0.75 },
      { s: "확인",          bt: "EVALUATIVE", f: 0.25 },
    ],
    medium: [
      { s: "준비물 모으기", bt: "ACTIVATION", fx: 0.5 },
      { s: "분류·정렬",     bt: "MECHANICAL", f: 0.20 },
      { s: "본 실행",       bt: "MECHANICAL", f: 0.55 },
      { s: "점검",          bt: "EVALUATIVE", f: 0.15 },
      { s: "정리",          bt: "MECHANICAL", f: 0.10 },
    ],
    hard: [
      { s: "범위 확인",     bt: "ACTIVATION", fx: 0.5 },
      { s: "순서 계획",     bt: "EVALUATIVE", f: 0.10 },
      { s: "1단계",         bt: "MECHANICAL", f: 0.28 },
      { s: "2단계",         bt: "MECHANICAL", f: 0.26 },
      { s: "3단계",         bt: "MECHANICAL", f: 0.22 },
      { s: "검수·정리",     bt: "EVALUATIVE", f: 0.14 },
    ],
  },
  EVALUATIVE: {
    simple: [
      { s: "자료 열기",     bt: "ACTIVATION", fx: 0.5 },
      { s: "살펴보기",      bt: "EVALUATIVE", f: 0.45 },
      { s: "판단·결정",     bt: "EVALUATIVE", f: 0.35 },
      { s: "기록",          bt: "MECHANICAL", f: 0.20 },
    ],
    medium: [
      { s: "자료 열기",     bt: "ACTIVATION", fx: 0.5 },
      { s: "데이터 확인",   bt: "MECHANICAL", f: 0.25 },
      { s: "비교·분석",     bt: "EVALUATIVE", f: 0.35 },
      { s: "결론 도출",     bt: "EVALUATIVE", f: 0.25 },
      { s: "문서화",        bt: "MECHANICAL", f: 0.15 },
    ],
    hard: [
      { s: "환경 세팅",     bt: "ACTIVATION", fx: 0.5 },
      { s: "데이터 수집",   bt: "MECHANICAL", f: 0.12 },
      { s: "기준 정의",     bt: "EVALUATIVE", f: 0.12 },
      { s: "1차 분석",      bt: "COGNITIVE",  f: 0.28 },
      { s: "2차 분석",      bt: "COGNITIVE",  f: 0.26 },
      { s: "결과 종합",     bt: "EVALUATIVE", f: 0.15 },
      { s: "요약 작성",     bt: "MECHANICAL", f: 0.07 },
    ],
  },
};

function pickTier(step) {
  const e = step.baseEnergy ?? 2;
  const t = step.actFinal ?? step.baseAct ?? 30;
  if (e <= 1 || t < 15) return "simple";
  if (e >= 4 || t >= 60) return "hard";
  return "medium";
}

/* ── v3 step → detente breakdown items (복수 sub-step) ── */
function v3StepToActions(step, startOrder, parentTitle) {
  const totalMin = step.actFinal ?? step.baseAct ?? 1;
  const tagLabel = tagToLabel(step.tag, step.l3);
  const parent = parentTitle || tagLabel;

  const btBase = inferBehaviorType(step);
  const tier = pickTier(step);
  const tmpl = (DECOMP_TEMPLATES[btBase] || DECOMP_TEMPLATES.COGNITIVE)[tier];

  const actions = [];
  let order = startOrder;
  for (const s of tmpl) {
    let minutes;
    if (s.fx != null) minutes = s.fx;
    else minutes = Math.round(totalMin * s.f * 10) / 10;
    minutes = Math.max(0.5, minutes);

    const bucket = assignBucket(minutes);
    actions.push({
      id: uid(),
      parentTitle: parent,
      title: `${parent} — ${s.s}`,
      shortTitle: s.s,
      estimatedMin: minutes,
      category: mapL1ToCategory(step.l1, step.l2),
      behaviorType: s.bt,
      timeBucket: bucket,
      cognitiveLoad: LOAD_MAP[bucket],
      rewardScore: Math.round((1 / Math.max(0.5, minutes)) * 100) / 100,
      difficulty: Math.min(10, Math.max(1, Math.round((step.baseEnergy ?? 2) * 2))),
      energy: Math.min(5, Math.max(1, Math.round(step.baseEnergy ?? 2))),
      order: order++,
      isMarker: false,
      v3: {
        tag: step.tag,
        // clockTime은 첫 번째 sub-step에만 붙임 (실제 시작 시각)
        clockTime: actions.length === 0 ? step.clockTime : undefined,
        isFixed: !!step.isFixed && actions.length === 0,
        energyMultiplier: step.energyMultiplier ?? 1,
        isRecovery: !!step.isRecovery,
      },
    });
  }
  return actions;
}

/* ── 현재 시각을 HH:MM 문자열로 ── */
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════════════════
   메인 파이프라인
   ══════════════════════════════════════════════════════════ */
/* ── V3 매칭 불완전 판정 ──
   두 가지 검사:
     (a) V3가 아예 못 잡거나 파싱 안됨
     (b) 입력에 '서술어성 키워드'(정산/풀이/응원/하기 등)가 포함되어 있는데
         V3가 그쪽을 빼고 앞쪽 명사만 잡은 경우 → 레거시가 더 정확함
   
   V3 taxonomy는 활동-물체 중심이라 서술어(~하기, 정산, 풀이, 응원) 의미를 못 살림.
   이런 단어가 입력 뒷부분에 있으면 레거시의 우측 우선 매칭이 낫다. */
const LEGACY_PREFERRED_SUFFIXES = [
  "하기", "응원", "격려", "정산", "결제", "풀이", "문의",
  "부탁", "요청", "보내기", "알리기", "말하기", "읽기", "쓰기", "만들기",
];

function isV3MatchSufficient(inputText, v3Detail) {
  if (!v3Detail || !v3Detail.matched || !v3Detail.l4) return false;

  // 서술어성 키워드가 입력에 있으면 V3 결과 믿지 않음
  for (const suffix of LEGACY_PREFERRED_SUFFIXES) {
    if (inputText.includes(suffix)) return false;
  }
  return true;
}

/* ══════════════════════════════════════════════════════════
   메인 파이프라인 (하이브리드)
   
   각 태스크를 독립적으로 처리:
     1) V3 단독 파싱 시도
     2) 매칭 충분(coverage ≥ 0.7)하면 V3 스케줄 사용
     3) 불충분·미인식이면 레거시 엔진으로 해당 태스크만 분해
   
   최종 결과는 모든 태스크의 breakdown을 이어붙임
   ══════════════════════════════════════════════════════════ */
export function runAnalysis(tasks, learningData) {
  const valid = tasks.filter(t => t.title && t.title.trim());
  if (!valid.length) {
    return { breakdown: [], analyses: [], totalEstMin: 0, totalReward: 0, totalCost: 0 };
  }

  // ── Phase A: 태스크별 V3 선행 판정 ──
  // V3 장점: 전공·생활 활동 인식, 시간 baseAct, 의존성 추론
  // V3 약점: 서술어/합성어 (응원하기, 정산, 풀이)
  const taskPlans = valid.map(t => {
    const title = t.title.trim();
    let detail = null;
    try {
      const parse = analyze(title, { now: nowHHMM(), optimize: false, strictTimeEnforcement: false });
      detail = (parse.parsedDetails || [])[0] || null;
    } catch (e) {
      console.warn(`[engine] parse error on "${title}":`, e?.message);
    }
    let useV3 = isV3MatchSufficient(title, detail);

    // ★ 고정시간 강제 승격: 
    // 고정시간 지정한 태스크는 반드시 V3로 보내야 anchor가 지켜짐.
    // V3 매칭이 약해도 'appointment' 태그를 임시로 빌려서 V3 경로로 유지.
    let forcedFallbackTag = null;
    if (t.hasFixed && t.fixedTime && !useV3) {
      useV3 = true;
      forcedFallbackTag = 'appointment';
    }
    return { task: t, title, v3Detail: detail, useV3, forcedFallbackTag };
  });

  // ── Phase B: V3에 넘길 태스크만 묶어서 다시 스케줄링 (fixedEvents 포함) ──
  const v3Tasks = taskPlans.filter(p => p.useV3);
  const legacyTasks = taskPlans.filter(p => !p.useV3);

  let v3Result = null;
  let v3DroppedAnchors = [];
  if (v3Tasks.length > 0) {
    // 강제 승격된 태스크는 원본 텍스트 대신 fallback 태그 이름으로 대체 (V3가 파싱 가능)
    const v3Text = v3Tasks.map(p => {
      if (p.forcedFallbackTag) return '약속';  // appointment 에 매핑되는 한국어
      return p.title;
    }).join(" 그리고 ");

    const fixedEvents = [];
    for (const p of v3Tasks) {
      if (p.task.hasFixed && p.task.fixedTime) {
        const anchorTag = p.forcedFallbackTag || p.v3Detail?.l4;
        if (anchorTag) fixedEvents.push({ tag: anchorTag, startAt: p.task.fixedTime });
      }
    }
    try {
      v3Result = analyze(v3Text, {
        now: nowHHMM(),
        inferMissing: true,
        optimize: true,
        strictTimeEnforcement: false,
        fixedEvents: fixedEvents.length > 0 ? fixedEvents : undefined,
      });
      v3DroppedAnchors = v3Result?.schedule?.droppedAnchors || [];
    } catch (e) {
      console.warn("[engine] v3 batch analyze threw:", e?.message);
      // V3 실패 시 해당 태스크들도 레거시로 강등
      v3Result = null;
      legacyTasks.push(...v3Tasks);
    }
  }

  // ── Phase C: breakdown 조립 ──
  const breakdown = [];
  const analyses = [];
  let orderCounter = 0;

  // V3가 돌린 태스크들의 steps 추가
  if (v3Result?.schedule?.timeline) {
    // 태그 → 원본 사용자 제목 매핑.
    // forcedFallback 이면 appointment 태그가 사용자의 원 제목으로 매핑되어야 함.
    const tagToTitle = new Map();
    v3Tasks.forEach(p => {
      const tag = p.forcedFallbackTag || p.v3Detail?.l4;
      if (tag) tagToTitle.set(tag, p.title);
    });

    const realSteps = v3Result.schedule.timeline.filter(s => s.tag && !String(s.tag).startsWith("__"));
    realSteps.forEach(step => {
      const parent = tagToTitle.get(step.tag) || tagToLabel(step.l3 || step.tag);
      const subActions = v3StepToActions(step, orderCounter, parent);
      breakdown.push(...subActions);
      orderCounter += subActions.length;
    });

    // V3 태스크의 analysis 메타
    v3Tasks.forEach(p => {
      const effectiveTag = p.forcedFallbackTag || p.v3Detail?.l4;
      const matched = realSteps.filter(s => s.tag === effectiveTag);
      const avgE = matched.length ? matched.reduce((a, s) => a + (s.baseEnergy || 0), 0) / matched.length : 2;
      const c = Math.min(10, Math.max(1, Math.round(avgE * 2.5)));
      analyses.push({
        title: p.title,
        type: inferBehaviorType(matched[0] || { baseEnergy: avgE }),
        complexity: c,
        tier: c <= 4 ? "simple" : c <= 7 ? "medium" : "hard",
        domain: mapL1ToCategory(matched[0]?.l1, matched[0]?.l2),
        source: p.forcedFallbackTag ? "v3-fallback" : "v3",
      });
    });
  }

  // 레거시 태스크들 분해
  if (legacyTasks.length > 0) {
    const legacyInput = legacyTasks.map(p => ({ title: p.title, estimatedMin: p.task.estimatedMin }));
    const legacyResult = runAnalysisLegacy(legacyInput, learningData);
    // 순서 재번호 + breakdown 이어 붙이기 (마커는 제거)
    legacyResult.breakdown
      .filter(b => !b.isMarker)
      .forEach(b => {
        breakdown.push({ ...b, order: orderCounter++ });
      });
    (legacyResult.analyses || []).forEach(a => analyses.push({ ...a, source: "legacy" }));
  }

  // ── Phase D: 전부 실패하면 completely legacy로 폴백 ──
  if (breakdown.length === 0) {
    console.info("[engine] both engines produced no steps, using full-legacy");
    return runAnalysisLegacy(valid, learningData);
  }

  const totalEstMin = breakdown.reduce((s, b) => s + b.estimatedMin, 0);
  const totalReward = breakdown.reduce((s, b) => s + (b.rewardScore || 0), 0);
  const totalCost = breakdown.reduce((s, b) => s + (b.cognitiveLoad || 0), 0);

  return {
    breakdown,
    analyses,
    totalEstMin,
    totalReward,
    totalCost,
    v3: {
      engineVersion: "3.1.0",
      hybrid: { v3Count: v3Tasks.length, legacyCount: legacyTasks.length },
      parsed: v3Result?.parsed || [],
      unmatched: v3Result?.unmatched || [],
      inferred: v3Result?.inferred || [],
      finalEnergy: v3Result?.schedule?.finalEnergy,
      droppedAnchors: v3DroppedAnchors,
      summary: v3Result?.summary,
    },
  };
}
