/* WorkflowHeader.jsx — 우측 input 모드 헤더 (Atelier Cyan v6b)
 * "WORK FLOW" 디스플레이 + Make a structure 라벨 + 모노 Step 배지 + 데코 라인
 * Props: onShowGuide */

import { T } from '../constants';

export function WorkflowHeader({ onShowGuide }) {
  return (
    <header style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 30,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <h1 style={{
              margin: 0,
              fontFamily: T.font_.familyDisplay,
              fontSize: T.font_.size.display,
              fontWeight: T.font_.weight.extrabold,
              letterSpacing: T.font_.tracking.tightest,
              lineHeight: T.font_.leading.tight,
              color: T.color.textPrimary,
            }}>WORK FLOW</h1>
            <span style={{
              padding: '4px 10px',
              fontSize: 11,
              fontFamily: T.font_.familyMono,
              fontWeight: T.font_.weight.medium,
              color: T.color.primary,
              background: T.color.mint,
              border: `1px solid rgba(0, 82, 45, 0.10)`,
              borderRadius: T.radius.pill,
              letterSpacing: T.font_.tracking.wide,
              marginBottom: 12,
            }}>Step 1</span>
          </div>
          <span style={{
            fontSize: T.font_.size.body,
            color: T.color.textSecondary,
            fontWeight: T.font_.weight.medium,
            letterSpacing: T.font_.tracking.tight,
          }}>Make a structure</span>
        </div>

        <button
          onClick={onShowGuide}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: T.font_.weight.medium,
            color: T.color.textSecondary,
            background: 'rgba(255, 255, 255, 0.55)',
            border: `1px solid ${T.glass.lightBorderStrong}`,
            borderRadius: T.radius.pill,
            cursor: 'pointer',
            fontFamily: 'inherit',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
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
        >📖 가이드 보기</button>
      </div>

      {/* 데코 라인 — wave + small dot 형식의 청사진 라인 */}
      <svg
        width="100%"
        height="14"
        viewBox="0 0 400 14"
        preserveAspectRatio="none"
        style={{ marginTop: 8 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wfWave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.color.primary} stopOpacity="0" />
            <stop offset="20%" stopColor={T.color.primary} stopOpacity="0.55" />
            <stop offset="60%" stopColor={T.color.electricMint} stopOpacity="0.55" />
            <stop offset="100%" stopColor={T.color.electricMint} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 7 Q 80 2, 160 7 T 320 7 T 480 7"
          stroke="url(#wfWave)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="60" cy="7" r="1.5" fill={T.color.primary} opacity="0.4" />
        <circle cx="220" cy="7" r="1.5" fill={T.color.electricMint} opacity="0.6" />
        <circle cx="350" cy="7" r="1.5" fill={T.color.primary} opacity="0.3" />
      </svg>
    </header>
  );
}
