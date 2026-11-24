-- 004_rewards: 리워드 · 신고 — XP · 연속 학습 · 배지 · 오류 신고
-- 설계: 2_설계.md 3-5 · 1_기획_요구분석.md 7절, ERD: 2-1_ERD.md

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('answer', 'lesson', 'perfect', 'review', 'speak', 'exam', 'rain_bonus')),
  created_at timestamptz not null default now()
);
create index xp_events_user_time_idx on public.xp_events (user_id, created_at desc);   -- 하루 목표 · 주간 리포트

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current int not null default 0,
  best int not null default 0,
  last_active_date date,                                     -- 한국 날짜
  protect_week text                                          -- 이번 주 보호 사용 ('2026-W48')
);

create table public.badges (
  code text primary key,                                     -- 'first_lesson'
  name text not null,
  description text not null,
  sort int not null default 0
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on update cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);
create index user_badges_badge_idx on public.user_badges (badge_code);

create table public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id) on update cascade,
  qtype text check (qtype in ('meaning', 'listen', 'blank', 'build', 'write', 'speak', 'card',
                              'pic', 'match', 'seed', 'butterfly')),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_item_idx on public.reports (item_id);
create index reports_user_idx on public.reports (user_id);

-- 가입 트리거에 연속 학습 기록 만들기를 더한다 (002 의 함수를 바꿔 씀)
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
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$;

alter table public.xp_events enable row level security;
alter table public.streaks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.reports enable row level security;
