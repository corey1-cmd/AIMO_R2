/* AddTaskButton.jsx — 우측 input 모드 추가 버튼 (Atelier Cyan v6b)
 * 점선 보더 + + 할 일 추가
 * 호버 시 일렉트릭 민트 점등 (절제됨)
 * Props: onClick, disabled */

import { T } from '../constants';

export function AddTaskButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.30)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1.5px dashed ${T.color.borderDashed}`,
        borderRadius: T.radius.xxl,
        color: T.color.textMuted,
        fontSize: T.font_.size.caption,
        fontWeight: T.font_.weight.medium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        letterSpacing: T.font_.tracking.tight,
        transition: 'border-color 220ms ease, color 220ms ease, background 220ms ease',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = T.color.primary;
        e.currentTarget.style.color = T.color.primary;
        e.currentTarget.style.background = 'rgba(232, 244, 237, 0.55)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = T.color.borderDashed;
        e.currentTarget.style.color = T.color.textMuted;
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.30)';
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      <span>할 일 추가</span>
    </button>
  );
}
