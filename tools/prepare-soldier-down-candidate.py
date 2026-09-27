#!/usr/bin/env python3
"""Normalize the six painted down-walk poses to the Gate 0 source cell grid."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
src=Image.open(ROOT/'art/production/source/soldier-down-paintover-v1.webp').convert('RGBA')
assert src.size==(2172,724)
out=Image.new('RGBA',(1536,384),(0,0,0,0))
accent=Image.new('RGBA',out.size,(0,0,0,0))
preview=Image.new('RGB',(600,110),'#718b77')
for frame in range(6):
    section=src.crop((frame*362,0,(frame+1)*362,724))
    bbox=section.getchannel('A').point(lambda a:255 if a>80 else 0).getbbox()
    assert bbox and bbox[0]>10 and bbox[2]<350
    body=section.crop(bbox)
    body=body.resize((round(body.width*.66),round(body.height*.66)),Image.Resampling.LANCZOS)
    a=body.getchannel('A').point(lambda v:0 if v<=20 else 255 if v>=225 else v)
    body.putalpha(a)
    x=frame*256+128-body.width//2
    out.alpha_composite(body,(x,30))
    mask=Image.new('RGBA',(256,384),(0,0,0,0))
    d=ImageDraw.Draw(mask)
    # Helmet band and right shoulder patch: authoring mask for future tinting.
    d.arc((88,55,166,93),180,360,fill='white',width=5)
    d.ellipse((176,123,188,133),fill='white')
    cell_alpha=out.crop((frame*256,0,(frame+1)*256,384)).getchannel('A')
    mask.putalpha(Image.composite(mask.getchannel('A'),Image.new('L',mask.size),cell_alpha))
    accent.alpha_composite(mask,(frame*256,0))
    thumb=out.crop((frame*256,0,(frame+1)*256,384)).resize((73,110),Image.Resampling.LANCZOS)
    preview.paste(thumb,(frame*100,0),thumb)

base=ROOT/'art/rig'
out.save(base/'soldier_walk_down_painted_candidate.png',optimize=True)
accent.save(base/'soldier_walk_down_painted_candidate_accent.png',optimize=True)
preview.save(ROOT/'art/review/soldier-down-candidate-1x.png')
print('Six 256 x 384 cells, top row ~30, alternating forward foot; preview at 44-world-px scale')
