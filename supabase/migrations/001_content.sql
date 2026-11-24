-- 001_content: 콘텐츠 — 코스 · 레벨 · 레슨 · 단어
-- 설계: 2_설계.md 3-2, ERD: 2-1_ERD.md
-- 권한(RLS) 정책은 005_rls.sql 에서 붙인다. 그 전까지는 RLS만 켜 두어 API로는 아무도 못 읽는다.

create table public.courses (
  code text primary key check (code in ('E', 'M', 'A')),   -- E 초등 · M 중고생 · A 성인
  name text not null,
  sort int not null default 0
);

create table public.levels (
  id text primary key,                                       -- 'E-1'
  course_code text not null references public.courses (code) on update cascade,
  level_no int not null check (level_no between 1 and 9),
  name text not null,                                        -- '나와 우리 집'
  unique (course_code, level_no)
);

create table public.lessons (
  id text primary key,                                       -- 'E-1-2'
  level_id text not null references public.levels (id) on update cascade,
  lesson_no int not null check (lesson_no between 1 and 9),
  topic text not null,                                       -- '동물'
  unique (level_id, lesson_no)
);
create index lessons_level_idx on public.lessons (level_id);

create table public.items (
  id text primary key,                                       -- 'E-1-2-05' (CSV · 음성 파일 이름과 같음)
  lesson_id text not null references public.lessons (id) on update cascade,
  word text not null,
  pos text not null,                                         -- 명 · 동 · 형 · 부
  meaning_ko text not null,
  example_en text not null,
  example_ko text not null,
  emoji text,                                                -- 초등 그림 문제용, 없으면 그림 문제 제외
  audio_word text not null,                                  -- 'E-1-2-05_w.mp3'
  audio_sentence text not null,                              -- 'E-1-2-05_s.mp3'
  audio_version int not null default 1,                      -- 파일을 바꾸면 +1 (휴대폰 캐시 무효화)
  audio_stale boolean not null default false,                -- 영어를 고쳐 음성 다시 만들기 필요
  hidden boolean not null default false,                     -- 숨김 (삭제 대신, 학습 기록 보호)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index items_lesson_idx on public.items (lesson_id);

-- 고칠 때마다 updated_at 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 영어(단어 · 예문)를 고치면 "음성 다시 만들기 필요" 로 표시
create or replace function public.mark_audio_stale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.word is distinct from old.word or new.example_en is distinct from old.example_en then
    new.audio_stale := true;
  end if;
  return new;
end;
$$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger items_audio_stale before update on public.items
  for each row execute function public.mark_audio_stale();

alter table public.courses enable row level security;
alter table public.levels enable row level security;
alter table public.lessons enable row level security;
alter table public.items enable row level security;
