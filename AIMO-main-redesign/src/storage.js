/* ═══════════════════════════════════════════════════════════════
   storage.js — localStorage 영속화
   
   저장 항목:
     - records: 완료된 기록 배열
     - savedIds: 라이브러리에 저장된 기록 id 배열
     - plan: 진행 중인 포커스 세션 (탭 닫아도 이어서 하기 가능)
   
   날짜 필드는 JSON 직렬화 시 문자열이 되므로 load 시 Date로 복원합니다.
   ═══════════════════════════════════════════════════════════════ */

const K_RECORDS = "detente-records";
const K_SAVED = "detente-saved-ids";
const K_PLAN = "detente-active-plan";

function safeGet(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function safeSet(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ }
}
function safeDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function loadRecords(fallback) {
  const r = safeGet(K_RECORDS);
  if (!Array.isArray(r)) return fallback;
  return r.map(x => ({ ...x, date: new Date(x.date) }));
}
export function saveRecords(records) {
  safeSet(K_RECORDS, records);
}

export function loadSavedIds(fallback) {
  const v = safeGet(K_SAVED);
  return Array.isArray(v) ? v : fallback;
}
export function saveSavedIds(ids) {
  safeSet(K_SAVED, ids);
}

/* ── 진행중 포커스 세션 ──
   plan 구조:
   {
     items: [{ id, title, shortTitle, estimatedMin, category, behaviorType,
               timeBucket, actualMin, status }],
     curIdx: number,
     startTimes: { [idx]: number(ms) },
     startedAt: number(ms),
     sourceTasks: [{ title }],  // 기록 저장용 원본 태스크 제목
   }
*/
export function loadPlan() {
  return safeGet(K_PLAN);
}
export function savePlan(plan) {
  safeSet(K_PLAN, plan);
}
export function clearPlan() {
  safeDel(K_PLAN);
}
