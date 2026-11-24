-- 006_functions: DB 함수 — 채점 · 기억 단계 · XP · 연속 학습 · 배지 · 관리자 현황
-- 설계: 2_설계.md 3-4 · 3-7, 기획: 1_기획_요구분석.md 3-4 · 3-5 · 7절
--
-- 화면이 보내는 답(answers) 한 개의 모양
--   { "item_id": "E-1-2-05", "qtype": "meaning", "answer": "토끼", "result": "correct", "grade": 2, "dont_know": false }
--   · answer : meaning → 고른 한글 뜻 / listen · blank · write → 영어 단어 / build → 만든 문장
--              pic · match · butterfly → 고른 단어 id
--   · result : speak · seed 만 화면 판단을 믿는다 (나머지는 DB가 다시 채점)
--   · grade  : card 만 — 0 다시 · 1 어려움 · 2 알맞음 · 3 쉬움
--   · dont_know : 레벨 테스트 "모르겠어요" (오답으로 셈)

------------------------------------------------------------------------
-- 0. 앞 단계 점검(advisors) 보완
------------------------------------------------------------------------
-- is_admin() 을 API 에 드러나지 않는 private 스키마로 옮긴다 (권한 규칙은 그대로 동작)
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;

-- 다른 표를 가리키는 칸에 색인 (점검 권고)
create index profiles_current_course_idx on public.profiles (current_course);
create index course_progress_course_idx on public.course_progress (course_code);
create index placement_tests_course_idx on public.placement_tests (course_code);
create index items_updated_by_idx on public.items (updated_by);
create index reports_resolved_by_idx on public.reports (resolved_by);

------------------------------------------------------------------------
-- 1. 도우미 (private — 앱에서 직접 부를 수 없음)
------------------------------------------------------------------------
create or replace function private.today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function private.require_user()
returns uuid language plpgsql stable set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  return uid;
end;
$$;

-- 영어 비교용: 소문자, 둥근 따옴표 → ', 문장부호 제거, 빈칸 하나로
create or replace function private.norm_en(t text)
returns text language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(
           regexp_replace(lower(coalesce(t, '')), '[’‘]', '''', 'g'),
           '[^a-z0-9'' -]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- 기억 단계별 다음 복습까지 날짜: 1 새싹 1일 · 2 잎 3일 · 3 꽃 7일 · 4 나무 14일 · 5 졸업(없음)
create or replace function private.interval_days(s int)
returns int language sql immutable set search_path = ''
as $$ select case s when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 14 else null end $$;

-- 답 하나 채점
create or replace function private.grade(it public.items, a jsonb)
returns text language plpgsql stable set search_path = ''
as $$
declare
  q text := a ->> 'qtype';
  ans text := a ->> 'answer';
  claimed text := coalesce(a ->> 'result', 'wrong');
begin
  if q = 'speak' and claimed = 'skipped' then
    return 'skipped';                                        -- "지금은 말할 수 없어요"
  end if;
  if coalesce((a ->> 'dont_know')::boolean, false) then
    return 'wrong';
  end if;
  case q
    when 'meaning' then
      return case when btrim(coalesce(ans, '')) = it.meaning_ko then 'correct' else 'wrong' end;
    when 'listen', 'blank', 'write' then
      return case when private.norm_en(ans) = private.norm_en(it.word) then 'correct' else 'wrong' end;
    when 'build' then
      return case when private.norm_en(ans) = private.norm_en(it.example_en) then 'correct' else 'wrong' end;
    when 'pic', 'match', 'butterfly' then
      return case when ans = it.id then 'correct' else 'wrong' end;
    when 'card' then
      return case when coalesce((a ->> 'grade')::int, 0) >= 1 then 'correct' else 'wrong' end;
    when 'speak', 'seed' then
      return case when claimed in ('correct', 'wrong') then claimed else 'wrong' end;
    else
      raise exception '알 수 없는 문제 유형: %', q;
  end case;
end;
$$;

-- 단어 기억 단계 저장
create or replace function private.set_memory(uid uuid, iid text, new_stage int, was_wrong boolean)
returns void language plpgsql set search_path = ''
as $$
declare s int := greatest(1, least(5, new_stage));
begin
  insert into public.item_memory as m
    (user_id, item_id, stage, due_at, correct_streak, wrong_count, ever_wrong, last_seen_at)
  values
    (uid, iid, s, private.today() + private.interval_days(s),
     case when was_wrong then 0 else 1 end, case when was_wrong then 1 else 0 end, was_wrong, now())
  on conflict (user_id, item_id) do update set
    stage = s,
    due_at = private.today() + private.interval_days(s),
    correct_streak = case when was_wrong then 0 else m.correct_streak + 1 end,
    wrong_count = m.wrong_count + case when was_wrong then 1 else 0 end,
    ever_wrong = m.ever_wrong or was_wrong,
    last_seen_at = now();
end;
$$;

-- 답 묶음 처리: 채점 → attempts 기록 → 개수 · 단어별 결과 · 물방울(5연속) 횟수
--   p_scope: 'E-1-2'(레슨) · 'E-1'(레벨) · 'E'(코스) — 이 범위 밖 단어는 거절, null 이면 제한 없음
create or replace function private.process_answers(uid uuid, p_answers jsonb, p_context text, p_scope text)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  a jsonb; it public.items; res text; prev text;
  n_ok int := 0; n_bad int := 0; n_skip int := 0; n_speak int := 0; run int := 0; rains int := 0;
  per jsonb := '{}'::jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception '답이 없어요';
  end if;
  if jsonb_array_length(p_answers) > 60 then
    raise exception '답이 너무 많아요';
  end if;

  for a in select value from jsonb_array_elements(p_answers) loop
    select i.* into it from public.items i where i.id = a ->> 'item_id' and not i.hidden;
    if not found then
      raise exception '없는 단어예요: %', a ->> 'item_id';
    end if;
    if p_scope is not null and not (it.id like (p_scope || '-%')) then
      raise exception '이 범위의 단어가 아니에요: %', it.id;
    end if;

    res := private.grade(it, a);
    insert into public.attempts (user_id, item_id, qtype, context, result)
    values (uid, it.id, a ->> 'qtype', p_context, res);

    if res = 'correct' then
      n_ok := n_ok + 1; run := run + 1;
      if run % 5 = 0 then rains := rains + 1; end if;
      if a ->> 'qtype' = 'speak' then n_speak := n_speak + 1; end if;
    elsif res = 'wrong' then
      n_bad := n_bad + 1; run := 0;
    else
      n_skip := n_skip + 1;
    end if;

    -- 한 단어를 여러 번 물으면 가장 나쁜 결과를 남긴다 (틀림 > 맞음 > 건너뜀)
    prev := per -> it.id ->> 'res';
    if prev is null or prev = 'skipped' or (prev = 'correct' and res = 'wrong') then
      per := jsonb_set(per, array[it.id],
        jsonb_build_object('res', res,
                           'grade', case when a ->> 'qtype' = 'card' then (a ->> 'grade')::int end));
    end if;
  end loop;

  return jsonb_build_object('correct', n_ok, 'wrong', n_bad, 'skipped', n_skip,
                            'speak', n_speak, 'rains', rains, 'per', per);
end;
$$;

create or replace function private.add_xp(uid uuid, amt int, why text)
returns int language plpgsql set search_path = ''
as $$
begin
  if amt > 0 then
    insert into public.xp_events (user_id, amount, reason) values (uid, amt, why);
  end if;
  return greatest(amt, 0);
end;
$$;

-- 연속 학습: 어제 했으면 +1, 하루 빠져도 이번 주 처음이면 보호(+1), 아니면 1부터
create or replace function private.touch_streak(uid uuid)
returns int language plpgsql set search_path = ''
as $$
declare
  st public.streaks;
  d date := private.today();
  wk text := to_char(private.today(), 'IYYY-"W"IW');
begin
  select * into st from public.streaks where user_id = uid for update;
  if not found then
    insert into public.streaks (user_id) values (uid) returning * into st;
  end if;
  if st.last_active_date = d then
    return st.current;
  end if;
  if st.last_active_date = d - 1 then
    st.current := st.current + 1;
  elsif st.last_active_date = d - 2 and st.protect_week is distinct from wk then
    st.current := st.current + 1;
    st.protect_week := wk;
  else
    st.current := 1;
  end if;
  update public.streaks
     set current = st.current, best = greatest(best, st.current),
         last_active_date = d, protect_week = st.protect_week
   where user_id = uid;
  return st.current;
end;
$$;

-- 새로 받을 배지 주기 (배지 목록은 DB-7 에서 넣음)
create or replace function private.award_badges(uid uuid)
returns text[] language plpgsql set search_path = ''
as $$
declare got text[] := '{}'; c text;
begin
  for c in
    select b.code from public.badges b
    where not exists (select 1 from public.user_badges ub where ub.user_id = uid and ub.badge_code = b.code)
      and case b.code
        when 'first_lesson' then exists (select 1 from public.lesson_progress where user_id = uid and passed_at is not null)
        when 'streak_7'     then exists (select 1 from public.streaks where user_id = uid and best >= 7)
        when 'streak_30'    then exists (select 1 from public.streaks where user_id = uid and best >= 30)
        when 'level_pass'   then exists (select 1 from public.level_exams where user_id = uid and passed)
        when 'course_done'  then exists (select 1 from public.course_progress where user_id = uid and completed_at is not null)
        when 'wrong_30'     then (select count(*) from public.item_memory where user_id = uid and ever_wrong and stage >= 3) >= 30
        when 'speak_50'     then (select count(*) from public.attempts where user_id = uid and qtype = 'speak' and result = 'correct') >= 50
        when 'perfect_10'   then (select count(*) from public.xp_events where user_id = uid and reason = 'perfect') >= 10
        when 'tree_10'      then (select count(*) from public.item_memory where user_id = uid and stage >= 4) >= 10
        when 'review_100'   then (select count(*) from public.attempts where user_id = uid and context = 'review' and result = 'correct') >= 100
        else false
      end
    order by b.sort
  loop
    insert into public.user_badges (user_id, badge_code) values (uid, c) on conflict do nothing;
    got := got || c;
  end loop;
  return got;
end;
$$;

------------------------------------------------------------------------
-- 2. 앱이 부르는 함수 (public — 로그인한 사람만)
------------------------------------------------------------------------

-- 레벨 테스트 제출: 2레벨 5문제 → (4개 이상) 3레벨 5문제 / (3개 이하) 1레벨 5문제
create or replace function public.submit_placement(p_course text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  r jsonb; c1 int; c2 int; c3 int; lvl int; easy boolean := false;
begin
  if not exists (select 1 from public.courses where code = p_course) then
    raise exception '없는 코스예요: %', p_course;
  end if;
  if jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) not between 5 and 12 then
    raise exception '레벨 테스트 답은 10개 안팎이어야 해요';
  end if;

  r := private.process_answers(uid, p_answers, 'placement', p_course);
  select count(*) filter (where split_part(key, '-', 2) = '1' and value ->> 'res' = 'correct'),
         count(*) filter (where split_part(key, '-', 2) = '2' and value ->> 'res' = 'correct'),
         count(*) filter (where split_part(key, '-', 2) = '3' and value ->> 'res' = 'correct')
    into c1, c2, c3
    from jsonb_each(r -> 'per');

  if c2 >= 4 then
    lvl := 3; easy := c3 >= 4;
  elsif c1 >= 4 then
    lvl := 2;
  else
    lvl := 1;
  end if;

  insert into public.placement_tests (user_id, course_code, answers, result_level, chosen_level)
  values (uid, p_course, p_answers, lvl, lvl);
  insert into public.course_progress (user_id, course_code, start_level, current_level, placement_done)
  values (uid, p_course, lvl, lvl, true)
  on conflict (user_id, course_code) do update
    set start_level = excluded.start_level, current_level = excluded.current_level, placement_done = true;
  update public.profiles set current_course = p_course where id = uid;

  return jsonb_build_object('result_level', lvl, 'easy_course', easy, 'correct', r -> 'correct');
end;
$$;

-- 결과 화면: "한 단계 아래에서 시작" 또는 테스트 건너뛰기(1레벨)
create or replace function public.choose_start_level(p_course text, p_level int, p_skipped boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  pt public.placement_tests;
  lvl int;
begin
  if not exists (select 1 from public.courses where code = p_course) then
    raise exception '없는 코스예요: %', p_course;
  end if;
  if p_skipped then
    lvl := 1;
    insert into public.placement_tests (user_id, course_code, skipped, chosen_level)
    values (uid, p_course, true, 1);
  else
    select * into pt from public.placement_tests
     where user_id = uid and course_code = p_course and not skipped
     order by created_at desc limit 1;
    if not found then
      raise exception '레벨 테스트를 먼저 봐 주세요';
    end if;
    if p_level < 1 or p_level > pt.result_level then
      raise exception '고를 수 없는 레벨이에요';
    end if;
    lvl := p_level;
    update public.placement_tests set chosen_level = lvl where id = pt.id;
  end if;

  insert into public.course_progress (user_id, course_code, start_level, current_level, placement_done)
  values (uid, p_course, lvl, lvl, true)
  on conflict (user_id, course_code) do update
    set start_level = excluded.start_level, current_level = excluded.current_level, placement_done = true;
  update public.profiles set current_course = p_course where id = uid;
  return jsonb_build_object('start_level', lvl);
end;
$$;

-- 레슨 제출: 점수(80% 통과) · XP · 기억 단계 · 연속 학습 · 배지
create or replace function public.submit_lesson(p_lesson_id text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  ls public.lessons; lv public.levels; cp public.course_progress;
  r jsonb; total int; score int; passed boolean; was_passed boolean;
  mult numeric := 1; xp int := 0; k text; v jsonb; cur int;
  wrong_items text[] := '{}'; streak int; badges text[]; ask_fit boolean := false; exam_open boolean;
begin
  select * into ls from public.lessons where id = p_lesson_id;
  if not found then raise exception '없는 레슨이에요: %', p_lesson_id; end if;
  select * into lv from public.levels where id = ls.level_id;
  select * into cp from public.course_progress where user_id = uid and course_code = lv.course_code;
  if not found or lv.level_no > cp.current_level then
    raise exception '아직 열리지 않은 레슨이에요';
  end if;

  r := private.process_answers(uid, p_answers, 'lesson', ls.id);
  total := (r ->> 'correct')::int + (r ->> 'wrong')::int;
  score := case when total = 0 then 0 else round(100.0 * (r ->> 'correct')::int / total) end;
  passed := score >= 80;

  select lp.passed_at is not null into was_passed
    from public.lesson_progress lp where lp.user_id = uid and lp.lesson_id = ls.id;
  was_passed := coalesce(was_passed, false);

  -- 단어 기억: 틀리면 새싹(1일 뒤), 다 맞히면 잎(3일 뒤) 이상
  for k, v in select key, value from jsonb_each(r -> 'per') loop
    continue when v ->> 'res' = 'skipped';
    select m.stage into cur from public.item_memory m where m.user_id = uid and m.item_id = k;
    if v ->> 'res' = 'wrong' then
      perform private.set_memory(uid, k, 1, true);
      wrong_items := wrong_items || k;
    else
      perform private.set_memory(uid, k, greatest(coalesce(cur, 0), 2), false);
    end if;
  end loop;

  insert into public.lesson_progress as lp (user_id, lesson_id, best_score, attempts, passed_at)
  values (uid, ls.id, score, 1, case when passed then now() end)
  on conflict (user_id, lesson_id) do update set
    best_score = greatest(lp.best_score, excluded.best_score),
    attempts = lp.attempts + 1,
    passed_at = coalesce(lp.passed_at, excluded.passed_at);

  -- XP (이미 통과한 레슨을 다시 풀면 절반)
  if was_passed then mult := 0.5; end if;
  xp := xp + private.add_xp(uid, floor((r ->> 'correct')::int * 10 * mult)::int, 'answer');
  xp := xp + private.add_xp(uid, floor((r ->> 'speak')::int * 5 * mult)::int, 'speak');
  if passed then xp := xp + private.add_xp(uid, floor(20 * mult)::int, 'lesson'); end if;
  if total > 0 and score = 100 then xp := xp + private.add_xp(uid, floor(10 * mult)::int, 'perfect'); end if;
  if lv.course_code = 'E' then
    xp := xp + private.add_xp(uid, floor((r ->> 'rains')::int * 20 * mult)::int, 'rain_bonus');
  end if;

  streak := private.touch_streak(uid);
  badges := private.award_badges(uid);

  -- 첫 레슨을 처음 통과했을 때 한 번만 "시작 레벨이 적당했나요?" (성공 기준 S4)
  if passed and not was_passed
     and (select count(*) from public.lesson_progress where user_id = uid and passed_at is not null) = 1 then
    ask_fit := exists (select 1 from public.placement_tests
                        where user_id = uid and course_code = lv.course_code and fit is null);
  end if;

  exam_open := not exists (
    select 1 from public.lessons l
     where l.level_id = lv.id
       and not exists (select 1 from public.lesson_progress p
                        where p.user_id = uid and p.lesson_id = l.id and p.passed_at is not null));

  return jsonb_build_object(
    'score', score, 'passed', passed,
    'correct', r -> 'correct', 'wrong', r -> 'wrong', 'skipped', r -> 'skipped',
    'xp', xp, 'wrong_items', to_jsonb(wrong_items), 'streak', streak,
    'new_badges', to_jsonb(badges), 'ask_fit', ask_fit, 'level_exam_open', exam_open);
end;
$$;

-- 오늘 복습할 단어 (본인 것만, 권한 규칙을 그대로 따름)
create or replace function public.get_review_queue(p_course text default null, p_limit int default 20)
returns table (
  item_id text, stage smallint, due_at date, word text, pos text, meaning_ko text,
  example_en text, example_ko text, emoji text, audio_word text, audio_sentence text,
  audio_version int, audio_stale boolean)
language sql stable security invoker set search_path = ''
as $$
  select m.item_id, m.stage, m.due_at, i.word, i.pos, i.meaning_ko, i.example_en, i.example_ko,
         i.emoji, i.audio_word, i.audio_sentence, i.audio_version, i.audio_stale
    from public.item_memory m
    join public.items i on i.id = m.item_id
   where m.user_id = (select auth.uid())
     and m.stage between 1 and 4
     and m.due_at <= private.today()
     and (p_course is null or i.id like (p_course || '-%'))
   order by m.due_at, m.stage, m.item_id
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- 복습 제출: 맞히면 한 단계 위, 틀리면 새싹(1일) / 카드는 다시 1단계 · 어려움 그대로 · 알맞음 +1 · 쉬움 +2
create or replace function public.submit_review(p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  r jsonb; k text; v jsonb; cur int; g int; nxt int;
  xp int := 0; wrong_items text[] := '{}'; graduated int := 0; streak int; badges text[];
begin
  r := private.process_answers(uid, p_answers, 'review', null);

  for k, v in select key, value from jsonb_each(r -> 'per') loop
    continue when v ->> 'res' = 'skipped';
    select m.stage into cur from public.item_memory m where m.user_id = uid and m.item_id = k;
    cur := coalesce(nullif(cur, 0), 1);
    if v ->> 'res' = 'wrong' then
      perform private.set_memory(uid, k, 1, true);
      wrong_items := wrong_items || k;
    else
      g := (v ->> 'grade')::int;
      nxt := case when g is null then cur + 1 when g = 1 then cur when g = 2 then cur + 1 else cur + 2 end;
      perform private.set_memory(uid, k, nxt, false);
      if nxt >= 5 then graduated := graduated + 1; end if;
    end if;
  end loop;

  xp := xp + private.add_xp(uid, (r ->> 'correct')::int * 10, 'answer');
  xp := xp + private.add_xp(uid, (r ->> 'speak')::int * 5, 'speak');
  xp := xp + private.add_xp(uid, 15, 'review');
  if (select current_course from public.profiles where id = uid) = 'E' then
    xp := xp + private.add_xp(uid, (r ->> 'rains')::int * 20, 'rain_bonus');
  end if;

  streak := private.touch_streak(uid);
  badges := private.award_badges(uid);
  return jsonb_build_object(
    'correct', r -> 'correct', 'wrong', r -> 'wrong', 'skipped', r -> 'skipped',
    'xp', xp, 'wrong_items', to_jsonb(wrong_items), 'graduated', graduated,
    'streak', streak, 'new_badges', to_jsonb(badges));
end;
$$;

-- 레벨 시험 제출: 레슨 3개 통과 뒤, 80% 이상이면 다음 레벨 (마지막 레벨이면 코스 완료)
create or replace function public.submit_level_exam(p_level_id text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  lv public.levels; cp public.course_progress;
  r jsonb; total int; score int; passed boolean; k text; v jsonb;
  max_level int; next_level int; done boolean := false; xp int := 0; streak int; badges text[];
begin
  select * into lv from public.levels where id = p_level_id;
  if not found then raise exception '없는 레벨이에요: %', p_level_id; end if;
  select * into cp from public.course_progress where user_id = uid and course_code = lv.course_code;
  if not found or lv.level_no > cp.current_level then
    raise exception '아직 열리지 않은 레벨이에요';
  end if;
  if exists (select 1 from public.lessons l
              where l.level_id = lv.id
                and not exists (select 1 from public.lesson_progress p
                                 where p.user_id = uid and p.lesson_id = l.id and p.passed_at is not null)) then
    raise exception '레슨 3개를 먼저 통과해 주세요';
  end if;

  r := private.process_answers(uid, p_answers, 'exam', lv.id);
  total := (r ->> 'correct')::int + (r ->> 'wrong')::int;
  score := case when total = 0 then 0 else round(100.0 * (r ->> 'correct')::int / total) end;
  passed := score >= 80;
  insert into public.level_exams (user_id, level_id, score, passed) values (uid, lv.id, score, passed);

  for k, v in select key, value from jsonb_each(r -> 'per') loop
    if v ->> 'res' = 'wrong' then
      perform private.set_memory(uid, k, 1, true);
    end if;
  end loop;

  select max(level_no) into max_level from public.levels where course_code = lv.course_code;
  next_level := cp.current_level;
  if passed then
    if lv.level_no >= max_level then
      done := true;
      update public.course_progress set completed_at = coalesce(completed_at, now())
       where user_id = uid and course_code = lv.course_code;
    else
      next_level := greatest(cp.current_level, lv.level_no + 1);
      update public.course_progress set current_level = next_level
       where user_id = uid and course_code = lv.course_code;
    end if;
  end if;

  xp := xp + private.add_xp(uid, (r ->> 'correct')::int * 10, 'answer');
  if passed then xp := xp + private.add_xp(uid, 50, 'exam'); end if;
  streak := private.touch_streak(uid);
  badges := private.award_badges(uid);
  return jsonb_build_object(
    'score', score, 'passed', passed, 'xp', xp, 'current_level', next_level,
    'course_completed', done, 'streak', streak, 'new_badges', to_jsonb(badges));
end;
$$;

-- "시작 레벨이 적당했나요?" (지금 코스의 마지막 레벨 테스트에 한 번만 기록)
create or replace function public.submit_fit(p_fit text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_user();
begin
  if p_fit not in ('easy', 'right', 'hard') then
    raise exception '쉬웠어요 · 적당해요 · 어려웠어요 중 하나를 골라 주세요';
  end if;
  update public.placement_tests set fit = p_fit, fit_at = now()
   where id = (select pt.id from public.placement_tests pt
                where pt.user_id = uid
                  and pt.course_code = (select current_course from public.profiles where id = uid)
                order by pt.created_at desc limit 1)
     and fit is null;
  return found;
end;
$$;

-- 오류 신고
create or replace function public.report_item(p_item_id text, p_qtype text, p_message text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare uid uuid := private.require_user(); new_id bigint;
begin
  if not exists (select 1 from public.items where id = p_item_id) then
    raise exception '없는 단어예요: %', p_item_id;
  end if;
  insert into public.reports (user_id, item_id, qtype, message)
  values (uid, p_item_id, nullif(p_qtype, ''), left(coalesce(p_message, ''), 500))
  returning id into new_id;
  return new_id;
end;
$$;

-- 관리자 현황 숫자 (성공 기준 S2 · S3 · S4 · S5 포함)
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception '관리자만 볼 수 있어요' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'minors', (select count(*) from public.profiles where is_minor),
    'active_7d', (select count(distinct user_id) from public.attempts where created_at > now() - interval '7 days'),
    'by_course', (select coalesce(jsonb_object_agg(c, n), '{}'::jsonb)
                    from (select coalesce(current_course, '-') c, count(*) n from public.profiles group by 1) s),
    'placement', (select coalesce(jsonb_agg(jsonb_build_object('course', course_code, 'level', result_level, 'n', n)
                                            order by course_code, result_level), '[]'::jsonb)
                    from (select course_code, result_level, count(*) n from public.placement_tests
                           where not skipped group by 1, 2) s),
    'fit', (select coalesce(jsonb_object_agg(fit, n), '{}'::jsonb)
              from (select fit, count(*) n from public.placement_tests where fit is not null group by 1) s),
    'lesson_pass_rate', (select round(100.0 * count(*) filter (where passed_at is not null) / nullif(count(*), 0))
                           from public.lesson_progress),
    'exam_pass_rate', (select round(100.0 * count(*) filter (where passed) / nullif(count(*), 0))
                         from public.level_exams),
    'relearn_rate', (select round(100.0 * count(*) filter (where a.result = 'correct')
                                  / nullif(count(*) filter (where a.result <> 'skipped'), 0))
                       from public.attempts a
                       join public.item_memory m on m.user_id = a.user_id and m.item_id = a.item_id and m.ever_wrong
                      where a.context = 'review'),
    'top_wrong_items', (select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'word', word, 'wrong', n)
                                                  order by n desc, item_id), '[]'::jsonb)
                          from (select a.item_id, i.word, count(*) n
                                  from public.attempts a join public.items i on i.id = a.item_id
                                 where a.result = 'wrong' group by 1, 2 order by 3 desc, 1 limit 10) s),
    'top_wrong_qtypes', (select coalesce(jsonb_agg(jsonb_build_object('qtype', qtype, 'wrong_rate', rate, 'n', n)
                                                   order by rate desc), '[]'::jsonb)
                           from (select qtype, count(*) n,
                                        round(100.0 * count(*) filter (where result = 'wrong')
                                              / nullif(count(*) filter (where result <> 'skipped'), 0)) rate
                                   from public.attempts group by qtype) s),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'stale_audio', (select count(*) from public.items where audio_stale)
  );
end;
$$;

------------------------------------------------------------------------
-- 3. 실행 권한
------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;       -- 권한 규칙에서 사용
grant execute on function private.today() to authenticated;          -- get_review_queue 에서 사용

revoke execute on function
  public.submit_placement(text, jsonb),
  public.choose_start_level(text, int, boolean),
  public.submit_lesson(text, jsonb),
  public.get_review_queue(text, int),
  public.submit_review(jsonb),
  public.submit_level_exam(text, jsonb),
  public.submit_fit(text),
  public.report_item(text, text, text),
  public.admin_stats()
  from public, anon;
grant execute on function
  public.submit_placement(text, jsonb),
  public.choose_start_level(text, int, boolean),
  public.submit_lesson(text, jsonb),
  public.get_review_queue(text, int),
  public.submit_review(jsonb),
  public.submit_level_exam(text, jsonb),
  public.submit_fit(text),
  public.report_item(text, text, text),
  public.admin_stats()
  to authenticated;
