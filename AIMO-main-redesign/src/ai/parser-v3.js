/* ═══════════════════════════════════════════════════════════════
   parser-v3.js — 한국어 자연어 → L4 태그 변환

   전략:
     1. 복합 입력 분리: "음악 틀고 요리하기" → ["음악 틀기", "요리"]
     2. 각 조각에 대해:
        a) L3 한국어 이름 직접 매칭 ("샤워" → L3 `shower`)
        b) 동의어 사전 매칭 ("코딩" → L3 `coding_dev`의 후보들)
        c) L4 태그 직접 매칭 (이미 태그로 입력된 경우)
     3. L3가 결정되면 하위 L4 중 "기본값" 선택
        - 수식어가 있으면 조정: "빨리" → 가장 짧은 act, "깊이" → 가장 긴 act

   범위 제한:
     - 완전한 NLU 아님. 의존성 엔진이 뒤에서 후행 활동을 추론하므로
       파서는 "사용자가 명시적으로 말한 것"만 L4로 변환
   ═══════════════════════════════════════════════════════════════ */

import { L4_DB, L3_META, L2_META, L1_META, TREE } from './types-v3.js';

/* ── 1. L3 한국어 이름 역인덱스 ─────────────────────── */
const L3_BY_KOREAN = new Map();   // "샤워" → "shower"

for (const [l3code, meta] of Object.entries(L3_META)) {
  const koreanName = meta.name;
  if (koreanName) {
    const cleaned = koreanName.replace(/\([^)]+\)/g, '').trim();
    const parts = cleaned.split(/[·,/]/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!L3_BY_KOREAN.has(p)) L3_BY_KOREAN.set(p, l3code);
    }
  }
}

/* ── 1-B. L2 한국어 이름 역인덱스 ──────────────────── */
const L2_BY_KOREAN = new Map();   // "위생" → "hygiene"

for (const [l2code, meta] of Object.entries(L2_META)) {
  const koreanName = meta.name;
  if (koreanName) {
    const cleaned = koreanName.replace(/\([^)]+\)/g, '').trim();
    const parts = cleaned.split(/[·,/]/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!L2_BY_KOREAN.has(p)) L2_BY_KOREAN.set(p, l2code);
    }
  }
}

/**
 * L2 코드에서 기본 L3 → 기본 L4 선택 (폴백용)
 */
function pickDefaultFromL2(l2code) {
  const l2meta = L2_META[l2code];
  if (!l2meta) return null;
  const l3s = TREE[l2meta.parent_l1]?.[l2code];
  if (!l3s) return null;
  // 첫 L3 선택 → 그 L3의 기본 L4
  const firstL3 = Object.keys(l3s)[0];
  if (!firstL3) return null;
  return { l3: firstL3, directL4: null };
}

/* ── 2. 수동 동의어 사전 (한국어 표현 → L3 또는 L4) ─────────── */
// 값이 L4 태그이면 L4_DB에 있으므로 matchL3에서 direct L4로 인식됨
const SYNONYMS = {
  // digital creation
  '코딩': 'coding_dev',
  '개발': 'coding_dev',
  '프로그래밍': 'coding_dev',
  '디버깅': 'coding_dev',
  '영상 편집': 'video_creation',
  '영상편집': 'video_creation',
  '편집': 'video_creation',
  '녹음': 'audio_creation',

  // research
  '논문 쓰기': 'paper_drafting',
  '논문쓰기': 'paper_drafting',
  '논문 작성': 'paper_drafting',
  '논문 쓰': 'paper_drafting',     // 정규화된 형태 대응
  '논문 읽기': 'paper_read',
  '논문읽기': 'paper_read',
  '논문 읽': 'paper_read',
  '논문': 'paper_read',
  '문헌조사': 'database_search',
  '문헌 검색': 'database_search',
  '실험': 'lab_experiment',
  '학회 발표': 'conf_presentation',
  '학회발표': 'conf_presentation',

  // work
  '업무': 'task_execution',
  '일': 'task_execution',
  '회의': 'team_meeting',
  '미팅': 'team_meeting',
  '보고서': 'report_writing',
  '이메일': 'work_email',
  '메일': 'work_email',
  '슬랙': 'work_messenger',
  '출장': 'domestic_trip',
  '회식': 'team_dinner',

  // household / food
  '요리': 'cooking_main',
  '요리하기': 'cooking_main',
  '재료 손질': 'ingredient_prep',
  '재료손질': 'ingredient_prep',
  '손질': 'ingredient_prep',
  '설거지': 'dishwashing',
  '청소': 'vacuuming',
  '방청소': 'room_tidy',
  '빨래': 'washing_machine',
  '세탁': 'washing_machine',
  '빨래 널기': 'drying',
  '빨래 개기': 'folding',
  '다림질': 'ironing',
  '장보기': 'grocery_trip',
  '마트': 'grocery_trip',

  // personal care
  '샤워': 'shower',
  '목욕': 'bath',
  '양치': 'toothbrush',
  '세안': 'face_wash',
  '화장': 'makeup_apply',
  '면도': 'shaving',
  '낮잠': 'power_nap',
  '취침': 'night_sleep',
  '기상': 'wake_up',
  '일어나기': 'wake_up',

  // eating
  '아침': 'home_breakfast_simple',
  '아침 식사': 'home_breakfast_simple',
  '아침식사': 'home_breakfast_simple',
  '점심': 'home_lunch',
  '점심 식사': 'home_lunch',
  '점심식사': 'home_lunch',
  '저녁': 'family_dinner',
  '저녁 식사': 'family_dinner',
  '저녁식사': 'family_dinner',
  '밥 먹': 'home_lunch',
  '야식': 'late_snack',
  '간식': 'afternoon_snack',
  '커피': 'morning_coffee',
  '외식': 'neighborhood_restaurant',

  // sports
  '운동': 'compound_lift',
  '헬스': 'compound_lift',
  '웨이트': 'compound_lift',
  '달리기': 'outdoor_run',
  '조깅': 'outdoor_run',
  '자전거': 'outdoor_cycle',
  '요가': 'yoga',
  '필라테스': 'pilates',
  '등산': 'hiking',
  '수영': 'swimming',

  // leisure / music — bgable이 필요하면 L4 태그 직접 매핑
  '음악 틀': 'background_music',   // 정규화 후
  '음악 틀기': 'background_music',
  '음악 틀고': 'background_music',
  '음악 듣': 'music_listen',        // L3 이름 (focused_listen이 기본)
  '음악': 'music_listen',
  '팟캐스트': 'podcast_leisure',
  '영화': 'movie_theater',
  '넷플릭스': 'streaming_watch',
  '유튜브': 'youtube_watch',
  '게임': 'mobile_game',
  '책': 'novel_reading',
  '독서': 'novel_reading',

  // self-dev
  '명상': 'guided_meditation',
  '일기': 'daily_journal',
  '회고': 'weekly_review',

  // travel
  '출근': 'commute_to_work',
  '퇴근': 'commute_from_work',
  '등교': 'commute_to_school',
  '하교': 'commute_from_school',
  '여행': 'vacation_travel',

  // caring / pets
  '산책': 'pet_walk',
  '강아지 산책': 'pet_walk',
  '밥주기': 'pet_feeding',
  '밥 주': 'pet_feeding',
  '사료': 'pet_feeding',

  // social
  '데이트': 'date_outing',
  '친구 만': 'friend_meetup',       // "친구 만나서" → "친구 만"
  '친구 만남': 'friend_meetup',
  '친구': 'friend_meetup',

  // shopping
  '쇼핑': 'clothes_shop',

  // medical
  '병원': 'clinic_visit',
  '진료': 'clinic_visit',
  '치과': 'dental_checkup',

  // Phase 1.5: 새 L3 + 누락 매핑
  '커밋': 'git_operations',
  '푸시': 'git_operations',
  'pr': 'git_operations',
  '풀리퀘': 'git_operations',
  'git': 'git_operations',
  '깃': 'git_operations',
  '연구비': 'proposal_draft',
  '연구비 신청': 'proposal_draft',
  '제안서': 'proposal_draft',
  '그랜트': 'proposal_draft',
  '웜업': 'dynamic_warmup',
  '쿨다운': 'cooldown_stretch',
  '파킹': 'parking_action',
  '경조사': 'wedding_attend',
  '돌잔치': 'celebration_attend',
  '장례': 'funeral_attend',
  '구독 관리': 'subscription_review',
  '피아노': 'piano_practice',
  '기타 연습': 'guitar_practice',
  '악기': 'instrument_practice',
  '바이올린': 'violin_practice',
  '드럼': 'drum_practice',
  '우쿨렐레': 'ukulele_casual',
  '수채화': 'watercolor',
  '스케치': 'pencil_sketch',
  '유화': 'oil_acrylic',
  '디지털 드로잉': 'digital_drawing',
  '뜨개질': 'knitting_crochet',
  '도자기': 'pottery_clay',
  '가죽공예': 'leather_craft',
  '비즈': 'beading_jewelry',
  '캔들': 'candle_soap',
  '합창': 'choir_rehearsal',
  '보컬': 'singing_vocal',
  '노래 연습': 'singing_vocal',
  '노래방': 'karaoke',
  '발레': 'ballet_hobby',
  '케이팝 댄스': 'kpop_dance',
  '사교 댄스': 'social_dance',
  '글램핑': 'glamping',
  '풍경 사진': 'photography_hobby',
  '사진 찍기': 'photography_hobby',
  '출사': 'photography_hobby',
};

/* ── 3. 수식어 (modifier) 테이블 ───────────────────── */
const MODIFIERS_SHORT = ['빨리', '간단히', '대충', '잠깐', '짧게'];  // 짧은 L4 선호
const MODIFIERS_LONG = ['깊이', '제대로', '오래', '충분히', '길게']; // 긴 L4 선호
const MODIFIERS_SERIOUS = ['집중해서', '진지하게', '정성껏'];         // 긴 L4 + cog 높은 것

/* ── 4. 분리 및 정규화 ─────────────────────────────── */

/**
 * 문장에서 시간 명시(분) 추출
 * "독서 30분" → { cleaned: "독서", duration: 30 }
 */
function extractDuration(text) {
  const m = text.match(/(\d+)\s*(분|시간|hour|min|시)/);
  if (!m) return { cleaned: text, duration: null };
  let dur = parseInt(m[1]);
  if (m[2].startsWith('시')) dur *= 60;
  return {
    cleaned: text.replace(m[0], '').trim(),
    duration: dur,
  };
}

/**
 * 복합 입력 분리: "음악 틀고 요리" → ["음악 틀고", "요리"]
 * 전략: 문장 안에서 "활동을 끝내고 다음으로 넘어감"을 나타내는 구분자들을
 *       정규식으로 잘라냄. 구분자 뒤에 오는 조각은 새 활동으로 간주.
 */
function splitCompound(text) {
  // 주요 명시적 연결어
  const explicit = /\s*(?:그리고|그 다음에|그다음에|그 후에|그후에|그 후|그후|한 다음에|한다음에|한 뒤에|한뒤에|한 다음|한다음|한 뒤|한뒤|다음에|고 나서|고나서|한 후|한후|만나서|가서|해서|시키고)\s*/g;

  // 동사 연결어미 '~고 ' 패턴:
  // 기존: ([가-힣]+)고\s+  → "샤워하고 " 는 맞지만 "샤워하고밥" 같은 무공백 연결 누락
  // 개선: 공백 요구를 완화하되 뒤에 한글 1자+ 가 있거나 문장 끝일 때만
  const verbGo = /([가-힣]+)고(?=\s|[가-힣])/g;

  const SEP = '|SPLIT|';
  let normalized = text.replace(explicit, SEP);
  normalized = normalized.replace(verbGo, '$1' + SEP);

  // 쉼표
  normalized = normalized.replace(/\s*,\s*/g, SEP);

  return normalized.split(SEP).map(s => s.trim()).filter(Boolean);
}

/**
 * 조사·어미 제거 (간단 버전)
 * 동의어 매칭 전에 쓰이는 정규화이므로, "논문 쓰기" 같은 복합어는
 * 정규화되더라도 SYNONYMS 매칭에서 공통 부분으로 잡혀야 함.
 *
 * 전략 변경: 매칭 시 정규화 전·후 모두 시도. 기존의 과도한 어미 제거는
 * "논문 쓰기" → "논문 쓰" 같은 이상 동작을 유발하므로 끝의 '기'는 제거.
 */
function normalizeKorean(text) {
  let t = text.trim();
  // 어미/조사 제거 (반복 적용)
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
  // 마지막 '기'는 조심스럽게 제거 (단 '쓰기', '읽기' 등 SYNONYMS에서 매칭되는 경우는 유지)
  return t;
}

/* ── 5. L3 매칭 ─────────────────────────────────────── */

/* ── SYNONYMS entries sorted by length (longest first) ──
   Also: a secondary index with spaces stripped, so "밥먹기" matches "밥 먹" */
const SYNONYMS_SORTED = Object.entries(SYNONYMS).sort(
  (a, b) => b[0].length - a[0].length
);
const SYNONYMS_NOSPACE = new Map();
for (const [k, v] of Object.entries(SYNONYMS)) {
  const nk = k.replace(/\s+/g, '');
  if (nk !== k && !SYNONYMS_NOSPACE.has(nk)) SYNONYMS_NOSPACE.set(nk, v);
}
const SYNONYMS_NOSPACE_SORTED = [...SYNONYMS_NOSPACE.entries()].sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * 정규화된 텍스트에서 L3/L4 코드 찾기
 * 우선순위:
 *   1. 직접 L4 태그
 *   2. L3 한국어 이름 **정확 일치** (전체 텍스트 == 이름)
 *   3. SYNONYMS 부분 매칭 (긴 키 우선)
 *   4. L3 한국어 이름 **부분 매칭**
 *   5. L2 한국어 이름 폴백
 */
function matchL3(normalizedText) {
  // 1. 직접 L4 태그
  if (L4_DB[normalizedText]) {
    return { l3: L4_DB[normalizedText].l3, directL4: normalizedText };
  }

  // 2. L3 정확 일치
  if (L3_BY_KOREAN.has(normalizedText)) {
    return { l3: L3_BY_KOREAN.get(normalizedText), directL4: null };
  }

  // 3. SYNONYMS 부분 매칭 (긴 키 우선)
  for (const [korean, target] of SYNONYMS_SORTED) {
    if (normalizedText.includes(korean)) {
      if (L4_DB[target]) return { l3: L4_DB[target].l3, directL4: target };
      if (L3_META[target]) return { l3: target, directL4: null };
      // BUG-F fix: fall back through L2 if target is an L2 code
      if (L2_META[target]) {
        const def = pickDefaultFromL2(target);
        if (def) return def;
      }
      // Unresolvable target → treat as unmatched (surface to details)
      return null;
    }
  }

  // 3-B. SYNONYMS 부분 매칭 — 공백 제거 버전 ("밥먹기" → "밥 먹" 매칭)
  const stripped = normalizedText.replace(/\s+/g, '');
  if (stripped !== normalizedText || stripped.length > 0) {
    for (const [korean, target] of SYNONYMS_NOSPACE_SORTED) {
      if (stripped.includes(korean)) {
        if (L4_DB[target]) return { l3: L4_DB[target].l3, directL4: target };
        if (L3_META[target]) return { l3: target, directL4: null };
        if (L2_META[target]) {
          const def = pickDefaultFromL2(target);
          if (def) return def;
        }
      }
    }
  }

  // 4. L3 부분 매칭
  for (const [korean, l3] of L3_BY_KOREAN) {
    if (normalizedText.includes(korean)) {
      return { l3, directL4: null };
    }
  }

  // 5. L2 폴백
  for (const [korean, l2] of L2_BY_KOREAN) {
    if (normalizedText.includes(korean)) {
      return pickDefaultFromL2(l2);
    }
  }

  return null;
}

/* ── SYNONYMS integrity check (fails loud on module load) ──
   BUG-F fix: invalid targets caused silent `l4=null` drops.
   Surface these at load time so they can be fixed. */
const SYNONYMS_INVALID_TARGETS = [];
for (const [k, v] of Object.entries(SYNONYMS)) {
  if (!L4_DB[v] && !L3_META[v] && !L2_META[v]) {
    SYNONYMS_INVALID_TARGETS.push({ key: k, target: v });
  }
}
export function getSynonymHealth() {
  return { total: Object.keys(SYNONYMS).length, invalid: SYNONYMS_INVALID_TARGETS };
}
if (SYNONYMS_INVALID_TARGETS.length > 0 && process.env.DETNETE_STRICT === '1') {
  throw new Error(`Invalid SYNONYMS targets: ${JSON.stringify(SYNONYMS_INVALID_TARGETS)}`);
}

/* ── 6. L3 → L4 선택 (수식어 고려) ─────────────────── */

/**
 * L3 코드에 해당하는 L4 후보들 중 적절한 것 선택
 */
function pickL4FromL3(l3code, { duration, modifiers } = {}) {
  const l3Meta = L3_META[l3code];
  if (!l3Meta) return null;

  const candidates = TREE[l3Meta.parent_l1]?.[l3Meta.parent_l2]?.[l3code] || [];
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // 사용자가 시간 명시: 가장 가까운 act를 가진 L4 선택
  if (duration != null) {
    return candidates.reduce((best, cur) => {
      const dBest = Math.abs(best.act - duration);
      const dCur = Math.abs(cur.act - duration);
      return dCur < dBest ? cur : best;
    });
  }

  if (modifiers?.short) {
    return candidates.reduce((min, cur) => (cur.act < min.act ? cur : min));
  }
  if (modifiers?.long || modifiers?.serious) {
    return candidates.reduce((max, cur) => (cur.act > max.act ? cur : max));
  }

  // 기본값: "전형적" L4 선택
  // 우선순위: 이름에 특수 접두사(post_/pre_/quick_/intense_/brief_)가 없는 것
  const specialPrefix = /^(post_|pre_|quick_|intense_|brief_|emergency_|deep_|critical_|partial_)/;
  const plain = candidates.filter(c => !specialPrefix.test(c.tag));
  const pool = plain.length > 0 ? plain : candidates;
  const sorted = [...pool].sort((a, b) => a.act - b.act);
  return sorted[Math.floor(sorted.length / 2)];
}

/* ── 7. 수식어 감지 ─────────────────────────────────── */
function detectModifiers(text) {
  return {
    short: MODIFIERS_SHORT.some(m => text.includes(m)),
    long: MODIFIERS_LONG.some(m => text.includes(m)),
    serious: MODIFIERS_SERIOUS.some(m => text.includes(m)),
  };
}

/* ── 8. 메인 파싱 함수 ──────────────────────────────── */

/**
 * 자연어 입력 → L4 태그 리스트
 *
 * @param {string} text - 예: "음악 틀고 요리하기"
 * @returns {{ tags: string[], unmatched: string[], details: [...] }}
 */
export function parseInput(text) {
  const parts = splitCompound(text);
  const tags = [];
  const unmatched = [];
  const details = [];
  let lastL3 = null;  // 연속 중복 L3 매칭 감지용

  for (const part of parts) {
    const { cleaned, duration } = extractDuration(part);
    const modifiers = detectModifiers(cleaned);
    const normalized = normalizeKorean(cleaned);

    if (!normalized) continue;

    // 정규화 전 원본으로도 매칭 시도 (조사 제거가 단어를 망가뜨리는 경우 대비)
    const match = matchL3(normalized) || matchL3(cleaned);

    if (!match) {
      unmatched.push(part);
      details.push({ input: part, matched: false });
      continue;
    }

    // 직전 L3와 같으면 스킵 (예: "헬스장 가서 운동" → compound_lift 2번 방지)
    if (match.l3 === lastL3) {
      details.push({ input: part, matched: true, l3: match.l3, l4: null, skipped: 'duplicate L3' });
      continue;
    }

    let l4;
    if (match.directL4) {
      l4 = L4_DB[match.directL4];
    } else {
      l4 = pickL4FromL3(match.l3, { duration, modifiers });
    }

    if (l4) {
      tags.push(l4.tag);
      lastL3 = match.l3;
      details.push({
        input: part,
        matched: true,
        l3: match.l3,
        l4: l4.tag,
        baseAct: l4.act,
        userDuration: duration,
        modifiers: Object.entries(modifiers).filter(([, v]) => v).map(([k]) => k),
      });
    } else {
      unmatched.push(part);
      details.push({ input: part, matched: true, l3: match.l3, l4: null });
    }
  }

  return { tags, unmatched, details };
}
