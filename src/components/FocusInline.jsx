/* FocusInline.jsx — 우측 focus 모드 콘텐츠 (Atelier Cyan v6b)
 * 라이트 글래스 카드 + 진행률 + 이어서 하기 / 새로 시작
 * Props: plan, onResume, onClose */

import { T, formatMin } from '../constants';

export function FocusInline({ plan, onResume, onClose }) {
  if (!plan || !plan.items || plan.items.length === 0) return null;

  const total = plan.items.length;
  const done = plan.items.filter(i => i.status === 'done').length;
  const current = plan.items[plan.curIdx];
  const ratio = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{
            margin: 0,
            fontFamily: T.font_.familyDisplay,
            fontSize: T.font_.size.display,
            fontWeight: T.font_.weight.extrabold,
            letterSpacing: T.font_.tracking.tightest,
            lineHeight: T.font_.leading.tight,
            color: T.color.textPrimary,
          }}>FOCUS</h1>
          <span aria-hidden style={{
            display: 'inline-block',
            width: 8, height: 8,
            borderRadius: '50%',
            background: T.color.electricMint,
            boxShadow: `0 0 10px ${T.color.electricMint}`,
            animation: 'cyanPulse 2.4s ease-in-out infinite',
            marginBottom: 14,
          }} />
        </div>
        <span style={{
          fontSize: T.font_.size.body,
          color: T.color.textSecondary,
          fontWeight: T.font_.weight.medium,
          letterSpacing: T.font_.tracking.tight,
        }}>진행 중인 세션</span>
      </header>

      <div style={{
        background: T.glass.light,
        backdropFilter: T.glass.blur,
        WebkitBackdropFilter: T.glass.blur,
        borderRadius: T.radius.xxl,
        padding: '30px 28px',
        boxShadow: T.shadow.glass,
        border: `1px solid ${T.glass.lightBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 코너 ambient orb */}
        <div aria-hidden style={{
          position: 'absolute',
          right: -60,
          top: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 224, 168, 0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', position: 'relative' }}>
          <span style={{
            fontSize: T.font_.size.tiny,
            fontWeight: T.font_.weight.semibold,
            letterSpacing: T.font_.tracking.widest,
            textTransform: 'uppercase',
            color: T.color.textMuted,
            fontFamily: T.font_.familyMono,
          }}>진행률</span>
          <span style={{
            fontSize: T.font_.size.statBig,
            fontWeight: T.font_.weight.extrabold,
            color: T.color.primary,
            fontFamily: T.font_.familyMono,
            letterSpacing: T.font_.tracking.tightest,
          }}>{done} / {total}</span>
        </div>

        <div style={{
          height: 8,
          background: 'rgba(0, 82, 45, 0.06)',
          borderRadius: T.radius.pill,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            width: `${ratio}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${T.color.primary} 0%, ${T.color.electricMint} 100%)`,
            transition: 'width 400ms ease',
            boxShadow: `0 0 8px rgba(79, 224, 168, 0.32)`,
          }} />
        </div>

        {current && (
          <div style={{
            background: 'rgba(232, 244, 237, 0.55)',
            border: `1px solid ${T.glass.lightBorder}`,
            borderRadius: T.radius.lg,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            position: 'relative',
          }}>
            <span style={{
              fontSize: T.font_.size.tiny,
              fontWeight: T.font_.weight.semibold,
              letterSpacing: T.font_.tracking.widest,
              textTransform: 'uppercase',
              color: T.color.primary,
              fontFamily: T.font_.familyMono,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span aria-hidden style={{
                display: 'inline-block',
                width: 5, height: 5,
                borderRadius: '50%',
                background: T.color.electricMint,
                boxShadow: `0 0 5px ${T.color.electricMint}`,
              }} />
              지금 진행 중
            </span>
            <span style={{
              fontSize: T.font_.size.body,
              fontWeight: T.font_.weight.semibold,
              color: T.color.textPrimary,
              letterSpacing: T.font_.tracking.tight,
            }}>{current.title}</span>
            {current.estimatedMin && (
              <span style={{
                fontSize: 12,
                color: T.color.textMuted,
                fontFamily: T.font_.familyMono,
              }}>예상 {formatMin(current.estimatedMin)}</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
          <button
            onClick={onResume}
            style={{
              flex: 1,
              padding: '14px 22px',
              fontSize: T.font_.size.body,
              fontWeight: T.font_.weight.semibold,
              fontFamily: 'inherit',
              background: T.color.primary,
              color: 'white',
              border: 'none',
              borderRadius: T.radius.pill,
              cursor: 'pointer',
              boxShadow: `0 6px 20px rgba(0, 82, 45, 0.22)`,
              transition: 'background 200ms ease, transform 200ms ease, box-shadow 200ms ease',
              letterSpacing: T.font_.tracking.tight,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.color.primaryHover;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 10px 28px rgba(0, 82, 45, 0.30)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.color.primary;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 6px 20px rgba(0, 82, 45, 0.22)`;
            }}
          >이어서 하기 →</button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '14px 22px',
                fontSize: T.font_.size.body,
                fontWeight: T.font_.weight.medium,
                fontFamily: 'inherit',
                background: 'rgba(255, 255, 255, 0.55)',
                color: T.color.textSecondary,
                border: `1px solid ${T.glass.lightBorderStrong}`,
                borderRadius: T.radius.pill,
                cursor: 'pointer',
                transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.color.mintSoft;
                e.currentTarget.style.color = T.color.primary;
                e.currentTarget.style.borderColor = 'rgba(0, 82, 45, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.55)';
                e.currentTarget.style.color = T.color.textSecondary;
                e.currentTarget.style.borderColor = T.glass.lightBorderStrong;
              }}
            >새로 시작</button>
          )}
        </div>
      </div>
    </section>
  );
}
