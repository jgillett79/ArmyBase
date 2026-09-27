#!/usr/bin/env python3
"""Two restrained breathing frames from the painted soldier down master."""
import json
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
source=Image.open(ROOT/'art/rig/soldier_walk_down_painted_v3.png').convert('RGBA')
# The neutral passing stance has the consistent face, helmet, webbing and rifle.
neutral=np.asarray(source.crop((2*256,0,3*256,384)),dtype=np.float32)/255
yy,xx=np.mgrid[0:384,0:256].astype(float)
wy=np.clip((yy-225)/100,0,1)
# Plant both boots around row 330, making a relaxed wide stance. No movement
# above the hip line, so the helmet and shoulder accent remain registered.
right=np.clip((xx-115)/24,0,1)
down=wy*(9*(1-right)+17*right)
sx=xx-12*right*wy
sy=yy-down

def warp(image,sx,sy):
    premult=image.copy();premult[:,:,:3]*=premult[:,:,3:4]
    out=np.stack([map_coordinates(premult[:,:,c],[sy,sx],order=1,mode='constant',cval=0) for c in range(4)],axis=2)
    a=out[:,:,3]
    rgb=np.divide(out[:,:,:3],a[:,:,None],out=np.zeros_like(out[:,:,:3]),where=a[:,:,None]>1/255)
    return np.dstack((rgb,a))

idle=warp(neutral,sx,sy)
# Frame two expands only the jacket torso by ~1% while hands, feet and head
# stay still. Feathered weight removes a hard line at the waist/collar.
chest=np.exp(-((yy-168)/48)**4)
sx2=128+(xx-128)/(1+.012*chest)
idle2=warp(idle,sx2,yy)

sheet=Image.new('RGBA',(512,384),(0,0,0,0))
for n,im in enumerate((idle,idle2)):
    sheet.alpha_composite(Image.fromarray(np.uint8(np.clip(im*255,0,255)),'RGBA'),(n*256,0))
path=ROOT/'art/rig/soldier_idle_down_painted_candidate.png'
sheet.save(path,optimize=True)

source_mask=Image.open(ROOT/'art/rig/soldier_walk_down_painted_v3_accent.png').convert('RGBA')
mask=source_mask.crop((2*256,0,3*256,384))
acc=Image.new('RGBA',(512,384),(0,0,0,0))
acc.alpha_composite(mask,(0,0));acc.alpha_composite(mask,(256,0))
acc.save(ROOT/'art/rig/soldier_idle_down_painted_candidate_accent.png',optimize=True)

track=[]
for n in range(2):
    a=np.asarray(sheet.crop((n*256,0,(n+1)*256,384)).getchannel('A'))
    feet=[]
    for start,stop in ((0,128),(128,256)):
        ys=np.flatnonzero((a[:,start:stop]>128).any(axis=1));feet.append(int(ys[-1]))
    track.append(feet)
(ROOT/'art/rig/soldier_idle_down_painted_candidate.json').write_text(json.dumps({
    'cell':[256,384],'pivot':[128,330],'frames':2,
    'feetLowestRow':track,
    'source':'art/rig/soldier_idle_down_painted_candidate.png',
    'accent':'art/rig/soldier_idle_down_painted_candidate_accent.png',
    'status':'candidate; in-game continuity review pending'},indent=2)+'\n')
preview=Image.new('RGB',(240,140),'#718b77')
for n in range(2):
    im=sheet.crop((n*256,0,(n+1)*256,384)).resize((93,140),Image.Resampling.LANCZOS)
    preview.paste(im,(n*120,0),im)
preview.save(ROOT/'art/review/soldier-idle-down-1x.png')
print('Idle feet lowest opaque rows [left,right]:',track)
