/* ═══════════════════════════════════════════════════════════════
 * src/auth/inAppBrowser.js
 *
 * 인앱 브라우저 감지 + 외부 브라우저 유도 유틸.
 *
 * 배경:
 *   Google OAuth 는 2021년 9월 30일부로 in-app webview 로그인을 차단합니다.
 *   카카오톡, 네이버앱, 페이스북, 인스타그램 등의 인앱 브라우저에서
 *   detnete OAuth 로그인을 시도하면 403 disallowed_useragent 에러가 발생합니다.
 *
 * 해결:
 *   1. user agent 패턴으로 인앱 브라우저인지 감지
 *   2. 카카오톡: ?openExternalBrowser=1 쿼리 트릭으로 외부 브라우저 강제 가능
 *   3. 그 외: OS 별 매뉴얼 안내 (iOS Safari / Android 외부 브라우저)
 *
 * 라이브러리 사용 안 함:
 *   30줄 분량의 detection 로직을 위해 의존성 추가는 과합니다.
 *   navigator.userAgent 만 사용하므로 SSR 안전성도 직접 처리합니다.
 * ═══════════════════════════════════════════════════════════════ */

/** 알려진 인앱 브라우저 패턴.
 *  값은 사용자에게 표시할 한국어 이름.
 *  순서 중요 — 더 구체적인 패턴이 먼저 와야 합니다 (예: KAKAOTALK 이 일반 'naver' 보다 먼저). */
const IN_APP_PATTERNS = [
  { regex: /KAKAOTALK/i, name: 'kakaotalk', label: '카카오톡' },
  { regex: /NAVER\(inapp/i, name: 'naver', label: '네이버 앱' },
  { regex: /Instagram/i, name: 'instagram', label: '인스타그램' },
  { regex: /FBAN|FBAV|FB_IAB|FB4A/i, name: 'facebook', label: '페이스북' },
  { regex: /Line\//i, name: 'line', label: '라인' },
  { regex: /DaumApps|DaumDevice/i, name: 'daum', label: '다음 앱' },
  // Android 의 일반 WebView 마커. 위의 구체 패턴과 매칭되지 않은 wv 만 잡음.
  // (정상 Chrome/Safari 는 wv 마커 없음)
  { regex: /; wv\)/i, name: 'android-webview', label: '앱 내 브라우저' },
];

/**
 * 현재 환경이 인앱 브라우저인지 감지합니다.
 * @returns {object|null} 매칭된 경우 { name, label }, 아니면 null
 */
export function detectInAppBrowser() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return null; // SSR 환경
  }
  const ua = navigator.userAgent || '';
  for (const p of IN_APP_PATTERNS) {
    if (p.regex.test(ua)) {
      return { name: p.name, label: p.label };
    }
  }
  return null;
}

/**
 * iOS 인지 감지 (안내 메시지 분기용).
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
}

/**
 * 카카오톡 외부 브라우저 강제 열기 트릭.
 * 현재 URL 에 ?openExternalBrowser=1 쿼리를 추가하여 location 이동.
 * 카카오톡은 이 쿼리를 만나면 시스템 기본 브라우저를 띄웁니다.
 *
 * @returns {boolean} 트릭 시도 여부 (카카오톡 환경이면 true, 아니면 false)
 */
export function tryOpenInExternalBrowser() {
  const detected = detectInAppBrowser();
  if (!detected || detected.name !== 'kakaotalk') return false;

  // 현재 URL 에 쿼리 추가 후 location 변경
  const url = new URL(window.location.href);
  url.searchParams.set('openExternalBrowser', '1');
  window.location.href = url.toString();
  return true;
}

/**
 * 사용자에게 표시할 안내 문구 생성.
 * @param {object} browser - detectInAppBrowser() 결과
 * @returns {object} { title, body, primaryAction }
 */
export function getGuidanceMessage(browser) {
  const isKakao = browser.name === 'kakaotalk';
  const isiOS = isIOS();

  if (isKakao) {
    // 카카오톡은 자동 우회 가능
    return {
      title: '카카오톡에서는 로그인할 수 없어요',
      body: 'Google 보안 정책으로 인해 카카오톡 안에서는 로그인이 막혀 있습니다. 아래 버튼을 누르면 외부 브라우저에서 detnete를 다시 열어드릴게요.',
      primaryAction: '외부 브라우저로 열기',
      autoFix: true,
    };
  }

  // 그 외 인앱 브라우저는 매뉴얼 안내
  if (isiOS) {
    return {
      title: `${browser.label}에서는 로그인할 수 없어요`,
      body: '오른쪽 위의 ⋯ 메뉴를 눌러 "Safari로 열기"를 선택해주세요. Safari에서 detnete를 열면 정상적으로 로그인할 수 있어요.',
      primaryAction: null,
      autoFix: false,
    };
  }

  // Android 등
  return {
    title: `${browser.label}에서는 로그인할 수 없어요`,
    body: '오른쪽 위의 ⋮ 메뉴를 눌러 "다른 브라우저로 열기" 또는 "Chrome으로 열기"를 선택해주세요.',
    primaryAction: null,
    autoFix: false,
  };
}

/* 디버깅 편의용 */
export const _INTERNAL = { IN_APP_PATTERNS };
