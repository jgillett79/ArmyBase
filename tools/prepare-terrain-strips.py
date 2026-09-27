#!/usr/bin/env python3
"""Make truly seamless 3px/world horizontal terrain edge strips."""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'art/production/source'
DEST=ROOT/'assets/terrain'
SPECS=(('shore_edge','terrain-shore-v1.webp',.375),
       ('foam_rock_drop','terrain-foam-rock-v1.webp',.375),
       ('cliff_face','terrain-cliff-v1.webp',.30))
entries=[]
strips={}
for name,filename,scale in SPECS:
    raw=Image.open(SOURCE/filename).convert('RGBA')
    bounds=raw.getchannel('A').point(lambda a:255 if a>60 else 0).getbbox()
    assert bounds and raw.width>=1800
    # Crop one 1024px source section and blend its outer 16px in pairs.
    # This gives equal left/right boundary pixels without mirrored motifs.
    cy0=max(0,bounds[1]-5);cy1=min(raw.height,bounds[3]+5)
    sample=raw.crop((574,cy0,1598,cy1))
    body=sample.resize((384,round(sample.height*scale)),Image.Resampling.LANCZOS)
    original=body.copy();pixels=body.load();prev=original.load()
    for j in range(16):
        t=j/16
        for y in range(body.height):
            left=prev[j,y];right=prev[383-j,y]
            mid=tuple(round((a+b)/2) for a,b in zip(left,right))
            pixels[j,y]=tuple(round(m*(1-t)+v*t) for m,v in zip(mid,left))
            pixels[383-j,y]=tuple(round(m*(1-t)+v*t) for m,v in zip(mid,right))
    output=Image.new('RGBA',(384,body.height+24),(0,0,0,0))
    output.alpha_composite(body,(0,12))
    # ImageGen leaves tiny bright red fringe at some rock alpha boundaries.
    pixels=output.load()
    for y in range(output.height):
        for x in range(output.width):
            r,g,b,a=pixels[x,y]
            if a<=22 or (name=='cliff_face' and r>130 and r>g*1.7 and r>b*1.45):
                pixels[x,y]=(0,0,0,0)
            elif a>=224:
                pixels[x,y]=(r,g,b,255)
    filename=f'{name}_3x.png'
    output.save(DEST/filename,optimize=True)
    for row in range(output.height):
        assert output.getpixel((0,row))==output.getpixel((383,row)),(name,row)
    strips[name]=output
    edge={'shore_edge':output.height-28,
          'foam_rock_drop':output.height//2,
          'cliff_face':12}[name]
    entries.append({'id':name,'file':f'assets/terrain/{filename}',
                    'size':list(output.size),'edgeRowPx':edge,
                    'density':3,'horizontallySeamless':True,
                    'status':'prepared; route-fitting screenshot approval pending'})

# Two bent shoreline end treatments. They are intentionally separate from
# the long straight tiles; the game can rotate/mirror for polygon corners.
shore=strips['shore_edge'];h=shore.height
for direction in ('west_to_south','east_to_south'):
    corner=Image.new('RGBA',(256,256),(0,0,0,0))
    horizontal=shore.crop((0,0,192,h))
    vertical=horizontal.transpose(Image.Transpose.ROTATE_270)
    # Both legs meet at (128,128); trim to remove the unintended far legs.
    corner.alpha_composite(horizontal.crop((0,0,128,h)),(0,128-h//2))
    lower=vertical.crop((0,0,vertical.width,128))
    corner.alpha_composite(lower,(128-vertical.width//2,128))
    if direction=='east_to_south':
        corner=corner.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    name=f'shore_corner_{direction}_3x.png';corner.save(DEST/name,optimize=True)
    entries.append({'id':direction,'file':f'assets/terrain/{name}',
                    'size':[256,256],'cornerPointPx':[128,128],
                    'density':3,'status':'prepared corner study; route-fitting review pending'})

(ROOT/'art/production/terrain-strips-v1.json').write_text(json.dumps({
 'camera':'top-down oblique','density':3,
 'tileWorldLength':128,'assets':entries},indent=2)+'\n')
preview=Image.new('RGB',(800,620),'#718b77')
for i,name in enumerate(('shore_edge','foam_rock_drop','cliff_face')):
    im=strips[name]
    preview.paste(im,(12,12+i*185),im)
    preview.paste(im,(396,12+i*185),im)
preview.save(ROOT/'art/review/terrain-strips-v1-repeat.png')
print(json.dumps(entries,indent=2))
