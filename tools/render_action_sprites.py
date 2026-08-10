#!/usr/bin/env python3
"""
ArmyBase — 3D-rigged action sprite renderer (Blender).

Renders individual animation frames from a rigged, animated 3D character
(Mixamo FBX, or a Meshy/Tripo AI model rigged+animated via Mixamo) out to
transparent PNGs, using a fixed camera/shading setup matched to this
project's existing flat-vector isometric art style (see
tools/generate_assets.py's STYLE_PREFIX / "30-40 degree top-down isometric
angle" convention used everywhere else in this repo).

This is the "build a 3D model once, render real animation frames from it"
technique big base-builder mobile games (Clash of Clans and similar) use to
get actual character animation cheaply at runtime — the game itself stays
plain 2D sprites, all the 3D work happens once, offline, here.

--------------------------------------------------------------------------
WHY THIS FILE EXISTS / WHAT IT DOES NOT DO
--------------------------------------------------------------------------
This script does NOT generate a 3D model and does NOT rig or animate it —
those steps happen in your browser, outside this repo, before you ever run
this script:

    1. Generate a custom-styled 3D character model (text-to-3D or
       image-to-3D) with a tool like Meshy (meshy.ai) or Tripo AI
       (tripo3d.ai) — both have a free tier as of when this was written.
       Tip: feed one of this project's EXISTING soldier sprites
       (assets/units/soldiers/soldier_01.png etc.) in as an image-to-3D
       reference if the tool supports it, to keep the look consistent with
       art already in the game.
    2. Export the model in roughly a T-pose/A-pose (FBX or OBJ).
    3. Upload it to Mixamo (mixamo.com, free, Adobe account) for
       auto-rigging — Mixamo also has a huge FREE library of already
       motion-captured animations (search "rifle aim", "firing rifle",
       "running", "weight lifting", "boxing"/"sparring", etc.) that you can
       apply directly to your rigged model.
    4. Download each animation as an FBX **with skin** (Mixamo's export
       dialog option) — one FBX file per animation.

Only once you have one or more of those downloaded FBX files does this
script come in: point it at a file, it renders every frame of that file's
animation to transparent PNGs.

IMPORTANT: nobody has run this script yet. It was written carefully
against the documented Blender Python API, but there is no Blender install
in the environment that wrote it, so it could not be executed or verified
end to end. Treat it like a first draft: run --preview first (see below),
expect to tweak camera/shading numbers once you can actually see output,
and don't be surprised if a Blender-version quirk needs a small fix.

--------------------------------------------------------------------------
SETUP (one time)
--------------------------------------------------------------------------
Install Blender (free): https://www.blender.org/download/
This script only uses Blender's bundled Python (bpy) — no pip installs
needed for this step. (tools/generate_assets.py's Pillow/rembg deps are
for the SEPARATE finish_3d_sprites.py post-processing step, not this one.)

--------------------------------------------------------------------------
USAGE
--------------------------------------------------------------------------
Run via Blender's own command-line batch mode (no need to open the GUI):

    blender --background --python tools/render_action_sprites.py -- \\
        --input path/to/Firing_Rifle.fbx \\
        --name shootingRange \\
        --frames 8

    # Quick sanity check before committing to a full batch — renders just
    # ONE frame so you can eyeball framing/shading/outline before waiting
    # on the rest:
    blender --background --python tools/render_action_sprites.py -- \\
        --input path/to/Firing_Rifle.fbx --name shootingRange --preview

Everything after the bare `--` is this script's own argv (Blender strips
its own args before that point) — this is standard Blender CLI convention,
not a mistake if it looks unusual.

Output lands in assets/_raw_3d/<name>/<name>_NN.png (transparent PNG, one
per rendered frame) — a RAW/staging area, not final game assets yet. Run
tools/finish_3d_sprites.py next to crop/resize/desaturate them to match
every other character sprite in this repo exactly (same canonical size and
palette convention that makes the runtime per-unit hue-rotate tinting
work). Wiring the finished frames into render.js as an actual in-game
multi-frame animation (extending the existing 2-frame walk-cycle swap to
N frames) is a deliberately separate, later step — see ASSETS.md's "3D
action-frame pipeline" section for why that's not done yet.

Options:
    --input PATH      Rigged, animated FBX or GLB/GLTF file (required)
    --name NAME        Short slug for this action, used in output paths
                        (e.g. shootingRange, obstacleCourse) (required)
    --frames N         How many frames to sample across the action's full
                        length, evenly spaced (default: 8)
    --azimuth DEG      Camera horizontal angle in degrees, 0 = facing the
                        character head-on from the front (default: 30,
                        a 3/4 view — matches the "down" direction's framing
                        used by the existing 2D directional sprites)
    --elevation DEG    Camera angle above the horizon (default: 35, matches
                        this repo's "30-40 degree top-down isometric angle"
                        convention used in every 2D asset prompt)
    --preview          Render only the first sampled frame, to
                        assets/_raw_3d/<name>/<name>_preview.png, and stop —
                        use this before running a full batch
    --outline-width N  Freestyle outline thickness in pixels (default: 3,
                        matches the "2-3px dark outline (#1a1d14)" spec
                        used throughout ASSETS.md)
"""

import argparse
import math
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    sys.exit(
        "ERROR: this script must be run INSIDE Blender, not with a plain "
        "python3 interpreter. Use:\n"
        "  blender --background --python tools/render_action_sprites.py -- [args]"
    )

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_OUT_DIR = REPO_ROOT / "assets" / "_raw_3d"

# Matches ASSETS.md's outline color for every existing 2D asset.
OUTLINE_COLOR = (0x1A / 255, 0x1D / 255, 0x14 / 255, 1.0)

# Render resolution — bigger than the final in-game sprite (128x192, see
# generate_assets.py's CHAR_OUT) so finish_3d_sprites.py's crop-to-bbox +
# resize step has real detail to work from, same "generate big, downscale
# after" approach the 2D pipeline already uses (CHAR_GEN vs CHAR_OUT).
RENDER_W, RENDER_H = 640, 960


def parse_args():
    # Blender eats its own CLI args; everything meant for this script comes
    # after a literal "--" separator, which argparse won't see unless we
    # slice it out ourselves first.
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True, help="Rigged animated FBX or GLB/GLTF file")
    ap.add_argument("--name", required=True, help="Short slug for this action (e.g. shootingRange)")
    ap.add_argument("--frames", type=int, default=8)
    ap.add_argument("--azimuth", type=float, default=30.0)
    ap.add_argument("--elevation", type=float, default=35.0)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--outline-width", type=float, default=3.0)
    return ap.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path):
    path = str(path)
    ext = Path(path).suffix.lower()
    before = set(bpy.data.objects.keys())
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        sys.exit(f"ERROR: unsupported model format '{ext}' (expected .fbx, .glb, or .gltf)")
    imported = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]
    if not imported:
        sys.exit(f"ERROR: import produced no objects — is '{path}' a valid rigged model file?")
    return imported


def find_armature(objects):
    for obj in objects:
        if obj.type == "ARMATURE":
            return obj
    sys.exit(
        "ERROR: no armature found in the imported file. This script expects a "
        "RIGGED model (skeleton + animation) — export from Mixamo with "
        "'Skin' included, not a plain static mesh."
    )


def scene_bounding_box(objects):
    """World-space bounding box across every mesh object, sampled at the
    animation's current frame — used to auto-frame the camera regardless of
    the model's own scale/units, since AI-generated models are notoriously
    inconsistent about real-world scale."""
    import mathutils
    min_co = mathutils.Vector((math.inf, math.inf, math.inf))
    max_co = mathutils.Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for obj in objects:
        if obj.type != "MESH":
            continue
        found = True
        for corner in obj.bound_box:
            world_co = obj.matrix_world @ mathutils.Vector(corner)
            min_co.x, min_co.y, min_co.z = min(min_co.x, world_co.x), min(min_co.y, world_co.y), min(min_co.z, world_co.z)
            max_co.x, max_co.y, max_co.z = max(max_co.x, world_co.x), max(max_co.y, world_co.y), max(max_co.z, world_co.z)
    if not found:
        sys.exit("ERROR: no mesh objects found to compute a bounding box from.")
    return min_co, max_co


def setup_camera(min_co, max_co, azimuth_deg, elevation_deg):
    import mathutils
    center = (min_co + max_co) / 2
    size = max_co - min_co
    radius = max(size.x, size.y, size.z) * 0.75 or 1.0  # guard against a zero-size bbox

    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    # Orthographic camera, not perspective — avoids perspective distortion,
    # which reads as more "flat game sprite" and less "3D render" than a
    # perspective lens would. Distance from center doesn't affect framing
    # for an ortho camera (only ortho_scale does), but it still needs to be
    # placed outside the model to avoid clipping into it.
    distance = radius * 4
    cam_data = bpy.data.cameras.new("SpriteCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = radius * 2.4  # padding so the figure doesn't touch the frame edge
    cam_obj = bpy.data.objects.new("SpriteCam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    cam_obj.location = center + mathutils.Vector((
        math.sin(az) * math.cos(el) * distance,
        -math.cos(az) * math.cos(el) * distance,
        math.sin(el) * distance,
    ))

    target = bpy.data.objects.new("SpriteCamTarget", None)
    target.location = center
    bpy.context.scene.collection.objects.link(target)
    constraint = cam_obj.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    bpy.context.scene.camera = cam_obj
    return cam_obj


def setup_flat_shading_and_outline(outline_width_px):
    """Matches ASSETS.md's flat-vector cel-shaded convention: solid flat
    fills with no gradient lighting, plus a bold dark outline — the same
    visual language every 2D asset in this repo already uses, so 3D-rendered
    frames don't look jarringly different (a real 3D render, un-styled,
    would clash badly against the rest of the flat-vector game art).

    Uses EEVEE (broadly available, stable Freestyle support) rather than
    Blender's Workbench engine — Workbench's flat-shading mode is simpler
    but has had inconsistent Freestyle support across Blender versions, and
    EEVEE + Freestyle is the safer, longer-established combination.
    """
    scene = bpy.context.scene
    # Blender 4.2+ renamed 'BLENDER_EEVEE' to 'BLENDER_EEVEE_NEXT'; try both
    # so this doesn't hard-fail on a version mismatch alone.
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"

    scene.render.film_transparent = True
    scene.render.resolution_x = RENDER_W
    scene.render.resolution_y = RENDER_H
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # Flat, unlit fill: swap every material's surface to a plain Emission
    # shader driven by its existing base color (or texture, if it has one),
    # which removes directional lighting/gradients entirely — "no gradient
    # shading, no realistic textures" per every other asset's style prompt.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        output = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None)
        principled = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        if output is None:
            continue
        emission = nodes.new("ShaderNodeEmission")
        # Reuse whatever feeds the Principled BSDF's base color (a texture,
        # if the model has one) as the emission color, so existing surface
        # detail/patterning survives — just without any lighting gradient.
        if principled is not None:
            base_color_input = principled.inputs.get("Base Color")
            if base_color_input and base_color_input.is_linked:
                src = base_color_input.links[0].from_socket
                links.new(src, emission.inputs["Color"])
            else:
                emission.inputs["Color"].default_value = (
                    base_color_input.default_value if base_color_input else (0.6, 0.6, 0.6, 1.0)
                )
        links.new(emission.outputs["Emission"], output.inputs["Surface"])

    # Freestyle bold outline — matches the "2-3px dark outline (#1a1d14) on
    # every edge" spec used by every 2D asset in ASSETS.md.
    scene.render.use_freestyle = True
    view_layer = bpy.context.view_layer
    view_layer.use_freestyle = True
    if not view_layer.freestyle_settings.linesets:
        view_layer.freestyle_settings.linesets.new("Outline")
    lineset = view_layer.freestyle_settings.linesets[0]
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = True
    if "ArmyBaseOutline" not in bpy.data.linestyles:
        bpy.data.linestyles.new("ArmyBaseOutline")
    linestyle = bpy.data.linestyles.get("ArmyBaseOutline", lineset.linestyle)
    lineset.linestyle = linestyle
    linestyle.color = OUTLINE_COLOR[:3]
    linestyle.thickness = outline_width_px


def render_frame(out_path):
    bpy.context.scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    reset_scene()

    imported = import_model(args.input)
    armature = find_armature(imported)
    min_co, max_co = scene_bounding_box(imported)
    setup_camera(min_co, max_co, args.azimuth, args.elevation)
    setup_flat_shading_and_outline(args.outline_width)

    action = armature.animation_data.action if armature.animation_data else None
    if action is None:
        sys.exit(
            "ERROR: the armature has no active animation action. Make sure you "
            "exported from Mixamo 'with Skin' and that this is an ANIMATED FBX, "
            "not a T-pose/rest-pose-only file."
        )
    frame_start, frame_end = int(action.frame_range[0]), int(action.frame_range[1])
    if frame_end <= frame_start:
        sys.exit(f"ERROR: action '{action.name}' has an empty frame range ({frame_start}-{frame_end}).")

    out_dir = RAW_OUT_DIR / args.name
    out_dir.mkdir(parents=True, exist_ok=True)

    frame_count = 1 if args.preview else max(1, args.frames)
    print(f"Action '{action.name}': frames {frame_start}-{frame_end}, sampling {frame_count}")

    for i in range(frame_count):
        t = frame_start if frame_count == 1 else frame_start + (frame_end - frame_start) * i / (frame_count - 1)
        bpy.context.scene.frame_set(int(round(t)))
        suffix = "preview" if args.preview else f"{i:02d}"
        out_path = out_dir / f"{args.name}_{suffix}.png"
        print(f"  frame {int(round(t))} -> {out_path.relative_to(REPO_ROOT)}")
        render_frame(out_path)

    print(f"\nDone. {frame_count} frame(s) written to {out_dir.relative_to(REPO_ROOT)}")
    if args.preview:
        print("Preview only — check the framing/shading/outline look right, "
              "then re-run without --preview for the full batch.")


if __name__ == "__main__":
    main()
