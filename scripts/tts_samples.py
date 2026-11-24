"""Kokoro 목소리 비교 샘플 만들기.

목소리 후보마다 단어 1개 + 코스별 예문 3개를 읽혀 mp3로 저장하고,
한 화면에서 들어 볼 수 있는 voice_samples/index.html 을 만든다.

사용: .venv-tts\\Scripts\\python.exe scripts/tts_samples.py
"""
import html
import os
import subprocess
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig

# espeak-ng 는 한글이 들어간 경로(C:\AX실습\...)를 읽지 못해서,
# dll 과 데이터를 영문 경로(%LOCALAPPDATA%\ax-english-poc\espeak)에 복사해 두고 쓴다.
ESPEAK_DIR = Path(os.environ["LOCALAPPDATA"]) / "ax-english-poc" / "espeak"

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "tts_models" / "kokoro-v1.0.onnx"
VOICES_BIN = ROOT / "tts_models" / "voices-v1.0.bin"
OUT = ROOT / "content" / "voice_samples"
SPEED = 0.9

VOICES = [
    ("af_heart", "en-us", "미국 · 여성 A"),
    ("af_bella", "en-us", "미국 · 여성 B"),
    ("af_nicole", "en-us", "미국 · 여성 C (부드러움)"),
    ("am_michael", "en-us", "미국 · 남성"),
    ("bf_emma", "en-gb", "영국 · 여성"),
    ("bm_george", "en-gb", "영국 · 남성"),
]
TEXTS = [
    ("word", "단어", "rabbit"),
    ("elem", "초등 예문", "The rabbit has long ears."),
    ("mid", "중고생 예문", "We reached a conclusion after a long discussion."),
    ("adult", "성인 예문", "Could I get the bill, please?"),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(
        str(MODEL),
        str(VOICES_BIN),
        espeak_config=EspeakConfig(
            lib_path=str(ESPEAK_DIR / "espeak-ng.dll"),
            data_path=str(ESPEAK_DIR / "espeak-ng-data"),
        ),
    )
    rows = []
    for voice, lang, label in VOICES:
        cells = []
        for key, _, text in TEXTS:
            wav = OUT / f"{voice}_{key}.wav"
            mp3 = OUT / f"{voice}_{key}.mp3"
            samples, rate = kokoro.create(text, voice=voice, speed=SPEED, lang=lang)
            sf.write(wav, samples, rate)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                 "-ac", "1", "-b:a", "64k", str(mp3)],
                check=True,
            )
            wav.unlink()
            cells.append(f'<td><audio controls preload="none" src="{mp3.name}"></audio></td>')
        rows.append(
            f"<tr><th>{html.escape(label)}<br><code>{voice}</code></th>{''.join(cells)}</tr>"
        )
        print("done", voice)

    head = "".join(f"<th>{html.escape(t[1])}<br><small>{html.escape(t[2])}</small></th>" for t in TEXTS)
    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>목소리 샘플 비교</title>
<style>
body{{font-family:system-ui,'Malgun Gothic',sans-serif;margin:16px;background:#fafafa;color:#222}}
table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:middle;background:#fff}}
thead th{{background:#f0f0f0}}
audio{{width:180px}}
small{{color:#666;font-weight:normal}}
</style></head><body>
<h1>목소리 샘플 비교 (Kokoro, 속도 {SPEED})</h1>
<p>각 칸의 ▶ 를 눌러 들어 보세요. 마음에 드는 목소리 이름(code)을 알려 주시면 그 목소리로 540개를 만듭니다.</p>
<table><thead><tr><th>목소리</th>{head}</tr></thead><tbody>
{''.join(rows)}
</tbody></table></body></html>"""
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print("page", OUT / "index.html")


if __name__ == "__main__":
    main()
