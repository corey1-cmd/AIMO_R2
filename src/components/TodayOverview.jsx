/* TodayOverview.jsx — 좌측 첫 카드 (Atelier Cyan v6b)
 * 다크 글래스 카드 + ↗ TODAY OVERVIEW + 3개 큰 숫자 (총 기록 / 평균 속도 / 이번 주)
 * 글래스 처리: rgba(14,22,20,0.82) + backdrop-blur — 절제된 깊이감 */

import { T, formatMin } from '../constants';

export function TodayOverview({ stats }) {
  return (
    <section style={{
      background: T.glass.dark,
      backdropFilter: T.glass.blur,
      WebkitBackdropFilter: T.glass.blur,
      borderRadius: T.radius.xxl,
      padding: '28px 26px',
      color: T.color.textOnDark,
      boxShadow: T.shadow.glassDark,
      border: `1px solid ${T.glass.darkBorder}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 우상단 ambient orb — 옅은 일렉트릭 민트 (눈 안 아프게) */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        right: -50,
        top: -50,
        width: 220,
        height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 224, 168, 0.18) 0%, transparent 65%)',
        pointerEvents: 'none',
        filter: 'blur(2px)',
      }} />
      {/* 좌하단 미세한 보조 글로우 */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        left: -30,
        bottom: -30,
        width: 140,
        height: 140,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(60, 180, 120, 0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* 상단 헤어라인 (sheen) */}
      <div aria-hidden style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
      }} />

      <div style={{
        fontSize: T.font_.size.tiny,
        fontWeight: T.font_.weight.semibold,
        letterSpacing: T.font_.tracking.widest,
        textTransform: 'uppercase',
        color: T.color.textOnDarkMuted,
        marginBottom: 22,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: T.font_.familyMono,
      }}>
        <span style={{
          display: 'inline-block',
          width: 5, height: 5,
          borderRadius: '50%',
          background: T.color.electricMint,
          boxShadow: `0 0 6px ${T.color.electricMint}`,
        }} />
        TODAY OVERVIEW
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
        <Row label="총 기록" value={stats.count} unit="개" />
        <Row
          label="평균 속도"
          value={stats.count ? `${stats.avgSpeed}` : '—'}
          unit={stats.count ? '%' : ''}
          accent={stats.count > 0 && stats.avgSpeed <= 100}
        />
        <Row
          label="이번 주 기록"
          value={stats.weekCount}
          unit={stats.weekMin > 0 ? `· ${formatMin(stats.weekMin)}` : ''}
        />
      </div>
    </section>
  );
}

function Row({ label, value, unit, accent = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontSize: T.font_.size.caption,
        color: T.color.textOnDarkMuted,
        fontWeight: T.font_.weight.regular,
        letterSpacing: '0.01em',
      }}>{label}</span>
      <span style={{
        fontSize: T.font_.size.statBig,
        fontWeight: T.font_.weight.extrabold,
        lineHeight: 1,
        color: accent ? T.color.electricMint : T.color.textOnDark,
        fontFamily: T.font_.familyMono,
        letterSpacing: T.font_.tracking.tightest,
      }}>
        {value}
        <span style={{
          fontSize: T.font_.size.body,
          fontWeight: T.font_.weight.medium,
          marginLeft: 4,
          color: T.color.textOnDarkMuted,
          fontFamily: T.font_.family,
        }}>{unit}</span>
      </span>
    </div>
  );
}
