-- 002_users: 사용자 — 프로필 · 코스별 진도 · 레벨 테스트 + 가입 트리거
-- 설계: 2_설계.md 3-3 · 3-7, ERD: 2-1_ERD.md

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  is_minor boolean not null default false,                   -- 만 14세 미만 = 보호자 이메일로 가입
  guardian_consent_at timestamptz,                           -- 보호자 동의 시각
  current_course text references public.courses (code),
  daily_goal int not null default 60 check (daily_goal in (30, 60, 100)),
  is_admin boolean not null default false,                   -- 본인은 못 바꿈 (005 칸 권한)
  created_at timestamptz not null default now(),
  constraint minor_needs_consent check (not is_minor or guardian_consent_at is not null)
);

create table public.course_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_code text not null references public.courses (code),
  start_level int not null default 1 check (start_level between 1 and 9),
  current_level int not null default 1 check (current_level between 1 and 9),
  placement_done boolean not null default false,
  completed_at timestamptz,                                  -- 마지막 레벨 시험 통과
  primary key (user_id, course_code)
);

create table public.placement_tests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_code text not null references public.courses (code),
  answers jsonb not null default '[]'::jsonb,                -- 10문제 답
  result_level int check (result_level between 1 and 9),     -- 판정
  chosen_level int check (chosen_level between 1 and 9),     -- 실제로 고른 레벨 (한 단계 아래 등)
  skipped boolean not null default false,                    -- 테스트 건너뛰기
  fit text check (fit in ('easy', 'right', 'hard')),         -- 성공 기준 S4 설문 (첫 레슨 뒤)
  fit_at timestamptz,
  created_at timestamptz not null default now()
);
create index placement_tests_user_idx on public.placement_tests (user_id, created_at desc);

-- 지금 로그인한 사람이 관리자인지 (권한 규칙 · 함수에서 사용)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- 가입하면 프로필 만들기. 가입 화면이 보내는 값: nickname, is_minor, guardian_consent
-- (004_rewards.sql 에서 연속 학습 기록 만들기를 더한다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  minor boolean := coalesce((meta ->> 'is_minor')::boolean, false);
begin
  insert into public.profiles (id, nickname, is_minor, guardian_consent_at)
  values (
    new.id,
    left(coalesce(nullif(btrim(meta ->> 'nickname'), ''), '학습자'), 20),
    minor,
    case when minor and coalesce((meta ->> 'guardian_consent')::boolean, false) then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.course_progress enable row level security;
alter table public.placement_tests enable row level security;
