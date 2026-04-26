/* QuickEntry.jsx — 좌측 네 번째 카드 (Atelier Cyan v6b)
 * 라이트 글래스 카드. 빠른 진입 모드 3종.
 * Props: onNavigate */

import { T } from '../constants';

const MODES = [
  { key: 'distill', icon: '🧩', title: 'Make a structure', desc: '할 일을 분해', to: '/distill' },
  { key: 'focus',   icon: '🎯', title: 'Focus Mode',       desc: '하나에 집중',  to: '/focus' },
  { key: 'record',  icon: '📋', title: 'Tasks Record',     desc: '기록 보기',    to: '/record' },
];

export function QuickEntry({ onNavigate }) {
  return (
    <section style={{
      background: T.glass.light,
      backdropFilter: T.glass.blur,
      WebkitBackdropFilter: T.glass.blur,
      borderRadius: T.radius.xxl,
      padding: '22px 24px',
      boxShadow: T.shadow.glass,
      border: `1px solid ${T.glass.lightBorder}`,
      position: 'relative',
    }}>
      <div style={{
        fontSize: T.font_.size.title,
        fontWeight: T.font_.weight.semibold,
        color: T.color.textPrimary,
        marginBottom: 14,
        letterSpacing: T.font_.tracking.tight,
      }}>빠른 진입</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => onNavigate?.(m.to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.55)',
              border: `1px solid ${T.glass.lightBorder}`,
              borderRadius: T.radius.md,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, background 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = T.shadow.glassHover;
              e.currentTarget.style.borderColor = 'rgba(0, 82, 45, 0.18)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.78)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = T.glass.lightBorder;
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.55)';
            }}
          >
            <span style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: T.color.mintSoft,
              border: `1px solid ${T.glass.lightBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }} aria-hidden="true">{m.icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontSize: T.font_.size.caption,
                fontWeight: T.font_.weight.semibold,
                color: T.color.textPrimary,
              }}>{m.title}</span>
              <span style={{
                fontSize: 11,
                color: T.color.textMuted,
                fontFamily: T.font_.familyMono,
                letterSpacing: '0.01em',
              }}>{m.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
