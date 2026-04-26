/* ═══════════════════════════════════════════════════════════════
 * src/auth/LoginPage.jsx
 *
 * Hard Gate 로그인 페이지.
 * status === 'unauthenticated' 일 때 App.jsx 가 이 컴포넌트만 렌더합니다.
 *
 * 디자인: Sprout 가이드 (deep forest #00522d). 디자이너 Lenu §5 + product context §7-1.
 * Plus Jakarta Sans 800 italic 으로 브랜드명 표현. 카드 fade-in + 버튼 hover lift.
 *
 * 인앱 브라우저 처리: KAKAOTALK / NAVER / Instagram / FB / Line / Daum / Android WebView
 * 감지 시 별도 안내 화면. 카카오톡은 ?openExternalBrowser=1 트릭으로 자동 우회.
 *
 * patch-v6a-hardgate-v3 (시니어 2 디자인 수정):
 *   PALETTE 교체 + 카드 shadow Sprout ambient 토큰 + Plus Jakarta Sans 인라인 임포트
 *   동작 로직 변경 없음. 시각 토큰만 교체.
 * ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { signInWithGoogle } from './supabase.js';
import {
  detectInAppBrowser,
  tryOpenInExternalBrowser,
  getGuidanceMessage,
} from './inAppBrowser.js';

/* ─── Sprout 디자인 토큰 ──────────────────────────────────────── */
const PALETTE = {
  primary: '#00522d',
  primaryHover: '#003d22',
  bgFrom: '#f6fbf4',
  bgTo: '#ebefe8',
  text: '#181d19',
  textMuted: '#6f7a70',
  border: 'rgba(45, 75, 62, 0.10)',
  cardShadow: '0 4px 24px rgba(45, 75, 62, 0.05)',
  ctaShadow: '0 4px 24px rgba(45, 75, 62, 0.18)',
  warnAccent: '#466557',
};

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [inApp, setInApp] = useState(null);

  // 페이지 진입 시 인앱 브라우저 감지 (1회)
  useEffect(() => {
    const detected = detectInAppBrowser();
    if (detected) setInApp(detected);
  }, []);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setBusy(false);
      setError(e?.message || '알 수 없는 오류가 발생했습니다');
    }
  };

  const handleOpenExternal = () => {
    tryOpenInExternalBrowser();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,800;1,800&family=Noto+Sans+KR:wght@400;500;700&display=swap');

        @keyframes detente-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes detente-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .detente-google-btn:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(45, 75, 62, 0.12);
          transform: translateY(-1px);
        }
        .detente-primary-btn:hover:not(:disabled) {
          background: ${PALETTE.primaryHover};
        }
      `}</style>
      <div style={styles.shell}>
        <div style={styles.card}>
          <div style={styles.brandBlock}>
            <h1 style={styles.brand}>détente</h1>
            <p style={styles.tagline}>당신의 작은 데탕트.</p>
          </div>

          {inApp ? (
            <InAppBrowserNotice browser={inApp} onOpenExternal={handleOpenExternal} />
          ) : (
            <NormalLoginBlock
              busy={busy}
              error={error}
              onSignIn={handleSignIn}
            />
          )}

          <div style={styles.footer}>
            <span>© détente</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── 정상 로그인 블록 (인앱 브라우저 아닐 때) ──────────────── */

function NormalLoginBlock({ busy, error, onSignIn }) {
  return (
    <div style={styles.actionBlock}>
      <button
        className="detente-google-btn"
        onClick={onSignIn}
        disabled={busy}
        style={{
          ...styles.googleBtn,
          opacity: busy ? 0.65 : 1,
          cursor: busy ? 'wait' : 'pointer',
        }}
        aria-label="Google 계정으로 로그인"
      >
        {busy ? (
          <span style={styles.btnContent}>
            <Spinner />
            <span>Google 로그인 진행 중...</span>
          </span>
        ) : (
          <span style={styles.btnContent}>
            <GoogleLogo />
            <span>Google로 시작하기</span>
          </span>
        )}
      </button>

      {error && (
        <div role="alert" style={styles.errorBox}>
          로그인에 실패했습니다: {error}
        </div>
      )}

      <p style={styles.note}>
        기록은 안전하게 보관되며,
        <br />
        여러 기기에서 이어서 쓸 수 있어요.
      </p>
    </div>
  );
}

/* ─── 인앱 브라우저 안내 블록 ────────────────────────────────── */

function InAppBrowserNotice({ browser, onOpenExternal }) {
  const guide = getGuidanceMessage(browser);

  return (
    <div style={styles.actionBlock}>
      <div style={styles.warnIcon} aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={PALETTE.warnAccent} strokeWidth="2" />
          <path d="M12 7v6" stroke={PALETTE.warnAccent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.2" fill={PALETTE.warnAccent} />
        </svg>
      </div>

      <h2 style={styles.guideTitle}>{guide.title}</h2>
      <p style={styles.guideBody}>{guide.body}</p>

      {guide.autoFix && guide.primaryAction && (
        <button
          className="detente-primary-btn"
          onClick={onOpenExternal}
          style={styles.primaryBtn}
        >
          {guide.primaryAction}
        </button>
      )}

      {!guide.autoFix && (
        <div style={styles.urlBox}>
          <div style={styles.urlBoxLabel}>또는 아래 주소를 직접 복사해서 브라우저에 붙여넣으세요</div>
          <code style={styles.urlBoxCode}>
            {typeof window !== 'undefined' ? window.location.origin : 'https://aimo-seven.vercel.app'}
          </code>
        </div>
      )}
    </div>
  );
}

/* ─── 작은 컴포넌트들 ─────────────────────────────────────────── */

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      style={{ animation: 'detente-spin 0.9s linear infinite' }}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="32"
        strokeDashoffset="20"
        opacity="0.85"
      />
    </svg>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */

const styles = {
  shell: {
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${PALETTE.bgFrom} 0%, ${PALETTE.bgTo} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: '"Plus Jakarta Sans", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", sans-serif',
    color: PALETTE.text,
  },
  card: {
    background: 'white',
    borderRadius: 24,
    padding: '48px 36px 32px',
    width: '100%',
    maxWidth: 420,
    boxShadow: PALETTE.cardShadow,
    border: `1px solid ${PALETTE.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 36,
    animation: 'detente-card-in 380ms ease-out',
  },
  brandBlock: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  brand: {
    fontSize: 38,
    fontWeight: 800,
    fontStyle: 'italic',
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    letterSpacing: '-0.5px',
    margin: 0,
    color: PALETTE.primary,
  },
  tagline: {
    fontSize: 14,
    color: PALETTE.textMuted,
    margin: 0,
    letterSpacing: '0.2px',
  },
  actionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
  },
  googleBtn: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'inherit',
    background: 'white',
    color: '#3c4043',
    border: '1px solid #dadce0',
    borderRadius: 9999,
    cursor: 'pointer',
    transition: 'box-shadow 200ms ease, transform 200ms ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  btnContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorBox: {
    width: '100%',
    padding: '10px 14px',
    background: '#fff5f5',
    border: '1px solid #ffd0d0',
    borderRadius: 8,
    color: '#c92a2a',
    fontSize: 13,
    lineHeight: 1.5,
  },
  note: {
    fontSize: 13,
    color: PALETTE.textMuted,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.55,
  },
  warnIcon: {
    display: 'flex',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 17,
    fontWeight: 600,
    margin: 0,
    color: PALETTE.text,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  guideBody: {
    fontSize: 14,
    color: PALETTE.textMuted,
    margin: 0,
    lineHeight: 1.6,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'inherit',
    background: PALETTE.primary,
    color: 'white',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    transition: 'background 200ms ease',
    boxShadow: PALETTE.ctaShadow,
  },
  urlBox: {
    width: '100%',
    padding: '12px 14px',
    background: PALETTE.bgFrom,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  urlBoxLabel: {
    fontSize: 12,
    color: PALETTE.textMuted,
    lineHeight: 1.5,
  },
  urlBoxCode: {
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: PALETTE.text,
    wordBreak: 'break-all',
    background: 'transparent',
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: PALETTE.textMuted,
    opacity: 0.6,
  },
};
