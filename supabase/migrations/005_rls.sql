-- 005_rls: 권한 — 누가 무엇을 읽고 쓸 수 있나
-- 설계: 2_설계.md 3-6, ERD: 2-1_ERD.md 2절
-- 원칙
--   · 로그인하지 않은 사람(anon)은 표를 하나도 못 본다
--   · 콘텐츠는 로그인한 사람 누구나 읽고, 관리자만 고친다 (숨긴 단어는 관리자만 봄)
--   · 학습 기록 · 리워드는 본인 것만 읽고, 쓰기는 006 DB 함수만 한다
--   · 프로필은 본인이 닉네임 · 코스 · 하루 목표만 고친다 (is_admin 은 못 바꿈)

-- 0. 로그인하지 않은 사람은 표 접근 없음
revoke all on all tables in schema public from anon;

-- 1. 콘텐츠
create policy "로그인하면 코스 읽기" on public.courses for select to authenticated using (true);
create policy "로그인하면 레벨 읽기" on public.levels for select to authenticated using (true);
create policy "로그인하면 레슨 읽기" on public.lessons for select to authenticated using (true);

create policy "단어 읽기 (숨김은 관리자만)" on public.items for select to authenticated
  using (not hidden or (select public.is_admin()));
create policy "관리자만 단어 추가" on public.items for insert to authenticated
  with check ((select public.is_admin()));
create policy "관리자만 단어 수정" on public.items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- 삭제 정책 없음: 단어는 지우지 않고 hidden 으로 숨긴다
revoke delete on public.items from authenticated;
revoke insert, update, delete on public.courses, public.levels, public.lessons from authenticated;

-- 2. 프로필: 본인 · 관리자 읽기, 본인은 세 칸만 고침
create policy "프로필 읽기 (본인 · 관리자)" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 프로필 고치기" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (nickname, current_course, daily_goal) on public.profiles to authenticated;

-- 3. 본인 기록 읽기 전용 (쓰기는 DB 함수만)
create policy "본인 · 관리자 읽기" on public.course_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.placement_tests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.level_exams for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.item_memory for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.streaks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "본인 · 관리자 읽기" on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on
  public.course_progress, public.placement_tests, public.lesson_progress, public.level_exams,
  public.item_memory, public.attempts, public.xp_events, public.streaks, public.user_badges
  from authenticated;

-- 4. 배지 목록은 누구나(로그인) 읽기
create policy "로그인하면 배지 목록 읽기" on public.badges for select to authenticated using (true);
revoke insert, update, delete on public.badges from authenticated;

-- 5. 오류 신고: 본인 · 관리자 읽기, 만들기는 report_item 함수, 처리는 관리자
create policy "신고 읽기 (본인 · 관리자)" on public.reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "관리자만 신고 처리" on public.reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.reports from authenticated;
revoke update on public.reports from authenticated;
grant update (status, resolved_at, resolved_by) on public.reports to authenticated;

-- 6. 함수 실행 권한: 트리거 함수는 API로 부를 수 없게
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.mark_audio_stale() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
