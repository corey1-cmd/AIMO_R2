/* AIMOInfoCard.jsx — 좌측 다섯 번째 카드 (Atelier Cyan v6b)
 * 라이트 글래스 + 정제된 큐브 SVG + 모노 버전 라벨.
 * 작은 일렉트릭 민트 점이 큐브 주위를 천천히 도는 미세 모션.
 * Props: onLearnMore */

import { T } from '../constants';

export function AIMOInfoCard({ onLearnMore }) {
  return (
    <section style={{
      background: T.glass.light,
      backdropFilter: T.glass.blur,
      WebkitBackdropFilter: T.glass.blur,
      borderRadius: T.radius.xxl,
      padding: '26px 24px',
      boxShadow: T.shadow.glass,
      border: `1px solid ${T.glass.lightBorder}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      alignItems: 'flex-start',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 옅은 코너 글로우 */}
      <div aria-hidden style={{
        position: 'absolute',
        right: -40,
        bottom: -40,
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 224, 168, 0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Cube />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: T.font_.familyDisplay,
          fontSize: 22,
          fontWeight: T.font_.weight.extrabold,
          fontStyle: 'italic',
          color: T.color.primary,
          letterSpacing: T.font_.tracking.tight,
          marginBottom: 4,
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
        }}>
          AIMO
          <span style={{
            fontFamily: T.font_.familyMono,
            fontStyle: 'normal',
            fontSize: 11,
            fontWeight: T.font_.weight.medium,
            color: T.color.textMuted,
            letterSpacing: T.font_.tracking.widest,
          }}>v3.1.0</span>
        </div>
        <p style={{
          fontSize: T.font_.size.caption,
          color: T.color.textSecondary,
          lineHeight: T.font_.leading.relaxed,
          margin: 0,
        }}>
          한국어를 자연스럽게 이해하고,
          <br />
          시간을 정확하게 추정합니다.
        </p>
      </div>
      <button
        onClick={onLearnMore}
        style={{
          padding: '7px 14px',
          fontSize: 11,
          fontWeight: T.font_.weight.semibold,
          letterSpacing: T.font_.tracking.widest,
          textTransform: 'uppercase',
          background: T.color.mint,
          color: T.color.primary,
          border: `1px solid rgba(0, 82, 45, 0.10)`,
          borderRadius: T.radius.pill,
          cursor: 'pointer',
          fontFamily: T.font_.familyMono,
          transition: 'background 200ms ease, transform 200ms ease',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#A8DCBE';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.color.mint;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >LEARN MORE →</button>
    </section>
  );
}

function Cube() {
  return (
    <div style={{ position: 'relative', width: 56, height: 56 }}>
      <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="cubeStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={T.color.primary} />
            <stop offset="100%" stopColor="#1F7A4D" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#cubeStroke)" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M24 6 L40 14 L40 32 L24 40 L8 32 L8 14 Z" />
          <path d="M24 6 L24 24 L40 14" />
          <path d="M24 24 L8 14" />
          <path d="M24 24 L24 40" />
        </g>
        {/* 중심 액센트 */}
        <circle cx="24" cy="24" r="2.4" fill={T.color.electricMint} />
      </svg>
      {/* 궤도를 도는 작은 점 */}
      <span aria-hidden style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: T.color.electricMint,
        boxShadow: `0 0 4px ${T.color.electricMint}`,
        marginLeft: -2,
        marginTop: -2,
        animation: 'orbitDot 7s linear infinite',
        opacity: 0.7,
      }} />
    </div>
  );
}
