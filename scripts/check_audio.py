"""음성 파일 점검 + 듣기 검수 페이지 만들기.

- 모든 id 마다 {id}_w.mp3 / {id}_s.mp3 가 있는지
- 길이가 너무 짧거나(소리 없음 의심) 글자 수에 비해 너무 긴지
- content/review.html : 코스별로 단어·예문·번역·음성을 한 줄씩 들어 볼 수 있는 페이지

사용: python scripts/check_audio.py   (ffprobe 필요)
"""
import csv
import html
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
AUDIO = CONTENT / "audio"
CSV_FILES = [("초등", "words_elementary.csv"), ("중고생", "words_middle_high.csv"), ("성인", "words_adult.csv")]


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def main():
    problems = []
    sections = []
    total = 0
    for course, name in CSV_FILES:
        with (CONTENT / name).open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        trs = []
        for r in rows:
            cells = {}
            for suffix, text in (("w", r["word"]), ("s", r["example_en"])):
                p = AUDIO / f"{r['id']}_{suffix}.mp3"
                if not p.exists():
                    problems.append(f"{p.name}: 파일 없음")
                    cells[suffix] = "없음"
                    continue
                total += 1
                d = duration(p)
                # 대략 글자당 0.03~0.15초, 최소 0.3초
                lo, hi = max(0.3, len(text) * 0.03), max(2.0, len(text) * 0.15)
                if not lo <= d <= hi:
                    problems.append(f"{p.name}: {d:.2f}초 (예상 {lo:.1f}~{hi:.1f}) — {text}")
                cells[suffix] = f'<audio controls preload="none" src="audio/{p.name}"></audio>'
            trs.append(
                "<tr>"
                f"<td><code>{r['id']}</code></td>"
                f"<td><b>{html.escape(r['word'])}</b><br><small>{html.escape(r['pos'])} {html.escape(r['meaning_ko'])}</small></td>"
                f"<td>{cells['w']}</td>"
                f"<td>{html.escape(r['example_en'])}<br><small>{html.escape(r['example_ko'])}</small></td>"
                f"<td>{cells['s']}</td>"
                "</tr>"
            )
        sections.append(
            f"<h2>{course}</h2><table><thead><tr><th>id</th><th>단어</th><th>단어 음성</th>"
            f"<th>예문</th><th>예문 음성</th></tr></thead><tbody>{''.join(trs)}</tbody></table>"
        )

    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>콘텐츠 듣기 검수</title>
<style>
body{{font-family:system-ui,'Malgun Gothic',sans-serif;margin:16px;background:#fafafa;color:#222}}
table{{border-collapse:collapse;width:100%;margin-bottom:32px}}
th,td{{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:middle;background:#fff}}
thead th{{background:#f0f0f0;position:sticky;top:0}}
audio{{width:150px;height:32px}}
small{{color:#666}}
</style></head><body>
<h1>콘텐츠 듣기 검수 (af_heart, 속도 0.9)</h1>
<p>음성 파일 {total}개. 발음이 이상한 줄은 id를 알려 주세요.</p>
{''.join(sections)}
</body></html>"""
    (CONTENT / "review.html").write_text(page, encoding="utf-8")

    print(f"음성 파일 {total}개 확인, 문제 {len(problems)}건")
    for p in problems:
        print("  ", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
