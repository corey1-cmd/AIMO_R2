-- ═══════════════════════════════════════════════════════════════
-- détente — Day 6b Schema (시니어 2 확정본, 2026-04-24)
--
-- 실행 순서:
--   1. Supabase Dashboard → SQL Editor → New Query
--   2. 이 파일 전체 복사 붙여넣기
--   3. Run 실행
--   4. Table Editor에서 4개 테이블(records, plans, learning_data, shares) 생성 확인
--   5. RLS 검증 (파일 말미의 검증 쿼리 참조)
--
-- 주의:
--   - auth.users 테이블은 Supabase가 자동 관리. 이 스키마는 public 스키마만 건드립니다.
--   - 프로덕션 실행 전 dev 환경에서 먼저 실행하여 검증하세요.
-- ═══════════════════════════════════════════════════════════════

-- 1. Records ──────────────────────────────────────────────────────
create table records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  input text not null,
  breakdown jsonb not null,
  total_est_min int,
  total_actual_min int,
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index records_user_idx on records(user_id, created_at desc);

-- 2. Plans ────────────────────────────────────────────────────────
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  state jsonb not null,
  updated_at timestamptz default now()
);
create unique index plans_user_unique on plans(user_id);

-- 3. Learning Data (Day 6 신규 승인) ─────────────────────────────
create table learning_data (
  user_id uuid primary key references auth.users,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 4. Shares ───────────────────────────────────────────────────────
create table shares (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references records on delete cascade not null,
  owner_user_id uuid references auth.users not null,
  share_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz default now()
);
create index shares_token_idx on shares(share_token) where revoked_at is null;

-- 5. RLS 활성화 ──────────────────────────────────────────────────
alter table records enable row level security;
alter table plans enable row level security;
alter table learning_data enable row level security;
alter table shares enable row level security;

-- 6. RLS 정책 ────────────────────────────────────────────────────
create policy "records_owner_all" on records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plans_owner_all" on plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "learning_data_owner_all" on learning_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "shares_owner_all" on shares
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- 공유 링크로 접근하는 미인증 사용자용 읽기 정책
create policy "shares_public_read" on shares
  for select using (
    revoked_at is null
    and (expires_at is null or expires_at > now())
  );

create policy "records_shared_read" on records
  for select using (
    exists (
      select 1 from shares
      where shares.record_id = records.id
        and shares.revoked_at is null
        and (shares.expires_at is null or shares.expires_at > now())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- RLS 검증 쿼리 (스키마 실행 후 별도로 돌려보세요)
-- ═══════════════════════════════════════════════════════════════
--
-- 테스트 1: 익명 클라이언트로 records 조회 시도 → 0 rows 반환되어야 함
--   (anon key로 select * from records 시 빈 결과)
--
-- 테스트 2: 테스트 사용자 A 로그인 후 records insert → 성공해야 함
--
-- 테스트 3: 테스트 사용자 B 로그인 후 A의 record 조회 시도 → 0 rows
--   (user_id filter 없이 select * from records)
--
-- 테스트 4: share 생성 후 익명으로 share_token 조회 → 1 row 반환
--
-- 각 테스트는 Supabase Dashboard의 "SQL Editor > Run as role" 기능으로
-- 역할별 실행 가능합니다.
