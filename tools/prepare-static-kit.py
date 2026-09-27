#!/usr/bin/env python3
"""Export four isolated game-scale sprites from reviewed ImageGen source art."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
KIT=[
 ('range_target','range-target-v1.webp','height',62,'ground',None),
 ('lift_barbell','lift-barbell-v1.webp','width',82,'centre',None),
 ('rec_bench','rec-bench-v1.webp','width',86,'ground',None),
 ('gate_boom','gate-boom-v1.webp','width',88,'hinge',(78,548)),
]
entries=[]
for key,filename,axis,size,anchor,source_hinge in KIT:
 source=ROOT/'art/production/source'/filename
 image=Image.open(source).convert('RGBA')
 bbox=image.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
 assert bbox is not None
 image=image.crop(bbox)
 if axis=='height':
  height=size*2;width=round(height*image.width/image.height)
 else:
  width=size*2;height=round(width*image.height/image.width)
 image=image.resize((width,height),Image.Resampling.LANCZOS)
 alpha=image.getchannel('A').point(lambda a:0 if a<=16 else 255 if a>=224 else a)
 image.putalpha(alpha)
 padded=Image.new('RGBA',(width+8,height+8),(0,0,0,0));padded.alpha_composite(image,(4,4))
 if anchor=='ground': pivot=[padded.width//2,padded.height-4]
 elif anchor=='centre': pivot=[padded.width//2,padded.height//2]
 else:
  x,y=source_hinge
  pivot=[4+round((x-bbox[0])*width/(bbox[2]-bbox[0])),4+round((y-bbox[1])*height/(bbox[3]-bbox[1]))]
 out=ROOT/'assets/props'/f'{key}.png';padded.save(out,optimize=True)
 with Image.open(out) as test:
  assert test.getchannel('A').getextrema()==(0,255) and 0<=pivot[0]<test.width and 0<=pivot[1]<test.height
 entries.append({'id':key,'source':str(source.relative_to(ROOT)),'path':str(out.relative_to(ROOT)),'pixelSize':list(padded.size),'defaultWorldSize':[round(padded.width/2,1),round(padded.height/2,1)],'pivotPx':pivot,'role':anchor,'status':'prepared; game integration and screenshot approval pending'})
print(json.dumps(entries,indent=2))
(ROOT/'art/production/static-kit-v1.json').write_text(json.dumps({'version':1,'camera':'three-quarter south','light':'upper-left','density':'2 image pixels per world pixel at default zoom','assets':entries},indent=2)+'\n')
