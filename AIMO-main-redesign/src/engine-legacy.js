/* ═══════════════════════════════════════════════════════════════
   engine.js — ★ Behavioral Execution Engine
   Skinner (강화 기반 분해) + Simon (제한적 합리성 청킹)

   ★ AI 모델을 수정할 때 이 파일만 수정하면 됩니다.
   
   파이프라인:
   1) 키워드 인식 → 행동유형·복잡도·에너지 추출
   2) 복잡도 tier → 템플릿 선택 → 세부 활동 분해
   3) Simon 제약: 20분 초과 시 재귀 분할
   4) Skinner 제약: ACTIVATION 행동 삽입 + 진행 마커
   5) 시간 배분 (학습 보정 포함)
   6) Quick-Win 다목적 최적화 순서 배치
   7) 비용 함수: cognitive_cost + transition_cost

   ── 외부 인터페이스 ──
   export { runAnalysis, BEHAVIOR_TYPES, BUCKET_LABELS }

   runAnalysis(tasks, learningData) → {
     breakdown: Action[],
     analyses: Analysis[],
     totalEstMin: number,
     totalReward: number,
     totalCost: number,
   }
   ═══════════════════════════════════════════════════════════════ */

import { uid, clamp } from './constants';
import keywordsData from './data/keywords.json';
import aliasesData from './data/aliases.json';

/* ── JSON → 런타임 룩업 테이블 ──
   keywords.json: 주 키워드 → {type, complexity, energy, domain, baseMin, weight}
   aliases.json:  동의어 → 주 키워드 (속성 상속)
   _ 로 시작하는 주석 섹션 제거 */
const KW_PRIMARY = Object.fromEntries(
  Object.entries(keywordsData.keywords).filter(([k]) => !k.startsWith('_'))
);
const ALIASES = Object.fromEntries(
  Object.entries(aliasesData.aliases).filter(([k]) => !k.startsWith('_'))
);

/** 주 키워드 또는 동의어 → 속성 객체 (없으면 null) */
function lookupKeyword(word) {
  if (KW_PRIMARY[word]) return { ...KW_PRIMARY[word], keyword: word };
  const primary = ALIASES[word];
  if (primary && KW_PRIMARY[primary]) {
    return { ...KW_PRIMARY[primary], keyword: primary, matchedVia: word };
  }
  return null;
}

/** 전체 키워드 리스트 (주+동의어) — 문자열 스캔용 */
const ALL_TOKENS = [
  ...Object.keys(KW_PRIMARY),
  ...Object.keys(ALIASES),
].sort((a, b) => b.length - a.length); // 긴 토큰 우선 (maximal match)

/* ══════════════════════════════════════════════════════════
   휴리스틱 POS 태거
   
   한국어 "할 일 제목" 수준에서 품사를 어림짐작.
   형태소 분석기 없이 패턴 + 소규모 어휘로 80% 커버.
   ══════════════════════════════════════════════════════════ */

// 명사화 접미사 (가중치 매우 낮음)
const NOMINALIZERS = new Set([
  '것', '거', '일', '업무', '작업', '활동',
]);

// 확실한 "동사성 명사"(행위 명사) — JSON 에서 weight ≥ 0.8 인 주 키워드 전체
const ACTION_NOUNS = new Set(
  Object.entries(KW_PRIMARY)
    .filter(([k, v]) => v.weight >= 0.8 && !NOMINALIZERS.has(k))
    .map(([k]) => k)
);

/**
 * 휴리스틱 품사 가중치 (브라우저 친화, 외부 의존성 0)
 * 
 * 규칙:
 *   1. 단어 끝이 '기/하기/되기' → 동사 명사화 (verb_nominal, 0.8)
 *   2. 단어가 '하다/되다' 어간(작성/개발 등 ACTION_NOUNS) → 행위명사 (0.8)
 *   3. NOMINALIZERS (것/일/업무) → 접미사 (0.2)
 *   4. 그 외 명사 → 기본 (0.5)
 * 
 * 반환: 0.2 ~ 1.0
 */
function posWeight(word) {
  if (NOMINALIZERS.has(word)) return 0.2;
  // '응원하기', '격려하기' 같은 명사+하기 복합 → 뒤쪽 '하기' 해석
  if (/하기$|되기$/.test(word) && word.length > 2) return 0.8;
  if (ACTION_NOUNS.has(word)) return 0.8;
  // 짧은 한자어 명사는 보통 행위명사 가능성 (정산/풀이/검수 등)
  if (word.length >= 2 && word.length <= 3) return 0.6;
  return 0.5;
}

/* ── Constants ────────────────────────────────────────── */
const MAX_CHUNK_TIME = 20;
const LOAD_MAP = { MICRO: 1, EXECUTION: 2, DEEP: 3 };

export const BEHAVIOR_TYPES = {
  ACTIVATION:  { label: "시작 행동",  icon: "⚡", color: "#4CAF50", order: 0 },
  MECHANICAL:  { label: "단순 실행",  icon: "⚙️", color: "#7B8EB8", order: 5 },
  COGNITIVE:   { label: "집중 사고",  icon: "🧠", color: "#9C5BB5", order: 3 },
  EVALUATIVE:  { label: "판단/평가",  icon: "🔍", color: "#D4956A", order: 4 },
};

export const BUCKET_LABELS = { MICRO: "마이크로", EXECUTION: "실행", DEEP: "딥워크" };

function assignBucket(min) {
  if (min <= 2) return "MICRO";
  if (min <= 7) return "EXECUTION";
  if (min <= 20) return "DEEP";
  return "DEEP";
}


/* ══════════════════════════════════════════════════════════
   세부 활동 분해 템플릿
   행동유형 × 복잡도 tier(simple/medium/hard)
   s=접미사, f=비율(0이면 fixed), fx=고정시간, bt=행동유형
   ══════════════════════════════════════════════════════════ */
const TMPL = {
  COGNITIVE: {
    simple: [
      { s:"도구/문서 열기",      f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"핵심 작업 실행",      f:.60,       bt:"COGNITIVE"  },
      { s:"결과 확인",           f:.25,       bt:"EVALUATIVE" },
      { s:"저장/마무리",         f:.15,       bt:"MECHANICAL" },
    ],
    medium: [
      { s:"도구/문서 열기",      f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"기존 자료 훑어보기",  f:.10,       bt:"MECHANICAL" },
      { s:"접근 방식 구상",      f:.10,       bt:"EVALUATIVE" },
      { s:"핵심 작업 1단계",     f:.30,       bt:"COGNITIVE"  },
      { s:"핵심 작업 2단계",     f:.25,       bt:"COGNITIVE"  },
      { s:"검토 및 수정",        f:.15,       bt:"EVALUATIVE" },
      { s:"최종 정리",           f:.10,       bt:"MECHANICAL" },
    ],
    hard: [
      { s:"작업 환경 열기",      f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"요구사항 파악",       f:.08,       bt:"MECHANICAL" },
      { s:"구조 분석",           f:.10,       bt:"EVALUATIVE" },
      { s:"접근 설계",           f:.10,       bt:"EVALUATIVE" },
      { s:"핵심 블록 1",         f:.22,       bt:"COGNITIVE"  },
      { s:"핵심 블록 2",         f:.20,       bt:"COGNITIVE"  },
      { s:"보조 블록",           f:.12,       bt:"COGNITIVE"  },
      { s:"교차 검증",           f:.10,       bt:"EVALUATIVE" },
      { s:"서식 정리/제출",      f:.08,       bt:"MECHANICAL" },
    ],
  },
  MECHANICAL: {
    simple: [
      { s:"작업 시작",           f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"실행",               f:.70,       bt:"MECHANICAL" },
      { s:"완료 확인",           f:.30,       bt:"EVALUATIVE" },
    ],
    medium: [
      { s:"준비물 모으기",       f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"분류/정렬",           f:.20,       bt:"MECHANICAL" },
      { s:"본 작업 실행",        f:.50,       bt:"MECHANICAL" },
      { s:"결과 점검",           f:.20,       bt:"EVALUATIVE" },
      { s:"정리/보관",           f:.10,       bt:"MECHANICAL" },
    ],
    hard: [
      { s:"범위 확인",           f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"순서 계획",           f:.10,       bt:"EVALUATIVE" },
      { s:"1단계 실행",          f:.25,       bt:"MECHANICAL" },
      { s:"2단계 실행",          f:.25,       bt:"MECHANICAL" },
      { s:"3단계 실행",          f:.20,       bt:"MECHANICAL" },
      { s:"전체 검수",           f:.12,       bt:"EVALUATIVE" },
      { s:"마무리 정리",         f:.08,       bt:"MECHANICAL" },
    ],
  },
  EVALUATIVE: {
    simple: [
      { s:"참고자료 열기",       f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"데이터 살펴보기",     f:.40,       bt:"EVALUATIVE" },
      { s:"판단/결정",           f:.35,       bt:"EVALUATIVE" },
      { s:"결과 기록",           f:.25,       bt:"MECHANICAL" },
    ],
    medium: [
      { s:"자료 열기",           f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"출처 A 확인",         f:.15,       bt:"MECHANICAL" },
      { s:"출처 B 확인",         f:.15,       bt:"MECHANICAL" },
      { s:"비교/대조",           f:.30,       bt:"EVALUATIVE" },
      { s:"결론 도출",           f:.25,       bt:"EVALUATIVE" },
      { s:"결과 문서화",         f:.15,       bt:"MECHANICAL" },
    ],
    hard: [
      { s:"환경 세팅",           f:0, fx:0.5, bt:"ACTIVATION" },
      { s:"입력 데이터 수집",    f:.10,       bt:"MECHANICAL" },
      { s:"평가 기준 정의",      f:.10,       bt:"EVALUATIVE" },
      { s:"심층 분석 1차",       f:.20,       bt:"COGNITIVE"  },
      { s:"심층 분석 2차",       f:.20,       bt:"COGNITIVE"  },
      { s:"결과 종합",           f:.15,       bt:"EVALUATIVE" },
      { s:"결론 검증",           f:.15,       bt:"EVALUATIVE" },
      { s:"요약 작성",           f:.10,       bt:"MECHANICAL" },
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   태스크 분류
   ══════════════════════════════════════════════════════════ */
function classifyTask(title, estimatedMin) {
  // 세 가지 가중치를 결합한 점수 기반 매칭:
  //   1. positionScore: 오른쪽일수록 높음 (0.5~1.0) — 한국어 서술어 특성
  //   2. keywordWeight:  JSON 에 명시 (0.2~1.0)    — 서술어/행위/수식어 구분
  //   3. posWeight:      휴리스틱 POS               — 명사/동사/접미사 구분
  // 
  // score = positionScore × keywordWeight × posWeight
  //
  // 예) "커피 정산" (5자)
  //   "커피" pos=0: (0.5+0/5×0.5) × 0.3(weight) × 0.5(POS) = 0.075
  //   "정산" pos=3: (0.5+3/5×0.5) × 1.0(weight) × 0.8(POS) = 0.672  ← 선택
  
  const cleanTitle = title.trim();
  const len = cleanTitle.length;
  if (len === 0) {
    return { keyword: null, type: "COGNITIVE", complexity: 4, energy: 3, domain: "other", tier: "simple" };
  }

  // 전체 토큰 스캔 — 긴 토큰 우선 (ALL_TOKENS 는 이미 length desc 로 정렬됨)
  const matches = [];
  for (const token of ALL_TOKENS) {
    const pos = cleanTitle.lastIndexOf(token);
    if (pos < 0) continue;
    const info = lookupKeyword(token);
    if (!info) continue;

    const positionScore = 0.5 + (pos / Math.max(1, len)) * 0.5;   // 0.5 ~ 1.0
    const kwWeight = info.weight ?? 0.5;
    const pos_w = posWeight(token);
    const score = positionScore * kwWeight * pos_w;

    matches.push({ token, pos, info, score });
  }

  // 매칭 없으면 기본값
  if (matches.length === 0) {
    return { keyword: null, type: "COGNITIVE", complexity: 4, energy: 3, domain: "other", tier: "medium" };
  }

  // 최고점 매칭 선택 (동점이면 더 오른쪽에 있는 것)
  matches.sort((a, b) => (b.score - a.score) || (b.pos - a.pos));
  const winner = matches[0];
  const best = { ...winner.info };

  // estimatedMin 보정 (학습 데이터 반영)
  let c = best.complexity;
  if (estimatedMin > 120) c = Math.min(10, c + 2);
  else if (estimatedMin > 60) c = Math.min(10, c + 1);
  else if (estimatedMin < 10) c = Math.max(1, c - 1);

  const tier = c <= 4 ? "simple" : c <= 7 ? "medium" : "hard";
  return { ...best, complexity: c, tier };
}

/* ══════════════════════════════════════════════════════════
   Simon 제약: 20분 초과 청크 재귀 분할
   ══════════════════════════════════════════════════════════ */
function splitChunk(action, minutes) {
  if (minutes <= MAX_CHUNK_TIME) return [action];
  const nChunks = Math.ceil(minutes / 7);
  const chunkMin = Math.round((minutes / nChunks) * 10) / 10;
  const results = [];
  for (let i = 1; i <= nChunks; i++) {
    const bucket = assignBucket(chunkMin);
    results.push({
      ...action,
      id: uid(),
      shortTitle: `${action.shortTitle} (${i}/${nChunks})`,
      title: `${action.parentTitle} — ${action.shortTitle} (${i}/${nChunks})`,
      estimatedMin: Math.max(0.5, chunkMin),
      timeBucket: bucket,
      cognitiveLoad: LOAD_MAP[bucket],
      rewardScore: Math.round((1 / chunkMin) * 100) / 100,
    });
  }
  return results;
}

/* ══════════════════════════════════════════════════════════
   Skinner 제약: ACTIVATION 행동 자동 생성
   ══════════════════════════════════════════════════════════ */
function generateActivation(task, domain) {
  const PROMPTS = {
    COGNITIVE:  "도구/문서 열기",
    MECHANICAL: "준비물 모으기",
    EVALUATIVE: "참고자료 열기",
  };
  const suffix = PROMPTS[task.type] || "작업 환경 준비";
  return {
    id: uid(),
    parentTitle: task.title,
    title: `${task.title} — ${suffix}`,
    shortTitle: suffix,
    estimatedMin: 0.5,
    category: domain,
    behaviorType: "ACTIVATION",
    timeBucket: "MICRO",
    cognitiveLoad: 1,
    rewardScore: 2.0,
    difficulty: 1,
    energy: 1,
    order: 0,
    isMarker: false,
  };
}

/* ══════════════════════════════════════════════════════════
   Skinner 제약: 진행 마커
   ══════════════════════════════════════════════════════════ */
function makeMarker(count) {
  return {
    id: uid(),
    parentTitle: "__marker__",
    title: `✓ 진행 체크포인트 — ${count}개 완료`,
    shortTitle: `✓ ${count}개 완료`,
    estimatedMin: 0.5,
    category: "other",
    behaviorType: "ACTIVATION",
    timeBucket: "MICRO",
    cognitiveLoad: 1,
    rewardScore: 2.0,
    difficulty: 0,
    energy: 0,
    order: 0,
    isMarker: true,
  };
}

/* ══════════════════════════════════════════════════════════
   단일 태스크 분해
   ══════════════════════════════════════════════════════════ */
function decomposeTask(task, learningData) {
  const analysis = classifyTask(task.title, task.estimatedMin || 30);
  // 사용자가 estimatedMin을 직접 안 주면 키워드의 baseMin → 기본 30분 순으로 폴백.
  // 예: "커피 정산"은 KEYWORD_DB['정산'].baseMin=15가 먹어서 15분짜리로 분해된다.
  const baseMin = task.estimatedMin || analysis.baseMin || 30;
  const tmplGroup = TMPL[analysis.type] || TMPL.COGNITIVE;
  const tmpl = tmplGroup[analysis.tier] || tmplGroup.simple;

  let actions = [];
  for (const step of tmpl) {
    let minutes;
    if (step.fx != null && step.f === 0) {
      minutes = step.fx;
    } else {
      minutes = Math.round(baseMin * step.f);
    }

    const stepDomain = step.dom || analysis.domain;
    if (learningData && learningData[stepDomain] && learningData[stepDomain].count >= 2) {
      const ratio = learningData[stepDomain].totalActual / learningData[stepDomain].totalEst;
      minutes = Math.round(minutes * clamp(1 + (ratio - 1) * 0.5, 0.5, 2.0));
    }
    minutes = Math.max(0.5, minutes);

    const bucket = assignBucket(Math.min(minutes, MAX_CHUNK_TIME));
    const action = {
      id: uid(),
      parentTitle: task.title,
      title: `${task.title} — ${step.s}`,
      shortTitle: step.s,
      estimatedMin: minutes,
      category: step.dom || analysis.domain,
      behaviorType: step.bt,
      timeBucket: bucket,
      cognitiveLoad: LOAD_MAP[bucket],
      rewardScore: Math.round((1 / Math.max(0.5, minutes)) * 100) / 100,
      difficulty: analysis.complexity,
      energy: analysis.energy,
      order: 0,
      isMarker: false,
    };

    if (minutes > MAX_CHUNK_TIME) {
      actions.push(...splitChunk(action, minutes));
    } else {
      actions.push(action);
    }
  }

  if (actions.length > 0 && actions[0].behaviorType !== "ACTIVATION") {
    actions.unshift(generateActivation({ title: task.title, type: analysis.type }, analysis.domain));
  }

  return { actions, analysis };
}

/* ══════════════════════════════════════════════════════════
   비용 함수
   ══════════════════════════════════════════════════════════ */
function transitionCost(prev, curr) {
  let cost = 0;
  if (prev.behaviorType !== curr.behaviorType) cost += 2;
  if (Math.abs(prev.cognitiveLoad - curr.cognitiveLoad) > 1) cost += 3;
  return cost;
}

/* ══════════════════════════════════════════════════════════
   다목적 최적화 순서 배치
   ══════════════════════════════════════════════════════════ */
function optimizeSequence(allActions) {
  const groups = {};
  for (const a of allActions) {
    if (!groups[a.parentTitle]) groups[a.parentTitle] = [];
    groups[a.parentTitle].push(a);
  }

  const groupList = Object.entries(groups).map(([title, actions]) => {
    const avgReward = actions.reduce((s, a) => s + a.rewardScore, 0) / actions.length;
    const avgLoad = actions.reduce((s, a) => s + a.cognitiveLoad, 0) / actions.length;
    const minTime = Math.min(...actions.map(a => a.estimatedMin));
    const priority = avgReward * 0.40 + (1 - avgLoad / 3) * 0.30 + (1 / Math.max(minTime, 0.5)) * 0.20 +
      (actions[0].behaviorType === "ACTIVATION" ? 0.10 : 0);
    return { title, actions, priority, avgLoad };
  });

  groupList.sort((a, b) => b.priority - a.priority);

  let sequence = [];
  for (const g of groupList) {
    sequence.push(...g.actions);
  }

  let improved = true;
  let passes = 0;
  while (improved && passes < 50) {
    improved = false;
    passes++;
    for (let i = 1; i < sequence.length - 1; i++) {
      if (sequence[i].isMarker || sequence[i + 1]?.isMarker) continue;
      if (sequence[i].parentTitle === sequence[i + 1]?.parentTitle) continue;
      const costNow = transitionCost(sequence[i - 1], sequence[i]);
      const costSwap = transitionCost(sequence[i - 1], sequence[i + 1]);
      if (costSwap < costNow) {
        [sequence[i], sequence[i + 1]] = [sequence[i + 1], sequence[i]];
        improved = true;
      }
    }
  }

  const withMarkers = [];
  let realCount = 0;
  for (const action of sequence) {
    withMarkers.push(action);
    if (!action.isMarker) {
      realCount++;
      if (realCount % 3 === 0) {
        withMarkers.push(makeMarker(realCount));
      }
    }
  }

  let cumReward = 0, cumCost = 0;
  for (let i = 0; i < withMarkers.length; i++) {
    const a = withMarkers[i];
    const posWeight = 1 / (1 + i * 0.15);
    cumReward += a.rewardScore * posWeight;
    cumCost += a.cognitiveLoad;
    if (i > 0) cumCost += transitionCost(withMarkers[i - 1], a);
    a.cumulativeReward = Math.round(cumReward * 100) / 100;
    a.cumulativeCost = cumCost;
    a.order = i;
  }

  return withMarkers;
}

/* ══════════════════════════════════════════════════════════
   ★ 메인 분석 파이프라인
   UI에서 이 함수 하나만 호출합니다.
   ══════════════════════════════════════════════════════════ */


// Legacy entry — used by adapter engine.js as fallback when v3 can't parse.
export function runAnalysisLegacy(tasks, learningData) {
  const allActions = [];
  const analyses = [];
  for (const task of tasks) {
    if (!task.title.trim()) continue;
    const { actions, analysis } = decomposeTask(task, learningData);
    allActions.push(...actions);
    analyses.push({ title: task.title, ...analysis });
  }
  const optimized = optimizeSequence(allActions);
  const totalEstMin = optimized.filter(a => !a.isMarker).reduce((s, a) => s + a.estimatedMin, 0);
  const totalReward = optimized.length > 0 ? optimized[optimized.length - 1].cumulativeReward : 0;
  const totalCost = optimized.length > 0 ? optimized[optimized.length - 1].cumulativeCost : 0;
  return { breakdown: optimized, analyses, totalEstMin, totalReward, totalCost };
}
