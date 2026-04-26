/* ═══════════════════════════════════════════════════════════════
   styles.js — CSS 생성 (디자인 토큰 기반)

   2026-04 Sprout 시스템 적용 (patch-v6a-design-system):
     - 색상 토큰을 deep forest 팔레트로 일괄 교체 (constants.js 자동 반영)
     - 하드코딩된 rgba(40,40,205,*) 블루 값을 rgba(0,82,45,*) 그린으로 직접 교체
     - 폰트 import 를 Plus Jakarta Sans + Noto Sans KR 로 변경
     - 호환성: 기존 클래스명/구조 유지. 메인 페이지 컴포넌트 코드는 변경 불필요.

   클래스 구조 그대로 유지 (T 토큰 자동 반영):
     .nav / .nav-* / .shell / .page
     .main-* / .dash / .top3 / .resume / .sb
     .dt-* / .task-* / .analyze-btn / .score-* / .loading-*
     .result-* / .timeline-* / .focus-* / .tilt-*
   ═══════════════════════════════════════════════════════════════ */

export function buildCSS(T) { return `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,500;1,800&family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── CSS Variables ── 브랜드 색을 런타임에서 참조할 수 있도록 노출
     Sprout deep forest 팔레트 (Lenu 가이드 §2-1) */
  :root{
    --brand-primary:${T.accent};
    --brand-hover:${T.accentHover};
    --brand-dark:${T.accent3};
    --brand-light:${T.accent2};
    --brand-mint:${T.accent2};
    --text-main:${T.textPrimary};
    --text-subtle:${T.textSecondary};
    --text-muted:${T.textMuted};
    --status-fast:${T.success};
    --status-slow:${T.error};
    --bg-page:${T.bgRoot};
    --bg-card:${T.bgSurface};
  }

  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;background:${T.bgRoot}}
  body{
    font-family:${T.font};
    color:${T.textPrimary};
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
    /* Atelier Cyan: 차가운 오프화이트 + 두 개의 ambient orb + 매우 옅은 그리드 */
    background-color:${T.bgRoot};
    background-image:
      radial-gradient(at 12% 8%, rgba(79, 224, 168, 0.10) 0px, transparent 42%),
      radial-gradient(at 88% 92%, rgba(0, 82, 45, 0.08) 0px, transparent 48%),
      radial-gradient(at 78% 12%, rgba(197, 232, 214, 0.20) 0px, transparent 38%),
      linear-gradient(${T.bgRoot}, ${T.bgRoot});
    background-attachment:fixed;
    position:relative;
  }
  /* 청사진 그리드 — 매우 옅게, 1.5%에서 거의 안 보임 */
  body::before{
    content:'';
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:0;
    background-image:
      linear-gradient(to right, rgba(24, 29, 25, 0.025) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(24, 29, 25, 0.025) 1px, transparent 1px);
    background-size:48px 48px;
    mask-image:radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 90%);
    -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 90%);
  }
  body > *{position:relative;z-index:1}
  /* 스크롤바 (Webkit) — 가는, 미래지향적 */
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(0, 82, 45, 0.18);border-radius:9999px;border:2px solid transparent;background-clip:padding-box}
  ::-webkit-scrollbar-thumb:hover{background:rgba(0, 82, 45, 0.32);background-clip:padding-box;border:2px solid transparent}
  /* 텍스트 선택 색 */
  ::selection{background:rgba(79, 224, 168, 0.30);color:${T.textPrimary}}

  /* 글래스 카드 유틸 (인라인 스타일에서도 호출 가능) */
  .glass-card{
    background:${T.glass.light};
    backdrop-filter:${T.glass.blur};
    -webkit-backdrop-filter:${T.glass.blur};
    border:1px solid ${T.glass.lightBorder};
    box-shadow:${T.shadow.glass};
  }
  .glass-card-dark{
    background:${T.glass.dark};
    backdrop-filter:${T.glass.blur};
    -webkit-backdrop-filter:${T.glass.blur};
    border:1px solid ${T.glass.darkBorder};
    box-shadow:${T.shadow.glassDark};
  }

  /* CTA 펄스 애니메이션 (절제된 사용 — 작은 점 1개에만) */
  @keyframes cyanPulse{
    0%,100%{opacity:0.55;transform:scale(1)}
    50%{opacity:1;transform:scale(1.15)}
  }
  /* 도트 회전 (AIMOInfoCard 큐브용) */
  @keyframes orbitDot{
    from{transform:rotate(0deg) translateX(20px) rotate(0deg)}
    to{transform:rotate(360deg) translateX(20px) rotate(-360deg)}
  }

  .nav{position:fixed;top:0;left:0;right:0;height:72px;background:rgba(244,247,244,0.72);border-bottom:1px solid ${T.glass.lightBorder};display:flex;align-items:center;padding:0 56px;z-index:100;backdrop-filter:${T.glass.blurNav};-webkit-backdrop-filter:${T.glass.blurNav}}
  .nav-logo{font-family:${T.display};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${T.accent};cursor:pointer;background:none;border:none;user-select:none}
  .nav-links{display:flex;gap:4px;margin-left:auto}
  .nav-link{padding:8px 16px;font-size:13px;font-weight:500;color:${T.textSecondary};background:none;border:none;border-radius:8px;cursor:pointer;font-family:inherit;transition:all 150ms;white-space:nowrap}
  .nav-link:hover{color:${T.textPrimary};background:${T.bgElevated}}
  .nav-link--active{color:${T.accent};background:${T.accentSoft}}
  .shell{min-height:100vh;padding-top:72px}
  .page{max-width:1180px;margin:0 auto;padding:40px 56px 96px}
  @media(max-width:1100px){.page{padding:32px 32px 64px}}
  @media(max-width:768px){.page{padding:24px 16px 48px}.nav{padding:0 24px}.nav-links{gap:0}.nav-link{padding:6px 10px;font-size:12px}}

  /* ── Main Hero + Cards (틸트 적용) ── */
  .main-hero{text-align:center;padding:64px 0 40px}
  .main-title{font-family:${T.display};font-size:48px;font-weight:700;letter-spacing:-0.03em;line-height:1.15;margin-bottom:12px;background:linear-gradient(135deg,${T.accent} 0%,${T.accent2} 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .main-sub{font-size:16px;color:${T.textSecondary};max-width:400px;margin:0 auto}
  .main-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:720px;margin:0 auto;padding-top:16px}
  .main-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px 24px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:16px;cursor:pointer;transition:transform 0.2s,border-color 0.2s;min-height:180px;overflow:hidden;color:inherit;position:relative}
  .main-card:hover{border-color:${T.accent}}
  .main-card-icon{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;position:relative;z-index:1}
  .mc-icon-distill{background:${T.accentSoft}}.mc-icon-record{background:${T.accent2Soft}}.mc-icon-analysis{background:${T.accent3Soft}}.mc-icon-focus{background:${T.warningSoft}}
  .main-card-title{font-size:16px;font-weight:600;position:relative;z-index:1}
  .main-card-desc{font-size:13px;color:${T.textSecondary};text-align:center;line-height:1.4;position:relative;z-index:1}
  @media(max-width:640px){.main-cards{grid-template-columns:1fr 1fr}.main-hero{padding:40px 0 28px}.main-title{font-size:36px}}

  /* ── Dashboard (메인 상단 요약) ── */
  .dash{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:720px;margin:0 auto 28px}
  .dash-card{padding:18px 20px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:14px;display:flex;flex-direction:column;gap:4px}
  .dash-label{font-size:11px;color:${T.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em}
  .dash-value{font-family:${T.display};font-size:26px;font-weight:700;color:${T.accent};line-height:1.1}
  .dash-sub{font-size:11px;color:${T.textSecondary}}
  @media(max-width:640px){.dash{grid-template-columns:1fr 1fr}.dash-card:last-child{grid-column:1/-1}}

  /* ── Top3 / 최근 기록 섹션 ── */
  .section{max-width:720px;margin:0 auto 28px}
  .section-title{font-size:14px;font-weight:600;margin-bottom:12px;color:${T.textPrimary};display:flex;align-items:center;gap:8px}
  .section-title-sub{font-size:11px;color:${T.textMuted};font-weight:500;margin-left:auto}
  .top3-list{display:flex;flex-direction:column;gap:8px}
  .top3-item{display:flex;align-items:center;gap:14px;padding:12px 16px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:10px;cursor:pointer;position:relative;transition:transform 0.2s,border-color 0.2s}
  .top3-rank{font-family:${T.display};font-size:22px;font-weight:700;color:${T.accent};width:24px;text-align:center;flex-shrink:0;position:relative;z-index:1}
  .top3-body{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;position:relative;z-index:1}
  .top3-t-title{font-size:13px;font-weight:600;color:${T.textPrimary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .top3-t-meta{font-size:11px;color:${T.textMuted};font-family:${T.mono}}

  /* ── Resume Session Banner (진행중 플랜) ── */
  .resume-banner{max-width:720px;margin:0 auto 24px;padding:18px 22px;background:linear-gradient(135deg,${T.accentSoft} 0%,${T.accent2Soft} 100%);border:1px solid ${T.accent};border-radius:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .resume-icon{width:44px;height:44px;border-radius:12px;background:${T.accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
  .resume-body{flex:1;min-width:200px}
  .resume-title{font-size:14px;font-weight:700;color:${T.textPrimary};margin-bottom:2px}
  .resume-sub{font-size:12px;color:${T.textSecondary}}
  .resume-actions{display:flex;gap:8px}
  .resume-btn{padding:10px 18px;font-size:13px;font-weight:600;font-family:inherit;background:${T.accent};color:#fff;border:none;border-radius:8px;cursor:pointer;transition:all 150ms}
  .resume-btn:hover{background:${T.accentHover};transform:translateY(-1px)}
  .resume-btn--ghost{background:transparent;color:${T.accent};border:1px solid ${T.accent}}
  .resume-btn--ghost:hover{background:${T.accentSoft};transform:none}

  /* ── StatusBadge ── HackHack Status 시스템을 기록 속도 순위에 매핑 */
  .sb{display:inline-flex;align-items:center;padding:3px 9px;border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.02em;white-space:nowrap}
  .sb--fast{background:${T.successSoft};color:${T.success}}
  .sb--avg{background:${T.accent2Soft};color:${T.accent2}}
  .sb--slow{background:${T.errorSoft};color:${T.error}}
  .sb--ongoing{background:${T.accent};color:#fff}
  .sb--pending{background:${T.bgElevated};color:${T.textMuted}}

  /* ── Distill 입력 ── */
  .dt-header{display:flex;align-items:center;gap:12px;margin-bottom:28px;flex-wrap:wrap}
  .dt-title{font-family:${T.display};font-size:28px;font-weight:700}
  .dt-step-badge{display:inline-flex;padding:4px 12px;font-size:12px;font-weight:600;color:${T.accent};background:${T.accentSoft};border-radius:9999px}
  .task-input-list{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
  .task-card{display:flex;gap:12px;align-items:flex-start;padding:16px 20px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;transition:border-color 200ms;animation:taskIn 250ms ease}
  @keyframes taskIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .task-card:focus-within{border-color:${T.accent}}
  .task-num{flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:${T.accent};background:${T.accentSoft};margin-top:2px}
  .task-fields{flex:1;display:flex;flex-direction:column;gap:8px}
  .task-title-input{width:100%;padding:0;border:none;outline:none;font-size:15px;font-weight:500;font-family:inherit;color:${T.textPrimary};background:transparent}
  .task-title-input::placeholder{color:${T.textMuted}}
  .task-meta-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .task-meta-input{padding:6px 10px;font-size:12px;font-family:inherit;background:${T.bgElevated};border:1px solid ${T.borderLight};border-radius:6px;color:${T.textPrimary};outline:none;transition:border-color 150ms;width:140px}
  .task-meta-input:focus{border-color:${T.accent}}.task-meta-input::placeholder{color:${T.textMuted}}
  .task-remove{flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:${T.textMuted};cursor:pointer;border-radius:6px;font-size:16px;transition:all 150ms;margin-top:2px}
  .task-remove:hover{color:${T.error};background:${T.errorSoft}}
  .add-task-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;background:transparent;border:2px dashed ${T.border};border-radius:12px;color:${T.textMuted};font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:all 200ms}
  .add-task-btn:hover{border-color:${T.accent};color:${T.accent};background:${T.accentSoft}}
  .add-task-btn:disabled{opacity:0.4;cursor:not-allowed}.add-task-btn:disabled:hover{border-color:${T.border};color:${T.textMuted};background:transparent}
  .analyze-row{display:flex;justify-content:flex-end;gap:12px;margin-top:8px;align-items:center;flex-wrap:wrap}
  .analyze-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:${T.accent};color:${T.textOnAccent};font-size:15px;font-weight:600;border:none;border-radius:10px;cursor:pointer;font-family:inherit;transition:all 200ms;box-shadow:0 2px 8px rgba(0,82,45,0.22)}
  .analyze-btn:hover{box-shadow:${T.accentGlow};transform:translateY(-1px)}.analyze-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none}

  .score-panel{background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
  .score-item{display:flex;flex-direction:column;gap:2px}
  .score-label{font-size:11px;color:${T.textMuted};font-weight:500;text-transform:uppercase;letter-spacing:0.04em}
  .score-value{font-family:${T.mono};font-size:15px;font-weight:600}
  .score-bar{width:80px;height:6px;border-radius:3px;background:${T.bgElevated};overflow:hidden}
  .score-bar-fill{height:100%;border-radius:3px}

  .loading-wrap{display:flex;flex-direction:column;align-items:center;gap:20px;padding:80px 0}
  .spinner{width:48px;height:48px;border-radius:50%;border:3px solid ${T.border};border-top-color:${T.accent};animation:spin 700ms linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loading-text{font-size:15px;color:${T.textSecondary};font-weight:500}
  .loading-steps{display:flex;flex-direction:column;gap:6px;font-size:13px;color:${T.textMuted}}
  .loading-step{display:flex;align-items:center;gap:8px;transition:color 300ms}
  .loading-step--active{color:${T.accent};font-weight:500}.loading-step--done{color:${T.done}}
  .loading-step-dot{width:8px;height:8px;border-radius:50%;border:2px solid currentColor;flex-shrink:0;transition:all 300ms}
  .loading-step--done .loading-step-dot{background:currentColor}

  .result-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
  .timeline-panel{grid-column:1/-1;background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:20px}
  .result-panel-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
  .result-panel-icon{font-size:16px}
  .timeline-list{display:flex;flex-direction:column;gap:6px;list-style:none}
  .timeline-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;cursor:grab;transition:all 200ms;border:1px solid transparent;user-select:none}
  .timeline-item:active{cursor:grabbing}.timeline-item:hover{background:${T.bgCard};border-color:${T.borderLight}}
  .timeline-item--dragging{opacity:0.5;background:${T.accentSoft}}.timeline-item--dragover{border-color:${T.accent};background:${T.accentSoft}}
  .timeline-order{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:${T.bgElevated};color:${T.textSecondary};flex-shrink:0}
  .timeline-bar-track{height:6px;border-radius:3px;background:${T.bgElevated};overflow:hidden;margin-top:4px}
  .timeline-bar-fill{height:100%;border-radius:3px;transition:width 300ms}
  .timeline-time{font-family:${T.mono};font-size:12px;color:${T.textSecondary};white-space:nowrap;flex-shrink:0}
  .timeline-handle{color:${T.textMuted};font-size:14px;flex-shrink:0;cursor:grab}

  .confirm-row{display:flex;justify-content:center;gap:12px;margin-top:8px}
  .confirm-btn{display:inline-flex;align-items:center;gap:8px;padding:16px 40px;background:${T.accent};color:${T.textOnAccent};font-size:16px;font-weight:600;border:none;border-radius:12px;cursor:pointer;font-family:inherit;transition:all 200ms;box-shadow:0 4px 16px rgba(0,82,45,0.25)}
  .confirm-btn:hover{box-shadow:0 6px 24px rgba(0,82,45,0.38);transform:translateY(-2px)}
  .back-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:13px;font-weight:500;font-family:inherit;color:${T.textSecondary};background:transparent;border:1px solid ${T.border};border-radius:8px;cursor:pointer;transition:all 150ms}
  .back-btn:hover{border-color:${T.accent};color:${T.textPrimary}}

  /* ── Activity / Focus 공유 스타일 ── */
  .activity-global-bar{margin-bottom:28px}
  .agb-label-row{display:flex;justify-content:space-between;margin-bottom:6px}
  .agb-label{font-size:13px;font-weight:500;color:${T.textSecondary}}
  .agb-pct{font-family:${T.mono};font-size:13px;font-weight:600;color:${T.accent}}
  .agb-track{height:10px;background:${T.bgElevated};border-radius:5px;overflow:hidden}
  .agb-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,${T.accent},${T.accent2});transition:width 500ms}
  .activity-list{display:flex;flex-direction:column;gap:10px}
  .activity-item{display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:12px;border:2px solid transparent;transition:all 300ms}
  .activity-item--done{background:${T.doneBg};border-color:${T.doneBg};opacity:0.7}
  .activity-item--done .ai-title{text-decoration:line-through;color:${T.done}}
  .activity-item--current{background:${T.currentBg};border-color:${T.currentBorder};animation:pulse 2s ease infinite}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,82,45,0.20)}50%{box-shadow:0 0 0 10px rgba(0,82,45,0)}}
  .activity-item--pending{background:${T.bgSurface};border-color:${T.border}}
  .ai-order{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0}
  .ai-order--done{background:${T.doneBg};color:${T.done}}.ai-order--current{background:${T.accent};color:${T.textOnAccent}}.ai-order--pending{background:${T.bgElevated};color:${T.textMuted}}
  .ai-body{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
  .ai-title{font-size:14px;font-weight:500;transition:all 300ms}
  .ai-time-row{display:flex;gap:12px;font-size:12px;flex-wrap:wrap}
  .ai-time-label{color:${T.textMuted}}.ai-time-value{font-family:${T.mono};font-weight:500}
  .ai-time-est{color:${T.textSecondary}}.ai-time-actual{color:${T.accent}}
  .ai-time-diff{font-weight:600}.ai-time-diff--fast{color:${T.success}}.ai-time-diff--slow{color:${T.error}}
  .ai-done-btn{padding:8px 16px;font-size:12px;font-weight:600;font-family:inherit;background:${T.accent};color:${T.textOnAccent};border:none;border-radius:8px;cursor:pointer;transition:all 150ms}
  .ai-done-btn:hover{box-shadow:${T.accentGlow}}

  /* ── Focus Page (하나의 할일에만 집중) ── */
  .focus-wrap{max-width:560px;margin:0 auto}
  .focus-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap}
  .focus-title{font-family:${T.display};font-size:26px;font-weight:700}
  .focus-progress{background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:14px 18px;margin-bottom:20px}
  .focus-progress-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
  .focus-card{position:relative;background:${T.bgSurface};border:2px solid ${T.accent};border-radius:20px;padding:32px 28px;display:flex;flex-direction:column;gap:20px;min-height:300px;box-shadow:0 12px 40px rgba(0,82,45,0.12);overflow:hidden}
  .focus-card-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(800px circle at 50% 0%,${T.accentSoft},transparent 50%)}
  .focus-card-step{font-size:11px;color:${T.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.08em;position:relative;z-index:1}
  .focus-card-title{font-family:${T.display};font-size:26px;font-weight:700;color:${T.textPrimary};line-height:1.3;position:relative;z-index:1}
  .focus-card-tags{display:flex;gap:6px;flex-wrap:wrap;position:relative;z-index:1}
  .focus-card-tag{font-size:11px;padding:4px 10px;border-radius:6px;font-weight:600}
  .focus-timer{display:flex;flex-direction:column;align-items:center;gap:4px;padding:20px;background:${T.bgCard};border-radius:14px;position:relative;z-index:1}
  .focus-timer-val{font-family:${T.mono};font-size:44px;font-weight:600;color:${T.accent};line-height:1;letter-spacing:-0.02em}
  .focus-timer-val--over{color:${T.error}}
  .focus-timer-label{font-size:11px;color:${T.textMuted};text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
  .focus-timer-est{font-size:11px;color:${T.textSecondary};font-family:${T.mono}}
  .focus-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}
  .focus-btn{padding:12px 28px;font-size:14px;font-weight:600;border-radius:10px;border:none;cursor:pointer;font-family:inherit;transition:all 200ms}
  .focus-btn--primary{background:${T.accent};color:#fff;box-shadow:0 2px 8px rgba(0,82,45,0.28)}
  .focus-btn--primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,82,45,0.40)}
  .focus-btn--ghost{background:${T.bgSurface};color:${T.textSecondary};border:1px solid ${T.border}}
  .focus-btn--ghost:hover{border-color:${T.accent};color:${T.accent}}
  .focus-mini{margin-top:20px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:12px 4px}
  .focus-mini-title{font-size:11px;font-weight:700;color:${T.textMuted};text-transform:uppercase;letter-spacing:0.05em;padding:4px 14px 10px}
  .focus-mini-item{display:flex;align-items:center;gap:10px;padding:7px 14px;font-size:12px}
  .focus-mini-item--done{opacity:0.55}
  .focus-mini-item--done .focus-mini-label{text-decoration:line-through}
  .focus-mini-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${T.bgElevated}}
  .focus-mini-item--done .focus-mini-dot{background:${T.success}}
  .focus-mini-item--current .focus-mini-dot{background:${T.accent};box-shadow:0 0 0 3px ${T.accentSoft}}
  .focus-mini-label{flex:1;color:${T.textSecondary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .focus-mini-time{font-family:${T.mono};font-size:11px;color:${T.textMuted}}
  .focus-empty{text-align:center;padding:72px 24px;display:flex;flex-direction:column;align-items:center;gap:12px}
  .focus-empty-icon{font-size:44px;opacity:0.5}
  .focus-empty-text{font-size:15px;color:${T.textSecondary}}

  /* ── Summary ── */
  .summary-wrap{text-align:center;padding:40px 0}
  .summary-emoji{font-size:56px;margin-bottom:16px;animation:bounce 500ms ease}
  @keyframes bounce{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  .summary-title{font-family:${T.display};font-size:28px;font-weight:700;margin-bottom:24px}
  .summary-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:480px;margin:0 auto 32px}
  .summary-stat{padding:20px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;display:flex;flex-direction:column;gap:4px}
  .summary-stat-label{font-size:12px;color:${T.textSecondary};font-weight:500}
  .summary-stat-value{font-family:${T.mono};font-size:20px;font-weight:600;color:${T.accent}}
  .summary-stat-sub{font-size:11px;color:${T.textMuted}}
  .summary-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
  .summary-learn-msg{margin-top:16px;font-size:13px;color:${T.accent};font-weight:500}
  @media(max-width:480px){.summary-stats{grid-template-columns:1fr}}

  /* ── Record 목록/카드 ── */
  .record-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
  .record-title{font-family:${T.display};font-size:28px;font-weight:700}
  .record-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
  .record-filter{padding:6px 14px;font-size:12px;font-weight:500;font-family:inherit;border-radius:9999px;border:1px solid ${T.border};color:${T.textSecondary};background:transparent;cursor:pointer;transition:all 150ms;white-space:nowrap}
  .record-filter:hover{border-color:${T.accent};color:${T.textPrimary}}
  .record-filter--active{background:${T.accentSoft};border-color:${T.accent};color:${T.accent}}
  .record-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .record-card{background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;transition:transform 0.2s,border-color 0.2s;cursor:pointer;position:relative}
  .record-card:hover{border-color:${T.accent}}
  .rc-title{font-size:15px;font-weight:700;color:${T.textPrimary};position:relative;z-index:1}
  .rc-tasks{font-size:12px;color:${T.textMuted};display:flex;align-items:center;gap:6px;position:relative;z-index:1}
  .rc-tasks-count{font-weight:600;color:${T.textSecondary}}
  .rc-meta{display:flex;gap:16px;font-size:12px;color:${T.textMuted};position:relative;z-index:1}
  .rc-meta-value{font-family:${T.mono};font-weight:500;color:${T.textSecondary}}
  .rc-bottom{display:flex;align-items:center;justify-content:space-between;margin-top:auto;position:relative;z-index:1}
  .rc-date{font-size:11px;color:${T.textMuted};font-family:${T.mono}}
  .rc-save-btn{padding:4px 10px;font-size:11px;font-weight:500;font-family:inherit;color:${T.accent};background:${T.accentSoft};border:none;border-radius:6px;cursor:pointer;transition:all 150ms}
  .rc-save-btn:hover{background:${T.accentMid}}.rc-save-btn--saved{color:${T.textMuted};background:${T.bgElevated}}

  /* ── Analysis ── */
  .analysis-title{font-family:${T.display};font-size:28px;font-weight:700;margin-bottom:24px}
  .analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  @media(max-width:640px){.analysis-grid{grid-template-columns:1fr}}
  .analysis-card{background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:16px}
  .analysis-card--wide{grid-column:1/-1}
  .ac-title{font-size:15px;font-weight:600}
  .ac-bar-chart{display:flex;flex-direction:column;gap:10px}
  .ac-bar-row{display:flex;align-items:center;gap:12px}
  .ac-bar-label{font-size:12px;font-weight:500;color:${T.textSecondary};width:92px;text-align:right;flex-shrink:0}
  .ac-bar-track{flex:1;height:24px;background:${T.bgElevated};border-radius:6px;overflow:hidden}
  .ac-bar-fill{height:100%;border-radius:6px;transition:width 600ms;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;font-size:11px;font-weight:600;color:white;min-width:32px}
  .ac-bar-value{font-family:${T.mono};font-size:12px;font-weight:500;color:${T.textSecondary};width:52px;text-align:right;flex-shrink:0}
  .pie-wrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center}
  .pie-legend{display:flex;flex-direction:column;gap:6px}
  .pie-legend-item{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:${T.textSecondary}}
  .pie-legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
  .trend-rows{display:flex;flex-direction:column;gap:8px}
  .trend-row{display:flex;align-items:center;gap:12px;font-size:13px}
  .trend-date{font-size:12px;color:${T.textMuted};width:72px;flex-shrink:0;font-family:${T.mono}}
  .trend-bars{flex:1;display:flex;gap:4px;align-items:center;height:20px}
  .trend-bar{height:100%;border-radius:4px;transition:width 400ms}
  .trend-bar--est{background:${T.accent3Soft};border:1px solid ${T.accent3}}
  .trend-bar--actual{background:${T.accentSoft};border:1px solid ${T.accent}}
  .trend-labels{font-size:11px;color:${T.textMuted};display:flex;gap:8px}

  /* ── Library ── */
  .library-title{font-family:${T.display};font-size:28px;font-weight:700;margin-bottom:24px}

  /* ── Record Detail ── */
  .rd-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:28px}
  .rd-title{font-family:${T.display};font-size:26px;font-weight:700;color:${T.textPrimary};line-height:1.3}
  .rd-actions{flex-shrink:0}
  .rd-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
  @media(max-width:640px){.rd-summary{grid-template-columns:repeat(2,1fr)}}
  .rd-stat{display:flex;flex-direction:column;gap:4px;padding:16px;background:${T.bgSurface};border:1px solid ${T.border};border-radius:12px}
  .rd-stat-icon{font-size:20px}
  .rd-stat-label{font-size:11px;font-weight:500;color:${T.textMuted};text-transform:uppercase;letter-spacing:0.04em}
  .rd-stat-value{font-family:${T.mono};font-size:18px;font-weight:600;color:${T.textPrimary}}
  .rd-val-fast{color:${T.success}}
  .rd-stat-sub{font-size:11px;color:${T.textMuted}}
  .rd-section{margin-bottom:32px}
  .rd-section-title{font-size:17px;font-weight:600;color:${T.textPrimary};margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid ${T.border}}
  .rd-timeline{display:flex;flex-direction:column;gap:0}
  .rd-tl-item{display:flex;gap:16px}
  .rd-tl-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px}
  .rd-tl-order{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;background:${T.accentSoft};color:${T.accent};flex-shrink:0}
  .rd-tl-line{flex:1;width:2px;background:${T.border};margin:6px 0}
  .rd-tl-item:last-child .rd-tl-line{display:none}
  .rd-tl-card{flex:1;background:${T.bgSurface};border:1px solid ${T.border};border-radius:10px;padding:16px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px;transition:border-color 200ms}
  .rd-tl-card:hover{border-color:${T.accent}}
  .rd-tl-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .rd-tl-cat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .rd-tl-title{font-size:14px;font-weight:500;color:${T.textPrimary};flex:1;min-width:0}
  .rd-tl-cat-label{font-size:11px;color:${T.textMuted};white-space:nowrap}
  .rd-tl-times{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
  .rd-tl-time{display:flex;align-items:baseline;gap:4px}
  .rd-tl-time-label{font-size:11px;color:${T.textMuted}}
  .rd-tl-time-val{font-family:${T.mono};font-size:13px;font-weight:500;color:${T.textSecondary}}
  .rd-tl-time-actual{color:${T.accent}}
  .rd-tl-diff{font-family:${T.mono};font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px}
  .rd-tl-diff--fast{background:${T.successSoft};color:${T.success}}
  .rd-tl-diff--slow{background:${T.errorSoft};color:${T.error}}
  .rd-tl-bar-track{height:6px;border-radius:3px;background:${T.bgElevated};overflow:hidden}
  .rd-tl-bar-fill{height:100%;border-radius:3px;transition:width 400ms}
  .library-empty{text-align:center;padding:80px 0;color:${T.textMuted}}
  .library-empty-icon{font-size:48px;margin-bottom:12px;opacity:0.5}.library-empty-text{font-size:15px}
  .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:64px 24px;text-align:center}
  .empty-icon{font-size:48px;opacity:0.4}.empty-text{font-size:15px;color:${T.textMuted}}

  /* ── Toast (HackHack 브랜드 다크 톤으로) ── */
  @keyframes toastIn{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
  @keyframes toastOut{from{opacity:1}to{transform:translate(-50%,-10px);opacity:0}}
  .toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);padding:12px 24px;background:${T.accent3};color:#fff;font-size:14px;font-weight:500;border-radius:10px;z-index:300;box-shadow:0 8px 32px rgba(0,51,25,0.30);animation:toastIn 250ms ease forwards;pointer-events:none}
  .toast--out{animation:toastOut 200ms ease forwards}
`; }
