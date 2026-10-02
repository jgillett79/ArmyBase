"""Render a built walk study in the GAME's projection, for the isolated preview
(tools/blender-walk-preview.html). Never writes into assets/ or the manifest.
Run: blender --background WALK_STUDY/soldier_walk_study.blend --python-exit-code 1
 --python tools/blender/render_game_projection.py -- --output NEW_DIRECTORY

Calibration (Claude, 3 Oct; 06_GATE0_VISUAL_CONTRACT.md): the game is a
top-down oblique view - 1 world px = 1 screen px on BOTH ground axes, heights
drawn straight up - i.e. a parallel projection along (0, south, down)/sqrt 2.
An orthographic camera at 45 degrees elevation looking north has that exact
view direction; its image is the game's, squashed vertically by 1/sqrt 2.
So: render ortho at 45 degrees, stretch vertically by sqrt 2 when drawing
(projection.json `verticalStretch`), and ground depth, ground x and height all
share one scale. Scale: the game's 44 world px figure / the model's height,
which is also the walk's 22 px per 0.944 m cycle. Facing right (east) the
camera sees the soldier's right side, as the game's south camera does.
The study light rig is turned with the camera so the light keeps the relation
it had in the approved appearance renders. Contact shadows stay the game's.

Readability looks (Claude, 3 Oct; preview only, applied in memory, the .blend
is never saved): --look warm replaces the rig with the map's light - a warm
sun from the screen's upper left (north-west, high; contact shadows fall
lower right, 06_GATE0_VISUAL_CONTRACT.md) and a weak cool sky fill;
--look warm-contrast also darkens the uniform/helmet below the grass value
and lightens the webbing so straps and silhouette separate. --accent-mask
renders a second pass (accent/NNN.png): the helmet band and shoulder patch
white, everything else held out, for the game-style accent fill
(js/animation.js accentStrip). --look study (default) is the e1752d3 path.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',required=True)
p.add_argument('--frames',default='1-24,49-60,72',help='frame list, e.g. 1-24,49-60,72')
p.add_argument('--px-per-metre',type=float,default=120.0,help='horizontal render px per metre')
p.add_argument('--samples',type=int,default=32)
p.add_argument('--look',choices=['study','warm','warm-contrast'],default='study')
p.add_argument('--accent-mask',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.output).expanduser().resolve()
if out.exists() and any(out.iterdir()): raise RuntimeError('Choose a new empty output directory')
if 'Soldier motion skeleton' not in bpy.data.objects: raise RuntimeError('Open a built walk study (build_walk_study.py output) first')
frames=[]
for part in a.frames.split(','):
    lo,_,hi=part.partition('-');frames+=list(range(int(lo),int(hi or lo)+1))

scene=bpy.context.scene
ELEVATION=math.radians(45);AZIMUTH=math.radians(-90)   # camera on the soldier's right (-X), looking +X
STRETCH=math.sqrt(2)
GAME_HEIGHT_PX=44                                      # js/asset-manifest.js unitWorldHeight

def model_height():
    scene.frame_set(72);dg=bpy.context.evaluated_depsgraph_get();top=0
    for o in scene.objects:
        if o.type=='MESH':
            e=o.evaluated_get(dg);top=max(top,max((e.matrix_world@v.co).z for v in e.data.vertices))
    return top
HEIGHT=model_height()

if a.look=='study':
    # Turn the light rig with the camera: same relation to the camera as the
    # appearance renders (camera azimuth 35 deg there, from build_soldier_study).
    old=scene.camera.location;old_az=math.atan2(old.x,-old.y)
    turn=Matrix.Rotation(AZIMUTH-old_az,4,'Z')
    for o in scene.objects:
        if o.type=='LIGHT': o.matrix_world=turn@o.matrix_world
else:
    # Map light. With this camera, screen-left is +Y (west) and screen-up is
    # north (+X) and up (+Z): the key comes from (+X, +Y, +Z).
    for o in [o for o in scene.objects if o.type=='LIGHT']: bpy.data.objects.remove(o,do_unlink=True)
    def sun(name,source,colour,strength,angle):
        data=bpy.data.lights.new(name,'SUN');data.color=colour;data.energy=strength;data.angle=math.radians(angle)
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        obj.rotation_euler=Vector(source).normalized().to_track_quat('Z','Y').to_euler()   # sun shines along -Z
        return obj
    sun('Map key (warm, upper left)',(0.5,1.2,1.8),(1.0,0.84,0.62),4.5,8)
    sun('Sky fill (cool, from the viewer)',(-1.0,-0.3,0.9),(0.72,0.84,1.0),1.4,30)
    if a.look=='warm-contrast':
        # Value separation against the grass (mid olive) and the trail (tan):
        # darker, deeper uniform and helmet; trousers a step lighter than the
        # tunic; lighter khaki webbing; darker boots.
        colours={'Uniform olive':(0.085,0.12,0.05),'Trousers muted olive':(0.12,0.15,0.075),
                 'Canvas webbing':(0.46,0.38,0.22),'Brown leather':(0.04,0.028,0.02),'Boot soles':(0.012,0.014,0.011),
                 'Seams and collar':(0.05,0.07,0.03)}
        for name,c in colours.items():
            node=bpy.data.materials[name].node_tree.nodes['Principled BSDF'];node.inputs['Base Color'].default_value=(*c,1)

W,H=176,256
cam=scene.camera;cam.data.type='ORTHO';cam.data.sensor_fit='AUTO'
cam.data.ortho_scale=max(W,H)/a.px_per_metre
target=Vector((0,0,.80))
direction=Vector((math.sin(AZIMUTH)*math.cos(ELEVATION),-math.cos(AZIMUTH)*math.cos(ELEVATION),math.sin(ELEVATION)))
cam.location=target+direction*6
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=W,H,100
scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
scene.render.film_transparent=True;scene.render.use_freestyle=False
if scene.render.engine=='CYCLES': scene.cycles.samples=a.samples
bpy.context.view_layer.update()

def pixel(point):
    v=world_to_camera_view(scene,cam,Vector(point));return (v.x*W,(1-v.y)*H)

pivot=pixel((0,0,0))
# Checks of the calibration, in game px after the vertical stretch:
world_per_m=GAME_HEIGHT_PX/HEIGHT
k=world_per_m/a.px_per_metre
def game_offset(point):
    x,y=pixel(point);return ((x-pivot[0])*k,(y-pivot[1])*k*STRETCH)
checks={'head (0,0,H) -> straight up by 44':game_offset((0,0,HEIGHT)),
        '1 m forward (-Y, east) -> right by world_per_m':game_offset((0,-1,0)),
        '1 m toward camera (-X, south) -> down by world_per_m':game_offset((-1,0,0))}
for name,(dx,dy) in checks.items(): print('CHECK',name,round(dx,3),round(dy,3))

folder=out/'right';folder.mkdir(parents=True)
for f in frames:
    scene.frame_set(f);scene.render.filepath=str(folder/f'{f:03}.png')
    bpy.ops.render.render(write_still=True)
ACCENT_OBJECTS=('Helmet accent band','Shoulder accent patch')
if a.accent_mask:
    # Accent pass: accent objects pure white, everything else a holdout, so
    # the body still hides the far-side patch. Standard view transform keeps
    # white at 1.0 for the fill.
    hold=bpy.data.materials.new('Preview holdout');hold.use_nodes=True;nt=hold.node_tree;nt.nodes.clear()
    nt.links.new(nt.nodes.new('ShaderNodeHoldout').outputs[0],nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
    white=bpy.data.materials.new('Preview accent');white.use_nodes=True;nt=white.node_tree;nt.nodes.clear()
    em=nt.nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(1,1,1,1);em.inputs['Strength'].default_value=1
    nt.links.new(em.outputs[0],nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
    for o in scene.objects:
        if o.type=='MESH':
            for slot in o.material_slots: slot.material=white if o.name in ACCENT_OBJECTS else hold
    scene.view_settings.view_transform='Standard'
    mask=out/'accent';mask.mkdir()
    for f in frames:
        scene.frame_set(f);scene.render.filepath=str(mask/f'{f:03}.png')
        bpy.ops.render.render(write_still=True)
(out/'projection.json').write_text(json.dumps({
    'status':'calibrated preview frames; not game art, not in the manifest',
    'projection':'ortho camera at 45 deg elevation, azimuth: right side of the soldier (facing screen-right); draw with verticalStretch to get the game\'s top-down oblique view (06_GATE0_VISUAL_CONTRACT.md)',
    'elevationDeg':45,'verticalStretch':STRETCH,'size':[W,H],
    'pivot':[round(pivot[0],3),round(pivot[1],3)],'pivotMeaning':'render px of the rig origin on the ground (pre-stretch): the unit\'s x/y',
    'renderPxPerMetre':a.px_per_metre,'modelHeightMetres':round(HEIGHT,4),'gameHeightPx':GAME_HEIGHT_PX,
    'worldPxPerMetre':round(world_per_m,4),
    'checks':{n:[round(x,3),round(y,3)] for n,(x,y) in checks.items()},
    'frames':frames,'direction':'right','mirrorForLeft':True,'look':a.look,'accentMask':a.accent_mask},indent=2))
print('Game-projection frames saved:',out)
