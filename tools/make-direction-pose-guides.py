"""Make measured up/right six-frame pose guides; these are NOT game art.

No browser is required. Each 256x384 cell has a ground pivot at (128,330).
The stance boot advances 25 source px per frame, matching down-walk v3.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art' / 'rig'
OUT.mkdir(parents=True, exist_ok=True)
W, H, PIVOT, STANCE_STEP = 256, 384, (128, 330), 25
INK, BODY, LEG, BOOT, JOINT = '#1d2217', '#758146', '#b39a66', '#493522', '#f6d58d'

def stroke(d, points, width, fill, outline=INK):
    d.line(points, fill=outline, width=width+8, joint='curve')
    d.line(points, fill=fill, width=width, joint='curve')
    for x,y in (points[0], points[-1]):
        d.ellipse((x-width//2,y-width//2,x+width//2,y+width//2), fill=fill, outline=outline, width=4)

def boot(d, x, y, side=False):
    # Bottom of the boot is y; no shadow or ground mark is part of the art.
    dx = 9 if side else 0
    d.rounded_rectangle((x-16,y-25,x+16+dx,y),radius=8,fill=BOOT,outline=INK,width=5)

def frame(direction, phase):
    im=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(im)
    # Contact, compression, passing, opposite contact, compression, passing.
    phase_in_half=phase%3
    bob=[0,5,-5][phase_in_half]
    hip_y=231+bob; shoulder_y=131+bob; helmet_y=30+bob
    if direction=='up':
        cx=128
        d.line((cx+25,80,cx+31,190),fill=INK,width=12)  # slung rifle on back
        d.rounded_rectangle((cx-14,helmet_y+45,cx+14,shoulder_y+10),radius=8,fill=BODY,outline=INK,width=5)
        d.rounded_rectangle((cx-38,shoulder_y,cx+38,hip_y),radius=17,fill=BODY,outline=INK,width=5)
        d.rounded_rectangle((cx-26,shoulder_y+23,cx+26,shoulder_y+66),radius=8,fill='#83734a',outline=INK,width=4)
        d.ellipse((cx-34,helmet_y,cx+34,helmet_y+53),fill='#67743b',outline=INK,width=6)
        # Continuous stance foot shifts 25 px per frame in screen depth;
        # the other foot swings up ~60 px at the passing pose.
        stance_right=phase<3
        track=37-phase_in_half*STANCE_STEP
        swing=-37+phase_in_half*STANCE_STEP
        for right in (True,False):
            planted=right==stance_right
            x=cx+(19 if right else -19)
            y=PIVOT[1]+(track if planted else swing)- (0 if planted else [0,20,61][phase_in_half])
            knee=(x,hip_y+52+(-4 if planted else 11))
            stroke(d,[(x,hip_y),knee,(x,y-17)],21,LEG)
            boot(d,x,y)
        for x in (cx-47,cx+47):stroke(d,[(x,shoulder_y+12),(x,shoulder_y+59),(x,hip_y-9)],20,BODY)
        feet={'right': {'x':147,'y':PIVOT[1]+track if stance_right else PIVOT[1]+swing-[0,20,61][phase_in_half],'planted':stance_right},'left': {'x':109,'y':PIVOT[1]+swing-[0,20,61][phase_in_half] if stance_right else PIVOT[1]+track,'planted':not stance_right}}
    else:
        # Right-facing oblique: a narrow torso, visible helmet top and muzzle
        # pointing to screen-right; lateral world distance drives x foot track.
        cx=128
        d.line((cx-18,82,cx-12,188),fill=INK,width=11)
        d.rounded_rectangle((cx-14,helmet_y+45,cx+14,shoulder_y+10),radius=8,fill=BODY,outline=INK,width=5)
        d.rounded_rectangle((cx-29,shoulder_y,cx+30,hip_y),radius=17,fill=BODY,outline=INK,width=5)
        d.ellipse((cx-34,helmet_y,cx+30,helmet_y+53),fill='#67743b',outline=INK,width=6)
        d.line((cx+13,helmet_y+39,cx+42,helmet_y+41),fill=INK,width=8)
        stance_right=phase<3
        track=37-phase_in_half*STANCE_STEP
        swing=-37+phase_in_half*STANCE_STEP
        feet={}
        for right in (True,False):
            planted=right==stance_right
            x=cx+(track if planted else swing)
            y=PIVOT[1]+(8 if right else -8)-(0 if planted else [0,20,60][phase_in_half])
            stroke(d,[(cx+(10 if right else -10),hip_y),(cx+(x-cx)//2,hip_y+58),(x,y-17)],21,LEG)
            boot(d,x,y,True)
            feet['right' if right else 'left']={'x':x,'y':y,'planted':planted}
        stroke(d,[(cx-26,shoulder_y+12),(cx-38,shoulder_y+64),(cx-32,hip_y-3)],19,BODY)
        stroke(d,[(cx+22,shoulder_y+12),(cx+35,shoulder_y+67),(cx+29,hip_y-3)],19,BODY)
    return im,feet

def main():
    for direction in ('up','right'):
        sheet=Image.new('RGBA',(W*6,H)); tracks=[]
        for i in range(6):
            im,feet=frame(direction,i);sheet.alpha_composite(im,(i*W,0));tracks.append(feet)
        base=OUT/f'soldier_walk_{direction}_pose_guide'
        sheet.save(str(base)+'.png')
        (base.with_suffix('.json')).write_text(json.dumps({'status':'pose guide only; paint with the approved soldier master','cell':[W,H],'pivot':PIVOT,'strideWorld':22,'footTrack':tracks},indent=2)+'\n')
        print(base.name)

if __name__=='__main__':main()
