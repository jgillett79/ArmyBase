#!/usr/bin/env python3
"""Export illustrated trees at three art pixels per world pixel."""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
KIT=[
 ('conifer_0','tree-spruce-v1.webp',174,270),
 ('conifer_1','tree-wind-pine-v1.webp',184,247),
 ('conifer_2','tree-fir-v1.webp',153,276),
 ('broadleaf','tree-ash-v1.webp',184,223),
]
entries={}
review=Image.new('RGB',(820,350),'#718b77')
for index,(key,filename,width,height) in enumerate(KIT):
    source=ROOT/'art/production/source'/filename
    image=Image.open(source).convert('RGBA')
    bbox=image.getchannel('A').point(lambda v:255 if v>60 else 0).getbbox()
    assert bbox and bbox[0]>0 and bbox[2]<image.width
    image=image.crop(bbox).resize((width,height),Image.Resampling.LANCZOS)
    alpha=image.getchannel('A').point(lambda a:0 if a<=20 else 255 if a>=224 else a)
    image.putalpha(alpha)
    canvas=Image.new('RGBA',(192,288),(0,0,0,0))
    canvas.alpha_composite(image,((192-width)//2,284-height))
    path=ROOT/'assets/trees'/f'{key}.png';path.parent.mkdir(exist_ok=True)
    canvas.save(path,optimize=True)
    entries[key]={'file':str(path.relative_to(ROOT)),'size':[192,288],
                  'pivot':[96,284],'density':3,'status':'provisional',
                  'source':str(source.relative_to(ROOT))}
    thumb=canvas.resize((160,240),Image.Resampling.LANCZOS)
    review.paste(thumb,(20+index*200,20),thumb)
    from PIL import ImageDraw
    ImageDraw.Draw(review).text((20+index*200,278),key,fill='#fff8d5')
(ROOT/'art/production/tree-kit-v1.json').write_text(json.dumps({'version':1,'density':3,'assets':entries},indent=2)+'\n')
review.save(ROOT/'art/review/tree-kit-v1-game-scale.png')
print(json.dumps(entries,indent=2))
