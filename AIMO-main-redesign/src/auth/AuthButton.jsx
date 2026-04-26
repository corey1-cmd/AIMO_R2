/* ═══════════════════════════════════════════════════════════════
 * src/auth/AuthButton.jsx
 *
 * Nav 에 사용할 로그인/로그아웃 버튼.
 * AuthProvider 의 status 를 보고 적절한 UI 렌더.
 *
 * loading 상태에서는 빈 placeholder (너비만 확보) 를 반환합니다.
 * 이것이 로그인 여부 확정 전에 "로그인" 또는 "로그아웃" 버튼이
 * 잠깐 번쩍 뜨는 flash 를 막는 핵심 부분입니다.
 *
 * patch-v6a-hardgate-v3 (시니어 2 디자인 수정):
 *   - inline #2828cd 직접 지정 → Sprout #00522d
 *   - 로그아웃 버튼: ghost 보더 → hover 시에만 mint tint (NavBar 시각 무게↓)
 *   - 로그인 버튼: 사각 6px → pill 9999 + ambient shadow
 *   - 200ms transition 추가
 * ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { signInWithGoogle, signOut } from './supabase.js';

/* ─── Sprout 토큰 (LoginPage 와 동일) ─────────────────────────── */
const PRIMARY = '#00522d';
const PRIMARY_HOVER = '#003d22';
const MINT_TINT = 'rgba(0, 82, 45, 0.06)';   // hover 시 잔잔한 강조
const TEXT_MUTED = '#6f7a70';
const CTA_SHADOW = '0 4px 24px rgba(45, 75, 62, 0.18)';

export function AuthButton() {
  const { status, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Flash 방지: loading 중에는 자리만 잡아두고 텍스트는 표시 안 함.
  if (status === 'loading') {
    return (
      <div
        aria-hidden="true"
        style={{
          display: 'inline-block',
          minWidth: 80,
          height: 32,
        }}
      />
    );
  }

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      alert('로그인에 실패했습니다: ' + e.message);
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    if (!confirm('로그아웃하시겠어요? 오프라인 기록은 다음 로그인까지 유지됩니다.')) {
      return;
    }
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      alert('로그아웃에 실패했습니다: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ─── 인증된 사용자: 로그아웃 버튼 ───────────────────────────
   * NavBar 의 시각 무게를 줄이기 위해 hover 시에만 mint tint 표시.
   * 평상시에는 텍스트만 보이는 ghost 형태. */
  if (status === 'authenticated' && user) {
    return (
      <button
        onClick={handleSignOut}
        disabled={busy}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '6px 14px',
          fontSize: 13,
          fontFamily: 'inherit',
          fontWeight: 500,
          background: hovered ? MINT_TINT : 'transparent',
          color: hovered ? PRIMARY : TEXT_MUTED,
          border: 'none',
          borderRadius: 9999,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.5 : 1,
          transition: 'background 200ms ease, color 200ms ease',
        }}
        title={user.email}
      >
        {busy ? '...' : '로그아웃'}
      </button>
    );
  }

  /* ─── 비인증 fallback: pill CTA 로그인 버튼 ──────────────────
   * Hard Gate 하에서는 이 버튼이 일반적으로 노출되지 않지만,
   * 로그아웃 직후 LoginPage 로 전환되기 전 짧은 순간 또는
   * 미래의 Soft Gate 재발의 시 사용 가능하도록 유지. */
  return (
    <button
      onClick={handleSignIn}
      disabled={busy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px',
        fontSize: 13,
        fontFamily: 'inherit',
        fontWeight: 500,
        background: hovered ? PRIMARY_HOVER : PRIMARY,
        color: 'white',
        border: 'none',
        borderRadius: 9999,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.7 : 1,
        boxShadow: CTA_SHADOW,
        transition: 'background 200ms ease',
      }}
    >
      {busy ? '로그인 중...' : 'Google 로그인'}
    </button>
  );
}
