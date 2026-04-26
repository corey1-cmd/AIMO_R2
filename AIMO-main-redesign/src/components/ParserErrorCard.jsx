/* ParserErrorCard.jsx — 우측 input 모드 파서 실패 안내 (Atelier Cyan v6b)
 * 라이트 글래스 + 워닝 액센트
 * Props: unrecognized, onClose */

import { T } from '../constants';

export function ParserErrorCard({ unrecognized, onClose }) {
  if (!unrecognized || (Array.isArray(unrecognized) && unrecognized.length === 0)) return null;

  const count = Array.isArray(unrecognized) ? unrecognized.length : 1;

  return (
    <div role="alert" style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '16px 18px',
      background: 'rgba(255, 248, 232, 0.65)',
      backdropFilter: T.glass.blur,
      WebkitBackdropFilter: T.glass.blur,
      border: `1px solid rgba(232, 163, 61, 0.22)`,
      borderRadius: T.radius.lg,
      marginBottom: 16,
      boxShadow: T.shadow.glass,
    }}>
      <span style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: T.color.warning,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: T.font_.weight.bold,
        marginTop: 1,
        boxShadow: `0 2px 6px rgba(232, 163, 61, 0.32)`,
      }} aria-hidden="true">!</span>
      <div style={{
        flex: 1,
        fontSize: T.font_.size.caption,
        color: T.color.textPrimary,
        lineHeight: T.font_.leading.relaxed,
      }}>
        <strong style={{ display: 'block', marginBottom: 4, letterSpacing: T.font_.tracking.tight }}>
          {count}개 항목을 정확히 인식하지 못했어요
        </strong>
        <span style={{ color: T.color.textSecondary }}>
          더 구체적으로 표현해 보세요. 예: "회의" → "팀 주간 회의 30분"
        </span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: T.color.textMuted,
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 4,
            transition: 'color 200ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.color.textPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.color.textMuted; }}
        >×</button>
      )}
    </div>
  );
}
