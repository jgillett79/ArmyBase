#!/usr/bin/env python3
"""
ArmyBase — post-process raw 3D-rendered action frames into game-ready sprites.

Second half of the "3D model -> real animation frames" pipeline (see
tools/render_action_sprites.py for the first half, which does the actual
Blender rendering). This script is plain Python — no Blender needed — and
reuses this repo's EXISTING sprite post-processing functions from
tools/generate_assets.py (_fit_canvas, _desaturate, _keep_largest_component)
so a 3D-rendered frame ends up byte-for-byte the same shape/size/palette
convention as every hand-generated 2D sprite already in this game — that's
what makes the runtime per-unit hue-rotate tinting (see render.js's
drawUnit()) work on these frames too, without any special-casing.

--------------------------------------------------------------------------
USAGE
--------------------------------------------------------------------------
    pip install -r tools/requirements.txt   # if not already done

    python tools/finish_3d_sprites.py --name shootingRange

Reads every PNG in assets/_raw_3d/<name>/ (written by render_action_sprites.py)
and writes matching processed files to assets/_3d_processed/<name>/, at this
repo's canonical character sprite size (128x192, same as every existing
soldier/civilian sprite) with the same desaturated palette convention.

This intentionally stops at a staging folder (assets/_3d_processed/), not
assets/units/soldiers/ — wiring finished frames into the actual game (naming
convention, and extending render.js's sprite lookup from today's 2-frame
walk-cycle swap to N frames per training action) is a deliberately separate
next step once real output exists to design that naming/lookup scheme
against, rather than guessing at it now. See ASSETS.md's "3D action-frame
pipeline" section.

Options:
    --name NAME     Which assets/_raw_3d/<name>/ folder to process (required)
    --keep-ghosts   Skip _keep_largest_component() (only needed if Freestyle
                    outline rendering leaves stray disconnected line
                    fragments in some frames — try without this first)
"""

import argparse
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
sys.path.insert(0, str(TOOLS_DIR))

# Reuses the SAME crop/fit/desaturate logic every 2D character sprite in
# this repo already went through — deliberately not reimplemented here, so
# the two pipelines can't silently drift into producing different-shaped
# output.
from generate_assets import _fit_canvas, _desaturate, _keep_largest_component, CHAR_OUT  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--name", required=True)
    ap.add_argument("--keep-ghosts", action="store_true")
    args = ap.parse_args()

    from PIL import Image

    raw_dir = REPO_ROOT / "assets" / "_raw_3d" / args.name
    if not raw_dir.exists():
        sys.exit(f"ERROR: {raw_dir.relative_to(REPO_ROOT)} doesn't exist — "
                  f"run render_action_sprites.py --name {args.name} first.")

    out_dir = REPO_ROOT / "assets" / "_3d_processed" / args.name
    out_dir.mkdir(parents=True, exist_ok=True)

    raw_files = sorted(raw_dir.glob("*.png"))
    if not raw_files:
        sys.exit(f"ERROR: no PNG files found in {raw_dir.relative_to(REPO_ROOT)}.")

    for i, path in enumerate(raw_files, 1):
        img = Image.open(path).convert("RGBA")
        if not args.keep_ghosts:
            img = _keep_largest_component(img)
        img = _desaturate(img)
        img = _fit_canvas(img, CHAR_OUT)
        dest = out_dir / path.name
        img.save(dest, format="PNG")
        print(f"[{i}/{len(raw_files)}] {path.name} -> {dest.relative_to(REPO_ROOT)}")

    print(f"\nDone. {len(raw_files)} frame(s) processed -> "
          f"{out_dir.relative_to(REPO_ROOT)}\n"
          "Look through them, then see ASSETS.md's \"3D action-frame "
          "pipeline\" section for the next step (wiring into render.js).")


if __name__ == "__main__":
    main()
