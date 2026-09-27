#!/usr/bin/env python3
"""Subtle foot-path corrections to the reviewed painted down walk."""
import json
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
old=Image.open(ROOT/'art/rig/soldier_walk_down_painted_candidate.png').convert('RGBA')
assert old.size==(1536,384)
out=Image.new('RGBA',old.size,(0,0,0,0))
yy,xx=np.mgrid[0:384,0:256].astype(float)
# Index: source boot lows are 370.5, 346.5, 324.5 | 370.5,345.5,327.5.
# Bring each planted foot to 370.5,345.5,320.5, then restart on the other leg.
# Moving the right planted boot away from the centre split also prevents the
# half-cell pixel probe mistaking that boot for a trailing left foot.
changes=((0,0,'left'),(0,1,'left'),(0,4,'left'),
         (8,0,'right'),(12,0,'right'),(10,8,'right'))
for frame,(dx,dy,side) in enumerate(changes):
    cell=np.asarray(old.crop((frame*256,0,(frame+1)*256,384)),dtype=np.float32)/255
    wy=np.clip((yy-224)/105,0,1)
    wx=np.clip((xx-110)/27,0,1) if side=='right' else np.clip((146-xx)/27,0,1)
    weight=wx*wy
    sx=xx-dx*weight
    sy=yy+dy*weight
    # Interpolate premultiplied RGB to avoid dark fringes at transparent edges.
    premult=cell.copy();premult[:,:,:3]*=premult[:,:,3:4]
    sampled=np.stack([map_coordinates(premult[:,:,c],[sy,sx],order=1,mode='constant',cval=0) for c in range(4)],axis=2)
    a=sampled[:,:,3]
    rgb=np.divide(sampled[:,:,:3],a[:,:,None],out=np.zeros_like(sampled[:,:,:3]),where=a[:,:,None]>1/255)
    result=np.dstack((rgb,a))
    out.alpha_composite(Image.fromarray(np.uint8(np.clip(result*255,0,255)).copy(),'RGBA'),(frame*256,0))

path=ROOT/'art/rig/soldier_walk_down_painted_v3.png'
out.save(path,optimize=True)
# The unchanged helmet/shoulder accent mask remains aligned: warps begin below y224.
accent=Image.open(ROOT/'art/rig/soldier_walk_down_painted_candidate_accent.png')
accent.save(ROOT/'art/rig/soldier_walk_down_painted_v3_accent.png',optimize=True)

track=[]
for frame in range(6):
    a=np.asarray(out.crop((frame*256,0,(frame+1)*256,384)).getchannel('A'))
    feet={}
    for name,start,stop in (('left',0,128),('right',128,256)):
        rows=np.flatnonzero((a[:,start:stop]>128).any(axis=1))
        y=int(rows[-1]);xs=np.flatnonzero(a[y,start:stop]>128)+start
        feet[name]={'x':round(float(xs.mean()),1),'y':y+.5}
    planted=max(feet,key=lambda k:feet[k]['y'])
    for f in feet:feet[f]['planted']=f==planted
    track.append(feet)
data={'cell':[256,384],'pivot':[128,330],'strideWorld':22,'pxPerWorld':300/44,
      'frames':6,'measured':True,'source':'art/rig/soldier_walk_down_painted_v3.png',
      'helmetTop':[30]*6,'track':track,
      'accent':{'file':'art/rig/soldier_walk_down_painted_v3_accent.png'}}
(ROOT/'art/rig/soldier_walk_down_painted_v3.json').write_text(json.dumps(data,indent=1)+'\n')
preview=Image.new('RGB',(600,110),'#718b77')
for n in range(6):
    thumb=out.crop((n*256,0,(n+1)*256,384)).resize((73,110),Image.Resampling.LANCZOS)
    preview.paste(thumb,(n*100,0),thumb)
preview.save(ROOT/'art/review/soldier-down-v3-1x.png')
print(json.dumps(track,indent=1))
