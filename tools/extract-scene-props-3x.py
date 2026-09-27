#!/usr/bin/env python3
"""Export the nine provisional scene props at three art pixels/world pixel."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
sources={'structures':'props-structures-study.webp','landscape':'props-landscape-study.webp'}
specs=[
 ('structures','fence',(0,0,570,512),72),
 ('structures','fence_post',(570,0,1020,512),20),
 ('structures','lamp',(1020,0,1536,512),36),
 ('landscape','noticeboard',(0,0,540,512),52),
 ('landscape','signpost',(540,0,1030,512),42),
 ('landscape','grass_flower',(1030,0,1536,512),44),
 ('landscape','rocks_granite',(0,512,540,1024),66),
 ('landscape','rock_moss',(540,512,1030,1024),54),
 ('landscape','utility_vehicle',(1030,512,1536,1024),96),
]
assets=[]
preview=Image.new('RGB',(900,500),'#718b77')
draw=ImageDraw.Draw(preview)
for index,(sheet,name,cell,width_world) in enumerate(specs):
    source=ROOT/'art/concepts'/sources[sheet]
    image=Image.open(source).convert('RGBA').crop(cell)
    bounds=image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
    assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<image.width and bounds[3]<image.height,name
    image=image.crop(bounds)
    width=width_world*3
    height=round(image.height*width/image.width)
    image=image.resize((width,height),Image.Resampling.LANCZOS)
    # Transparent holes must stay transparent, especially between fence rails.
    # Remove low-alpha webp fringes, preserve the narrow anti-aliased outline.
    alpha=image.getchannel('A').point(lambda a:0 if a<=28 else 255 if a>=224 else a)
    image.putalpha(alpha)
    output=Image.new('RGBA',(width+24,height+24),(0,0,0,0))
    output.alpha_composite(image,(12,12))
    path=ROOT/'assets/props'/f'scene_{name}_3x.png'
    output.save(path,optimize=True)
    pivot=[output.width//2,output.height-12]
    assets.append({'id':name,'path':str(path.relative_to(ROOT)),
                   'source':str(source.relative_to(ROOT)),
                   'size':list(output.size),'pivot':pivot,
                   'worldSize':[output.width/3,output.height/3],
                   'status':'prepared; existing placements still use 1x files'})
    thumb=output.resize((round(output.width/3),round(output.height/3)),Image.Resampling.LANCZOS)
    col=index%3;row=index//3;x=20+col*300;y=10+row*165
    preview.paste(thumb,(x,y),thumb)
    draw.text((x,y+130),name,fill='#fff8d5')
(ROOT/'art/production/scene-props-3x.json').write_text(json.dumps({
 'density':3,'version':1,'assets':assets},indent=2)+'\n')
preview.save(ROOT/'art/review/scene-props-3x-contact.png')
print(json.dumps([(a['id'],a['size'],a['pivot']) for a in assets]))
