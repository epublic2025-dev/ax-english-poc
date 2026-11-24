"""content/audio/*.mp3 → Supabase Storage `audio` 버킷 업로드

비밀 키는 이 폴더의 .env.local 에서 읽는다 (git 에 올라가지 않음, 화면에 출력하지 않음).
  .env.local 내용:  SUPABASE_SECRET_KEY=sb_secret_...

사용
  python scripts/upload_audio.py                 # 모든 파일 올리기 (같은 이름은 덮어씀)
  python scripts/upload_audio.py E-1-1-01 A-2-3-05   # 고른 id 의 _w · _s 만 올리기
"""
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "content" / "audio"
PROJECT_URL = "https://xmioairzejhpohirqgkl.supabase.co"
BUCKET = "audio"


def load_key() -> str:
    env = ROOT / ".env.local"
    if not env.exists():
        sys.exit(".env.local 파일이 없어요. SUPABASE_SECRET_KEY=... 한 줄을 넣어 만들어 주세요.")
    for line in env.read_text(encoding="utf-8-sig").splitlines():
        name, _, value = line.partition("=")
        if name.strip() == "SUPABASE_SECRET_KEY" and value.strip():
            return value.strip().strip('"').strip("'")
    sys.exit(".env.local 에 SUPABASE_SECRET_KEY 줄이 없어요.")


def headers(key: str) -> dict:
    h = {"apikey": key}
    if key.startswith("eyJ"):            # 예전 방식(service_role JWT) 키
        h["Authorization"] = f"Bearer {key}"
    return h


def upload(path: Path, key: str):
    req = urllib.request.Request(
        f"{PROJECT_URL}/storage/v1/object/{BUCKET}/{path.name}",
        data=path.read_bytes(),
        method="POST",
        headers={**headers(key), "Content-Type": "audio/mpeg", "x-upsert": "true",
                 "cache-control": "max-age=31536000"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return path.name, r.status, ""
    except urllib.error.HTTPError as e:
        return path.name, e.code, e.read().decode("utf-8", "replace")[:200]
    except Exception as e:  # 네트워크 오류 등
        return path.name, 0, str(e)[:200]


def main():
    key = load_key()
    ids = sys.argv[1:]
    files = sorted(AUDIO.glob("*.mp3"))
    if ids:
        files = [f for f in files if f.name.rsplit("_", 1)[0] in ids]
    if not files:
        sys.exit("올릴 파일이 없어요.")
    print(f"{len(files)}개 올리는 중…", flush=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda f: upload(f, key), files))
    bad = [r for r in results if r[1] not in (200, 201)]
    print(f"성공 {len(results) - len(bad)} · 실패 {len(bad)}")
    for name, code, msg in bad[:10]:
        print(f"  실패 {name}: {code} {msg}")
    # 공개 주소로 하나 열어 보기
    if not bad:
        url = f"{PROJECT_URL}/storage/v1/object/public/{BUCKET}/{files[0].name}"
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30) as r:
            print(f"공개 주소 확인: {files[0].name} → {r.status} {r.headers.get('Content-Type')}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
