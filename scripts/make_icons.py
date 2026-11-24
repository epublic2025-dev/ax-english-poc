"""PWA 아이콘 만들기 — app/public/favicon.svg 와 같은 새싹 그림을 PNG 로.

만드는 파일: app/public/pwa-192.png · pwa-512.png · apple-touch-icon.png(180)
사용: python scripts/make_icons.py   (Pillow 필요)
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "public"
S = 4  # 크게 그린 뒤 줄여서 가장자리를 매끈하게


def bezier(p0, p1, p2, p3, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def draw(size: int, pad: float) -> Image.Image:
    big = size * S
    img = Image.new("RGBA", (big, big), "#2F6B47")
    d = ImageDraw.Draw(img)
    k = big * (1 - 2 * pad) / 64        # 64칸 설계 → 실제 크기
    o = big * pad

    def p(x, y):
        return (o + x * k, o + y * k)

    d.line([p(32, 50), p(32, 30)], fill="#E1EDE2", width=int(4 * k))
    left = bezier(p(32, 32), p(24, 16), p(10, 18), p(9, 27)) + bezier(p(9, 27), p(19, 27), p(26, 28), p(32, 34))
    right = bezier(p(32, 30), p(40, 12), p(55, 14), p(56, 24)) + bezier(p(56, 24), p(45, 24), p(38, 26), p(32, 32))
    d.polygon(left, fill="#A6D98A")
    d.polygon(right, fill="#6FBF5B")
    return img.resize((size, size), Image.LANCZOS)


def main():
    # 마스크 아이콘(안드로이드가 둥글게 자름)을 생각해 그림을 가운데로 조금 모은다
    draw(192, 0.12).save(OUT / "pwa-192.png")
    draw(512, 0.12).save(OUT / "pwa-512.png")
    draw(180, 0.10).convert("RGB").save(OUT / "apple-touch-icon.png")
    print("아이콘 3개 저장:", OUT)


if __name__ == "__main__":
    main()
