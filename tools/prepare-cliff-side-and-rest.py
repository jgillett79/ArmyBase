#!/usr/bin/env python3
"""Export side-facing cliff kit and the gate's fixed receiving fork."""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'art/production/source'
TERRAIN=ROOT/'assets/terrain'

def load(name):return Image.open(SRC/name).convert('RGBA')

def clean(image,red=False):
    p=image.load()
    for y in range(image.height):
        for x in range(image.width):
            r,g,b,a=p[x,y]
            if a<=22 or (red and r>130 and r>g*1.7 and r>b*1.45):p[x,y]=(0,0,0,0)
            elif a>=224:p[x,y]=(r,g,b,255)
    return image

raw=load('terrain-cliff-side-v1.webp')
sample=raw.crop((574,132,1598,610))
body=sample.resize((384,159),Image.Resampling.LANCZOS)
# The paired 16px edge blend keeps end columns equal while preserving
# asymmetric rock features over the central 352 pixels.
orig=body.copy();p=body.load();o=orig.load()
for j in range(16):
    t=j/16
    for y in range(body.height):
        a=o[j,y];b=o[383-j,y]
        mid=tuple(round((v+w)/2) for v,w in zip(a,b))
        p[j,y]=tuple(round(m*(1-t)+v*t) for m,v in zip(mid,a))
        p[383-j,y]=tuple(round(m*(1-t)+v*t) for m,v in zip(mid,b))
strip=Image.new('RGBA',(384,183),(0,0,0,0));strip.alpha_composite(body,(0,12))
clean(strip,red=True)
assert all(strip.getpixel((0,y))==strip.getpixel((383,y)) for y in range(strip.height))
strip.save(TERRAIN/'cliff_side_face_3x.png',optimize=True)

for hand in ('left','right'):
    raw=load('terrain-cliff-side-cap-'+hand+'-v1.webp')
    bbox=raw.getchannel('A').point(lambda a:255 if a>80 else 0).getbbox()
    rock=raw.crop(bbox).resize((140,159),Image.Resampling.LANCZOS)
    cap=Image.new('RGBA',(152,183),(0,0,0,0))
    cap.alpha_composite(rock,(6,12));clean(cap,red=True)
    cap.save(TERRAIN/f'cliff_side_cap_{hand}_3x.png',optimize=True)

raw=load('gate-boom-rest-v1.webp')
bbox=raw.getchannel('A').point(lambda a:255 if a>70 else 0).getbbox()
fork=raw.crop(bbox).resize((42,66),Image.Resampling.LANCZOS)
post=Image.new('RGBA',(50,74),(0,0,0,0));post.alpha_composite(fork,(4,4));clean(post)
post.save(ROOT/'assets/props/gate_boom_rest_post.png',optimize=True)

data={'density':3,'camera':'top-down oblique','assets':[
 {'id':'side_face','file':'assets/terrain/cliff_side_face_3x.png',
  'size':[384,183],'tileWorldLength':128,'edgeRowPx':12,
  'horizontallySeamless':True,'status':'trial; map contour review pending'},
 {'id':'left_cap','file':'assets/terrain/cliff_side_cap_left_3x.png',
  'size':[152,183],'edgeRowPx':12,'joinEdge':'right',
  'overlapPx':15,'status':'trial; join review pending'},
 {'id':'right_cap','file':'assets/terrain/cliff_side_cap_right_3x.png',
  'size':[152,183],'edgeRowPx':12,'joinEdge':'left',
  'overlapPx':15,'status':'trial; join review pending'},
 {'id':'boom_rest','file':'assets/props/gate_boom_rest_post.png',
  'size':[50,74],'groundPivotPx':[25,70],
  'forkSeatPx':[25,20], 'proposedWorldGround':[39,588],
  'status':'prepared; closed-tip placement check pending'}]}
(ROOT/'art/production/cliff-side-and-rest-v1.json').write_text(json.dumps(data,indent=2)+'\n')

preview=Image.new('RGB',(1090,270),'#718b77')
left=Image.open(TERRAIN/'cliff_side_cap_left_3x.png')
right=Image.open(TERRAIN/'cliff_side_cap_right_3x.png')
preview.paste(strip,(136,12),strip);preview.paste(strip,(520,12),strip)
preview.paste(left,(0,12),left);preview.paste(right,(889,12),right)
preview.paste(post,(1012,174),post)
preview.save(ROOT/'art/review/cliff-side-and-rest-v1.png')
print(json.dumps(data,indent=2))
