"""First deforming skeleton test. Open a COPY of a local soldier study.
Run: blender --background soldier_study.blend --python-exit-code 1 --python
 tools/blender/build_walk_study.py -- --output NEW_DIRECTORY
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',required=True)
p.add_argument('--render-step',type=int,default=0,help='0 saves scene only; 3 renders eight loop poses per view; 1 renders every pose')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.output).expanduser().resolve()
if out.exists() and any(out.iterdir()): raise RuntimeError('Choose a new empty output directory')
if 'Uniform continuous surface' not in bpy.data.objects: raise RuntimeError('Open the soldier appearance .blend first')
out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
scene.render.use_freestyle=False
scene.render.fps=24
scene.frame_start=1
scene.frame_end=72
# Actual smoothed surface used for contact repair before adding deformation.
uniform=bpy.data.objects['Uniform continuous surface'].evaluated_get(bpy.context.evaluated_depsgraph_get())
for o in list(scene.objects):
    if o.name.startswith('Harness_'):
        for v in o.data.vertices:
            hit, point, normal, face=uniform.closest_point_on_mesh(v.co)
            if hit: v.co=point+normal*.003
    if o.name.startswith('Boot shaped upper_'):
        # Meet the sole's z=.029 top; don't translate the ankle or whole boot.
        for v in o.data.vertices:
            if v.co.z < .06: v.co.z-=.019*max(0,(.06-v.co.z)/.015)
# Bone rest landmarks: upright knees; anatomical right is negative X.
rest={'pelvis':((0,0,.96),(0,0,1.10)), 'spine':((0,0,1.10),(0,0,1.49)),
      'head':((0,0,1.49),(0,0,1.85))}
for side,sign in [('R',-1),('L',1)]:
    x=sign*.105
    rest.update({f'thigh.{side}':((x,0,.96),(x,0,.55)),
                 f'shin.{side}':((x,0,.55),(x,0,.17)),
                 f'foot.{side}':((x,0,.17),(x,-.15,.05)),
                 f'upper_arm.{side}':((sign*.20,0,1.43),(sign*.26,0,1.13)),
                 f'forearm.{side}':((sign*.26,0,1.13),(sign*.268,0,.86)),
                 f'hand.{side}':((sign*.268,0,.86),(sign*.268,0,.76))})
bpy.ops.object.select_all(action='DESELECT')
data=bpy.data.armatures.new('Soldier motion skeleton')
rig=bpy.data.objects.new('Soldier motion skeleton',data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(h,t) in rest.items():
    b=data.edit_bones.new(name);b.head=h;b.tail=t
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
# Independent deformation bones permit explicit analytic contact poses.
# This is a study rig; a production control hierarchy/IK can follow review.
def distance(point,h,t):
    h,t=Vector(h),Vector(t);d=t-h
    return (point-(h+d*max(0,min(1,(point-h).dot(d)/d.length_squared)))).length

def rigid_group(name):
    if name.startswith(('Helmet','Head','Eye','Iris','Ear','Nose','Mouth','Eyebrow','Neck')): return 'head'
    if name.startswith(('Boot','Sole','Lace')): return 'foot.'+('R' if name.endswith('_R') else 'L')
    if name.startswith(('Hand','Thumb','Cuff')): return 'hand.'+('R' if name.endswith('_R') else 'L')
    if name.startswith('Cargo'): return 'thigh.'+('R' if name.endswith('_R') else 'L')
    if name.startswith(('Belt','Buckle')): return 'pelvis'
    if name.startswith('Shoulder'): return 'upper_arm.L'
    if name.startswith(('Harness','Chest','Tunic')): return 'spine'

for obj in list(scene.objects):
    if obj.type not in ('MESH','CURVE') or obj==rig: continue
    if obj.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    # Apply study smoothing first; weights belong to the final evaluated mesh.
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    groups={n:obj.vertex_groups.new(name=n) for n in rest}
    fixed=rigid_group(obj.name)
    for vertex in obj.data.vertices:
        point=obj.matrix_world@vertex.co
        if fixed: groups[fixed].add([vertex.index],1,'REPLACE');continue
        names=['pelvis','spine','head']
        if obj.name.startswith('Trousers'): names=['pelvis','thigh.R','thigh.L','shin.R','shin.L']
        elif obj.name.startswith('Uniform'): names=['pelvis','spine','upper_arm.R','upper_arm.L','forearm.R','forearm.L']
        close=sorted((distance(point,*rest[n]),n) for n in names)[:2]
        w=[1/max(.015,d)**4 for d,n in close];total=sum(w)
        for (_,n),weight in zip(close,w): groups[n].add([vertex.index],weight/total,'REPLACE')
    modifier=obj.modifiers.new('Soldier deformation','ARMATURE');modifier.object=rig

def foot(q):
    q=q%1
    if q<.5:return .1-.4*q,0,True
    t=(q-.5)*2
    return -.1+.2*(-t+6*t*t-4*t*t*t),.045*math.sin(math.pi*t)**2,False

def pose_bone(name,h,t):
    rotation=(Vector(t)-Vector(h)).to_track_quat('Y','Z')
    bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION'
    bone.matrix=Matrix.Translation(Vector(h))@rotation.to_matrix().to_4x4()
    for channel in ('location','rotation_quaternion','scale'): bone.keyframe_insert(data_path=channel)

contacts=[]
for frame in range(1,73):
    scene.frame_set(frame)
    phase=(frame-1)/24
    # Walk two complete cycles; ease to neutral over twelve frames, then idle.
    amount=1 if frame<=48 else max(0,1-(frame-48)/12)
    q=phase%1; sway=.008*math.sin(math.tau*q)*amount
    bob=(-.007-.008*math.cos(2*math.tau*q))*amount
    hip=.955+bob
    pose_bone('pelvis',(sway,0,hip),(sway,-.006*amount,1.10+bob))
    pose_bone('spine',(sway,-.006*amount,1.10+bob),(sway,-.012*amount,1.49+bob))
    pose_bone('head',(sway,-.012*amount,1.49+bob),(sway,-.012*amount,1.85+bob))
    for side,sign,offset in [('R',-1,0),('L',1,.5)]:
        depth,lift,planted=foot(q+offset);depth*=amount;lift*=amount
        h=Vector((sign*.105+sway,0,hip));ankle=Vector((sign*.105,-depth,.17+lift))
        delta=ankle-h;length=delta.length;upper=.41;lower=.38
        if length>upper+lower+.001: raise RuntimeError('Unreachable leg contact')
        along=(upper*upper-lower*lower+length*length)/(2*length)
        bend=math.sqrt(max(0,upper*upper-along*along))
        forward=Vector((0,-1,0));perp=(forward-delta.normalized()*forward.dot(delta.normalized())).normalized()
        knee=h+delta.normalized()*along+perp*bend
        pose_bone('thigh.'+side,h,knee);pose_bone('shin.'+side,knee,ankle)
        pose_bone('foot.'+side,ankle,ankle+Vector((0,-.15,-.12)))
        swing=-.065*math.cos(math.tau*(q+offset)) * amount
        shoulder=(sign*.20+sway,-.012*amount,1.43+bob)
        elbow=(sign*.26+sway,-swing*.45,1.13+bob)
        wrist=(sign*.268+sway,-swing,.86+bob)
        pose_bone('upper_arm.'+side,shoulder,elbow)
        pose_bone('forearm.'+side,elbow,wrist)
        pose_bone('hand.'+side,wrist,(wrist[0],wrist[1],.76+bob))
        contacts.append({'frame':frame,'leg':side,'planted':planted and frame<=48,
                         'soleDepthMetres':depth,'liftMetres':lift,
                         'virtualTravelMetres':.4*phase})
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'soldier_walk_study.blend'))
(out/'motion-report.json').write_text(json.dumps({'status':'first weighted motion candidate; not approved',
    'fps':24,'walkFrames':[1,48],'settleFrames':[49,60],'idleFrames':[61,72],
    'cycleMetres':.4,'cycleSeconds':1,'contacts':contacts,
    'limitations':['Automatic distance weights require visual correction','No production control hierarchy',
                   'Projection uncalibrated','No runtime integration','Settle is not a foot-lock guarantee']},indent=2))
if a.render_step:
    camera=scene.camera
    for name,degrees in [('right',-90),('three_quarter',35)]:
        angle=math.radians(degrees);elev=math.radians(35)
        camera.location=(5*math.sin(angle)*math.cos(elev),-5*math.cos(angle)*math.cos(elev),.95+5*math.sin(elev))
        camera.rotation_euler=(Vector((0,0,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
        folder=out/name;folder.mkdir()
        for frame in list(range(1,25,max(1,a.render_step)))+[72]:
            scene.frame_set(frame);scene.render.filepath=str(folder/f'{frame:03}.png')
            bpy.ops.render.render(write_still=True)
print('Motion study saved:',out)
