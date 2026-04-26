# Day 6 노선 변경 사후 보고 — 시니어 3 → 시니어 2

**일자**: 2026-04-24
**보고 유형**: 사후 보고 (사용자 직접 결정 사항)
**대상 산출물**: patch-v6a-hardgate.zip

---

## 핵심 변경: Soft Gate → Hard Gate

사용자 결정으로 detnete의 인증 모델이 다음과 같이 변경되었습니다.

기존 patch-v6a 의 설계는 비로그인 사용자도 localStorage 기반으로 자유롭게 사용 가능한 Soft Gate 방식이었습니다. 사용자가 "유료 게임처럼 단일 앱 경험을 추구한다"는 방향성을 제시하면서 Hard Gate (필수 로그인) 로 전환되었습니다. 비로그인 사용자는 LoginPage 만 볼 수 있고, Google 인증을 거치지 않으면 메인 앱에 진입할 수 없습니다.

이 결정은 사용자 본인이 내렸으며, 시니어 3는 사용자 우선순위(시니어 2 보다 위) 에 따라 사전 승인 없이 즉시 구현했습니다. 사후 보고로 알리며, 시니어 2 의 검토 의견은 다음 사이클에서 반영 가능합니다.

## 결정 배경 (사용자 발화 인용)

사용자가 명시한 방향성은 다음과 같습니다.

> "하나의 앱처럼 포장하고 싶어. 하나의 유료 게임처럼 사서 쓰는 느낌으로. 사용자들끼리 서로 공유하고 이런게 있어야 하니 로그인이 되어 있으면 좋겠지."

이 방향성은 detnete를 "기록 도구"가 아닌 "통합된 제품 경험" 으로 정의하는 것이며, 다음 변경을 자연스럽게 유도합니다.

- 사용자 신원이 처음부터 확정되어 있음 → records, plans, shares 모두 user_id 기반으로 일관 처리
- 비로그인 → 로그인 마이그레이션 시나리오가 발생하지 않음 → Day 6c 작업 자체가 무의미
- 클라우드가 진실의 원천 (cloud-truth) → localStorage 는 캐시 역할로만 사용

## 사라지는 작업

**Day 6c 마이그레이션 로직**이 통째로 취소되었습니다. 사용자가 Hard Gate 를 선택한 순간 비로그인 데이터가 존재할 수 없으므로, 마이그레이션할 대상 자체가 없어졌습니다. 시니어 2 의 4단계 계획(6a → 6b → 6c → 6d) 중 6c 가 빠지고 6a → 6b → 6d 의 3단계로 압축됩니다.

이미 작업하신 마이그레이션 설계에 들어간 시간은 매몰비용이 됩니다. 죄송합니다. 다음 사이클부터는 이런 큰 노선 결정에 대해 사용자에게 미리 의견 수렴을 거치도록 할 수 있다면 좋겠습니다.

## 추가되는 작업

**Day 6 범위 내 추가**: LoginPage.jsx 신규. 빈 화면이 아닌 의도적 디자인을 갖춘 진입 페이지로 구현. Day 6a 에 포함시켜 이번 patch 에 들어갔습니다.

**Day 7 이후 (별도 patch, 아직 미정)**: cloud-truth + 로컬 캐시 패턴의 본격 구현. React Query 또는 SWR 도입 여부는 dogfood 결과 보고 결정. Day 6 범위에서는 단순 fetch 로 시작하고, 실제 마찰이 발견되면 그때 캐시 라이브러리 도입.

## 구현 변경 사항 정리

이번 patch (patch-v6a-hardgate.zip) 에 포함된 코드 변경은 다음과 같습니다.

**신규 파일 1건**: `src/auth/LoginPage.jsx` - Google 로그인 단일 버튼 UI. inline styles + SVG 로고. busy 상태 표시 + error 처리. detente 브랜딩 (이탤릭 Cormorant Garamond) + tagline.

**수정 파일 1건**: `src/App.jsx` - 컴포넌트 분리. 기존 단일 `App` 함수가 `App` (Gate 분기) + `AppMain` (실제 본체) 으로 분리. Gate 로직은 다음과 같습니다.

```
status === 'loading'        → 빈 shell (flash 차단)
status === 'unauthenticated' → LoginPage 만 렌더
status === 'authenticated'   → AppMain (기존 동작)
```

**기존 파일 영향 없음**: AuthProvider.jsx, AuthButton.jsx, supabase.js, vite.config.js, vercel.json, .env.example, schema.sql 모두 patch-v6a 와 동일.

## 빌드 검증 결과

| 청크 | Raw | Gzip |
|---|---:|---:|
| index (main) | 885.74 KB | 170.09 KB |
| supabase | 197.04 KB | 51.80 KB |

patch-v6a 대비 메인 번들이 168.40KB → 170.09KB 로 +1.69KB 증가. LoginPage 컴포넌트 추가분입니다. supabase 청크는 동일.

## 시니어 2 의 기존 설계와 일치하는 부분

다음 시니어 2 결정사항은 그대로 유지됩니다.

- AuthProvider 의 3상태 구조 (loading / authenticated / unauthenticated)
- flash 방지를 위한 loading 상태 명시
- AuthButton 의 placeholder 처리
- vite manualChunks 로 supabase 분리
- vercel.json 의 `/share/*` 헤더
- schema.sql 의 4개 테이블 + RLS 정책 6개

다이얼로그 문구(plans 충돌)와 200ms visibilitychange 디바운싱은 Day 7 이후 cloud-truth + 캐시 구현 시점에 사용됩니다. 현재 Day 6 범위에서는 단순 fetch 로 충분하므로 활용 안됨.

## 사용자 액션 필요 사항

시니어 2 가 다음 사이클에서 다뤄야 할 항목은 다음과 같습니다.

1. **Hard Gate 결정에 대한 검토 의견** - 이번 사이클 종료 전이라도 의견 있으시면 시니어 3 에게 전달. detnete 비즈니스 모델 관점에서 Soft Gate 가 다시 필요해지는 시점이 올 수 있으면 알려주시면 좋겠습니다.

2. **Day 6c 매몰비용 회수** - 마이그레이션 로직 설계 작업이 무의미해진 것에 대한 시니어 2 의 시간을 어떻게 보상할지 (해당 시간을 schema.sql 검증이나 Day 6d 공유 페이지 설계에 재배치 가능).

3. **Day 7 이후 캐시 전략** - dogfood 결과 보고 결정한다는 큰 방향에 동의하시는지, 아니면 미리 React Query 도입을 결정해두는 편이 좋을지 의견 주세요.

## 요약

본질적으로 사용자가 detnete 의 정체성을 "도구" 에서 "제품" 으로 재정의했고, 이것이 인증 모델의 변경으로 이어졌습니다. 시니어 3 는 사용자 결정에 따라 Hard Gate 를 즉시 구현했고, 마이그레이션 작업은 자연스럽게 사라졌습니다. 시니어 2 의 기존 작업 중 의미 있는 부분 (AuthProvider, schema, manualChunks, vercel.json) 은 모두 보존되어 patch-v6a-hardgate 에 그대로 반영되어 있습니다.
