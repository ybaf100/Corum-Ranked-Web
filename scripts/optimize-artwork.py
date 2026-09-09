"""Regenerate display-sized WebP assets; never overwrite archived originals.

Run manually with Python + Pillow. Generated files are committed, so the site
build and GitHub Pages workflow need no image-processing dependency.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "artwork-originals"
OUTPUT = ROOT / "public" / "artwork"
TIERS = ("unranked", "red", "aqua", "bronze", "silver", "gold")


def encode(stem, widths):
    with Image.open(SOURCE / f"{stem}.webp") as original:
        for width in widths:
            height = round(original.height * width / original.width)
            display = original.resize((width, height), Image.Resampling.LANCZOS)
            # Preserve existing URLs as the largest display variant for cached clients.
            suffix = "" if width == widths[-1] else f"-{width}"
            target = OUTPUT / f"{stem}{suffix}.webp"
            display.save(target, "WEBP", quality=86, method=6, exact=True)
            print(f"{target.relative_to(ROOT)}: {width}×{height}, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for tier in TIERS:
        encode(f"corum-trophy-{tier}", (96, 192, 384, 768))
    encode("rank-transition-background", (720, 1280, 1920))
