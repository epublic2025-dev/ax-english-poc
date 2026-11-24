-- 코스 · 레벨 · 레슨 · 배지 (build_seed.py 로 만듦)

insert into public.courses (code, name, sort) values
  ('E', '초등', 1),
  ('M', '중고생', 2),
  ('A', '성인', 3)
on conflict (code) do update set name = excluded.name, sort = excluded.sort;

insert into public.levels (id, course_code, level_no, name) values
  ('A-1', 'A', 1, '생활 기초 (A1)'),
  ('A-2', 'A', 2, '여행 (A2)'),
  ('A-3', 'A', 3, '일상 회화 (B1)'),
  ('E-1', 'E', 1, '나와 우리 집'),
  ('E-2', 'E', 2, '나의 하루'),
  ('E-3', 'E', 3, '바깥 세상'),
  ('M-1', 'M', 1, '중1 기초'),
  ('M-2', 'M', 2, '중2~3'),
  ('M-3', 'M', 3, '고등 필수')
on conflict (id) do update set name = excluded.name;

insert into public.lessons (id, level_id, lesson_no, topic) values
  ('A-1-1', 'A-1', 1, '인사·자기소개'),
  ('A-1-2', 'A-1', 2, '쇼핑'),
  ('A-1-3', 'A-1', 3, '식당'),
  ('A-2-1', 'A-2', 1, '공항·교통'),
  ('A-2-2', 'A-2', 2, '호텔'),
  ('A-2-3', 'A-2', 3, '길 찾기·관광'),
  ('A-3-1', 'A-3', 1, '약속·일정'),
  ('A-3-2', 'A-3', 2, '감정·의견'),
  ('A-3-3', 'A-3', 3, '문제 해결·요청'),
  ('E-1-1', 'E-1', 1, '가족·사람'),
  ('E-1-2', 'E-1', 2, '동물'),
  ('E-1-3', 'E-1', 3, '학교 물건'),
  ('E-2-1', 'E-2', 1, '음식'),
  ('E-2-2', 'E-2', 2, '움직임'),
  ('E-2-3', 'E-2', 3, '느낌·모양'),
  ('E-3-1', 'E-3', 1, '날씨·계절'),
  ('E-3-2', 'E-3', 2, '장소'),
  ('E-3-3', 'E-3', 3, '시간·요일'),
  ('M-1-1', 'M-1', 1, '학교생활'),
  ('M-1-2', 'M-1', 2, '일상 동사'),
  ('M-1-3', 'M-1', 3, '성격·감정'),
  ('M-2-1', 'M-2', 1, '건강·습관'),
  ('M-2-2', 'M-2', 2, '환경·자연'),
  ('M-2-3', 'M-2', 3, '기술·미디어'),
  ('M-3-1', 'M-3', 1, '사회·관계'),
  ('M-3-2', 'M-3', 2, '생각·탐구'),
  ('M-3-3', 'M-3', 3, '진로·미래')
on conflict (id) do update set topic = excluded.topic;

insert into public.badges (code, name, description, sort) values
  ('first_lesson', '첫 레슨 통과', '첫 레슨을 통과했어요', 1),
  ('streak_7', '7일 연속', '7일 연속으로 공부했어요', 2),
  ('level_pass', '레벨 통과', '레벨 시험을 처음 통과했어요', 3),
  ('tree_10', '나무 10그루', '단어 10개가 나무로 자랐어요', 4),
  ('wrong_30', '오답 30개 정복', '틀렸던 단어 30개를 꽃으로 피웠어요', 5),
  ('perfect_10', '만점 10번', '레슨을 10번 만점으로 마쳤어요', 6),
  ('speak_50', '말하기 50번', '소리 내어 50번 맞혔어요', 7),
  ('review_100', '복습 100문제', '복습 문제를 100개 맞혔어요', 8),
  ('streak_30', '30일 연속', '30일 연속으로 공부했어요', 9),
  ('course_done', '코스 완료', '코스의 모든 레벨을 통과했어요', 10)
on conflict (code) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;
