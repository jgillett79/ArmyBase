#!/usr/bin/env python3
"""Export individually checked prop cutouts from the two authored study sheets."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'props'
OUT.mkdir(parents=True, exist_ok=True)
SPECS = [
  ('structures', 'fence', (0,0,570,512), 72),
  ('structures', 'fence_post', (570,0,1020,512), 20),
  ('structures', 'lamp', (1020,0,1536,512), 36),
  ('landscape', 'noticeboard', (0,0,540,512), 52),
  ('landscape', 'signpost', (540,0,1030,512), 42),
  ('landscape', 'grass_flower', (1030,0,1536,512), 44),
  ('landscape', 'rocks_granite', (0,512,540,1024), 66),
  ('landscape', 'rock_moss', (540,512,1030,1024), 54),
  ('landscape', 'utility_vehicle', (1030,512,1536,1024), 96),
]
SOURCES = {
 'structures': ROOT / 'art/concepts/props-structures-study.webp',
 'landscape': ROOT / 'art/concepts/props-landscape-study.webp',
}
assets=[]
for sheet, name, bounds, target_w in SPECS:
 image=Image.open(SOURCES[sheet]).convert('RGBA').crop(bounds)
 mask=image.getchannel('A').point(lambda a: 255 if a > 16 else 0)
 bbox=mask.getbbox()
 assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<image.width and bbox[3]<image.height, name
 image=image.crop(bbox)
 width=target_w
 height=round(image.height*width/image.width)
 image=image.resize((width,height),Image.Resampling.LANCZOS)
 # Study alpha is mostly 250-254, which looks translucent on terrain.
 alpha=image.getchannel('A').point(lambda a:0 if a<=16 else (255 if a>=224 else a))
 image.putalpha(alpha)
 canvas=Image.new('RGBA',(width+8,height+8),(0,0,0,0))
 canvas.alpha_composite(image,(4,4))
 dest=OUT/f'scene_{name}.png';canvas.save(dest,optimize=True)
 assets.append({'id':name,'path':str(dest.relative_to(ROOT)),'size':list(canvas.size),'pivot':[canvas.width//2,canvas.height-4],'source':str(SOURCES[sheet].relative_to(ROOT))})
 with Image.open(dest) as verify:
  assert verify.size==canvas.size and verify.getchannel('A').getextrema()==(0,255), name
print(json.dumps(assets,indent=2))
(ROOT/'art/production/scene-props.json').write_text(json.dumps({'version':1,'status':'static production cutouts, placement pending','assets':assets},indent=2)+'\n')
