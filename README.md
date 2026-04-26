# patch-v6a-hardgate

**Day 6a 산출물 (Hard Gate 버전)**
2026-04-24

## 변경 핵심

- 비로그인 사용 불가능. Google 인증을 거쳐야 메인 진입.
- LoginPage.jsx 신규: 인증되지 않은 모든 사용자에게 표시
- App.jsx 분리: `App` (Gate 분기) + `AppMain` (인증 후 본체)
- 기존 patch-v6a 와의 차이는 위 두 가지뿐. 나머지는 동일.

## 산출물 목록

```
src/auth/
  ├── supabase.js         싱글톤 클라이언트
  ├── AuthProvider.jsx    3상태 context
  ├── AuthButton.jsx      Nav 우측 로그아웃 버튼
  ├── LoginPage.jsx       Hard Gate 진입 페이지 (인앱 브라우저 처리 포함)
  └── inAppBrowser.js     인앱 브라우저 감지 + 외부 브라우저 유도 (신규)

src/
  ├── main.jsx            AuthProvider 래핑
  └── App.jsx             Gate 분기 + AppMain (수정)

package.json              @supabase/supabase-js 추가
vite.config.js            manualChunks
vercel.json               SPA rewrites + share 헤더
.env.example              환경변수 템플릿
schema.sql                Day 6b 스키마

SENIOR2_REPORT.md         Hard Gate 노선 변경 사후 보고
```

## 인앱 브라우저 처리 (신규)

이전 patch 적용 후 카카오톡 등에서 접속 시 Google이 `403 disallowed_useragent` 에러로 OAuth 로그인을 차단하는 문제가 있었습니다. patch-v6a-hardgate-v2 부터 LoginPage 가 진입 시점에 인앱 브라우저를 감지하고 다음과 같이 처리합니다.

**감지 대상**: 카카오톡, 네이버앱, 인스타그램, 페이스북, 라인, 다음앱, Android WebView 일반.

**카카오톡 사용자**: "외부 브라우저로 열기" 버튼 표시. 클릭 시 `?openExternalBrowser=1` 쿼리 트릭으로 자동 우회.

**그 외 인앱 브라우저 사용자**: OS 별 매뉴얼 안내 표시. iOS 는 "Safari로 열기", Android 는 "Chrome으로 열기" 메뉴 위치 안내. URL 직접 복사 가능한 박스 제공.

**일반 Chrome / Safari 사용자**: 영향 없음. 기존 Google 로그인 버튼 표시.

단위 테스트 8/8 통과 확인 완료 (실제 카카오톡, Facebook, Instagram, Line UA 샘플 + Safari, Chrome false positive 없음 검증).

## 적용 절차

1. `patch-v6a-hardgate.zip` 압축 해제
2. `src/auth/` 디렉토리 전체 복사
3. `src/main.jsx`, `src/App.jsx` 덮어쓰기
4. `package.json`, `vite.config.js`, `vercel.json`, `.env.example` 덮어쓰기
5. `npm install`
6. 로컬 테스트
   - `.env.example` → `.env.local` 복사 후 실제 값 입력
   - `npm run dev`
   - 브라우저에서 LoginPage 표시 확인
   - Google 로그인 → 메인 진입 확인
7. 저장소 commit → Vercel 자동 배포

## 환경변수 확인 사항 (중요)

이전 turn 에서 발생한 `niuyxborqhzsinbglhmn.supabase.com` (틀림) vs `.supabase.co` (맞음) 이슈가 있었습니다. Vercel 환경변수에서 `VITE_SUPABASE_URL` 값을 다시 확인하세요.

```
VITE_SUPABASE_URL=https://niuyxborqhzsinbglhmn.supabase.co
                                                    ↑↑
                                                    co (NOT com)
```

수정 후 Vercel 에서 **Redeploy** 필요 (환경변수만 변경해도 자동 재배포 안 됨).

## 빌드 검증

| 청크 | Raw | Gzip |
|---|---:|---:|
| index (main) | 885.74 KB | 170.09 KB |
| supabase | 197.04 KB | 51.80 KB |

manualChunks 정상 동작. LoginPage 추가로 메인이 +1.69KB 증가.

## 검증 절차

배포 후 다음을 확인하세요.

1. **첫 진입**: 브라우저 시크릿 모드에서 `https://aimo-seven.vercel.app` 접속 → LoginPage 만 표시되어야 함. 메인 페이지나 NavBar 가 보이면 안 됨.
2. **로그인 플로우**: Google 버튼 클릭 → `Google 로그인 진행 중...` 스피너 → Google OAuth 동의 → Supabase 콜백 → AppMain 진입.
3. **세션 지속성**: 로그인 후 탭 닫고 다시 열기 → LoginPage 거치지 않고 바로 AppMain 진입.
4. **로그아웃**: Nav 우측 "로그아웃" 클릭 → 확인 다이얼로그 → 로그아웃 후 LoginPage 로 복귀.
5. **Flash 부재**: 로그인 상태에서 페이지 새로고침 5회 연속 → 우측 상단에 "로그인" 버튼이 잠깐 번쩍이는 현상 없어야 함.

위 5가지가 모두 통과하면 Day 6a 완료. 이후 Day 6b (schema.sql 실행) 진행 가능.

## 시니어 2 보고서

`SENIOR2_REPORT.md` 에 Hard Gate 노선 변경 배경과 영향이 정리되어 있습니다. Day 6c 마이그레이션 작업이 취소된 것이 핵심이며, 시니어 2 의 다음 사이클 검토 항목 3가지가 명시되어 있습니다.
