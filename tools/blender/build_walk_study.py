"""Deforming skeleton walk study (pass 3). Open a COPY of a local soldier study.
Run: blender --background soldier_study.blend --python-exit-code 1 --python
 tools/blender/build_walk_study.py -- --output NEW_DIRECTORY [--render-step N]

Pass 2 (Claude, 2 Oct): the cycle matches the game's measured stride, the
pelvis rides the stance leg so it can straighten, arms swing opposite the
legs at preserved lengths, thigh pockets deform with the trousers, the
harness is rebuilt on the final chest surface, and the stop finishes on
planted feet. Bones keep their rest roll (the pass-1 twist fix).
Pass 3 (Claude, 2 Oct): the uniform's chest and back follow only the torso
bones, blending into the sleeves over the shoulder cap (sleeve_amount);
motion is unchanged from pass 2.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Euler

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

# --- Gait constants -----------------------------------------------------------
# Game measurement (js/animation.js + js/asset-manifest.js): one full gait
# cycle (both footsteps) per strideWorld = 22 world px on a 44 world px
# figure, i.e. half the figure's height. Scaled to this model's height.
def model_height():
    top=0
    for o in scene.objects:
        if o.type=='MESH': top=max(top,max((o.matrix_world@Vector(c)).z for c in o.bound_box))
    return top
HEIGHT=model_height()
CYCLE=22/44*HEIGHT            # metres per full cycle (two footsteps), ~0.943
D=CYCLE/4                     # stance foot runs from +D (front) to -D (behind)
ANKLE=.17                     # ankle joint height above the ground
UPPER,LOWER=.41,.38           # thigh and shin bone lengths (rest skeleton)
KNEE_STANCE=math.radians(172) # stance knee: straight-looking, never locked at 180
LEG=math.sqrt(UPPER*UPPER+LOWER*LOWER-2*UPPER*LOWER*math.cos(KNEE_STANCE))
LIFT=.05                      # swing foot clearance at mid-swing
SWAY=.018                     # pelvis shift over the stance foot
ARM_SWING=math.radians(20)    # shoulder pitch amplitude, opposite to the legs
WALK_FRAMES,STOP=(1,48),(49,60)   # two cycles; a half-cycle planted stop; idle 61-72

# --- Contact repairs on the final (smoothed) surfaces ----------------------
dg=bpy.context.evaluated_depsgraph_get()
uniform=bpy.data.objects['Uniform continuous surface'].evaluated_get(dg)

def onto_chest(point):
    hit,loc,normal,_=uniform.closest_point_on_mesh(point)
    return (loc,normal) if hit else (point,Vector((0,-1,0)))

def rebuild_harness(obj,width=.023,thickness=.004,lift=.0025):
    """Rebuild a webbing strip from its centreline on the final chest surface.
    Projecting each of the strip's corner vertices separately (pass 1) folded
    it into zig-zags; here the centreline is densified, laid on the surface,
    smoothed and re-laid, then the strip is rebuilt across its local normal."""
    me=obj.data
    n=len(me.vertices)//4
    centre=[sum((me.vertices[4*i+j].co for j in range(4)),Vector())/4 for i in range(n)]
    dense=[]
    for i in range(n-1):
        p0,p1,p2,p3=centre[max(0,i-1)],centre[i],centre[i+1],centre[min(n-1,i+2)]
        for k in range(4):
            t=k/4;t2=t*t;t3=t2*t
            dense.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3))
    dense.append(centre[-1])
    pts=[onto_chest(q)[0] for q in dense]
    for _ in range(4):
        pts=[pts[0]]+[(pts[i-1]+2*pts[i]+pts[i+1])/4 for i in range(1,len(pts)-1)]+[pts[-1]]
        pts=[onto_chest(q)[0] for q in pts]
    verts=[]
    for i,q in enumerate(pts):
        loc,normal=onto_chest(q)
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        side=tangent.cross(normal).normalized()*width/2
        inner=loc+normal*lift;outer=loc+normal*(lift+thickness)
        verts+= [inner-side,inner+side,outer+side,outer-side]
    faces=[(3,2,1,0)]
    for i in range(len(pts)-1):
        for j in range(4):
            k=(j+1)%4;faces.append((4*i+j,4*i+k,4*(i+1)+k,4*(i+1)+j))
    faces.append(tuple(4*(len(pts)-1)+j for j in range(4)))
    mesh=bpy.data.meshes.new(obj.name+'_rebuilt')
    mesh.from_pydata([tuple(v) for v in verts],[],faces);mesh.update()
    for m in me.materials: mesh.materials.append(m)
    for f in mesh.polygons: f.use_smooth=True
    obj.data=mesh

for o in list(scene.objects):
    if o.name.startswith('Harness_'): rebuild_harness(o)
    if o.name.startswith('Boot shaped upper_'):
        # Meet the sole's z=.029 top; don't translate the ankle or whole boot.
        for v in o.data.vertices:
            if v.co.z < .06: v.co.z-=.019*max(0,(.06-v.co.z)/.015)

# --- Skeleton -----------------------------------------------------------------
# Bone rest landmarks: upright knees; anatomical right is negative X; the
# soldier faces negative Y.
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

def distance(point,h,t):
    h,t=Vector(h),Vector(t);d=t-h
    return (point-(h+d*max(0,min(1,(point-h).dot(d)/d.length_squared)))).length

def rigid_group(name):
    if name.startswith(('Helmet','Head','Eye','Iris','Ear','Nose','Mouth','Eyebrow','Neck')): return 'head'
    if name.startswith(('Boot','Sole','Lace')): return 'foot.'+('R' if name.endswith('_R') else 'L')
    if name.startswith(('Hand','Thumb','Cuff')): return 'hand.'+('R' if name.endswith('_R') else 'L')
    if name.startswith(('Belt','Buckle')): return 'pelvis'
    if name.startswith('Shoulder'): return 'upper_arm.L'
    if name.startswith(('Harness','Chest','Tunic')): return 'spine'
    # Thigh pockets are NOT rigid any more: they take the trousers' weights
    # below, so they bend with the cloth instead of flapping off the leg.

TROUSER_BONES=['pelvis','thigh.R','thigh.L','shin.R','shin.L']

def nearest_two(point,names):
    close=sorted((distance(point,*rest[n]),n) for n in names)[:2]
    w=[1/max(.015,d)**4 for d,n in close];total=sum(w)
    return {n:weight/total for (_,n),weight in zip(close,w)}

def smoothstep(e0,e1,x):
    t=max(0,min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)

# Measured on the rest uniform (pass 3): below the armpit the flank and the
# sleeve are separate surfaces with a gap in |x| centred here (z -> x).
ARMPIT_GAP=[(1.00,.193),(1.05,.200),(1.10,.191),(1.15,.181),(1.20,.178)]
def sleeve_amount(point):
    """0 = torso, 1 = arm. Pass 2 weighted the uniform to its two nearest
    bones, so the flank under the armpit (closer to the upper arm than the
    spine) followed the arm swing: the chest/back warped and the harness
    stood 3.2 cm off. Now the chest and back belong to the torso bones; below
    the armpit the split runs down the flank/sleeve gap, and over the
    shoulder cap it blends smoothly across |x| 0.165-0.225."""
    x,z=abs(point.x),point.z
    zs=[g[0] for g in ARMPIT_GAP];k=max(0,min(len(zs)-2,sum(1 for q in zs if q<=z)-1))
    (z0,c0),(z1,c1)=ARMPIT_GAP[k],ARMPIT_GAP[k+1]
    c=c0+(c1-c0)*max(0,min(1,(z-z0)/(z1-z0)))
    low=smoothstep(c-.008,c+.008,x)
    high=smoothstep(.165,.225,x)
    w=smoothstep(1.17,1.30,z)
    return low+(high-low)*w

def uniform_weights(point):
    side='R' if point.x<0 else 'L'
    a=sleeve_amount(point)
    out={}
    for part,names in [(1-a,['pelvis','spine']),(a,['upper_arm.'+side,'forearm.'+side])]:
        if part<=0: continue
        for n,w in nearest_two(point,names).items(): out[n]=out.get(n,0)+part*w
    return out
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
        if obj.name.startswith('Uniform'): weights=uniform_weights(point)
        elif obj.name.startswith(('Trousers','Cargo')): weights=nearest_two(point,TROUSER_BONES)
        else: weights=nearest_two(point,['pelvis','spine','head'])
        for n,weight in weights.items(): groups[n].add([vertex.index],weight,'REPLACE')
    modifier=obj.modifiers.new('Soldier deformation','ARMATURE');modifier.object=rig

# --- Motion -------------------------------------------------------------------
def ease(t):
    """Swing path 0->1 whose start speed equals the stance foot's backward
    speed (no velocity jump at toe-off); it overshoots slightly at both ends."""
    return -t+6*t*t-4*t*t*t

def walk_foot(q):
    """Local foot depth (+ = in front of the hip) and lift at cycle phase q."""
    q%=1
    if q<.5: return D-4*D*q,0.0,True
    t=(q-.5)*2
    return -D+2*D*ease(t),LIFT*math.sin(math.pi*t)**2,False

def pose_bone(name,h,t):
    # Swing the bone from its REST direction to the target direction and keep
    # its rest roll (pass-1 twist fix: to_track_quat twisted thighs 174 deg,
    # feet 180 deg and arms 79-88 deg).
    bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION'
    rest_m=bone.bone.matrix_local.to_3x3()
    swing=(rest_m@Vector((0,1,0))).rotation_difference((Vector(t)-Vector(h)).normalized())
    bone.matrix=Matrix.Translation(Vector(h))@(swing.to_matrix()@rest_m).to_4x4()
    for channel in ('location','rotation_quaternion','scale'): bone.keyframe_insert(data_path=channel)

def leg(side,sign,hip,depth,lift,sway,planted):
    h=Vector((sign*.105+sway,0,hip));ankle=Vector((sign*.105,-depth,ANKLE+lift))
    delta=ankle-h;length=delta.length
    if length>UPPER+LOWER-1e-4:
        if planted: raise RuntimeError(f'Unreachable planted {side} foot ({length:.4f} m)')
        ankle=h+delta.normalized()*(UPPER+LOWER-1e-4);delta=ankle-h;length=delta.length  # swing only
    along=(UPPER*UPPER-LOWER*LOWER+length*length)/(2*length)
    bend=math.sqrt(max(0,UPPER*UPPER-along*along))
    forward=Vector((0,-1,0));perp=(forward-delta.normalized()*forward.dot(delta.normalized())).normalized()
    knee=h+delta.normalized()*along+perp*bend
    pose_bone('thigh.'+side,h,knee);pose_bone('shin.'+side,knee,ankle)
    pose_bone('foot.'+side,ankle,ankle+Vector((0,-.15,-.12)))
    return math.degrees((h-knee).angle(ankle-knee)),ankle

def arm(side,sign,pitch,body_y,hip_offset,sway):
    """Pendulum arm about the shoulder: bone lengths preserved; forward pitch
    adds a little elbow flex. pitch > 0 swings the arm backward (+Y)."""
    shoulder=Vector((sign*.20+sway,body_y,1.43+hip_offset))
    rot=lambda angle:Matrix.Rotation(angle,3,'X')
    flex=math.radians(8)+max(0,-pitch)*.6
    elbow=shoulder+rot(pitch)@Vector((sign*.06,0,-.30))
    wrist=elbow+rot(pitch-flex)@Vector((sign*.008,0,-.27))
    tip=wrist+rot(pitch-flex)@Vector((0,0,-.10))
    pose_bone('upper_arm.'+side,shoulder,elbow);pose_bone('forearm.'+side,elbow,wrist);pose_bone('hand.'+side,wrist,tip)

def body(hip,sway,lean):
    off=hip-.96
    pose_bone('pelvis',(sway,0,hip),(sway,-lean*.14,1.10+off))
    pose_bone('spine',(sway,-lean*.14,1.10+off),(sway,-lean*.53,1.49+off))
    pose_bone('head',(sway,-lean*.53,1.49+off),(sway,-lean*.53,1.85+off))
    return off

def hip_over(depth,sway,lift=0):
    """Pelvis height that keeps the stance leg at LEG length over its foot."""
    return ANKLE+lift+math.sqrt(LEG*LEG-depth*depth-sway*sway)

contacts=[];frames=[]
for frame in range(1,73):
    scene.frame_set(frame)
    row={'frame':frame}
    if frame<=WALK_FRAMES[1]:
        phase=(frame-1)/24;q=phase%1
        travel=CYCLE*phase
        feet={s:walk_foot(q+o) for s,o in [('R',0),('L',.5)]}
        stance='R' if feet['R'][2] else 'L'
        sway=SWAY*(-1 if stance=='R' else 1)*math.sin(math.pi*((q%.5)/.5))
        hip=hip_over(feet[stance][0],sway)
        arm_amount=1;lean=.015
    elif frame<=STOP[1]:
        # Planted stop: the right foot (just landed in front) stays planted
        # while the body decelerates over it; the left foot steps in beside it.
        u=(frame-STOP[0])/(STOP[1]-STOP[0])
        moved=D*(2*u-u*u)                      # same speed as walking at u=0, still at u=1
        travel=CYCLE*2+moved
        feet={'R':(D-moved,0.0,True),
              'L':(-D+D*ease(u),.7*LIFT*math.sin(math.pi*u)**2,u>=1)}
        stance='R'
        sway=-SWAY*math.sin(math.pi*min(1,u*2))*(1-u)
        hip=hip_over(feet['R'][0],sway)
        arm_amount=1-u;lean=.015*(1-u)
    else:
        travel=CYCLE*2+D
        feet={'R':(0.0,0.0,True),'L':(0.0,0.0,True)}
        stance='both';sway=0;hip=hip_over(0,0);arm_amount=0;lean=0
    off=body(hip,sway,lean)
    for side,sign,o in [('R',-1,0),('L',1,.5)]:
        depth,lift,planted=feet[side]
        angle,ankle=leg(side,sign,hip,depth,lift,sway,planted)
        # Opposite arm swing: right arm back when the right foot is forward.
        pitch=ARM_SWING*arm_amount*math.cos(math.tau*(((frame-1)/24)+o)) if frame<=STOP[1] else 0
        arm(side,sign,pitch,-lean*.53,off,sway)
        row[side]={'depth':round(depth,4),'lift':round(lift,4),'planted':planted,'kneeAngle':round(angle,1)}
        contacts.append({'frame':frame,'leg':side,'planted':planted,'soleDepthMetres':depth,'liftMetres':lift,'virtualTravelMetres':travel})
    row.update({'hip':round(hip,4),'sway':round(sway,4),'virtualTravelMetres':round(travel,4)})
    frames.append(row)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'soldier_walk_study.blend'))
(out/'motion-report.json').write_text(json.dumps({'status':'weighted motion candidate, pass 3 (torso/sleeve weights); not approved',
    'fps':24,'walkFrames':list(WALK_FRAMES),'stopFrames':list(STOP),'idleFrames':[61,72],
    'modelHeightMetres':round(HEIGHT,4),'cycleMetres':round(CYCLE,4),'stepMetres':round(CYCLE/2,4),'cycleSeconds':1,
    'gameStride':'22 world px per full cycle on a 44 px figure (js/asset-manifest.js strideWorld; js/animation.js)',
    'stanceKneeDegrees':172,'legLengthMetres':round(LEG,4),'frames':frames,'contacts':contacts,
    'limitations':['Distance-based weights, not hand-painted','No production control hierarchy',
                   'Flat-footed stance (no heel-strike/toe-off roll)','Projection uncalibrated','No runtime integration']},indent=2))
if a.render_step:
    camera=scene.camera
    for name,degrees in [('right',-90),('three_quarter',35)]:
        angle=math.radians(degrees);elev=math.radians(35)
        camera.location=(5*math.sin(angle)*math.cos(elev),-5*math.cos(angle)*math.cos(elev),.95+5*math.sin(elev))
        camera.rotation_euler=(Vector((0,0,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
        folder=out/name;folder.mkdir()
        loop=list(range(1,25,max(1,a.render_step)))
        stop=list(range(49,61,max(1,a.render_step)))+[60,72]
        for frame in sorted(set(loop+stop)):
            scene.frame_set(frame);scene.render.filepath=str(folder/f'{frame:03}.png')
            bpy.ops.render.render(write_still=True)
print('Motion study saved:',out)
