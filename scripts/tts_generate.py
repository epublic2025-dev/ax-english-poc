"""단어·예문 영어 음성 만들기 (Kokoro, 이 PC에서 실행).

content/words_*.csv 의 각 행마다 두 파일을 만든다.
  content/audio/{id}_w.mp3  — 단어
  content/audio/{id}_s.mp3  — 예문

사용
  .venv-tts\\Scripts\\python.exe scripts/tts_generate.py              # 없는 파일만 만들기
  .venv-tts\\Scripts\\python.exe scripts/tts_generate.py --all        # 모두 다시 만들기
  .venv-tts\\Scripts\\python.exe scripts/tts_generate.py --ids E-1-1-01 A-2-3-05   # 고른 id만 다시

나중에 상용 음성 서비스 키가 나오면 같은 파일 이름으로 갈아 끼우면 된다.
"""
import argparse
import csv
import os
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
AUDIO = CONTENT / "audio"
MODEL = ROOT / "tts_models" / "kokoro-v1.0.onnx"
VOICES_BIN = ROOT / "tts_models" / "voices-v1.0.bin"
# espeak-ng 는 한글 경로를 읽지 못해 영문 경로에 복사해 둔 것을 쓴다 (tts_samples.py 참고)
ESPEAK_DIR = Path(os.environ["LOCALAPPDATA"]) / "ax-english-poc" / "espeak"

VOICE = "af_heart"
LANG = "en-us"
SPEED = 0.9
CSV_FILES = ["words_elementary.csv", "words_middle_high.csv", "words_adult.csv"]


def load_rows():
    rows = []
    for name in CSV_FILES:
        with (CONTENT / name).open(encoding="utf-8-sig", newline="") as f:
            rows.extend(csv.DictReader(f))
    return rows


def synth(kokoro, text, out_mp3, tmpdir):
    samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang=LANG)
    wav = Path(tmpdir) / "tmp.wav"
    sf.write(wav, samples, rate)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-b:a", "64k", str(out_mp3)],
        check=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="이미 있는 파일도 다시 만들기")
    ap.add_argument("--ids", nargs="*", help="이 id들만 다시 만들기")
    args = ap.parse_args()

    AUDIO.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(
        str(MODEL),
        str(VOICES_BIN),
        espeak_config=EspeakConfig(
            lib_path=str(ESPEAK_DIR / "espeak-ng.dll"),
            data_path=str(ESPEAK_DIR / "espeak-ng-data"),
        ),
    )

    rows = load_rows()
    if args.ids:
        wanted = set(args.ids)
        rows = [r for r in rows if r["id"] in wanted]

    made = skipped = 0
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, r in enumerate(rows, 1):
            for suffix, text in (("w", r["word"]), ("s", r["example_en"])):
                out = AUDIO / f"{r['id']}_{suffix}.mp3"
                if out.exists() and not (args.all or args.ids):
                    skipped += 1
                    continue
                synth(kokoro, text, out, tmpdir)
                made += 1
            if i % 30 == 0:
                print(f"{i}/{len(rows)} 행 처리", flush=True)
    print(f"완료: 새로 만듦 {made}, 건너뜀 {skipped}, 목소리 {VOICE}, 속도 {SPEED}")


if __name__ == "__main__":
    main()
