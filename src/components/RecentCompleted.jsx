/* RecentCompleted.jsx — 좌측 세 번째 카드 (Atelier Cyan v6b)
 * 라이트 글래스 카드. 📋 최근 완료 + 전체 보기 →
 * Props: items, onSelect, onSeeAll */

import { T, formatMin, formatDate, CATEGORIES } from '../constants';

function catIcon(c) {
  return CATEGORIES.find(x => x.key === c)?.icon || '📌';
}

export function RecentCompleted({ items, onSelect, onSeeAll }) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: T.font_.size.title,
          fontWeight: T.font_.weight.semibold,
          color: T.color.textPrimary,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          letterSpacing: T.font_.tracking.tight,
        }}>
          <span aria-hidden="true">📋</span>
          <span>최근 완료</span>
        </span>
        <button
          onClick={onSeeAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.color.textMuted,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '4px 8px',
            letterSpacing: '0.02em',
            transition: 'color 200ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.color.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.color.textMuted; }}
        >전체 보기 →</button>
      </div>

      {(!items || items.length === 0) ? (
        <div style={{
          fontSize: T.font_.size.caption,
          color: T.color.textMuted,
          padding: '20px 4px',
          textAlign: 'center',
        }}>기록이 쌓이면 여기에 표시돼요</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect?.(r.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: T.radius.md,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(232, 244, 237, 0.55)';
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontSize: 18,
                flexShrink: 0,
                width: 32, height: 32,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.6)',
                border: `1px solid ${T.glass.lightBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }} aria-hidden="true">
                {catIcon(r.categories?.[0])}
              </span>
              <span style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
                flex: 1,
              }}>
                <span style={{
                  fontSize: T.font_.size.caption,
                  fontWeight: T.font_.weight.semibold,
                  color: T.color.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{r.title}</span>
                <span style={{
                  fontSize: 11,
                  color: T.color.textMuted,
                  fontFamily: T.font_.familyMono,
                  letterSpacing: '0.01em',
                }}>
                  {formatDate(r.date)} · {formatMin(r.totalActualMin)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
