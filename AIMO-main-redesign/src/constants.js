/* ═══════════════════════════════════════════════════════════════
   constants.js — 디자인 토큰, 카테고리, 유틸리티 함수

   2026-04 v6b — Atelier Cyan 업그레이드 (절제된 미래지향 글래스모피즘):
     - Sprout deep forest 팔레트 유지 (브랜드 일관성)
     - 글래스 토큰 추가: T.glass.{light, dark, hairline, ...}
     - 일렉트릭 민트 #4FE0A8 액센트 (아주 절제적 사용)
     - 모노스페이스 토큰 강화 (수치 표기용)
     - 기존 키 (T.accent, T.color.*, T.font_.*) 100% 호환 유지
   ═══════════════════════════════════════════════════════════════ */

const SPROUT = {
  primary:       '#00522D',
  primaryHover:  '#00422A',
  primaryDark:   '#003319',
  mint:          '#C5E8D6',
  mintSoft:      '#E8F4ED',

  bgPage:        '#F4F7F4',  // 더 차가운 오프화이트 (Atelier Cyan)
  bgCard:        '#FFFFFF',
  bgCardDark:    '#0E1614',
  bgElevated:    '#EBEFE8',

  textPrimary:   '#181D19',
  textSecondary: '#5C6760',
  textMuted:     '#8A9590',
  textOnDark:    '#FFFFFF',
  textOnDarkMuted: 'rgba(255, 255, 255, 0.65)',

  border:        'rgba(24, 29, 25, 0.06)',
  borderStrong:  'rgba(24, 29, 25, 0.10)',
  borderDashed:  'rgba(24, 29, 25, 0.18)',
  divider:       'rgba(24, 29, 25, 0.04)',

  success:       '#00522D',
  successSoft:   'rgba(0, 82, 45, 0.10)',
  warning:       '#E8A33D',
  warningSoft:   'rgba(232, 163, 61, 0.12)',
  error:         '#D14D4D',
  errorSoft:     'rgba(209, 77, 77, 0.10)',
  notif:         '#E26D5A',

  primaryAlpha04: 'rgba(0, 82, 45, 0.04)',
  primaryAlpha06: 'rgba(0, 82, 45, 0.06)',
  primaryAlpha10: 'rgba(0, 82, 45, 0.10)',
  primaryAlpha12: 'rgba(0, 82, 45, 0.12)',
  primaryAlpha18: 'rgba(0, 82, 45, 0.18)',
  primaryAlpha25: 'rgba(0, 82, 45, 0.25)',

  darkGlow: 'radial-gradient(ellipse at right, rgba(79, 224, 168, 0.18) 0%, transparent 60%)',

  /* Atelier Cyan v6b 추가 */
  electricMint:  '#4FE0A8',
  electricMintSoft: 'rgba(79, 224, 168, 0.14)',
  cyanMist:      '#D4E8DD',
};

export const T = {
  bgRoot:        SPROUT.bgPage,
  bgSurface:     SPROUT.bgCard,
  bgCard:        SPROUT.bgCard,
  bgElevated:    SPROUT.bgElevated,

  border:        SPROUT.border,
  borderLight:   SPROUT.divider,

  accent:        SPROUT.primary,
  accentSoft:    SPROUT.primaryAlpha10,
  accentMid:     SPROUT.primaryAlpha18,
  accentGlow:    `0 0 16px ${SPROUT.primaryAlpha25}`,
  accentHover:   SPROUT.primaryHover,

  accent2:       SPROUT.mint,
  accent2Soft:   SPROUT.mintSoft,
  accent3:       SPROUT.primaryDark,
  accent3Soft:   SPROUT.primaryAlpha10,

  error:         SPROUT.error,
  errorSoft:     SPROUT.errorSoft,
  success:       SPROUT.success,
  successSoft:   SPROUT.successSoft,
  warning:       SPROUT.warning,
  warningSoft:   SPROUT.warningSoft,

  textPrimary:   SPROUT.textPrimary,
  textSecondary: SPROUT.textSecondary,
  textMuted:     SPROUT.textMuted,
  textOnAccent:  SPROUT.textOnDark,

  done:          SPROUT.textMuted,
  doneBg:        SPROUT.bgElevated,
  currentBg:     SPROUT.primaryAlpha06,
  currentBorder: SPROUT.primary,

  font:    "'Plus Jakarta Sans','Noto Sans KR','Pretendard',-apple-system,BlinkMacSystemFont,sans-serif",
  mono:    "'JetBrains Mono','Fira Code',ui-monospace,Menlo,monospace",
  display: "'Plus Jakarta Sans',-apple-system,sans-serif",

  color: {
    bgPage:          SPROUT.bgPage,
    bgCard:          SPROUT.bgCard,
    bgCardDark:      SPROUT.bgCardDark,
    bgElevated:      SPROUT.bgElevated,

    textPrimary:     SPROUT.textPrimary,
    textSecondary:   SPROUT.textSecondary,
    textMuted:       SPROUT.textMuted,
    textOnDark:      SPROUT.textOnDark,
    textOnDarkMuted: SPROUT.textOnDarkMuted,

    primary:         SPROUT.primary,
    primaryHover:    SPROUT.primaryHover,
    mint:            SPROUT.mint,
    mintSoft:        SPROUT.mintSoft,

    electricMint:    SPROUT.electricMint,
    electricMintSoft: SPROUT.electricMintSoft,
    cyanMist:        SPROUT.cyanMist,

    darkGlow:        SPROUT.darkGlow,

    border:          SPROUT.border,
    borderStrong:    SPROUT.borderStrong,
    borderDashed:    SPROUT.borderDashed,
    divider:         SPROUT.divider,

    rankFast:        SPROUT.primary,
    rankAvg:         '#7B8EB8',
    success:         SPROUT.success,
    successSoft:     SPROUT.successSoft,
    warning:         SPROUT.warning,
    warningSoft:     SPROUT.warningSoft,
    error:           SPROUT.error,
    errorSoft:       SPROUT.errorSoft,

    notifBadge:      SPROUT.notif,
  },

  /* 글래스모피즘 토큰 — 절제된 사용 */
  glass: {
    light:           'rgba(255, 255, 255, 0.62)',
    lightHover:      'rgba(255, 255, 255, 0.78)',
    lightHairline:   'rgba(255, 255, 255, 0.85)',
    lightBorder:     'rgba(24, 29, 25, 0.05)',
    lightBorderStrong: 'rgba(24, 29, 25, 0.09)',

    dark:            'rgba(14, 22, 20, 0.82)',
    darkHairline:    'rgba(160, 220, 190, 0.10)',
    darkBorder:      'rgba(79, 224, 168, 0.08)',

    blur:            'blur(20px) saturate(160%)',
    blurStrong:      'blur(28px) saturate(180%)',
    blurNav:         'blur(16px) saturate(140%)',

    insetSheen:      'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
    insetSheenDark:  'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },

  font_: {
    family:        "'Plus Jakarta Sans','Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif",
    familyDisplay: "'Plus Jakarta Sans',-apple-system,sans-serif",
    familyMono:    "'JetBrains Mono','Fira Code',ui-monospace,Menlo,monospace",
    size: {
      logo:    36,
      display: 56,
      h1:      28,
      statBig: 34,
      rankNum: 34,
      title:   16,
      body:    15,
      caption: 13,
      tiny:    11,
    },
    weight: {
      light:     300,
      regular:   400,
      medium:    500,
      semibold:  600,
      bold:      700,
      extrabold: 800,
    },
    tracking: {
      tightest: '-0.02em',
      tight:    '-0.01em',
      normal:   '0',
      wide:     '0.04em',
      wider:    '0.12em',
      widest:   '0.18em',
    },
    leading: {
      tight:   1.15,
      normal:  1.45,
      relaxed: 1.6,
    },
  },

  space: {
    xs:      4,
    sm:      8,
    md:      16,
    lg:      24,
    xl:      32,
    xxl:     48,
    xxxl:    64,
    section: 96,
  },

  radius: {
    sm:   8,
    md:   12,
    lg:   20,
    xl:   24,
    xxl:  28,
    pill: 9999,
  },

  shadow: {
    none:    'none',
    ambient: '0 4px 24px rgba(45, 75, 62, 0.05)',
    hover:   '0 6px 28px rgba(45, 75, 62, 0.08)',
    cta:     '0 8px 32px rgba(0, 82, 45, 0.12)',
    dark:    '0 6px 24px rgba(0, 0, 0, 0.18)',
    glass:       '0 8px 32px rgba(45, 75, 62, 0.06), 0 1px 0 rgba(255, 255, 255, 0.6) inset',
    glassHover:  '0 12px 40px rgba(45, 75, 62, 0.10), 0 1px 0 rgba(255, 255, 255, 0.7) inset',
    glassDark:   '0 12px 36px rgba(0, 0, 0, 0.22), 0 1px 0 rgba(255, 255, 255, 0.04) inset',
  },

  brand: {
    name: 'AIMO',
  },
};

export const PASTELS = [
  { bg: '#E8F4ED', border: '#C5E8D6' },
  { bg: '#EFF5EA', border: '#D4E5C6' },
  { bg: '#F0EFE6', border: '#DCD8C0' },
  { bg: '#E8EFEC', border: '#C8D8D0' },
  { bg: '#EEEAE5', border: '#D8CDB8' },
  { bg: '#E5EDE8', border: '#BFD3C7' },
  { bg: '#EBE8DE', border: '#D5CDB8' },
];

export const CATEGORIES = [
  { key: 'move',     label: '이동',      icon: '🚶', color: '#7B8EB8' },
  { key: 'talk',     label: '대화',      icon: '💬', color: '#C49873' },
  { key: 'organize', label: '자료 정리', icon: '📂', color: '#5B8C6A' },
  { key: 'create',   label: '창작',      icon: '✏️', color: '#A87BA0' },
  { key: 'digital',  label: '디지털',    icon: '💻', color: '#6A9BC4' },
  { key: 'physical', label: '신체 활동', icon: '🏃', color: '#C49B6A' },
  { key: 'wait',     label: '대기/점검', icon: '⏳', color: '#A0A078' },
  { key: 'other',    label: '기타',      icon: '📌', color: '#8A9590' },
];

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatMin(min) {
  if (min < 1) return '1분 미만';
  if (min < 60) return `${Math.round(min)}분`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export function formatDate(d) {
  return (d instanceof Date ? d : new Date(d)).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
