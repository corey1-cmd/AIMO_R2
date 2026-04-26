/* ═══════════════════════════════════════════════════════════════
 * src/auth/AuthProvider.jsx
 *
 * 인증 상태 context. 앱 전역에서 사용자 세션을 구독합니다.
 *
 * 설계 결정 (시니어 2 지적 반영):
 *   세션 상태를 null/undefined 이진값이 아닌 3상태로 명시적 구분합니다.
 *   - status === 'loading': 최초 확인 중. 이 단계에서는 어떤 UI도 비로그인 가정으로 렌더하지 않음.
 *   - status === 'authenticated': 유효 세션 있음. user/session 제공.
 *   - status === 'unauthenticated': 세션 없음 확정.
 *
 *   이 구분이 "새로고침 시 비로그인 UI 번쩍임" flash 를 근본적으로 방지합니다.
 *   loading 상태에서는 스플래시 또는 스켈레톤 UI를 보여주고, 로그인 상태가 확정된 후에
 *   비로소 분기 렌더를 시작합니다.
 *
 * onAuthStateChange 구독으로 로그인/로그아웃/토큰 갱신/탭 간 동기화 모두 자동 반영됩니다.
 * ═══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase, getInitialSession } from './supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    // 최초 세션 확인
    getInitialSession().then(s => {
      if (!mounted) return;
      if (s) {
        setSession(s);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    });

    // 로그인/로그아웃/토큰 갱신 구독
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // 이벤트 종류:
      //   SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
      if (newSession) {
        setSession(newSession);
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({
    status,
    session,
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }), [status, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
