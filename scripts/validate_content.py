"""콘텐츠 CSV 검사 스크립트.

검사 항목
- 파일마다 90행 = 3레벨 x 3레슨 x 10단어
- id 형식(코스-레벨-레슨-번호)과 level/lesson 칸이 맞는지
- 같은 코스 안에서 단어 중복 없음
- 예문에 단어가 그 모양 그대로 들어 있는지 (빈칸 채우기용)
- 필수 칸이 비어 있지 않은지
- 예문 길이(단어 수)가 코스 기준 안에 드는지 (경고만)

--bom 옵션을 주면 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM으로 다시 저장한다.

사용: python scripts/validate_content.py [--bom]
"""
import csv
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content"
FILES = {
    "E": ("words_elementary.csv", (3, 6)),
    "M": ("words_middle_high.csv", (4, 12)),
    "A": ("words_adult.csv", (3, 12)),
}
REQUIRED = ["id", "course", "level", "level_name", "lesson", "topic", "word",
            "pos", "meaning_ko", "example_en", "example_ko"]
ID_RE = re.compile(r"^([EMA])-(\d)-(\d)-(\d{2})$")


def word_count(sentence: str) -> int:
    return len(re.findall(r"[A-Za-z0-9'.-]+", sentence))


def contains_word(sentence: str, word: str) -> bool:
    pattern = r"(?<![A-Za-z])" + re.escape(word) + r"(?![A-Za-z])"
    return re.search(pattern, sentence, flags=re.IGNORECASE) is not None


def check(code: str, filename: str, length_range, rewrite_bom: bool):
    path = ROOT / filename
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    errors, warnings = [], []
    if len(rows) != 90:
        errors.append(f"행 수 {len(rows)} (90이어야 함)")

    per_lesson = Counter()
    words = Counter()
    ids = Counter()
    for r in rows:
        rid = r["id"]
        ids[rid] += 1
        for col in REQUIRED:
            if not (r.get(col) or "").strip():
                errors.append(f"{rid}: '{col}' 칸이 비어 있음")
        m = ID_RE.match(rid)
        if not m or m.group(1) != code:
            errors.append(f"{rid}: id 형식 오류")
        elif m.group(2) != r["level"] or m.group(3) != r["lesson"]:
            errors.append(f"{rid}: id와 level/lesson 칸이 다름")
        per_lesson[(r["level"], r["lesson"])] += 1
        words[r["word"].lower()] += 1
        if not contains_word(r["example_en"], r["word"]):
            errors.append(f"{rid}: 예문에 '{r['word']}'가 그대로 없음 → {r['example_en']}")
        n = word_count(r["example_en"])
        lo, hi = length_range
        if not lo <= n <= hi:
            warnings.append(f"{rid}: 예문 {n}단어 (기준 {lo}~{hi}) → {r['example_en']}")

    for key, n in sorted(per_lesson.items()):
        if n != 10:
            errors.append(f"레벨 {key[0]} 레슨 {key[1]}: {n}개 (10이어야 함)")
    for w, n in words.items():
        if n > 1:
            errors.append(f"단어 중복: {w} ({n}번)")
    for i, n in ids.items():
        if n > 1:
            errors.append(f"id 중복: {i}")

    print(f"[{filename}] {len(rows)}행, 오류 {len(errors)}, 경고 {len(warnings)}")
    for e in errors:
        print("  오류:", e)
    for w in warnings:
        print("  경고:", w)

    if rewrite_bom and not errors:
        with path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            writer.writerows(rows)
    return len(errors)


def main():
    rewrite_bom = "--bom" in sys.argv
    total = sum(check(code, fn, rng, rewrite_bom) for code, (fn, rng) in FILES.items())
    print("통과" if total == 0 else f"오류 합계 {total}")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
