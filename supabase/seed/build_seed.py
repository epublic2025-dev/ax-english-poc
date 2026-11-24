"""content/words_*.csv → supabase/seed/*.sql (콘텐츠 올리기용 SQL 만들기)

만드는 파일
  00_base.sql   코스 3 · 레벨 9 · 레슨 27 · 배지 10
  E_items.sql   초등 단어 90
  M_items.sql   중고생 단어 90
  A_items.sql   성인 단어 90

여러 번 돌려도 안전하다 (on conflict … do update). 단, 관리자 화면에서 고친 뒤에는
DB가 원본이므로 이 SQL을 다시 올리면 고친 내용을 CSV 값으로 되돌린다 — 처음 한 번만 쓴다.

사용: python supabase/seed/build_seed.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"
OUT = Path(__file__).resolve().parent
FILES = [("E", "초등", 1, "words_elementary.csv"), ("M", "중고생", 2, "words_middle_high.csv"), ("A", "성인", 3, "words_adult.csv")]

BADGES = [
    ("first_lesson", "첫 레슨 통과", "첫 레슨을 통과했어요", 1),
    ("streak_7", "7일 연속", "7일 연속으로 공부했어요", 2),
    ("level_pass", "레벨 통과", "레벨 시험을 처음 통과했어요", 3),
    ("tree_10", "나무 10그루", "단어 10개가 나무로 자랐어요", 4),
    ("wrong_30", "오답 30개 정복", "틀렸던 단어 30개를 꽃으로 피웠어요", 5),
    ("perfect_10", "만점 10번", "레슨을 10번 만점으로 마쳤어요", 6),
    ("speak_50", "말하기 50번", "소리 내어 50번 맞혔어요", 7),
    ("review_100", "복습 100문제", "복습 문제를 100개 맞혔어요", 8),
    ("streak_30", "30일 연속", "30일 연속으로 공부했어요", 9),
    ("course_done", "코스 완료", "코스의 모든 레벨을 통과했어요", 10),
]


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main():
    base = ["-- 코스 · 레벨 · 레슨 · 배지 (build_seed.py 로 만듦)"]
    courses, levels, lessons = [], {}, {}
    item_sql = {}
    for code, name, sort, fn in FILES:
        courses.append(f"({q(code)}, {q(name)}, {sort})")
        with (CONTENT / fn).open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        for r in rows:
            lv_id = f"{code}-{r['level']}"
            ls_id = f"{lv_id}-{r['lesson']}"
            levels[lv_id] = (code, int(r["level"]), r["level_name"])
            lessons[ls_id] = (lv_id, int(r["lesson"]), r["topic"])
        data = [
            {"i": r["id"], "w": r["word"], "p": r["pos"], "m": r["meaning_ko"],
             "e": r["example_en"], "k": r["example_ko"], "j": r.get("emoji") or None}
            for r in rows
        ]
        payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        assert "$j$" not in payload
        item_sql[code] = f"""-- {name} 단어 {len(rows)}개 (build_seed.py 로 만듦)
insert into public.items (id, lesson_id, word, pos, meaning_ko, example_en, example_ko, emoji, audio_word, audio_sentence)
select r.i, left(r.i, length(r.i) - 3), r.w, r.p, r.m, r.e, r.k, r.j, r.i || '_w.mp3', r.i || '_s.mp3'
from jsonb_to_recordset($j${payload}$j$::jsonb) as r(i text, w text, p text, m text, e text, k text, j text)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, word = excluded.word, pos = excluded.pos, meaning_ko = excluded.meaning_ko,
  example_en = excluded.example_en, example_ko = excluded.example_ko, emoji = excluded.emoji,
  audio_word = excluded.audio_word, audio_sentence = excluded.audio_sentence, audio_stale = false;
"""

    base.append("insert into public.courses (code, name, sort) values\n  " + ",\n  ".join(courses)
                + "\non conflict (code) do update set name = excluded.name, sort = excluded.sort;")
    base.append("insert into public.levels (id, course_code, level_no, name) values\n  "
                + ",\n  ".join(f"({q(k)}, {q(c)}, {n}, {q(nm)})" for k, (c, n, nm) in sorted(levels.items()))
                + "\non conflict (id) do update set name = excluded.name;")
    base.append("insert into public.lessons (id, level_id, lesson_no, topic) values\n  "
                + ",\n  ".join(f"({q(k)}, {q(lv)}, {n}, {q(t)})" for k, (lv, n, t) in sorted(lessons.items()))
                + "\non conflict (id) do update set topic = excluded.topic;")
    base.append("insert into public.badges (code, name, description, sort) values\n  "
                + ",\n  ".join(f"({q(c)}, {q(n)}, {q(d)}, {s})" for c, n, d, s in BADGES)
                + "\non conflict (code) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;")

    (OUT / "00_base.sql").write_text("\n\n".join(base) + "\n", encoding="utf-8")
    for code, sql in item_sql.items():
        (OUT / f"{code}_items.sql").write_text(sql, encoding="utf-8")
    print(f"코스 {len(courses)} · 레벨 {len(levels)} · 레슨 {len(lessons)} · 배지 {len(BADGES)} · 단어 파일 {len(item_sql)}개")


if __name__ == "__main__":
    main()
