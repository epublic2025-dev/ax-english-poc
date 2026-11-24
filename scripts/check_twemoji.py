"""초등 CSV 의 emoji 68개가 Twemoji 그림으로 모두 있는지 확인 (앱과 같은 파일 이름 규칙)."""
import csv
import sys
import urllib.request
from pathlib import Path

BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/"
CSV = Path(__file__).resolve().parent.parent / "content" / "words_elementary.csv"


def twemoji_name(ch: str) -> str:
    # Twemoji 규칙: 이어 붙인 그림(ZWJ)이 아니면 FE0F(그림 표시 문자)는 뺀다
    if "‍" not in ch:
        ch = ch.replace("️", "")
    return "-".join(f"{ord(c):x}" for c in ch)


bad = []
with CSV.open(encoding="utf-8-sig", newline="") as f:
    rows = [r for r in csv.DictReader(f) if r.get("emoji")]
for r in rows:
    url = BASE + twemoji_name(r["emoji"]) + ".svg"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20) as resp:
            if resp.status != 200:
                bad.append((r["id"], r["emoji"], resp.status))
    except Exception as e:  # noqa: BLE001
        bad.append((r["id"], r["emoji"], str(e)[:60]))
print(f"그림 {len(rows)}개 확인, 없음 {len(bad)}개")
for b in bad:
    print("  ", b)
sys.exit(1 if bad else 0)
