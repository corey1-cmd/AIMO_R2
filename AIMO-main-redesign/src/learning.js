/* ═══════════════════════════════════════════════════════════════
   learning.js — 선택적 학습 데이터 저장/로드
   ═══════════════════════════════════════════════════════════════ */

const LS_LEARN = "detente-learning-data";

export function loadLD() {
  try {
    const raw = localStorage.getItem(LS_LEARN);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLD(data) {
  try {
    localStorage.setItem(LS_LEARN, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

export function resetLD() {
  try { localStorage.removeItem(LS_LEARN); } catch {}
}

export function accumLD(existing, items) {
  const d = existing ? { ...existing } : {};
  for (const item of items) {
    if (item.actualMin == null) continue;
    if (!d[item.category]) d[item.category] = { totalEst: 0, totalActual: 0, count: 0 };
    d[item.category].totalEst += item.estimatedMin;
    d[item.category].totalActual += item.actualMin;
    d[item.category].count += 1;
  }
  return d;
}
