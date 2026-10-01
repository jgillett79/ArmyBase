"""Original, editable soldier appearance study. Run in a fresh Blender process.
No external assets, add-ons or animation. Blender 4.2+ intended; local run required.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='New output directory')
    parser.add_argument('--samples', type=int, default=48)
    parser.add_argument('--elevation', type=float, default=35)
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--outline', action='store_true', help='Freestyle contour experiment')
    parser.add_argument('--soft-lighting', action='store_true', help='Study-01 lighting for comparison')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def material(name, colour, roughness=.75):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*colour, 1)
    node.inputs['Roughness'].default_value = roughness
    return mat


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def loft(name, rings, mat, segments=32):
    """Closed elliptical cross-sections: x,y,z, half-width, half-depth."""
    vertices = []
    for x, y, z, rx, ry in rings:
        vertices.extend((x + rx * math.cos(a * math.tau / segments),
                         y + ry * math.sin(a * math.tau / segments), z)
                        for a in range(segments))
    faces = [tuple(reversed(range(segments)))]
    for r in range(len(rings) - 1):
        for a in range(segments):
            b = (a + 1) % segments
            faces.append((r*segments+a, r*segments+b, (r+1)*segments+b, (r+1)*segments+a))
    faces.append(tuple((len(rings)-1)*segments+a for a in range(segments)))
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


def ellipsoid(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat)


def box(name, location, scale, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, mat)
    mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    return obj


def seam(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def ribbon(name, points, width, mat):
    """Closed flat webbing strip, with capped ends and a 4 mm thickness."""
    vertices = []
    for x, y, z in points:
        vertices.extend([(x-width/2,y,z),(x+width/2,y,z),
                         (x+width/2,y+.004,z),(x-width/2,y+.004,z)])
    faces = [(3,2,1,0)]
    for i in range(len(points)-1):
        for j in range(4):
            k=(j+1)%4
            faces.append((4*i+j,4*i+k,4*(i+1)+k,4*(i+1)+j))
    faces.append(tuple(4*(len(points)-1)+j for j in range(4)))
    mesh=bpy.data.meshes.new(name+'_mesh')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,name,mat)
    return obj


def fuse(objects, name):
    """Weld garment volumes into one surface; study topology, not skinning-ready."""
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    remesh = obj.modifiers.new('Continuous garment surface', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .009
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new('Relax surface', 'SMOOTH')
    smooth.factor = .5
    smooth.iterations = 4
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def soldier():
    olive = material('Uniform olive', (.19,.25,.12))
    trouser = material('Trousers muted olive', (.24,.29,.17))
    edge = material('Seams and collar', (.10,.14,.065))
    skin = material('Warm skin', (.57,.35,.22), .6)
    boots = material('Brown leather', (.065,.048,.035))
    sole = material('Boot soles', (.025,.029,.022))
    web = material('Canvas webbing', (.25,.22,.14))
    steel = material('Buckle metal', (.25,.29,.27), .4)
    hair = material('Hair and eyebrows', (.06,.04,.025))
    ivory = material('Eye whites', (.69,.67,.58))
    iris = material('Eyes', (.055,.085,.075))
    accent = material('Editable helmet band and patch', (.53,.36,.12))
    # Anatomical right is negative X; soldier faces negative Y.
    torso = loft('Tunic shaped torso', [(0,0,1.00,.17,.11),(0,0,1.06,.19,.13),
        (0,0,1.17,.16,.105),(0,0,1.32,.195,.13),(0,0,1.43,.205,.12),
        (0,0,1.49,.18,.11),(0,0,1.52,.08,.075)], olive)
    sleeves = []
    for sign, side in [(-1,'R'),(1,'L')]:
        sleeves.append(loft('Sleeve_'+side, [(sign*.268,0,.855,.045,.049),
            (sign*.268,0,.91,.049,.053),(sign*.265,0,1.065,.055,.057),
            (sign*.25,0,1.16,.059,.062),(sign*.225,0,1.37,.067,.072),
            (sign*.19,0,1.435,.067,.077)], olive))
        loft('Hand_'+side, [(sign*.268,-.01,.74,.025,.019),
            (sign*.268,-.014,.77,.034,.024),(sign*.268,-.013,.82,.036,.025),
            (sign*.268,-.008,.875,.027,.027)],skin)
        ellipsoid('Thumb_'+side,(sign*.244,-.029,.809),(.015,.019,.032),skin)
        loft('Cuff_'+side,[(sign*.268,0,.858,.048,.052),
                           (sign*.268,0,.878,.049,.053)],edge)
        # Thin cloth pockets hug the thigh rather than forming holsters.
        box('Cargo pocket_'+side,(sign*.184,.0,.755),(.018,.115,.13),trouser,.007)
    fuse([torso,*sleeves], 'Uniform continuous surface')
    pelvis = loft('Trousers pelvis', [(0,0,.86,.155,.115),(0,0,.98,.175,.12),
                                    (0,0,1.07,.17,.115)], trouser)
    legs = []
    for sign, side in [(-1,'R'),(1,'L')]:
        legs.append(loft('Trouser leg_'+side, [(sign*.105,0,.16,.065,.069),
            (sign*.105,0,.25,.072,.075),(sign*.105,0,.47,.077,.08),
            (sign*.105,-.005,.56,.084,.085),(sign*.105,0,.76,.091,.095),
            (sign*.092,0,.96,.095,.109)], trouser))
        loft('Sole_'+side,[(sign*.105,-.062,.003,.065,.143),
            (sign*.105,-.062,.013,.069,.15),(sign*.105,-.062,.029,.068,.15)],sole)
        loft('Boot shaped upper_'+side,[(sign*.105,-.062,.045,.067,.15),
            (sign*.105,-.065,.082,.065,.146),(sign*.105,-.045,.115,.059,.114),
            (sign*.105,.009,.15,.058,.063)],boots)
        loft('Boot ankle_'+side,[(sign*.105,.015,.055,.067,.077),
             (sign*.105,.012,.12,.065,.069),(sign*.105,.009,.205,.064,.065)],boots)
        # Omit laces at game size rather than leaving buried stray marks.
    fuse([pelvis,*legs], 'Trousers continuous surface')
    loft('Neck',[(0,0,1.49,.063,.06),(0,0,1.61,.066,.065)],skin)
    loft('Head sculpt base',[(0,-.025,1.565,.033,.04),(0,-.025,1.585,.065,.065),
        (0,-.012,1.64,.085,.084),(0,0,1.72,.094,.086),
        (0,.006,1.79,.083,.079),(0,.008,1.815,.045,.05)],skin)
    for sign in [-1,1]:
        ellipsoid('Ear_'+str(sign),(sign*.092,0,1.69),(.018,.022,.032),skin)
        # Restrained inset-looking eyes; no projecting white eyeballs.
        ellipsoid('Eye_'+str(sign),(sign*.034,-.081,1.712),(.012,.004,.005),hair)
        ellipsoid('Iris_'+str(sign),(sign*.034,-.085,1.713),(.004,.002,.004),iris)
        seam('Eyebrow_'+str(sign),[(sign*.015,-.093,1.735),(sign*.037,-.09,1.74),
                                 (sign*.054,-.082,1.733)],.004,hair)
    ellipsoid('Nose',(0,-.091,1.69),(.013,.016,.021),skin)
    seam('Mouth', [(-.022,-.089,1.638),(0,-.098,1.636),(.022,-.089,1.638)],.0025,hair)
    # Helmet is a shaped shell, not a full sphere sitting on the head.
    loft('Helmet shell',[(0,0,1.75,.111,.108),(0,0,1.77,.113,.11),
        (0,.008,1.82,.107,.105),(0,.012,1.866,.076,.078),
        (0,.014,1.889,.025,.026)],olive)
    loft('Helmet accent band',[(0,0,1.752,.113,.11),(0,0,1.763,.114,.111)],accent)
    loft('Helmet continuous lip',[(0,0,1.745,.113,.11),
        (0,0,1.751,.119,.115),(0,0,1.759,.114,.11)],edge)
    for sign in [-1,1]:
        # Omit the cheek-cutting chin strap in this scale study.
        x=sign*.12
        front=[]
        for z,rx,ry in [(1.095,.1805,.122),(1.17,.16,.105),
                       (1.24,.179,.118),(1.32,.195,.13),
                       (1.43,.205,.12),(1.47,.188,.113)]:
            front.append((x,-ry*math.sqrt(1-(x/rx)**2)-.006,z))
        over=[(x,-.055,1.495),(x,0,1.505),(x,.055,1.495)]
        back=[(xx,-yy,zz) for xx,yy,zz in reversed(front)]
        ribbon('Harness_'+str(sign),front+over+back,.023,web)
        box('Chest pocket_'+str(sign),(sign*.108,-.111,1.31),(.08,.018,.072),olive,.006)
        box('Belt pouch_'+str(sign),(sign*.116,-.124,1.09),(.072,.034,.071),web,.009)
    loft('Belt',[(0,0,1.085,.189,.130),(0,0,1.108,.183,.125)],web)
    box('Buckle',(0,-.135,1.096),(.042,.015,.033),steel,.004)
    box('Shoulder accent patch',(.258,-.057,1.31),(.032,.012,.037),accent,.004)
    # Omit the broken centre seam: it adds noise at 44 px.
    # No rifle in this appearance pass: settle anatomy and silhouette first.


def point_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def main():
    args = arguments()
    if bpy.app.version < (4,2,0):
        raise RuntimeError('Use Blender 4.2 or newer.')
    if bpy.data.filepath:
        raise RuntimeError('Run in a fresh background process, not in an existing .blend file.')
    out = Path(args.output).expanduser().resolve()
    if out.exists() and any(out.iterdir()):
        raise RuntimeError('Output directory is not empty. Choose a new directory to preserve edits.')
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    soldier()
    model = bpy.data.collections.new('SOLDIER_STUDY')
    scene.collection.children.link(model)
    for obj in list(scene.objects):
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        model.objects.link(obj)
    scene.render.engine = 'CYCLES'
    if args.outline:
        scene.render.use_freestyle = True
        lines = scene.view_layers[0].freestyle_settings.linesets
        line_set = lines[0] if len(lines) else lines.new('Soldier contours')
        for feature in ('select_crease','select_edge_mark','select_material_boundary',
                        'select_suggestive_contour','select_ridge_valley'):
            setattr(line_set,feature,False)
        line_set.select_silhouette = True
        line_set.select_border = True
        line_set.select_contour = True
        # A new line set in a factory-startup scene has no line style in
        # Blender 5.2 (linestyle is None); create one (Claude's local run).
        if line_set.linestyle is None:
            line_set.linestyle = bpy.data.linestyles.new('Soldier contour style')
        line_set.linestyle.color = (.045,.065,.035)
        line_set.linestyle.thickness = 12

    scene.cycles.device = 'CPU'
    scene.cycles.samples = max(1,args.samples)
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1536
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.world = bpy.data.worlds.new('Studio ambient')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.55,.59,.65,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .3 if args.soft_lighting else .12
    for name, location, power, size, colour in [
        ('Warm upper-left key',(-3,-4,6),550,4 if args.soft_lighting else 2.5,(1,.88,.72)),
        ('Soft fill',(3,-1,3),180 if args.soft_lighting else 70,5,(.80,.88,1)),
        ('Rear separation',(0,3,4),220 if args.soft_lighting else 110,3,(1,.95,.84))]:
        data = bpy.data.lights.new(name,'AREA')
        data.energy,data.size,data.color = power,size,colour
        obj = bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location = location
        point_at(obj,(0,0,1))
    camera_data = bpy.data.cameras.new('Appearance camera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 2.35
    camera = bpy.data.objects.new('Appearance camera',camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    elevation = math.radians(args.elevation)
    # The soldier faces -Y with anatomical right on -X. The game's "right"
    # view shows the soldier facing screen-right with the RIGHT side to the
    # camera, so that camera sits on -X (-90 degrees). +90 showed the left
    # side facing screen-left (Claude's local run, Blender 5.2.2, 1 Oct).
    views = [('front',0),('right',-90),('back',180),('three_quarter',35)]
    def aim(degrees):
        angle = math.radians(degrees)
        camera.location = (5*math.sin(angle)*math.cos(elevation),
                           -5*math.cos(angle)*math.cos(elevation),.95+5*math.sin(elevation))
        point_at(camera,(0,0,.95))
    aim(35)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'soldier_study.blend'))
    if not args.no_render:
        for name, degrees in views:
            aim(degrees)
            scene.render.filepath = str(out/(name+'.png'))
            bpy.ops.render.render(write_still=True)
    report = {'status':'appearance candidate; not rigged or approved',
              'blender':bpy.app.version_string,'heightMetres':1.889,
              'camera':{'type':'ORTHO','elevationDegrees':args.elevation,'scale':2.35},
              'views':[name for name,_ in views], 'rendered':not args.no_render,
              'revision':3,'outline':args.outline,'lighting':'soft' if args.soft_lighting else 'contrast',
              'productionProjectionMatched':False,
              'notes':'Standard orthographic study. Existing equal-ground-axis oblique projection requires a separate export calibration. Garment remesh needs animation topology/weights before rigging.'}
    (out/'study-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Soldier appearance study saved:',out)


if __name__ == '__main__':
    main()
