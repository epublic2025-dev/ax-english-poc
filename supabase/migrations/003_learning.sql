-- 003_learning: 학습 기록 — 레슨 · 레벨 시험 · 단어별 기억 · 문제 답
-- 설계: 2_설계.md 3-4, ERD: 2-1_ERD.md
-- 이 표들은 화면이 직접 쓰지 않는다. 006 DB 함수만 쓴다.
-- 날짜(due_at 등)는 한국 시간 기준: (now() at time zone 'Asia/Seoul')::date

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on update cascade,
  best_score int not null default 0 check (best_score between 0 and 100),
  attempts int not null default 0,
  passed_at timestamptz,                                     -- 80% 이상 처음 통과한 시각
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create table public.level_exams (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null references public.levels (id) on update cascade,
  score int not null check (score between 0 and 100),
  passed boolean not null,                                   -- 80% 이상
  created_at timestamptz not null default now()
);
create index level_exams_user_idx on public.level_exams (user_id, level_id);
create index level_exams_level_idx on public.level_exams (level_id);

-- 단어별 기억 상태 = 정원 그림
-- stage 0 씨앗(처음 봄) · 1 새싹(1일) · 2 잎(3일) · 3 꽃(7일) · 4 나무(14일) · 5 졸업
create table public.item_memory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id) on update cascade,
  stage smallint not null default 0 check (stage between 0 and 5),
  due_at date,                                               -- 다음 복습일 (stage 5면 비움)
  correct_streak int not null default 0,
  wrong_count int not null default 0,
  ever_wrong boolean not null default false,                 -- 오답 노트
  last_seen_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index item_memory_due_idx on public.item_memory (user_id, due_at) where stage between 1 and 4;
create index item_memory_wrong_idx on public.item_memory (user_id) where ever_wrong;
create index item_memory_item_idx on public.item_memory (item_id);

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id) on update cascade,
  qtype text not null check (qtype in ('meaning', 'listen', 'blank', 'build', 'write', 'speak', 'card',
                                       'pic', 'match', 'seed', 'butterfly')),
  context text not null check (context in ('lesson', 'review', 'placement', 'exam')),
  result text not null check (result in ('correct', 'wrong', 'skipped')),
  created_at timestamptz not null default now()
);
create index attempts_item_idx on public.attempts (item_id);               -- 자주 틀리는 단어
create index attempts_user_time_idx on public.attempts (user_id, created_at desc);  -- 주간 리포트

alter table public.lesson_progress enable row level security;
alter table public.level_exams enable row level security;
alter table public.item_memory enable row level security;
alter table public.attempts enable row level security;
