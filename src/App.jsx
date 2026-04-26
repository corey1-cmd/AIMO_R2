/* ═══════════════════════════════════════════════════════════════
   App.jsx — UI 컴포넌트 (순수 화면 로직)

   2026-04 업그레이드:
     ① useTilt 3D 카드 (메인 카드·Top3·기록 카드·라이브러리 카드)
     ② StatusBadge 컴포넌트 (속도 순위 표시 통일)
     ③ 메인 대시보드 (총 기록 / 평균 속도 / 이번 주) + Top3 빠른 완료 + 최근 기록
     ④ /focus 라우트 — 하나의 할 일에만 집중하는 포커스 모드
     ⑤ localStorage 영속화 (기록 / 라이브러리 / 진행중 플랜)
     ⑥ 메인 상단 "진행 중인 플랜 이어서 하기" 배너

   AI 엔진 수정 시 이 파일을 건드리지 마세요. → src/engine.js
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { T, PASTELS, CATEGORIES, uid, formatMin, formatDate } from './constants';
import { runAnalysis, BEHAVIOR_TYPES, BUCKET_LABELS } from './engine';
import { loadLD, saveLD, accumLD } from './learning';
import { buildCSS } from './styles';
import { MOCK_RECORDS } from './data';
import { useTilt, tiltGlowStyle } from './useTilt';
import {
  loadRecords, saveRecords, loadSavedIds, saveSavedIds,
  loadPlan, savePlan, clearPlan,
} from './storage';
import { AuthButton } from './auth/AuthButton.jsx';
import { LoginPage } from './auth/LoginPage.jsx';
import { useAuth } from './auth/AuthProvider.jsx';

// 메인 페이지 컴포넌트 (Lenu 가이드 §4 기반)
import { TodayOverview } from './components/TodayOverview.jsx';
import { Top3 } from './components/Top3.jsx';
import { RecentCompleted } from './components/RecentCompleted.jsx';
import { QuickEntry } from './components/QuickEntry.jsx';
import { AIMOInfoCard } from './components/AIMOInfoCard.jsx';
import { RightPanel } from './components/RightPanel.jsx';

const CSS = buildCSS(T);

/* ═══ 공통 유틸 ═══ */
function catColor(c) { return CATEGORIES.find(x => x.key === c)?.color || T.textMuted; }
function catLabel(c) { return CATEGORIES.find(x => x.key === c)?.label || "기타"; }
function catIcon(c) { return CATEGORIES.find(x => x.key === c)?.icon || "📌"; }
function btInfo(bt) { return BEHAVIOR_TYPES[bt] || BEHAVIOR_TYPES.COGNITIVE; }
function bucketLabel(b) { return BUCKET_LABELS[b] || b; }

/* ═══ Toast ═══ */
function Toast({ message, visible }) {
  const [phase, setPhase] = useState("in");
  useEffect(() => {
    if (!visible) return;
    setPhase("in");
    const t = setTimeout(() => setPhase("out"), 2200);
    return () => clearTimeout(t);
  }, [visible, message]);
  if (!visible) return null;
  return <div className={`toast ${phase === "out" ? "toast--out" : ""}`}>{message}</div>;
}

/* ═══ StatusBadge — 속도 순위 통일 (fast/avg/slow) ═══ */
function StatusBadge({ level, label }) {
  const cls = level === "fast" ? "sb--fast" : level === "slow" ? "sb--slow" : "sb--avg";
  return <span className={`sb ${cls}`}>{label}</span>;
}

/* ═══ TiltCard — 자식을 렌더 + 자동으로 glow 오버레이 삽입 ═══ */
function TiltCard({ as = "div", className = "", style, glowColor, children, disabled, onClick, onMouseEnter, onMouseLeave, ...rest }) {
  const tilt = useTilt({ disabled });
  const Tag = as;
  return (
    <Tag
      ref={tilt.ref}
      className={className}
      style={{ position: "relative", ...style }}
      onMouseEnter={(e) => { tilt.onMouseEnter(e); onMouseEnter?.(e); }}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={(e) => { tilt.onMouseLeave(e); onMouseLeave?.(e); }}
      onClick={onClick}
      {...rest}
    >
      <div aria-hidden style={tiltGlowStyle(glowColor)} />
      {children}
    </Tag>
  );
}

/* ═══ NavBar — AIMO branded (Lenu §3, §4-1) ═══ */
const NAV = [
  { label: 'Make',     to: '/distill' },
  { label: 'Focus',    to: '/focus' },
  { label: 'Record',   to: '/record' },
  { label: 'Analysis', to: '/analysis' },
  { label: 'Library',  to: '/library' },
  { label: 'Share',    to: '/share', disabled: true },
];

function NavBar({ currentPath, onNavigate }) {
  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      background: 'rgba(244, 247, 244, 0.72)',
      borderBottom: `1px solid ${T.glass.lightBorder}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 56px',
      gap: 32,
      zIndex: 100,
      backdropFilter: T.glass.blurNav,
      WebkitBackdropFilter: T.glass.blurNav,
    }}>
      {/* 미래지향 헤어라인 — 네비 하단에 1px 그라디언트 라인 (절제됨) */}
      <div aria-hidden style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${T.color.electricMint} 22%, ${T.color.primary} 50%, ${T.color.electricMint} 78%, transparent 100%)`,
        opacity: 0.18,
        pointerEvents: 'none',
      }} />
      <button
        onClick={() => onNavigate('/')}
        style={{
          fontFamily: T.font_.familyDisplay,
          fontSize: T.font_.size.logo,
          fontWeight: T.font_.weight.extrabold,
          fontStyle: 'italic',
          letterSpacing: T.font_.tracking.wider,
          color: T.color.primary,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          position: 'relative',
        }}
      >
        AIMO
        <span aria-hidden style={{
          width: 6, height: 6, borderRadius: '50%',
          background: T.color.electricMint,
          boxShadow: `0 0 8px ${T.color.electricMint}`,
          animation: 'cyanPulse 2.4s ease-in-out infinite',
          marginBottom: 2,
        }} />
      </button>

      <nav style={{ display: 'flex', gap: 4, marginLeft: 24 }}>
        {NAV.map(({ label, to, disabled }) => {
          const active = currentPath === to ||
            (to === '/record' && currentPath.startsWith('/record'));
          return (
            <button
              key={to}
              onClick={() => !disabled && onNavigate(to)}
              disabled={disabled}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: T.font_.weight.medium,
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
                color: active ? T.color.primary : (disabled ? T.color.textMuted : T.color.textSecondary),
                background: active ? T.color.mintSoft : 'transparent',
                border: active ? `1px solid ${T.glass.lightBorderStrong}` : '1px solid transparent',
                borderRadius: T.radius.pill,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (disabled || active) return;
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                e.currentTarget.style.borderColor = T.glass.lightBorder;
              }}
              onMouseLeave={(e) => {
                if (disabled || active) return;
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          aria-label="알림"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.color.textSecondary,
            transition: 'background 200ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.color.mintSoft; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <AuthButton />
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MainPage — Lenu 디자인 가이드 §3 기반 2-column 레이아웃
   좌측: TodayOverview / Top3 / RecentCompleted / QuickEntry / AIMOInfoCard
   우측: RightPanel (input mode | focus mode 자동 전환)
   ═══════════════════════════════════════════════════════════════ */
function MainPage({ onNavigate, records, activePlan, onAnalyze, onClosePlan }) {
  const stats = useMemo(() => {
    const count = records.length;
    if (!count) return { count: 0, avgSpeed: 0, weekCount: 0, weekMin: 0 };
    let totalEst = 0, totalAct = 0;
    for (const r of records) { totalEst += r.totalEstMin; totalAct += r.totalActualMin; }
    const avgSpeed = totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : 100;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const wk = records.filter(r => new Date(r.date).getTime() >= weekAgo);
    const weekMin = wk.reduce((s, r) => s + r.totalActualMin, 0);
    return { count, avgSpeed, weekCount: wk.length, weekMin };
  }, [records]);

  const top3 = useMemo(() => {
    return [...records]
      .filter(r => r.rankLevel === "fast")
      .sort((a, b) => (a.totalActualMin / a.totalEstMin) - (b.totalActualMin / b.totalEstMin))
      .slice(0, 3);
  }, [records]);

  const recent = useMemo(() => {
    return [...records]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
  }, [records]);

  const hasActiveSession = !!(activePlan && activePlan.items && activePlan.items.length > 0);
  const rightMode = hasActiveSession ? 'focus' : 'input';

  return (
    <div style={{
      maxWidth: 1480,
      margin: '0 auto',
      padding: '40px 56px 96px',
    }}>
      <div className="main-grid" style={{
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        gap: 40,
        alignItems: 'flex-start',
      }}>
        {/* 좌측 컬럼 — 회상 모드 (어제 한 일·기록·빠른 진입) */}
        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          minWidth: 0,
        }}>
          <TodayOverview stats={stats} />
          <Top3
            items={top3}
            onSelect={(id) => onNavigate(`/record/${id}`)}
          />
          <RecentCompleted
            items={recent}
            onSelect={(id) => onNavigate(`/record/${id}`)}
            onSeeAll={() => onNavigate('/record')}
          />
          <QuickEntry onNavigate={onNavigate} />
          <AIMOInfoCard onLearnMore={() => onNavigate('/library')} />
        </aside>

        {/* 우측 컬럼 — 행동 모드 (입력·분석 또는 진행 중 세션) */}
        <div style={{ minWidth: 0 }}>
          <RightPanel
            mode={rightMode}
            activePlan={activePlan}
            onAnalyze={onAnalyze}
            onResumeFocus={() => onNavigate('/focus')}
            onCloseFocus={onClosePlan}
            onShowGuide={() => onNavigate('/library')}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 1180px) {
          .main-grid { grid-template-columns: 340px 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 980px) {
          .main-grid { grid-template-columns: 1fr !important; }
          .main-grid > div:nth-child(2) { order: -1; }
        }
        @media (max-width: 640px) {
          .main-grid { gap: 24px !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DistillPage — 입력 → 분석 → 배치 결과 → 포커스로 이동
   (기존 inline 활동/서머리 제거, /focus 로 위임)
   ═══════════════════════════════════════════════════════════════ */
const PH = { INPUT: "input", ANALYZING: "analyzing", RESULT: "result" };

function DistillPage({ onNavigate, onStartPlan }) {
  const [phase, setPhase] = useState(PH.INPUT);
  // 태스크 스키마 (v2):
  //   title       — 할 일 이름 (V3가 태그·시간 자동 산정)
  //   hasFixed    — "이 일은 고정 시간에 시작" 체크 여부
  //   fixedTime   — "HH:MM" (hasFixed=true 일 때만 유효)
  const [tasks, setTasks] = useState([{ id: uid(), title: "", hasFixed: false, fixedTime: "" }]);
  const [breakdown, setBD] = useState([]);
  const [analyses, setAN] = useState([]);
  const [totalEst, setTE] = useState(0);
  const [aStep, setAStep] = useState(0);
  const [dragIdx, setDI] = useState(null);
  const [dragOverIdx, setDO] = useState(null);
  const [learnData, setLearnData] = useState(null);
  const [v3Meta, setV3Meta] = useState(null);

  useEffect(() => { setLearnData(loadLD()); }, []);

  function addTask() { if (tasks.length >= 7) return; setTasks([...tasks, { id: uid(), title: "", hasFixed: false, fixedTime: "" }]); }
  function removeTask(id) { if (tasks.length <= 1) return; setTasks(tasks.filter(t => t.id !== id)); }
  function updateTask(id, f, v) { setTasks(tasks.map(t => t.id === id ? { ...t, [f]: v } : t)); }

  function startAnalysis() {
    const valid = tasks.filter(t => t.title.trim());
    if (!valid.length) return;
    setPhase(PH.ANALYZING); setAStep(0);
    setTimeout(() => setAStep(1), 500);
    setTimeout(() => setAStep(2), 1200);
    setTimeout(() => {
      setAStep(3);
      const r = runAnalysis(valid, learnData);
      setBD(r.breakdown); setAN(r.analyses); setTE(r.totalEstMin);
      setV3Meta(r.v3 || null);
      setTimeout(() => setPhase(PH.RESULT), 500);
    }, 1900);
  }

  function onDragStart(i) { setDI(i); }
  function onDragOver(e, i) { e.preventDefault(); setDO(i); }
  function onDragEnd() {
    if (dragIdx != null && dragOverIdx != null && dragIdx !== dragOverIdx) {
      const it = [...breakdown];
      const [m] = it.splice(dragIdx, 1);
      it.splice(dragOverIdx, 0, m);
      it.forEach((x, i) => { x.order = i; });
      setBD(it);
      setTE(it.filter(b => !b.isMarker).reduce((s, b) => s + b.estimatedMin, 0));
    }
    setDI(null); setDO(null);
  }

  function confirmPlan() {
    // Focus 페이지로 넘길 플랜 빌드
    const items = breakdown
      .filter(b => !b.isMarker)
      .map(b => ({ ...b, actualMin: null, status: "pending" }));
    const sourceTitles = tasks.filter(t => t.title.trim()).map(t => t.title);
    onStartPlan({
      items,
      curIdx: 0,
      startTimes: { 0: Date.now() },
      startedAt: Date.now(),
      sourceTasks: sourceTitles,
    });
    onNavigate("/focus");
  }

  function reset() {
    setPhase(PH.INPUT);
    setTasks([{ id: uid(), title: "", hasFixed: false, fixedTime: "" }]);
    setBD([]); setAN([]);
  }

  return (
    <div className="page">
      <div className="dt-header">
        <button className="back-btn" onClick={() => phase === PH.INPUT ? onNavigate("/") : reset()}>← {phase === PH.INPUT ? "메인" : "처음으로"}</button>
        <h1 className="dt-title">Work Flow</h1>
        <span className="dt-step-badge">{phase === PH.INPUT ? "Step 1" : phase === PH.ANALYZING ? "Step 2-4" : "Step 5"}</span>
      </div>

      {phase === PH.INPUT && <>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
          할 일 이름만 입력하면 AI가 필요한 시간과 세부 스텝을 자동으로 산정합니다. <br />
          특정 시간에 반드시 시작해야 하는 일정이라면 🔒 <strong>고정 시간</strong>을 지정하세요.
        </p>
        <div className="task-input-list">
          {tasks.map((task, i) => (
            <div key={task.id} className="task-card" style={{ borderLeft: `3px solid ${PASTELS[i % PASTELS.length].border}` }}>
              <span className="task-num">{i + 1}</span>
              <div className="task-fields">
                <input type="text" className="task-title-input" value={task.title}
                  onChange={e => updateTask(task.id, "title", e.target.value)}
                  placeholder="예: 샤워, 이메일 확인, 논문 작성"
                  autoFocus={i === tasks.length - 1} />
                <div className="task-meta-row" style={{ gap: 10, alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={!!task.hasFixed}
                      onChange={e => updateTask(task.id, "hasFixed", e.target.checked)}
                      style={{ cursor: "pointer", accentColor: T.accent }}
                    />
                    🔒 고정 시간
                  </label>
                  {task.hasFixed && (
                    <>
                      <input
                        type="time"
                        className="task-meta-input"
                        value={task.fixedTime || ""}
                        onChange={e => updateTask(task.id, "fixedTime", e.target.value)}
                        style={{ width: 120 }}
                      />
                      <span style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>
                        {task.fixedTime ? `이 시각에 시작` : "시간을 선택하세요"}
                      </span>
                    </>
                  )}
                  {!task.hasFixed && (
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      자유 배치 (AI가 순서·시간 결정)
                    </span>
                  )}
                </div>
              </div>
              {tasks.length > 1 && <button className="task-remove" onClick={() => removeTask(task.id)}>×</button>}
            </div>
          ))}
        </div>
        <button className="add-task-btn" onClick={addTask} disabled={tasks.length >= 7}>
          <span style={{ fontSize: 18 }}>+</span> 할 일 추가 {tasks.length >= 7 && "(최대 7개)"}
        </button>
        <div className="analyze-row">
          <button className="analyze-btn" onClick={startAnalysis} disabled={!tasks.some(t => t.title.trim())}>분석 실행</button>
        </div>
      </>}

      {phase === PH.ANALYZING && (
        <div className="loading-wrap">
          <div className="spinner" />
          <span className="loading-text">분석 엔진 처리 중{learnData ? " (학습 데이터 반영)" : ""}</span>
          <div className="loading-steps">
            {[
              { l: "키워드 분석 · 행동유형 분류", s: 1 },
              { l: "Skinner 분해 · Simon 청킹", s: 2 },
              { l: "Quick-Win 최적 순서 배치", s: 3 },
            ].map(({ l, s }) => (
              <div key={s} className={`loading-step ${aStep > s ? "loading-step--done" : aStep === s ? "loading-step--active" : ""}`}>
                <span className="loading-step-dot" />{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === PH.RESULT && <>
        <div className="score-panel">
          {analyses.map((a, i) => (
            <div key={i} className="score-item">
              <span className="score-label">{a.title.length > 12 ? a.title.slice(0, 12) + "…" : a.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="score-value">{a.complexity}/10</span>
                <div className="score-bar"><div className="score-bar-fill" style={{ width: `${a.complexity * 10}%`, background: btInfo(a.type).color }} /></div>
              </div>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {btInfo(a.type).icon} {btInfo(a.type).label} · {a.tier === "simple" ? "간단" : a.tier === "medium" ? "보통" : "복잡"}
              </span>
            </div>
          ))}
          <div className="score-item" style={{ marginLeft: "auto" }}>
            <span className="score-label">전체 소요 시간</span>
            <span className="score-value" style={{ color: T.accent }}>{formatMin(totalEst)}</span>
            {learnData && <span style={{ fontSize: 10, color: T.accent }}>학습 보정 적용</span>}
          </div>
        </div>

        <div className="result-header">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>배치 결과</h2>
            <button className="back-btn" onClick={() => setPhase(PH.INPUT)}>다시 입력</button>
          </div>
        </div>

        {/* 고정 시간 중 반영되지 못한 anchor 경고 */}
        {v3Meta?.droppedAnchors && v3Meta.droppedAnchors.length > 0 && (
          <div style={{ padding: "12px 16px", background: T.warningSoft, border: `1px solid ${T.warning}`, borderRadius: 10, marginBottom: 16, fontSize: 12, color: T.textPrimary }}>
            ⚠️ <strong>고정 시간 일부가 반영되지 않았습니다.</strong> 지정한 시각이 이미 지났거나, 다른 활동과 겹치는 경우 제외됩니다.
            <div style={{ marginTop: 6, color: T.textSecondary, fontSize: 11 }}>
              {v3Meta.droppedAnchors.map((d, i) => (
                <span key={i} style={{ marginRight: 10 }}>• {d.tag} ({d.reason})</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
          <div className="timeline-panel" style={{ gridColumn: "auto" }}>
            <h3 className="result-panel-title" style={{ marginBottom: 4 }}>
              <span className="result-panel-icon">📋</span> 실행 순서
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginLeft: 8 }}>드래그하여 순서 변경</span>
            </h3>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16 }}>행동 분해 · 시간 분배 · 순서 배치가 통합된 뷰입니다</p>
            <ul className="timeline-list">{breakdown.map((b, i) => {
              if (b.isMarker) return (<li key={b.id} style={{ padding: "8px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: T.accent, background: T.accentSoft, borderRadius: 8 }}>{b.shortTitle}</li>);
              const pct = totalEst > 0 ? (b.estimatedMin / totalEst) * 100 : 0;
              return (
                <li key={b.id} className={`timeline-item ${dragIdx === i ? "timeline-item--dragging" : ""} ${dragOverIdx === i ? "timeline-item--dragover" : ""}`}
                  draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 8, cursor: "grab" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="timeline-handle">⠿</span>
                    <span className="timeline-order" style={{ background: btInfo(b.behaviorType).color + "20", color: btInfo(b.behaviorType).color }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                      {b.v3?.isFixed && <span style={{ marginRight: 6 }}>🔒</span>}
                      {b.title}
                    </span>
                    {b.v3?.clockTime && (
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: b.v3.isFixed ? T.accent : T.textMuted, fontWeight: b.v3.isFixed ? 600 : 400 }}>
                        {b.v3.clockTime}
                      </span>
                    )}
                    <span className="timeline-time">{formatMin(b.estimatedMin)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 58 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: btInfo(b.behaviorType).color + "15", color: btInfo(b.behaviorType).color, fontWeight: 600 }}>
                      {btInfo(b.behaviorType).icon} {btInfo(b.behaviorType).label}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.bgElevated, color: T.textSecondary, fontWeight: 500 }}>
                      {bucketLabel(b.timeBucket)}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.bgElevated, color: T.textMuted, fontFamily: T.mono }}>CL {b.cognitiveLoad}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.bgElevated, color: T.textMuted, fontFamily: T.mono }}>R {b.rewardScore}</span>
                  </div>
                  <div style={{ paddingLeft: 58 }}>
                    <div className="timeline-bar-track"><div className="timeline-bar-fill" style={{ width: `${Math.max(pct, 6)}%`, background: btInfo(b.behaviorType).color }} /></div>
                  </div>
                </li>
              );
            })}</ul>
          </div>
        </div>

        <div className="confirm-row">
          <button className="confirm-btn" onClick={confirmPlan}>포커스 모드로 시작 →</button>
        </div>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FocusPage — 하나의 할 일에만 집중
   ═══════════════════════════════════════════════════════════════ */
function FocusPage({ plan, onUpdatePlan, onCompleteAll, onCancel, onNavigate }) {
  const [elapsed, setElapsed] = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    if (!plan) return;
    timerRef.current = setInterval(() => setElapsed(Date.now()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [plan]);

  if (!plan || !plan.items || plan.items.length === 0) {
    return (
      <div className="page">
        <div className="focus-wrap">
          <div className="focus-empty">
            <span className="focus-empty-icon">🎯</span>
            <p className="focus-empty-text">진행 중인 포커스 세션이 없습니다</p>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: -4 }}>Distill에서 할 일을 분석하고 포커스 모드를 시작하세요</p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="focus-btn focus-btn--primary" onClick={() => onNavigate("/distill")}>Distill 열기</button>
              <button className="focus-btn focus-btn--ghost" onClick={() => onNavigate("/")}>메인으로</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { items, curIdx, startTimes } = plan;
  const current = items[curIdx];
  const doneCount = items.filter(i => i.status === "done").length;
  const progressPct = Math.round((doneCount / items.length) * 100);
  const curStartedAt = startTimes[curIdx] || Date.now();
  const curElapsedMin = (elapsed - curStartedAt) / 60000;
  const estMin = current?.estimatedMin || 0;
  const overTime = curElapsedMin > estMin;

  function fmtTimer(min) {
    const s = Math.max(0, Math.floor(min * 60));
    const m = Math.floor(s / 60), ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function completeCur() {
    const now = Date.now();
    const actMin = (now - curStartedAt) / 60000;
    const updatedItems = [...items];
    updatedItems[curIdx] = { ...updatedItems[curIdx], actualMin: actMin, status: "done" };
    const next = curIdx + 1;
    if (next < items.length) {
      const newST = { ...startTimes, [next]: now };
      onUpdatePlan({ ...plan, items: updatedItems, curIdx: next, startTimes: newST });
    } else {
      // 모든 활동 완료
      if (timerRef.current) clearInterval(timerRef.current);
      onCompleteAll({ ...plan, items: updatedItems, curIdx: next, startTimes });
    }
  }

  function handleCancel() {
    if (typeof window !== "undefined" && !window.confirm("진행 중인 포커스 세션을 종료하시겠어요? 저장되지 않습니다.")) return;
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  }

  return (
    <div className="page">
      <div className="focus-wrap">
        <div className="focus-header">
          <button className="back-btn" onClick={() => onNavigate("/")}>← 메인</button>
          <h1 className="focus-title">Focus</h1>
          <button className="back-btn" onClick={handleCancel} style={{ color: T.error, borderColor: T.errorSoft }}>세션 종료</button>
        </div>

        {/* 전체 진행률 */}
        <div className="focus-progress">
          <div className="focus-progress-top">
            <span className="dash-label">전체 진행률</span>
            <span className="agb-pct">{doneCount} / {items.length} · {progressPct}%</span>
          </div>
          <div className="agb-track"><div className="agb-fill" style={{ width: `${progressPct}%` }} /></div>
        </div>

        {/* 현재 포커스 카드 */}
        <div className="focus-card">
          <div className="focus-card-glow" />
          <div className="focus-card-step">
            Step {curIdx + 1} / {items.length} · {btInfo(current.behaviorType).icon} {btInfo(current.behaviorType).label}
          </div>
          <h2 className="focus-card-title">{current.shortTitle || current.title}</h2>
          {current.parentTitle && current.parentTitle !== current.title && (
            <div style={{ fontSize: 12, color: T.textMuted, position: "relative", zIndex: 1, marginTop: -8 }}>
              ↳ {current.parentTitle}
            </div>
          )}

          <div className="focus-card-tags">
            <span className="focus-card-tag" style={{ background: btInfo(current.behaviorType).color + "18", color: btInfo(current.behaviorType).color }}>
              {bucketLabel(current.timeBucket)}
            </span>
            <span className="focus-card-tag" style={{ background: T.accentSoft, color: T.accent }}>
              CL {current.cognitiveLoad}
            </span>
            <span className="focus-card-tag" style={{ background: T.bgElevated, color: T.textSecondary }}>
              {catIcon(current.category)} {catLabel(current.category)}
            </span>
          </div>

          <div className="focus-timer">
            <span className={`focus-timer-val ${overTime ? "focus-timer-val--over" : ""}`}>
              {fmtTimer(curElapsedMin)}
            </span>
            <span className="focus-timer-label">경과 시간</span>
            <span className="focus-timer-est">
              예상 {formatMin(estMin)}{overTime ? ` · +${Math.round(curElapsedMin - estMin)}분 초과` : ""}
            </span>
          </div>

          <div className="focus-actions">
            <button className="focus-btn focus-btn--primary" onClick={completeCur}>✓ 완료</button>
          </div>
        </div>

        {/* 미니 리스트 */}
        <div className="focus-mini">
          <div className="focus-mini-title">전체 스텝</div>
          {items.map((it, i) => (
            <div key={it.id || i} className={`focus-mini-item ${it.status === "done" ? "focus-mini-item--done" : i === curIdx ? "focus-mini-item--current" : ""}`}>
              <span className="focus-mini-dot" />
              <span className="focus-mini-label">{it.shortTitle || it.title}</span>
              <span className="focus-mini-time">
                {it.status === "done" ? formatMin(it.actualMin || 0) : formatMin(it.estimatedMin)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SummaryPage — 포커스 완료 후 요약 + 학습 반영 + 저장
   ═══════════════════════════════════════════════════════════════ */
function SummaryPage({ finalPlan, onAddRecord, onNavigate, onDiscard }) {
  const [learnConfirmed, setLearnConfirmed] = useState(null);
  const [learnData, setLearnData] = useState(null);

  useEffect(() => { setLearnData(loadLD()); }, []);

  if (!finalPlan) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-icon">🤔</span>
          <span className="empty-text">표시할 결과가 없습니다</span>
          <button className="back-btn" onClick={() => onNavigate("/")}>메인으로</button>
        </div>
      </div>
    );
  }

  const sumData = useMemo(() => {
    const real = finalPlan.items.filter(i => !i.isMarker);
    const te = real.reduce((s, i) => s + i.estimatedMin, 0);
    const ta = real.reduce((s, i) => s + (i.actualMin || 0), 0);
    return { totalEst: te, totalActual: ta, diff: ta - te };
  }, [finalPlan]);

  function confirmLearn() {
    setLearnConfirmed(true);
    const nld = accumLD(learnData, finalPlan.items);
    setLearnData(nld);
    saveLD(nld);
  }

  function saveResult() {
    const titles = finalPlan.sourceTasks || [];
    onAddRecord({
      id: `rec-${uid()}`,
      title: titles.join(" + ") || "세션",
      tasks: titles,
      taskCount: titles.length,
      totalEstMin: sumData.totalEst,
      totalActualMin: Math.round(sumData.totalActual),
      speedRank: sumData.diff < 0 ? `상위 ${Math.round(Math.random() * 15 + 5)}%` : "평균",
      rankLevel: sumData.diff < 0 ? "fast" : "avg",
      date: new Date(),
      categories: [...new Set(finalPlan.items.filter(i => !i.isMarker).map(i => i.category))],
      breakdown: finalPlan.items.filter(i => !i.isMarker).map(i => ({
        title: i.title, estMin: i.estimatedMin,
        actMin: Math.round(i.actualMin || 0),
        cat: i.category, bt: i.behaviorType,
      })),
    });
    onDiscard();
    onNavigate("/record");
  }

  return (
    <div className="page">
      <div className="summary-wrap">
        <div className="summary-emoji">🎉</div>
        <h2 className="summary-title">모든 활동 완료!</h2>
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="summary-stat-label">예상 시간</span>
            <span className="summary-stat-value">{formatMin(sumData.totalEst)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-label">실제 시간</span>
            <span className="summary-stat-value">{formatMin(sumData.totalActual)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat-label">차이</span>
            <span className="summary-stat-value" style={{ color: sumData.diff <= 0 ? T.success : T.error }}>
              {sumData.diff <= 0 ? "" : "+"}{Math.round(sumData.diff)}분
            </span>
            <span className="summary-stat-sub">{sumData.diff <= 0 ? "빠르게 완료!" : "예상보다 느림"}</span>
          </div>
        </div>
        <div className="summary-actions">
          <button className="confirm-btn" onClick={saveResult}>기록 저장 & 확인</button>
          <button className="back-btn" onClick={() => { onDiscard(); onNavigate("/distill"); }}>새로 시작하기</button>
        </div>
        {learnConfirmed === null ? (
          <div style={{ marginTop: 24, padding: 20, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: T.textPrimary }}>이번 결과를 학습에 반영할까요?</p>
            <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>반영하면 다음 분석 시 카테고리별 시간 예측이 더 정확해집니다.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="confirm-btn" style={{ padding: "10px 24px", fontSize: 13 }} onClick={confirmLearn}>반영하기</button>
              <button className="back-btn" onClick={() => setLearnConfirmed(false)}>괜찮아요</button>
            </div>
          </div>
        ) : learnConfirmed ? (
          <p className="summary-learn-msg">✓ 학습 데이터에 반영되었습니다</p>
        ) : (
          <p style={{ marginTop: 16, fontSize: 13, color: T.textMuted }}>학습에 반영하지 않았습니다</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RecordPage — 틸트 적용된 카드 그리드 + StatusBadge
   ═══════════════════════════════════════════════════════════════ */
function RecordPage({ records, savedIds, onToggleSave, onNavigate }) {
  const [filter, setFilter] = useState("all");
  const allCats = useMemo(() => {
    const s = new Set();
    records.forEach(r => r.categories.forEach(c => s.add(c)));
    return Array.from(s);
  }, [records]);
  const filtered = useMemo(
    () => filter === "all" ? records : records.filter(r => r.categories.includes(filter)),
    [records, filter]
  );

  return (
    <div className="page">
      <div className="record-header"><h1 className="record-title">Tasks Record</h1></div>
      <div className="record-filters">
        <button className={`record-filter ${filter === "all" ? "record-filter--active" : ""}`} onClick={() => setFilter("all")}>전체</button>
        {CATEGORIES.filter(c => allCats.includes(c.key)).map(c => (
          <button key={c.key} className={`record-filter ${filter === c.key ? "record-filter--active" : ""}`} onClick={() => setFilter(c.key)}>{c.icon} {c.label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">📋</span><span className="empty-text">기록이 없습니다</span></div>
      ) : (
        <div className="record-grid">{filtered.map(rec => (
          <TiltCard key={rec.id} className="record-card" onClick={() => onNavigate(`/record/${rec.id}`)}>
            <div className="rc-title">{rec.title}</div>
            <div className="rc-tasks"><span className="rc-tasks-count">{rec.taskCount}개</span> 할 일</div>
            <div className="rc-meta">
              <span>소요 <span className="rc-meta-value">{formatMin(rec.totalActualMin)}</span></span>
              <span>예상 <span className="rc-meta-value">{formatMin(rec.totalEstMin)}</span></span>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <StatusBadge level={rec.rankLevel} label={rec.speedRank} />
            </div>
            <div className="rc-bottom">
              <span className="rc-date">{formatDate(rec.date)}</span>
              <button className={`rc-save-btn ${savedIds.includes(rec.id) ? "rc-save-btn--saved" : ""}`}
                onClick={e => { e.stopPropagation(); onToggleSave(rec.id); }}>
                {savedIds.includes(rec.id) ? "✓ 저장됨" : "📁 저장"}
              </button>
            </div>
          </TiltCard>
        ))}</div>
      )}
    </div>
  );
}

/* ═══ RecordDetailPage (기존 구조 유지 + 색상 업데이트) ═══ */
function RecordDetailPage({ record, onNavigate, savedIds, onToggleSave }) {
  if (!record) return (
    <div className="page">
      <div className="empty-state">
        <span className="empty-icon">🔍</span>
        <span className="empty-text">기록을 찾을 수 없습니다</span>
        <button className="back-btn" onClick={() => onNavigate("/record")}>목록으로</button>
      </div>
    </div>
  );

  const totalEst = record.totalEstMin;
  const totalAct = record.totalActualMin;
  const diff = totalAct - totalEst;
  const isSaved = savedIds.includes(record.id);

  return (
    <div className="page">
      <button className="back-btn" onClick={() => onNavigate("/record")} style={{ marginBottom: 20 }}>← 목록으로</button>
      <div className="rd-header">
        <h1 className="rd-title">{record.title}</h1>
        <div className="rd-actions">
          <button className={`rc-save-btn ${isSaved ? "rc-save-btn--saved" : ""}`} style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => onToggleSave(record.id)}>
            {isSaved ? "✓ 라이브러리 저장됨" : "📁 라이브러리에 저장"}
          </button>
        </div>
      </div>
      <div className="rd-summary">
        <div className="rd-stat"><span className="rd-stat-icon">📅</span><span className="rd-stat-label">활동 날짜</span><span className="rd-stat-value">{formatDate(record.date)}</span></div>
        <div className="rd-stat"><span className="rd-stat-icon">⏱</span><span className="rd-stat-label">활동 시간</span><span className="rd-stat-value">{formatMin(totalAct)}</span><span className="rd-stat-sub">예상 {formatMin(totalEst)}</span></div>
        <div className="rd-stat"><span className="rd-stat-icon">{diff <= 0 ? "⚡" : "🐢"}</span><span className="rd-stat-label">시간 차이</span><span className="rd-stat-value" style={{ color: diff <= 0 ? T.success : T.error }}>{diff <= 0 ? "" : "+"}{Math.round(diff)}분</span><span className="rd-stat-sub">{diff <= 0 ? "빠르게 완료" : "예상보다 느림"}</span></div>
        <div className="rd-stat"><span className="rd-stat-icon">🏆</span><span className="rd-stat-label">속도 순위</span><span className={`rd-stat-value ${record.rankLevel === "fast" ? "rd-val-fast" : ""}`}>{record.speedRank}</span></div>
      </div>
      <div className="rd-section">
        <h2 className="rd-section-title">활동 배치 · 소요 시간</h2>
        <div className="rd-timeline">
          {record.breakdown.map((b, i) => {
            const pct = totalAct > 0 ? (b.actMin / totalAct) * 100 : 0;
            const timeDiff = b.actMin - b.estMin;
            return (
              <div key={i} className="rd-tl-item">
                <div className="rd-tl-left">
                  <span className="rd-tl-order">{i + 1}</span>
                  <div className="rd-tl-line" />
                </div>
                <div className="rd-tl-card">
                  <div className="rd-tl-head">
                    <span className="rd-tl-cat-dot" style={{ background: b.bt ? btInfo(b.bt).color : catColor(b.cat) }} />
                    <span className="rd-tl-title">{b.title}</span>
                    {b.bt && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: btInfo(b.bt).color + "18", color: btInfo(b.bt).color, fontWeight: 500, whiteSpace: "nowrap" }}>{btInfo(b.bt).icon} {btInfo(b.bt).label}</span>}
                    <span className="rd-tl-cat-label">{catIcon(b.cat)} {catLabel(b.cat)}</span>
                  </div>
                  <div className="rd-tl-times">
                    <span className="rd-tl-time"><span className="rd-tl-time-label">예상</span><span className="rd-tl-time-val">{formatMin(b.estMin)}</span></span>
                    <span className="rd-tl-time"><span className="rd-tl-time-label">실제</span><span className="rd-tl-time-val rd-tl-time-actual">{formatMin(b.actMin)}</span></span>
                    <span className={`rd-tl-diff ${timeDiff <= 0 ? "rd-tl-diff--fast" : "rd-tl-diff--slow"}`}>{timeDiff <= 0 ? "" : "+"}{timeDiff}분</span>
                  </div>
                  <div className="rd-tl-bar-track">
                    <div className="rd-tl-bar-fill" style={{ width: `${Math.max(pct, 5)}%`, background: b.bt ? btInfo(b.bt).color : catColor(b.cat) }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ AnalysisPage (기존 그대로) ═══ */
function AnalysisPage({ records }) {
  const catData = useMemo(() => {
    const m = {};
    for (const r of records) for (const b of r.breakdown) {
      if (!m[b.cat]) m[b.cat] = { totalEst: 0, totalAct: 0 };
      m[b.cat].totalEst += b.estMin; m[b.cat].totalAct += b.actMin;
    }
    return CATEGORIES.filter(c => m[c.key]).map(c => ({
      ...c,
      avgSpeed: m[c.key].totalEst > 0 ? Math.round(m[c.key].totalAct / m[c.key].totalEst * 100) : 100,
    }));
  }, [records]);
  const maxSpd = Math.max(...catData.map(c => c.avgSpeed), 120);
  const pieData = useMemo(() => {
    const m = {};
    for (const r of records) for (const b of r.breakdown) m[b.title] = (m[b.title] || 0) + b.actMin;
    const total = Object.values(m).reduce((s, v) => s + v, 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, min], i) => ({
      title: t, min,
      pct: total > 0 ? Math.round(min / total * 100) : 0,
      color: CATEGORIES[i % CATEGORIES.length].color,
    }));
  }, [records]);
  const trendData = useMemo(() => records.slice(0, 6).reverse().map(r => ({
    date: formatDate(r.date).slice(5), est: r.totalEstMin, actual: r.totalActualMin,
  })), [records]);
  const trendMax = Math.max(...trendData.flatMap(t => [t.est, t.actual]), 1);

  function renderPie() {
    if (!pieData.length) return null;
    const sz = 140, cx = 70, cy = 70, r = 55;
    let cum = -90;
    const slices = pieData.map(d => {
      const a = (d.pct / 100) * 360, s = cum; cum += a;
      const la = a > 180 ? 1 : 0;
      const rd = x => (x * Math.PI) / 180;
      return { ...d, path: `M ${cx} ${cy} L ${cx + r * Math.cos(rd(s))} ${cy + r * Math.sin(rd(s))} A ${r} ${r} 0 ${la} 1 ${cx + r * Math.cos(rd(cum))} ${cy + r * Math.sin(rd(cum))} Z` };
    });
    return (
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.75} stroke="white" strokeWidth={1.5} />)}
        <circle cx={cx} cy={cy} r={25} fill={T.bgSurface} />
      </svg>
    );
  }

  if (!records.length) return (
    <div className="page">
      <h1 className="analysis-title">Analysis</h1>
      <div className="empty-state"><span className="empty-icon">📊</span><span className="empty-text">분석할 데이터가 없습니다</span></div>
    </div>
  );
  return (
    <div className="page">
      <h1 className="analysis-title">Analysis</h1>
      <div className="analysis-grid">
        <div className="analysis-card">
          <h3 className="ac-title">행동 범주별 속도</h3>
          <div className="ac-bar-chart">
            {catData.map(c => (
              <div key={c.key} className="ac-bar-row">
                <span className="ac-bar-label">{c.icon} {c.label}</span>
                <div className="ac-bar-track"><div className="ac-bar-fill" style={{ width: `${(c.avgSpeed / maxSpd) * 100}%`, background: c.color }} /></div>
                <span className="ac-bar-value">{c.avgSpeed}%</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: T.textMuted }}>100% = 예상과 동일, 낮을수록 빠름</span>
        </div>
        <div className="analysis-card">
          <h3 className="ac-title">세부 활동 비율</h3>
          <div className="pie-wrap">
            {renderPie()}
            <div className="pie-legend">
              {pieData.map((d, i) => (
                <div key={i} className="pie-legend-item">
                  <span className="pie-legend-dot" style={{ background: d.color }} />
                  {d.title.length > 12 ? d.title.slice(0, 12) + "…" : d.title} ({d.pct}%)
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="analysis-card analysis-card--wide">
          <h3 className="ac-title">예상 vs 실제 시간 추이</h3>
          <div className="trend-labels">
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 4, borderRadius: 2, background: T.accent3, display: "inline-block" }} />예상</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 4, borderRadius: 2, background: T.accent, display: "inline-block" }} />실제</span>
          </div>
          <div className="trend-rows">
            {trendData.map((t, i) => (
              <div key={i} className="trend-row">
                <span className="trend-date">{t.date}</span>
                <div className="trend-bars"><div className="trend-bar trend-bar--est" style={{ width: `${(t.est / trendMax) * 100}%` }} /></div>
                <div className="trend-bars"><div className="trend-bar trend-bar--actual" style={{ width: `${(t.actual / trendMax) * 100}%` }} /></div>
                <span style={{ fontSize: 11, color: T.textMuted, width: 60, textAlign: "right", flexShrink: 0 }}>{formatMin(t.est)}/{formatMin(t.actual)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ LibraryPage (틸트 적용) ═══ */
function LibraryPage({ records, savedIds, onToggleSave, onNavigate }) {
  const saved = records.filter(r => savedIds.includes(r.id));
  return (
    <div className="page">
      <h1 className="library-title">Library</h1>
      {saved.length === 0 ? (
        <div className="library-empty"><div className="library-empty-icon">📚</div><p className="library-empty-text">저장한 기록이 없습니다</p></div>
      ) : (
        <div className="record-grid">{saved.map(rec => (
          <TiltCard key={rec.id} className="record-card" onClick={() => onNavigate(`/record/${rec.id}`)}>
            <div className="rc-title">{rec.title}</div>
            <div className="rc-tasks"><span className="rc-tasks-count">{rec.taskCount}개</span> 할 일</div>
            <div className="rc-meta">
              <span>소요 <span className="rc-meta-value">{formatMin(rec.totalActualMin)}</span></span>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <StatusBadge level={rec.rankLevel} label={rec.speedRank} />
            </div>
            <div className="rc-bottom">
              <span className="rc-date">{formatDate(rec.date)}</span>
              <button className="rc-save-btn rc-save-btn--saved"
                onClick={e => { e.stopPropagation(); onToggleSave(rec.id); }}>✕ 삭제</button>
            </div>
          </TiltCard>
        ))}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   App — 라우팅 + 영속화 오케스트레이션
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   App — 라우팅 + 영속화 오케스트레이션

   Hard Gate (patch-v6a-hardgate):
     status === 'loading'        → 빈 splash (flash 차단)
     status === 'unauthenticated' → LoginPage 만 렌더
     status === 'authenticated'   → AppMain (정상 앱)
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f6fbf4 0%, #ebefe8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }} />
    );
  }
  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return <AppMain />;
}

function AppMain() {
  const [path, setPath] = useState("/");
  const [records, setRecords] = useState(() => loadRecords(MOCK_RECORDS));
  const [savedIds, setSavedIds] = useState(() => loadSavedIds(["rec-1", "rec-3"]));
  const [activePlan, setActivePlan] = useState(() => loadPlan());
  const [finalPlan, setFinalPlan] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVis, setToastVis] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => { saveRecords(records); }, [records]);
  useEffect(() => { saveSavedIds(savedIds); }, [savedIds]);
  useEffect(() => {
    if (activePlan) savePlan(activePlan);
    else clearPlan();
  }, [activePlan]);

  const nav = (to) => { setPath(to); window.scrollTo(0, 0); };

  function toast(msg) {
    setToastMsg(msg);
    setToastKey(k => k + 1);
    setToastVis(true);
    setTimeout(() => setToastVis(false), 2600);
  }

  function addRec(r) { setRecords(p => [r, ...p]); toast("기록이 저장되었습니다!"); }
  function toggleSave(id) {
    setSavedIds(p => {
      if (p.includes(id)) { toast("라이브러리에서 제거"); return p.filter(x => x !== id); }
      toast("라이브러리에 저장");
      return [...p, id];
    });
  }

  function startPlan(plan) { setActivePlan(plan); }
  function updatePlan(plan) { setActivePlan(plan); }
  function completeAll(plan) { setFinalPlan(plan); setActivePlan(null); nav("/summary"); }
  function discardPlan() { setActivePlan(null); setFinalPlan(null); }
  function cancelActive() { setActivePlan(null); toast("세션 종료됨"); nav("/"); }

  // 메인 페이지의 우측 패널 input 모드에서 호출되는 분석 진입점.
  // 입력값을 DistillPage 가 받을 수 있는 형태로 만들고 라우팅.
  // 현재는 단순 라우팅이며, 향후 prefill 데이터 전달 필요 시 확장.
  function onAnalyzeFromMain(/* validTasks */) {
    nav("/distill");
    return { unrecognized: null };
  }

  const pg = () => {
    if (path.startsWith("/record/")) {
      const id = path.replace("/record/", "");
      const rec = records.find(r => r.id === id);
      return <RecordDetailPage record={rec} onNavigate={nav} savedIds={savedIds} onToggleSave={toggleSave} />;
    }
    switch (path) {
      case "/": return (
        <MainPage
          onNavigate={nav}
          records={records}
          activePlan={activePlan}
          onAnalyze={onAnalyzeFromMain}
          onClosePlan={cancelActive}
        />
      );
      case "/distill": return <DistillPage onNavigate={nav} onStartPlan={startPlan} />;
      case "/focus": return (
        <FocusPage
          plan={activePlan}
          onUpdatePlan={updatePlan}
          onCompleteAll={completeAll}
          onCancel={cancelActive}
          onNavigate={nav}
        />
      );
      case "/summary": return (
        <SummaryPage
          finalPlan={finalPlan}
          onAddRecord={addRec}
          onNavigate={nav}
          onDiscard={discardPlan}
        />
      );
      case "/record": return <RecordPage records={records} savedIds={savedIds} onToggleSave={toggleSave} onNavigate={nav} />;
      case "/analysis": return <AnalysisPage records={records} />;
      case "/library": return <LibraryPage records={records} savedIds={savedIds} onToggleSave={toggleSave} onNavigate={nav} />;
      default: return (
        <div className="page">
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <span className="empty-text">페이지를 찾을 수 없습니다</span>
            <button className="back-btn" onClick={() => nav("/")}>메인으로</button>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <NavBar currentPath={path} onNavigate={nav} />
        <main>{pg()}</main>
      </div>
      <Toast key={toastKey} message={toastMsg} visible={toastVis} />
    </>
  );
}
