"""Measure a walk study on its EVALUATED (deformed) meshes, frame by frame.
Run: blender --background WALK_STUDY/soldier_walk_study.blend --python-exit-code 1
 --python tools/blender/inspect_walk_study.py -- --report WALK_STUDY/motion-report.json
 --output rig-inspection.json

Checks (Claude, 2 Oct): boot/sole slide while planted in the virtual
travelling frame, sole height/tilt, support-leg knee angle, wrist swing,
cargo-pocket stand-off from the trousers, harness distance from the chest
(signed: negative = inside), chest/back distortion (how far each torso
vertex is from where the spine or pelvis alone would carry it),
and the stop/idle feet. The script only reads; it never saves the .blend.
"""
import argparse, json, math, sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--report',required=True)
p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
report=json.load(open(a.report))
travel={row['frame']:row['virtualTravelMetres'] for row in report['frames']}
scene=bpy.context.scene
rig=bpy.data.objects['Soldier motion skeleton']

def world_verts(name,dg):
    obj=bpy.data.objects[name].evaluated_get(dg);m=obj.matrix_world
    return [m@v.co for v in obj.data.vertices]

def bvh(name,dg):
    obj=bpy.data.objects[name].evaluated_get(dg)
    return BVHTree.FromObject(obj,dg)

def bone_point(name,tail=False):
    b=rig.pose.bones[name];return rig.matrix_world@(b.tail if tail else b.head)

def stats(xs):
    return {'min':round(min(xs),4),'max':round(max(xs),4),'mean':round(sum(xs)/len(xs),4)}

frames=[]
for frame in range(1,73):
    scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
    row={'frame':frame,'travel':travel[frame]}
    for side in 'RL':
        sole=world_verts('Sole_'+side,dg)
        bottom=[v for v in sole if v.z<min(s.z for s in sole)+.004]
        heel=max(sole,key=lambda v:v.y);toe=min(sole,key=lambda v:v.y)
        c=sum(sole,Vector())/len(sole)
        upper=world_verts('Boot shaped upper_'+side,dg)
        hip,knee,ankle=bone_point('thigh.'+side),bone_point('shin.'+side),bone_point('shin.'+side,True)
        row[side]={
            # Soldier faces -Y; travelling forward moves the body by -travel in Y,
            # so a truly planted sole keeps y - travel constant.
            'soleWorldY':round(c.y-travel[frame],4),'soleX':round(c.x,4),
            'soleMinZ':round(min(v.z for v in sole),4),
            'soleBottomZ':round(sum(v.z for v in bottom)/len(bottom),4),
            'toeMinusHeelZ':round(min(v.z for v in sole if v.y<toe.y+.02)-min(v.z for v in sole if v.y>heel.y-.02),4),
            'upperBottomMinusSoleTop':round(min(v.z for v in upper)-max(v.z for v in sole),4),
            'kneeAngle':round(math.degrees((hip-knee).angle(ankle-knee)),1),
            'wristFromShoulderY':round((bone_point('hand.'+side)-bone_point('upper_arm.'+side)).y,4),
            'upperArmLen':round((bone_point('forearm.'+side)-bone_point('upper_arm.'+side)).length,4),
            'forearmLen':round((bone_point('hand.'+side)-bone_point('forearm.'+side)).length,4)}
    trousers=bvh('Trousers continuous surface',dg)
    for side in 'RL':
        d=[trousers.find_nearest(v)[3] for v in world_verts('Cargo pocket_'+side,dg)]
        row[side]['pocketToTrousers']=stats(d)
    chest=bvh('Uniform continuous surface',dg)
    harness=[chest.find_nearest(v)[3] for n in ('Harness_-1','Harness_1') for v in world_verts(n,dg)]
    row['harnessToChest']=stats(harness)
    signed=[]
    for n in ('Harness_-1','Harness_1'):
        for v in world_verts(n,dg):
            loc,normal,_,d=chest.find_nearest(v);signed.append(d if (v-loc).dot(normal)>=0 else -d)
    row['harnessSigned']=stats(signed)
    uni=bpy.data.objects['Uniform continuous surface'];ev=uni.evaluated_get(dg)
    deform={b:rig.matrix_world@rig.pose.bones[b].matrix@rig.data.bones[b].matrix_local.inverted()@rig.matrix_world.inverted() for b in ('spine','pelvis')}
    drift=[]
    for v,e in zip(uni.data.vertices,ev.data.vertices):
        r=uni.matrix_world@v.co
        if abs(r.x)<.15 and 1.0<r.z<1.5:
            p=ev.matrix_world@e.co;drift.append(min((p-deform[b]@r).length for b in deform))
    row['chestDrift']=stats(drift)
    # Harness kinks: largest angle between consecutive centreline segments.
    turn=0
    for n in ('Harness_-1','Harness_1'):
        vs=world_verts(n,dg);k=len(vs)//4
        cl=[sum(vs[4*i:4*i+4],Vector())/4 for i in range(k)]
        for i in range(1,k-1):
            s0,s1=cl[i]-cl[i-1],cl[i+1]-cl[i]
            if s0.length>1e-6 and s1.length>1e-6: turn=max(turn,math.degrees(s0.angle(s1)))
    row['harnessMaxTurnDeg']=round(turn,1)
    frames.append(row)

planted={r['frame']:r for r in report['frames']}
def slide(side,lo,hi):
    """Spans of consecutive planted frames for one leg in [lo,hi], with the
    sole's travel-frame Y and X drift across each span."""
    spans=[];cur=[]
    for f in range(lo,hi+1):
        if planted[f][side]['planted']: cur.append(f)
        elif cur: spans.append(cur);cur=[]
    if cur: spans.append(cur)
    out=[]
    for s in spans:
        ys=[frames[f-1][side]['soleWorldY'] for f in s];xs=[frames[f-1][side]['soleX'] for f in s]
        zs=[frames[f-1][side]['soleBottomZ'] for f in s];tilt=[abs(frames[f-1][side]['toeMinusHeelZ']) for f in s]
        out.append({'frames':[s[0],s[-1]],'slideY':round(max(ys)-min(ys),4),'slideX':round(max(xs)-min(xs),4),
                    'bottomZ':stats(zs),'maxToeHeelTilt':round(max(tilt),4)})
    return out

walk=range(1,49)
summary={
    'plantedSlideWalk':{s:slide(s,1,48) for s in 'RL'},
    'plantedSlideStop':{s:slide(s,49,60) for s in 'RL'},
    'idleDrift':{s:{'y':round(max(frames[f-1][s]['soleWorldY'] for f in range(61,73))-min(frames[f-1][s]['soleWorldY'] for f in range(61,73)),4)} for s in 'RL'},
    'stopEndFeet':{s:{'y':frames[59][s]['soleWorldY'],'x':frames[59][s]['soleX'],'z':frames[59][s]['soleBottomZ']} for s in 'RL'},
    'idleFeet':{s:{'y':frames[60][s]['soleWorldY'],'x':frames[60][s]['soleX'],'z':frames[60][s]['soleBottomZ']} for s in 'RL'},
    'stanceKnee':stats([frames[f-1][s]['kneeAngle'] for f in walk for s in 'RL' if planted[f][s]['planted']]),
    'swingKnee':stats([frames[f-1][s]['kneeAngle'] for f in walk for s in 'RL' if not planted[f][s]['planted']]),
    'wristSwingY':{s:stats([frames[f-1][s]['wristFromShoulderY'] for f in walk]) for s in 'RL'},
    'armLengths':{s:{'upper':stats([r[s]['upperArmLen'] for r in frames]),'fore':stats([r[s]['forearmLen'] for r in frames])} for s in 'RL'},
    'pocketToTrousersMax':{s:max(r[s]['pocketToTrousers']['max'] for r in frames) for s in 'RL'},
    'pocketToTrousersMaxIdle':{s:frames[60][s]['pocketToTrousers']['max'] for s in 'RL'},
    'harnessToChest':stats([r['harnessToChest']['max'] for r in frames]),
    'harnessToChestMin':min(r['harnessToChest']['min'] for r in frames),
    'harnessSignedMin':min(r['harnessSigned']['min'] for r in frames),
    'chestDriftMax':max(r['chestDrift']['max'] for r in frames),
    'armExtremes':{f:{'harnessMax':frames[f-1]['harnessToChest']['max'],'harnessSignedMin':frames[f-1]['harnessSigned']['min'],'chestDriftMax':frames[f-1]['chestDrift']['max']} for f in (1,7,13,19)},
    'harnessMaxTurnDeg':max(r['harnessMaxTurnDeg'] for r in frames),
    'bootSoleGap':stats([r[s]['upperBottomMinusSoleTop'] for r in frames for s in 'RL']),
    'soleMinZ':min(r[s]['soleMinZ'] for r in frames for s in 'RL'),
}
json.dump({'source':a.report,'summary':summary,'frames':frames},open(a.output,'w'),indent=2)
print('SUMMARY',json.dumps(summary,indent=1))
