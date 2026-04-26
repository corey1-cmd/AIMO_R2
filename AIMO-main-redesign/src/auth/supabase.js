/* ═══════════════════════════════════════════════════════════════
 * src/auth/supabase.js
 *
 * Supabase 클라이언트 싱글톤.
 *
 * 설계 결정:
 *   - 싱글톤 패턴: 번들 내에서 단 하나의 인스턴스만 존재 (세션 일관성)
 *   - Publishable key 체계 사용 (sb_publishable_... 또는 eyJ... 형태 모두 허용)
 *     * 기존 anon key와 클라이언트 동작은 동일. 환경변수명 호환 유지.
 *   - persistSession: true — 브라우저 새로고침 시에도 세션 유지
 *   - autoRefreshToken: true — access token 만료 전 자동 갱신
 *   - detectSessionInUrl: true — OAuth 콜백 hash 처리
 *
 * 환경변수 누락 시 즉시 에러를 throw하여 프로덕션 배포에서 실패를 빨리 드러냅니다.
 * Day 6a 범위: 클라이언트 생성만. 사용은 AuthProvider에서.
 * ═══════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // 빌드 타임이 아닌 런타임에 즉시 터져야 Vercel Preview에서 환경변수 누락을 감지 가능
  throw new Error(
    '[supabase] 환경변수 누락: VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다. ' +
    '.env.local 또는 Vercel 대시보드 환경변수를 확인하세요.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // localStorage 키 prefix를 앱 고유 이름으로 지정 (다른 Supabase 앱과 충돌 방지)
    storageKey: 'detente-auth',
    // PKCE flow 사용 — security best practice
    flowType: 'pkce',
  },
  // 전역 헤더: 사용자 식별용. 디버깅 시 서버 로그에서 앱 구분 가능
  global: {
    headers: {
      'x-application-name': 'detente',
    },
  },
});

/** 현재 세션이 유효한지 즉시 확인 (AuthProvider 초기화 시 사용) */
export async function getInitialSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[supabase] getSession failed:', error.message);
    return null;
  }
  return data.session;
}

/** Google OAuth 시작 */
export async function signInWithGoogle() {
  const redirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // 매번 계정 선택 화면을 표시하지 않음 (이미 Google에 로그인된 계정으로 자동 진행)
      // 테스트 사용자 다중 전환이 필요하면 { queryParams: { prompt: 'select_account' } } 로 변경
    },
  });

  if (error) {
    console.error('[supabase] signIn failed:', error.message);
    throw error;
  }
}

/** 로그아웃 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[supabase] signOut failed:', error.message);
    throw error;
  }
}
