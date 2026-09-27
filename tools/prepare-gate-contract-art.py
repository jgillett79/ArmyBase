#!/usr/bin/env python3
"""Reproducible Gate 0 bridge/checkpoint layer exports from reviewed source art."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art/production/source'
BRIDGES = ROOT / 'assets/bridges'
PROPS = ROOT / 'assets/props'
BRIDGES.mkdir(exist_ok=True)

def source(name):
    return Image.open(SOURCE / name).convert('RGBA')

def clean(image):
    a = image.getchannel('A').point(lambda v: 0 if v <= 18 else 255 if v >= 224 else v)
    image.putalpha(a)
    return image

def save(image, path):
    clean(image).save(path, optimize=True)
    with Image.open(path) as check:
        assert check.getchannel('A').getextrema() == (0, 255), path

# The generated source has a level east-west deck and no front rail.
bridge = source('bridge-gate-back-v1.webp')
back = Image.new('RGBA', (360, 216), (0, 0, 0, 0))
body = bridge.crop((55, 200, 1721, 686)).resize((306, 194), Image.Resampling.LANCZOS)
back.alpha_composite(body, (27, 20))
save(back, BRIDGES / 'bridge_gate_back.png')

# Reuse the far rail's identical timber and iron materials for the near rail.
# Its posts are masked individually below the crossbar so no deck plank leaks
# into the foreground layer. This image overlays people at the south deck edge.
rail = bridge.crop((205, 195, 1570, 322))
mask = Image.new('L', rail.size)
draw = ImageDraw.Draw(mask)
draw.rectangle((0, 0, rail.width, 95), fill=255)
for x in (35, 483, 895, 1327):
    draw.rectangle((x-43, 80, x+43, 126), fill=255)
rail.putalpha(Image.composite(rail.getchannel('A'), Image.new('L', rail.size), mask))
rail = rail.resize((252, 51), Image.Resampling.LANCZOS)
front = Image.new('RGBA', (360, 216), (0, 0, 0, 0))
front.alpha_composite(rail, (54, 96))
save(front, BRIDGES / 'bridge_gate_front.png')

# Keep the same 180 x 318 canvas and pivot in both kiosk layers.
kiosk_source = source('gate-kiosk-v1.webp')
kiosk = kiosk_source.crop((112, 13, 962, 1451)).resize((170, 288), Image.Resampling.LANCZOS)
whole = Image.new('RGBA', (180, 318), (0, 0, 0, 0))
whole.alpha_composite(kiosk, (5, 12))
kiosk_back = whole.copy()
kiosk_front = whole.copy()
cut = 222  # just above the south-facing timber counter
kiosk_back.paste((0, 0, 0, 0), (0, cut, 180, 318))
kiosk_front.paste((0, 0, 0, 0), (0, 0, 180, cut))
save(kiosk_back, PROPS / 'gate_kiosk_back.png')
save(kiosk_front, PROPS / 'gate_kiosk_front.png')

# Rescale the existing approved striped boom source to 42 world px of reach.
boom_source = source('gate-boom-v1.webp')
bb = boom_source.getchannel('A').point(lambda a: 255 if a > 30 else 0).getbbox()
boom = boom_source.crop(bb).resize((126, 30), Image.Resampling.LANCZOS)
boom_frame = Image.new('RGBA', (142, 46), (0, 0, 0, 0))
boom_frame.alpha_composite(boom, (8, 8))
save(boom_frame, PROPS / 'gate_boom_swing.png')
post_source = source('gate-boom-post-v1.webp')
pb = post_source.getchannel('A').point(lambda a: 255 if a > 50 else 0).getbbox()
post = post_source.crop(pb).resize((39, 72), Image.Resampling.LANCZOS)
post_frame = Image.new('RGBA', (51, 84), (0, 0, 0, 0))
post_frame.alpha_composite(post, (6, 6))
save(post_frame, PROPS / 'gate_boom_post.png')

manifest = {
    'contract': 'CLAUDE_IMPLEMENTATION/06_GATE0_VISUAL_CONTRACT.md',
    'density': 3, 'camera': 'top-down oblique; straight verticals',
    'bridge': {'back': 'assets/bridges/bridge_gate_back.png',
               'front': 'assets/bridges/bridge_gate_front.png',
               'size': [360, 216], 'westPivot': [36, 105], 'eastPivot': [300, 111]},
    'kiosk': {'back': 'assets/props/gate_kiosk_back.png',
              'front': 'assets/props/gate_kiosk_front.png',
              'size': [180, 318], 'groundPivot': [90, 300],
              'worldGround': [70, 590]},
    'boom': {'file': 'assets/props/gate_boom_swing.png',
             'size': [142, 46], 'hingePinPx': [9, 30],
             'reachPx': 126, 'worldHinge': [40, 632]},
    'post': {'file': 'assets/props/gate_boom_post.png',
             'size': [51, 84], 'hingePinPx': [21, 21],
             'groundPx': [25, 78], 'worldHinge': [40, 632]},
}
(ROOT / 'art/production/gate-contract-art-v1.json').write_text(json.dumps(manifest, indent=2)+'\n')

# The review is a composite at zoom 1, with a 44-world-pixel person ruler.
preview = Image.new('RGB', (960, 420), '#718b77')
for image, x, y in ((back, 50, 70), (front, 50, 70),
                    (kiosk_back, 480, 20), (kiosk_front, 480, 20),
                    (boom_frame, 690, 120), (post_frame, 690, 165)):
    thumb = image.resize((round(image.width/3), round(image.height/3)), Image.Resampling.LANCZOS)
    preview.paste(thumb, (x, y), thumb)
d = ImageDraw.Draw(preview)
d.line((378, 130, 378, 174), fill='#faf1d2', width=2)
d.text((320, 183), '44 world px', fill='#faf1d2')
d.text((50, 260), 'bridge back + front, one person-scale rail ruler', fill='#faf1d2')
d.text((480, 150), 'kiosk', fill='#faf1d2')
d.text((690, 250), 'boom + fixed hinge post', fill='#faf1d2')
preview.save(ROOT / 'art/review/gate-contract-art-v1-contact.png')
print(json.dumps(manifest, indent=2))
