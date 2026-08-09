#!/usr/bin/env python3
"""
ArmyBase — asset generator.

Full local pipeline for the 15 images described in ASSETS.md:

    1. Send each prompt to Cloudflare Workers AI (text-to-image).
    2. Remove the (opaque) background with rembg  -> transparent RGBA.
    3. Resize to the exact in-game target size.
    4. Save the PNG to its path under assets/.

Cost: Cloudflare's Free plan includes 10,000 Neurons/day at no charge.
All 15 images cost only a few hundred Neurons total, so this stays free.
rembg + Pillow are open-source and run locally.

--------------------------------------------------------------------------
SETUP (one time)
--------------------------------------------------------------------------
    pip install -r tools/requirements.txt

Get free Cloudflare credentials:
    1. Sign up / log in at https://dash.cloudflare.com  (Free plan is fine)
    2. Go to AI -> Workers AI -> "Use REST API"
    3. Create an API token (Workers AI Read + Edit), copy it
    4. Copy your Account ID from the same page

Put them in a .env file in the repo root (copy .env.example):
    CF_ACCOUNT_ID=your_account_id_here
    CF_API_TOKEN=your_token_here

--------------------------------------------------------------------------
USAGE
--------------------------------------------------------------------------
    python tools/generate_assets.py                 # generate all missing
    python tools/generate_assets.py --force         # regenerate everything
    python tools/generate_assets.py --only barracks # just one (by filename stem)
    python tools/generate_assets.py --only soldier_01 --only soldier_02
    python tools/generate_assets.py --no-bg         # skip background removal
    python tools/generate_assets.py --keep-raw      # also save the raw AI output
    python tools/generate_assets.py --list          # list all assets and exit
    python tools/generate_assets.py --model @cf/black-forest-labs/flux-1-schnell
"""

import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "assets"

# FLUX gives the cleanest flat-vector look and best prompt adherence for both
# buildings and characters, so it's the default for everything. SDXL remains
# available via --model (it can honor exact width/height if you need that).
MODEL_BUILDING = "@cf/black-forest-labs/flux-1-schnell"
MODEL_CHAR = "@cf/black-forest-labs/flux-1-schnell"

# Generation size (bigger than the final file, matching the target aspect
# ratio) -> better detail; then downscaled to the target after bg removal.
BUILDING_GEN = (768, 512)   # 3:2
BUILDING_OUT = (576, 384)   # final file size
CHAR_GEN     = (512, 768)   # 2:3
CHAR_OUT     = (128, 192)   # final file size

# Prepended to every prompt to force the flat, bold-outlined game-art look
# (SDXL drifts toward 3D/CAD renders without this).
STYLE_PREFIX = ("Flat 2D vector illustration, cel-shaded mobile strategy game "
                "art icon, bold thick uniform dark outline, flat solid fill "
                "colors, no gradient shading, no realistic textures, simple "
                "clean minimal shapes. ")

# Extra prefix for character assets: force ONE centered figure, not a sheet.
# "Wholesome / fully clothed" wording avoids FLUX's touchy NSFW false-positives.
CHAR_SOLO = ("Wholesome G-rated cartoon mascot, fully clothed. Exactly one "
             "single solo character, one person only, centered, full body "
             "head to feet, front view only. ")

_NEG_COMMON = ("3d render, cad model, blender render, unreal engine, "
               "photorealistic, realistic, photograph, octane, ray tracing, "
               "ambient occlusion, gradient shading, glossy, metallic, "
               "reflections, depth of field, soft focus, blurry, grainy, "
               "text, words, letters, numbers, watermark, logo, signature")
NEG_BUILDING = (_NEG_COMMON + ", people, characters, extra buildings, ground "
                "texture, grass, trees, plants, foliage, bushes, hedges, "
                "landscaping, background scenery")
NEG_CHAR = (_NEG_COMMON + ", colorful, saturated colors, vibrant, bright "
            "colors, rainbow, extra characters, background scenery, multiple "
            "people, group, crowd, two people, character sheet, turnaround, "
            "multiple views, multiple poses, duplicate, collage, grid, "
            "car, vehicle, taxi cab")


def _b(prompt):
    return {"prompt": prompt, "negative": NEG_BUILDING,
            "gen": BUILDING_GEN, "out": BUILDING_OUT,
            "subdir": "buildings"}


def _c(prompt):
    return {"prompt": prompt, "negative": NEG_CHAR,
            "gen": CHAR_GEN, "out": CHAR_OUT,
            "subdir": None}  # set per entry below


# ---------------------------------------------------------------------------
# The 15 assets (prompts copied verbatim from ASSETS.md / asset-generator.html)
# ---------------------------------------------------------------------------

ASSETS = {
    # -- Buildings (6) : assets/buildings/ --
    "barracks": _b(
        "A low, single-story military barracks building, viewed from a 30-40 degree "
        "top-down isometric angle, flat vector game-art illustration style with a "
        "consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular footprint, "
        "slightly wider than deep. Walls in muted khaki-sage (#8a9478), a shallow-pitched "
        "corrugated roof in dark olive (#5a6450). One visible door centered on the long "
        "wall facing the camera, two small square windows flanking it, a short set of steps "
        "or a low concrete stoop at the entrance. Optional a stack of sandbags or a folded "
        "flag pole beside the door for military flavor, but keep it minimal. Flat ambient "
        "lighting from upper-left, no hard shadows. Plain solid flat background, no ground, "
        "no grass, no text, no people, no other structures. Building fills about 80% of the "
        "canvas width, centered with even padding."),
    "shooting_range": _b(
        "An open-air military shooting range, viewed from a 30-40 degree top-down isometric "
        "angle, flat vector game-art illustration style with a consistent 2-3px dark outline "
        "(#1a1d14) on every edge. Long rectangular footprint: a low firing-line barrier or "
        "counter at the camera-facing end in brown (#6a5240), 3-4 parallel narrow shooting "
        "lanes marked by low wooden divider walls running away from the camera, simple "
        "humanoid target silhouettes standing at the far end of the lanes, backed by a low "
        "earth berm or sandbag wall in khaki-sage (#8a9478). No roof, this structure is "
        "outdoors. Flat ambient lighting from upper-left, no hard shadows. Plain solid flat "
        "background, no ground texture, no grass, no text, no people, no other structures. "
        "Structure fills about 80% of the canvas width, centered with even padding."),
    "weight_room": _b(
        "A small enclosed military gym or weight room building, viewed from a 30-40 degree "
        "top-down isometric angle, flat vector game-art illustration style with a consistent "
        "2-3px dark outline (#1a1d14) on every edge. Rectangular footprint, flat roof in "
        "muted purple-gray (#5a4a6a), walls in khaki-sage (#8a9478). One open garage-style "
        "front wall or large window facing the camera revealing the interior: a barbell rack, "
        "a couple of weight plates, and a bench, rendered simply and flatly with clear "
        "readable silhouettes. Flat ambient lighting from upper-left, no hard shadows. Plain "
        "solid flat background, no ground, no grass, no text, no people, no other structures. "
        "Building fills about 80% of the canvas width, centered with even padding."),
    "obstacle_course": _b(
        "An outdoor military obstacle course, viewed from a 30-40 degree top-down isometric "
        "angle, flat vector game-art illustration style with a consistent 2-3px dark outline "
        "(#1a1d14) on every edge. No enclosing building, a compact training-yard footprint "
        "containing 3 simple obstacle elements arranged left-to-right: a low wooden wall to "
        "climb over, a stack of 3-4 truck tires laid flat for foot-stepping, and a cargo-net "
        "frame (simple crosshatch net between two posts). Colors in olive-brown (#6a5a30) "
        "for the wood and dirt elements, dark gray (#4a4942) for the tires and net rope. "
        "Flat ambient lighting from upper-left, no hard shadows. Plain solid flat background, "
        "no ground texture, no grass, no text, no people, no other structures. The three "
        "obstacles together fill about 80% of the canvas width, centered with even padding."),
    "drill_yard": _b(
        "An open military combat drill yard, viewed from a 30-40 degree top-down isometric "
        "angle, flat vector game-art illustration style with a consistent 2-3px dark outline "
        "(#1a1d14) on every edge. A paved or packed-dirt open rectangular area in steel-blue "
        "(#4a5a6a) as the dominant tone, marked with 4-5 small painted formation-marker "
        "circles or cones arranged in a grid pattern like drill-position markers, and 1-2 "
        "simple padded training dummies (a vertical post with a rounded punching-bag-like "
        "top) standing at one edge. It should read as open-area formation and combat "
        "drilling, not equipment. Flat ambient lighting from upper-left, no hard shadows. "
        "Plain solid flat background, no grass, no text, no people, no other structures. "
        "Fills about 80% of the canvas width, centered with even padding."),
    "mess_hall": _b(
        "A military mess hall or dining building, viewed from a 30-40 degree top-down "
        "isometric angle, flat vector game-art illustration style with a consistent 2-3px "
        "dark outline (#1a1d14) on every edge. Rectangular footprint, wider than deep, roof "
        "and walls in teal-green (#40605a). A serving window or open hatch on the "
        "camera-facing wall with a simple awning above it, one or two picnic-style tables "
        "visible just outside the building along the same wall. Flat ambient lighting from "
        "upper-left, no hard shadows. Plain solid flat background, no ground, no grass, no "
        "text, no people, no other structures. Building fills about 80% of the canvas width, "
        "centered with even padding."),

    # -- Civilians (3) : assets/units/civilians/ --
    "civilian": dict(_c(
        "A generic civilian pedestrian, full body, front-facing, simple stylized "
        "flat-vector game-icon character with a consistent 2-3px dark outline (#1a1d14). "
        "Mid-stride walking pose, one leg forward, arms relaxed. Plain casual clothing, a "
        "simple t-shirt or jacket shape and pants, no distinguishing accessories. Use ONLY "
        "these desaturated tones: neutral warm gray #8a897d for the main clothing, darker "
        "gray #6e6d63 for shading creases, light gray-khaki #b8b6a8 for skin and highlights, "
        "near-black gray #4a4942 for shoes and small details. No other colors, no bright or "
        "saturated colors anywhere. Minimal facial detail (simple dot eyes). Flat ambient "
        "lighting from upper-left, no hard shadows. Plain solid flat background, no ground, "
        "no text, no props, no other characters. Figure fills about 80% of the canvas "
        "height, centered with even padding."), subdir="units/civilians"),
    "bus_rider": dict(_c(
        "A civilian pedestrian who just got off a bus, full body, front-facing, simple "
        "stylized flat-vector game-icon character with a consistent 2-3px dark outline "
        "(#1a1d14). Mid-stride walking pose, one leg forward, arms relaxed, carrying a small "
        "duffel bag or backpack over one shoulder. Use ONLY these desaturated tones: neutral "
        "warm gray #8a897d for the main clothing, darker gray #6e6d63 for shading and the "
        "bag, light gray-khaki #b8b6a8 for skin and highlights, near-black gray #4a4942 for "
        "shoes and straps. No other colors, no bright or saturated colors anywhere. Minimal "
        "facial detail (simple dot eyes). Flat ambient lighting from upper-left, no hard "
        "shadows. Plain solid flat background, no ground, no text, no other props or "
        "characters. Figure fills about 80% of the canvas height, centered with even "
        "padding."), subdir="units/civilians"),
    "taxi": dict(_c(
        "A single well-dressed civilian person standing, full body, front-facing, simple "
        "stylized flat-vector game-icon character with a consistent 2-3px dark outline "
        "(#1a1d14). Mid-stride walking pose, one leg forward, arms relaxed, a neater sharper "
        "silhouette with a simple collared jacket shape instead of a plain t-shirt, no bag. "
        "Use ONLY these desaturated tones: neutral warm gray #8a897d for the main clothing, "
        "darker gray #6e6d63 for shading and collar, light gray-khaki #b8b6a8 for skin and "
        "highlights, near-black gray #4a4942 for shoes and small details. No other colors, "
        "no bright or saturated colors anywhere. Minimal facial detail (simple dot eyes). "
        "Flat ambient lighting from upper-left, no hard shadows. Plain solid flat "
        "background, no ground, no text, no other props or characters. Figure fills about "
        "80% of the canvas height, centered with even padding."), subdir="units/civilians"),

    # -- Soldiers (6) : assets/units/soldiers/ --
    "soldier_01": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette, no extra gear). No headgear, bare head with a simple short-hair "
        "silhouette. Use ONLY these desaturated tones: neutral warm gray #8a897d for the "
        "uniform, darker gray #6e6d63 for shading creases, light gray-khaki #b8b6a8 for skin "
        "and highlights, near-black gray #4a4942 for boots. No other colors, no bright or "
        "saturated colors. Minimal facial detail (simple dot eyes). Flat ambient lighting "
        "from upper-left, no hard shadows. Plain solid flat background, no ground, no text, "
        "no props or other characters. Figure fills about 80% of the canvas height, centered "
        "with even padding."), subdir="units/soldiers"),
    "soldier_02": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette) plus a rounded combat helmet. Use ONLY these desaturated tones: neutral "
        "warm gray #8a897d for the uniform, darker gray #6e6d63 for the helmet and shading, "
        "light gray-khaki #b8b6a8 for skin and highlights, near-black gray #4a4942 for "
        "boots. No other colors, no bright or saturated colors. Minimal facial detail. Flat "
        "ambient lighting from upper-left, no hard shadows. Plain solid flat background, no "
        "ground, no text, no props or other characters. Figure fills about 80% of the canvas "
        "height, centered with even padding."), subdir="units/soldiers"),
    "soldier_03": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette), no headgear. Noticeably bulkier and broader-shouldered build, wider "
        "torso silhouette, same overall height. Use ONLY these desaturated tones: neutral "
        "warm gray #8a897d for the uniform, darker gray #6e6d63 for shading creases, light "
        "gray-khaki #b8b6a8 for skin and highlights, near-black gray #4a4942 for boots. No "
        "other colors, no bright or saturated colors. Minimal facial detail. Flat ambient "
        "lighting from upper-left, no hard shadows. Plain solid flat background, no ground, "
        "no text, no props or other characters. Figure fills about 80% of the canvas height, "
        "centered with even padding."), subdir="units/soldiers"),
    "soldier_04": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette), no headgear. Noticeably slighter and narrower build, narrower torso "
        "silhouette, same overall height. Use ONLY these desaturated tones: neutral warm "
        "gray #8a897d for the uniform, darker gray #6e6d63 for shading creases, light "
        "gray-khaki #b8b6a8 for skin and highlights, near-black gray #4a4942 for boots. No "
        "other colors, no bright or saturated colors. Minimal facial detail. Flat ambient "
        "lighting from upper-left, no hard shadows. Plain solid flat background, no ground, "
        "no text, no props or other characters. Figure fills about 80% of the canvas height, "
        "centered with even padding."), subdir="units/soldiers"),
    "soldier_05": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette) plus a soft beret angled slightly to one side, clearly distinct in "
        "silhouette from a rounded combat helmet. Use ONLY these desaturated tones: neutral "
        "warm gray #8a897d for the uniform, darker gray #6e6d63 for the beret and shading, "
        "light gray-khaki #b8b6a8 for skin and highlights, near-black gray #4a4942 for "
        "boots. No other colors, no bright or saturated colors. Minimal facial detail. Flat "
        "ambient lighting from upper-left, no hard shadows. Plain solid flat background, no "
        "ground, no text, no props or other characters. Figure fills about 80% of the canvas "
        "height, centered with even padding."), subdir="units/soldiers"),
    "soldier_06": dict(_c(
        "A standard military soldier, full body, front-facing, simple stylized flat-vector "
        "game-icon character with a consistent 2-3px dark outline (#1a1d14). Standing at "
        "ease, facing forward, arms at sides, wearing a basic uniform (jacket and trousers "
        "silhouette), no headgear, plus visible gear webbing straps across the chest and a "
        "small pack on the back with only the top and sides visible from the front. Use ONLY "
        "these desaturated tones: neutral warm gray #8a897d for the uniform, darker gray "
        "#6e6d63 for the webbing pack and shading, light gray-khaki #b8b6a8 for skin and "
        "highlights, near-black gray #4a4942 for boots. No other colors, no bright or "
        "saturated colors. Minimal facial detail. Flat ambient lighting from upper-left, no "
        "hard shadows. Plain solid flat background, no ground, no text, no props or other "
        "characters. Figure fills about 80% of the canvas height, centered with even "
        "padding."), subdir="units/soldiers"),
}


# ---------------------------------------------------------------------------
# .env loader (no dependency)
# ---------------------------------------------------------------------------

def load_dotenv():
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key, val = key.strip(), val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


# ---------------------------------------------------------------------------
# Cloudflare Workers AI call
# ---------------------------------------------------------------------------

def cf_generate(account_id, token, model, prompt, negative, width, height):
    """Return raw image bytes from Cloudflare Workers AI."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    payload = {"prompt": prompt}
    if "flux" in model:
        payload["steps"] = 8  # max quality for schnell
    else:
        payload.update({"negative_prompt": negative, "width": width,
                        "height": height, "num_steps": 20, "guidance": 9.0})
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            ctype = resp.headers.get("Content-Type", "")
            body = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"Cloudflare HTTP {e.code}: {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e.reason}") from None

    # Image models usually return raw bytes; some (FLUX) return JSON base64.
    if "application/json" in ctype or body[:1] == b"{":
        obj = json.loads(body)
        if not obj.get("success", True) and obj.get("errors"):
            raise RuntimeError(f"Cloudflare API error: {obj['errors']}")
        img_b64 = obj.get("result", {}).get("image")
        if not img_b64:
            raise RuntimeError(f"Unexpected JSON response: {body[:300]!r}")
        return base64.b64decode(img_b64)
    return body


# ---------------------------------------------------------------------------
# Post-processing (rembg + resize)
# ---------------------------------------------------------------------------

def _keep_largest_component(img):
    """Drop floating ghost blobs / stray extra figures: keep only the biggest
    connected opaque region. Safe for single-subject characters (NOT buildings,
    whose separate parts are intentional)."""
    import numpy as np
    from scipy import ndimage
    from PIL import Image
    arr = np.array(img)
    mask = arr[:, :, 3] > 30
    labeled, n = ndimage.label(mask)
    if n <= 1:
        return img
    sizes = ndimage.sum(mask, labeled, range(1, n + 1))
    biggest = int(np.argmax(sizes)) + 1
    arr[:, :, 3] = np.where(labeled == biggest, arr[:, :, 3], 0)
    return Image.fromarray(arr)


def _fit_canvas(img, out_size, fill=0.9):
    """Crop to the figure's bounding box, then scale (preserving aspect) to
    fill ~90% of the target canvas and paste centered on transparency. Avoids
    the squish you'd get resizing a square FLUX image straight to 2:3."""
    from PIL import Image
    bbox = img.split()[3].getbbox()
    if bbox:
        img = img.crop(bbox)
    ow, oh = out_size
    scale = min(ow * fill / img.width, oh * fill / img.height)
    new = img.resize((max(1, round(img.width * scale)),
                      max(1, round(img.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", out_size, (0, 0, 0, 0))
    canvas.paste(new, ((ow - new.width) // 2, (oh - new.height) // 2), new)
    return canvas


def _desaturate(img, factor=0.28):
    """Force characters into the game's desaturated gray palette (hard
    requirement for the in-engine hue-shift). Alpha is preserved."""
    from PIL import Image, ImageEnhance
    r, g, b, a = img.split()
    rgb = ImageEnhance.Color(Image.merge("RGB", (r, g, b))).enhance(factor)
    r2, g2, b2 = rgb.split()
    return Image.merge("RGBA", (r2, g2, b2, a))


def process_image(raw_bytes, out_size, do_bg, is_char):
    from PIL import Image
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")

    if do_bg:
        from rembg import remove
        img = remove(img)  # returns RGBA with transparent background

    if is_char:
        if do_bg:
            img = _keep_largest_component(img)   # one figure only, no ghosts
        img = _desaturate(img)                    # enforce gray palette
        img = _fit_canvas(img, out_size)          # crop + fit, no squish
    elif do_bg:
        img = _fit_canvas(img, out_size, fill=0.95)   # buildings: crop + fit
    else:
        img = img.resize(out_size, Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def out_path(name, spec):
    subdir = spec["subdir"]
    return ASSETS_DIR / subdir / f"{name}.png"


def main():
    ap = argparse.ArgumentParser(description="Generate ArmyBase art assets via Cloudflare Workers AI.")
    ap.add_argument("--only", action="append", default=[],
                    help="Generate only this asset (filename stem, e.g. barracks). Repeatable.")
    ap.add_argument("--force", action="store_true", help="Regenerate even if the file exists.")
    ap.add_argument("--no-bg", action="store_true", help="Skip background removal (keep opaque).")
    ap.add_argument("--keep-raw", action="store_true", help="Also save the raw AI output to assets/_raw/.")
    ap.add_argument("--model", default=None,
                    help="Force one model for everything (default: FLUX for "
                         "characters, SDXL for buildings).")
    ap.add_argument("--list", action="store_true", help="List all assets and exit.")
    args = ap.parse_args()

    if args.list:
        for name, spec in ASSETS.items():
            print(f"  {name:16s} -> {out_path(name, spec).relative_to(REPO_ROOT)}")
        print(f"\n  {len(ASSETS)} assets total.")
        return

    load_dotenv()
    account_id = os.environ.get("CF_ACCOUNT_ID")
    token = os.environ.get("CF_API_TOKEN")
    if not account_id or not token:
        sys.exit("ERROR: set CF_ACCOUNT_ID and CF_API_TOKEN (see .env.example / this file's SETUP).")

    do_bg = not args.no_bg
    targets = args.only if args.only else list(ASSETS.keys())
    unknown = [t for t in targets if t not in ASSETS]
    if unknown:
        sys.exit(f"ERROR: unknown asset(s): {unknown}\nRun with --list to see valid names.")

    raw_dir = ASSETS_DIR / "_raw"
    done = skipped = failed = 0

    for i, name in enumerate(targets, 1):
        spec = ASSETS[name]
        dest = out_path(name, spec)
        if dest.exists() and not args.force:
            print(f"[{i}/{len(targets)}] {name}: exists, skipping (use --force to redo)")
            skipped += 1
            continue

        is_char = spec["subdir"].startswith("units")
        model = args.model or (MODEL_CHAR if is_char else MODEL_BUILDING)
        full_prompt = STYLE_PREFIX + (CHAR_SOLO if is_char else "") + spec["prompt"]

        print(f"[{i}/{len(targets)}] {name}: generating via {model.split('/')[-1]} "
              f"({spec['gen'][0]}x{spec['gen'][1]}) ...", flush=True)
        try:
            raw = cf_generate(account_id, token, model, full_prompt,
                              spec["negative"], spec["gen"][0], spec["gen"][1])
            if args.keep_raw:
                raw_dir.mkdir(parents=True, exist_ok=True)
                (raw_dir / f"{name}.png").write_bytes(raw)

            print(f"          post-processing (bg removal={'on' if do_bg else 'off'}, "
                  f"resize -> {spec['out'][0]}x{spec['out'][1]}"
                  f"{', desaturate+isolate' if is_char else ''}) ...", flush=True)
            png = process_image(raw, tuple(spec["out"]), do_bg, is_char)

            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(png)
            print(f"          saved -> {dest.relative_to(REPO_ROOT)}")
            done += 1
        except Exception as e:  # noqa: BLE001 - report and continue the batch
            print(f"          FAILED: {e}")
            failed += 1
        time.sleep(0.5)  # be gentle on the API

    print(f"\nDone. {done} generated, {skipped} skipped, {failed} failed.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
