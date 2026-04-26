/* ═══════════════════════════════════════════════════════════════
 * Legacy Bridge Fallback
 *
 * V3 파서와 coherence validator를 모두 통과하지 못한 입력에 대해,
 * 수동 정의된 legacy_bridge.json을 조회하여 가장 가까운 V3 L2로 매핑합니다.
 *
 * 설계 원칙 (senior 3 수정안 5):
 *   - confidence_cap이 아닌 confidence_floor 사용
 *   - floor는 "최소 보장값"이므로 미래의 학습 로직이 추가되어도 상한이 걸리지 않음
 *   - target_l2가 null이면 V3 갭이 심각한 영역(의료 등)이므로 NEEDS_CONTEXT로 폴백
 *
 * 매칭은 입력 문자열 포함 검사이며, 여러 엔트리가 매칭될 경우 긴 키워드 우선.
 * ═══════════════════════════════════════════════════════════════ */

import bridgeData from './legacy_bridge.json' with { type: 'json' };
import { L2_META } from '../types-v3.js';

// 긴 키워드 우선 매칭을 위해 길이 내림차순 정렬
const ENTRIES_SORTED = [...bridgeData.entries].sort(
  (a, b) => b.keyword.length - a.keyword.length
);

/**
 * 주어진 입력에 대해 legacy_bridge에서 가장 적합한 엔트리를 찾아 반환합니다.
 *
 * @param {string} rawInput - 사용자 원본 입력
 * @returns {object|null} {
 *   status: 'INFERRED' | 'NEEDS_CONTEXT',
 *   l1, l2, confidence, source, keyword, note?, hint?
 * } 또는 null(매칭 없음)
 */
export function legacyBridge(rawInput) {
  const input = String(rawInput || '');
  if (!input.trim()) return null;

  for (const entry of ENTRIES_SORTED) {
    if (!input.includes(entry.keyword)) continue;

    // target_l2가 null인 엔트리는 명시적 갭 — NEEDS_CONTEXT로 폴백
    if (!entry.target_l2) {
      return {
        status: 'NEEDS_CONTEXT',
        source: 'legacy_bridge_gap',
        keyword: entry.keyword,
        hint: entry.note || 'V3 분류 체계에 해당 활동이 없습니다. 카테고리를 직접 설정해 주세요.',
      };
    }

    // L2 메타에서 parent L1을 추출
    const l2meta = L2_META[entry.target_l2];
    if (!l2meta) {
      // 방어 코드: bridge.json 유효성은 기동 시점에 검증되지만 만약을 대비
      continue;
    }

    return {
      status: 'INFERRED',
      source: 'legacy_bridge',
      keyword: entry.keyword,
      l1: l2meta.parent_l1,
      l2: entry.target_l2,
      l3: null,
      l4: null,
      confidence: entry.confidence_floor,
      note: entry.note || null,
    };
  }

  return null;
}

/**
 * 부팅 시점 유효성 검증 — 모든 target_l2가 실제 V3 L2에 존재하는지 확인.
 * 유효하지 않으면 문제 엔트리 배열을 반환합니다.
 */
export function validateBridge() {
  const invalid = [];
  for (const entry of bridgeData.entries) {
    if (entry.target_l2 && !L2_META[entry.target_l2]) {
      invalid.push({ keyword: entry.keyword, target_l2: entry.target_l2 });
    }
  }
  return invalid;
}

export const _INTERNAL = { ENTRIES_SORTED };
