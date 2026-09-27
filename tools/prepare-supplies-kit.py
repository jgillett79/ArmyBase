#!/usr/bin/env python3
"""Export the isolated supply props at twice the default world resolution."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
KIT = (
    ('supply_wood_crates', 'supply-wood-crates-v1.webp', 64),
    ('supply_canvas_boxes', 'supply-canvas-boxes-v1.webp', 68),
)
entries = []
preview = Image.new('RGB', (390, 200), '#71856e')
draw = ImageDraw.Draw(preview)
for index, (name, filename, world_width) in enumerate(KIT):
    source = ROOT / 'art/production/source' / filename
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    bounds = alpha.point(lambda value: 255 if value > 80 else 0).getbbox()
    assert bounds
    image = image.crop(bounds)
    width = 2 * world_width
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    alpha = image.getchannel('A').point(lambda value: 0 if value <= 20 else 255 if value >= 225 else value)
    image.putalpha(alpha)
    result = Image.new('RGBA', (width + 8, height + 8), (0, 0, 0, 0))
    result.alpha_composite(image, (4, 4))
    path = ROOT / 'assets/props' / f'{name}.png'
    result.save(path, optimize=True)
    pivot = [result.width // 2, result.height - 4]
    entries.append({
        'id': name, 'source': str(source.relative_to(ROOT)),
        'path': str(path.relative_to(ROOT)), 'pixelSize': list(result.size),
        'defaultWorldSize': [result.width / 2, result.height / 2],
        'pivotPx': pivot, 'role': 'ground',
        'status': 'prepared; game placement and screenshot approval pending',
    })
    thumb = result.resize((result.width // 2, result.height // 2), Image.Resampling.LANCZOS)
    preview.paste(thumb, (35 + index * 190, 30), thumb)
    draw.text((30 + index * 190, 170), name, fill='#fff8d5')

(ROOT / 'art/production/supplies-kit-v1.json').write_text(json.dumps({
    'version': 1, 'camera': 'three-quarter south', 'light': 'upper-left',
    'density': '2 image pixels per world pixel at default zoom', 'assets': entries,
}, indent=2) + '\n')
preview.save(ROOT / 'art/review/supplies-kit-v1-contact.png')
print(json.dumps(entries, indent=2))
