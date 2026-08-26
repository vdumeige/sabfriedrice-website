#!/usr/bin/env python3
"""
Generate the web-sized image derivatives the site actually serves.

The originals in src/img/ are straight off a camera - 3000x4000, 12 MP, 1-3 MB each,
and up to 52 MP / 30 MB for the backgrounds. Shipping those was costing ~42 MB on the
homepage. This writes small WebP derivatives into src/optimized/, which is the only
image directory webpack copies into the build.

Run it after adding or replacing anything in src/img/:

    python tools/optimize-images.py

Then rebuild (npm run build) and commit both src/img/ and src/optimized/.

Requires Pillow:  pip install Pillow
"""

import base64
import io
import json
import os
import re
import shutil
import sys

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None  # the source backgrounds are legitimately huge

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "img")
OUT = os.path.join(ROOT, "src", "optimized")
MENU = os.path.join(ROOT, "src", "data", "menu.json")

# Dishes carrying this filename have no real photo. We render those menu rows as
# text only rather than repeating one grey placeholder 52 times, so it needs no
# derivatives.
PLACEHOLDER = "default.jpg"

# variant -> (subdir, [widths], quality, aspect or None to preserve)
VARIANTS = {
    "hero": ("hero", [1280, 1920], 72, (3, 2)),
    "card": ("card", [640, 960], 76, (4, 3)),
    "thumb": ("thumb", [200, 400], 78, (1, 1)),
}

HEROES = [
    "wood-png.png",
    "thaitea.jpg",
    "menu-background.jpg",
    "about-us-background.jpg",
    "contact-background.jpg",
]

CARDS = [
    # homepage featured dishes
    "green-curry.jpg", "sab-sampler.jpg", "chicken-larb.jpg",
    "tom-yum.jpg", "nam-khao.jpg", "yum-kai.jpg",
    # gallery
    "pad-ke-mow.jpg", "chicken-wings.jpg", "cream-cheese-wonton.jpg",
    "fresh-roll.jpg", "fried-rice.jpg", "main2.jpg",
    # about / story
    "main1.jpg", "about-us-sub.jpg", "inside-restaurant.jpg",
]


def stem(filename):
    """sab-sampler.jpg -> sab-sampler ; orange.chicken.jpg -> orange-chicken"""
    base = os.path.splitext(filename)[0]
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def derive(filename, variant, report):
    subdir, widths, quality, aspect = VARIANTS[variant]
    source = os.path.join(SRC, filename)
    if not os.path.exists(source):
        report["missing"].append(filename)
        return

    target_dir = os.path.join(OUT, subdir)
    os.makedirs(target_dir, exist_ok=True)

    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        report["src_bytes"] += os.path.getsize(source)

        for width in widths:
            if aspect:
                height = round(width * aspect[1] / aspect[0])
                out = ImageOps.fit(im, (width, height), Image.LANCZOS, centering=(0.5, 0.5))
            else:
                height = round(im.height * width / im.width)
                out = im.resize((width, height), Image.LANCZOS)

            path = os.path.join(target_dir, f"{stem(filename)}-{width}.webp")
            out.save(path, "WEBP", quality=quality, method=6)
            report["out_bytes"] += os.path.getsize(path)
            report["written"] += 1


def extract_logo(report):
    """
    src/img/logo-final-svg.svg is 305 KB of base64-encoded PNG wrapped in an <svg>.
    Pull the raster out, trim the transparent margin, and emit sane widths.
    """
    svg_path = os.path.join(SRC, "logo-final-svg.svg")
    if not os.path.exists(svg_path):
        report["missing"].append("logo-final-svg.svg")
        return

    svg = io.open(svg_path, encoding="utf-8").read()
    report["src_bytes"] += os.path.getsize(svg_path)
    match = re.search(r'base64,\s*([A-Za-z0-9+/=\s]+?)\s*["\']', svg)
    if not match:
        print("  ! could not find embedded raster in logo-final-svg.svg")
        return

    raw = base64.b64decode(re.sub(r"\s+", "", match.group(1)))
    target_dir = os.path.join(OUT, "logo")
    os.makedirs(target_dir, exist_ok=True)

    # Both marks are flat illustrations with a small palette and hard alpha edges.
    # Quantised PNG-8 beats WebP roughly 3:1 on this kind of art (41 KB vs 125 KB),
    # so don't be tempted to "modernise" these to WebP.
    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert("RGBA")
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
        # The embedded raster is only 438px wide - emitting a 2x variant would be
        # upscaling, which costs bytes and adds no detail.
        path = os.path.join(target_dir, "hero-illustration.png")
        im.quantize(colors=96, method=Image.FASTOCTREE).save(path, "PNG", optimize=True)
        report["out_bytes"] += os.path.getsize(path)
        report["written"] += 1
        print(f"  hero illustration extracted at {im.width}x{im.height} -> "
              f"{os.path.getsize(path) / 1024:.0f} KB PNG-8")

    mark = os.path.join(SRC, "Sab2-png.png")
    if os.path.exists(mark):
        report["src_bytes"] += os.path.getsize(mark)
        with Image.open(mark) as im:
            im = im.convert("RGBA")
            for width in (180, 360):
                height = round(im.height * width / im.width)
                out = im.resize((width, height), Image.LANCZOS)
                path = os.path.join(target_dir, f"mark-{width}.png")
                out.quantize(colors=64, method=Image.FASTOCTREE).save(path, "PNG", optimize=True)
                report["out_bytes"] += os.path.getsize(path)
                report["written"] += 1


def main():
    # Clear the contents rather than the directory itself: on Windows a shell
    # sitting in src/optimized holds a lock on the directory and rmtree(OUT) fails.
    os.makedirs(OUT, exist_ok=True)
    for entry in os.listdir(OUT):
        target = os.path.join(OUT, entry)
        shutil.rmtree(target) if os.path.isdir(target) else os.remove(target)

    menu = json.load(io.open(MENU, encoding="utf-8"))
    thumbs = sorted({i["image"] for i in menu if i.get("image") and i["image"] != PLACEHOLDER})

    report = {"src_bytes": 0, "out_bytes": 0, "written": 0, "missing": []}

    print(f"heroes ({len(HEROES)})")
    for name in HEROES:
        derive(name, "hero", report)

    print(f"cards ({len(CARDS)})")
    for name in CARDS:
        derive(name, "card", report)

    print(f"thumbs ({len(thumbs)})")
    for name in thumbs:
        derive(name, "thumb", report)

    print("logo")
    extract_logo(report)

    print()
    print(f"  wrote {report['written']} files")
    print(f"  source total : {report['src_bytes'] / 1024 / 1024:9.1f} MB")
    print(f"  output total : {report['out_bytes'] / 1024 / 1024:9.2f} MB")
    if report["out_bytes"]:
        print(f"  reduction    : {report['src_bytes'] / report['out_bytes']:9.0f}x")
    if report["missing"]:
        print()
        print(f"  MISSING from src/img ({len(report['missing'])}): {', '.join(report['missing'])}")
        print("  -> menu.json references these; either add the file or set image to default.jpg")

    return 1 if report["missing"] else 0


if __name__ == "__main__":
    sys.exit(main())
