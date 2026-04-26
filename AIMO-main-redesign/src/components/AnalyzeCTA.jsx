/* AnalyzeCTA.jsx — 우측 input 모드 분석 실행 (Atelier Cyan v6b)
 * 다크 글래스 + 우측 aurora 글로우 + ✦ + 분석 실행하기
 * 절제된 반짝임 — 글로우 강도 낮춤, 호버 시 transform만 살짝
 * Props: onClick, disabled, count */

import { T } from '../constants';

export function AnalyzeCTA({ onClick, disabled, count }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '26px 30px',
        width: '100%',
        background: T.glass.dark,
        backdropFilter: T.glass.blur,
        WebkitBackdropFilter: T.glass.blur,
        border: `1px solid ${T.glass.darkBorder}`,
        borderRadius: T.radius.xxl,
        color: T.color.textOnDark,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: T.shadow.glassDark,
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 14px 42px rgba(0, 82, 45, 0.18), 0 1px 0 rgba(255, 255, 255, 0.06) inset';
        e.currentTarget.style.borderColor = 'rgba(79, 224, 168, 0.18)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = T.shadow.glassDark;
        e.currentTarget.style.borderColor = T.glass.darkBorder;
      }}
    >
      {/* 우측 aurora 글로우 */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        right: -80,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 280,
        height: 280,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 224, 168, 0.18) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {/* 좌측 미세한 보조 빛 */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        left: -40,
        top: -40,
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(60, 180, 120, 0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* 상단 sheen 라인 */}
      <div aria-hidden style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(79, 224, 168, 0.32), transparent)',
        pointerEvents: 'none',
      }} />

      <span style={{
        flexShrink: 0,
        width: 46,
        height: 46,
        borderRadius: 13,
        background: 'rgba(79, 224, 168, 0.10)',
        border: '1px solid rgba(79, 224, 168, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        position: 'relative',
        color: T.color.electricMint,
        textShadow: `0 0 8px rgba(79, 224, 168, 0.45)`,
      }} aria-hidden="true">✦</span>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        position: 'relative',
        flex: 1,
      }}>
        <span style={{
          fontSize: T.font_.size.title + 2,
          fontWeight: T.font_.weight.semibold,
          letterSpacing: T.font_.tracking.tight,
        }}>분석 실행하기</span>
        <span style={{
          fontSize: T.font_.size.tiny,
          color: T.color.textOnDarkMuted,
          fontWeight: T.font_.weight.regular,
          fontFamily: T.font_.familyMono,
          letterSpacing: '0.02em',
        }}>
          {count > 0 ? `${count}개 항목 → 시간 추정 + 순서 결정` : '항목을 추가한 후 실행할 수 있어요'}
        </span>
      </div>

      <span style={{
        position: 'relative',
        fontSize: 18,
        color: T.color.textOnDarkMuted,
        flexShrink: 0,
      }} aria-hidden="true">→</span>
    </button>
  );
}
