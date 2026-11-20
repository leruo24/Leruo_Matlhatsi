"""Free third-party assets: Poly Haven models (CC0) and ez-tree textures (MIT).

Sources, licences and changes are listed in blender/README.md. Every file lives in
blender/assets/, so the scene builds offline.
"""
import math, os
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
REPO = os.path.dirname(HERE)


def model_path(name):
    for p in (os.path.join(ASSETS, 'models', name + '.glb'), os.path.join(REPO, 'assets', 'models', name + '.glb')):
        if os.path.exists(p):
            return p
    raise FileNotFoundError(name)


def _bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def place(name, loc, rot_z=0.0, scale=1.0, parent=None, floor=None, tilt=(0.0, 0.0), label=None):
    """Import a GLB under one empty. floor: if given, the lowest point is set to this height
    (world Z), so nothing floats or sinks."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=model_path(name))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(label or name, None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.scale = (scale, scale, scale)
    root.rotation_euler = (tilt[0], tilt[1], rot_z)
    root.location = loc
    if parent is not None:
        root.parent = parent
    bpy.context.view_layer.update()
    if floor is not None:
        lo, _ = _bbox([o for o in new])
        # parents used here are unscaled and only turned about Z, so a world Z shift is a local one
        root.location.z += floor - lo.z
        bpy.context.view_layer.update()
    return root, new


# ---------------------------------------------------------------- texture helpers
def _img(nt, fname, non_color=False):
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(os.path.join(ASSETS, 'textures', fname), check_existing=True)
    if non_color:
        t.image.colorspace_settings.name = 'Non-Color'
    return t


def _world_xy(nt, size):
    """World-space planar coordinates with one tile every `size` metres."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / size, 1 / size, 1 / size)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    return mp


def leaf_material(fname, name):
    """Photo twig card (alpha cut-out), lit from both sides, each tree a slightly different green."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = _img(nt, fname)
    info = nt.nodes.new('ShaderNodeObjectInfo')
    hsv = nt.nodes.new('ShaderNodeHueSaturation'); hsv.inputs['Saturation'].default_value = 0.85; hsv.inputs['Value'].default_value = 0.8
    hue = nt.nodes.new('ShaderNodeMapRange'); hue.inputs['To Min'].default_value = 0.47; hue.inputs['To Max'].default_value = 0.53
    nt.links.new(info.outputs['Random'], hue.inputs['Value']); nt.links.new(hue.outputs['Result'], hsv.inputs['Hue'])
    nt.links.new(tex.outputs['Color'], hsv.inputs['Color'])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.5
    nt.links.new(hsv.outputs['Color'], p.inputs['Base Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTranslucent'); nt.links.new(hsv.outputs['Color'], tr.inputs['Color'])
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs['Fac'].default_value = 0.3
    nt.links.new(p.outputs['BSDF'], mx.inputs[1]); nt.links.new(tr.outputs['BSDF'], mx.inputs[2])
    tp = nt.nodes.new('ShaderNodeBsdfTransparent')
    cut = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Alpha'], cut.inputs['Fac']); nt.links.new(tp.outputs['BSDF'], cut.inputs[1]); nt.links.new(mx.outputs['Shader'], cut.inputs[2])
    nt.links.new(cut.outputs['Shader'], out.inputs['Surface'])
    return m


def bark_material():
    """Poly Haven bark_brown_02 (via ez-tree), box-projected in object space: trunks have no UVs."""
    m = bpy.data.materials.new('Bark (photo)'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / 0.9, 1 / 0.9, 1 / 1.4)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    col = _img(nt, 'bark_brown_02_color_1k.jpg'); rough = _img(nt, 'bark_brown_02_roughness_1k.jpg', True); ao = _img(nt, 'bark_brown_02_ao_1k.jpg', True)
    for t in (col, rough, ao):
        t.projection = 'BOX'; t.projection_blend = 0.3
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    dim = nt.nodes.new('ShaderNodeMix'); dim.data_type = 'RGBA'; dim.blend_type = 'MULTIPLY'; dim.inputs['Factor'].default_value = 1.0
    nt.links.new(col.outputs['Color'], dim.inputs['A']); nt.links.new(ao.outputs['Color'], dim.inputs['B'])
    nt.links.new(dim.outputs['Result'], b.inputs['Base Color'])
    nt.links.new(rough.outputs['Color'], b.inputs['Roughness'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6; bp.inputs['Distance'].default_value = 0.02
    nt.links.new(ao.outputs['Color'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def ground_grass(name):
    """Short grass from a photo texture, sampled at two unrelated scales and blended by noise so the
    tile never repeats visibly; dry golden patches; fades to a flat colour far away (no moire)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    a = _img(nt, 'eztree_grass.jpg'); c = _img(nt, 'eztree_grass.jpg'); d = _img(nt, 'eztree_dirt_color.jpg')
    nt.links.new(_world_xy(nt, 1.7).outputs['Vector'], a.inputs['Vector'])
    rot = _world_xy(nt, 5.3); rot.inputs['Rotation'].default_value = (0, 0, 0.7)
    nt.links.new(rot.outputs['Vector'], c.inputs['Vector'])
    nt.links.new(_world_xy(nt, 2.3).outputs['Vector'], d.inputs['Vector'])
    co = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.09; n.inputs['Detail'].default_value = 6
    n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 0.03; n2.inputs['Detail'].default_value = 4
    for k in (n, n2): nt.links.new(co.outputs['Object'], k.inputs['Vector'])
    ab0 = nt.nodes.new('ShaderNodeMix'); ab0.data_type = 'RGBA'
    nt.links.new(n.outputs['Fac'], ab0.inputs['Factor']); nt.links.new(a.outputs['Color'], ab0.inputs['A']); nt.links.new(c.outputs['Color'], ab0.inputs['B'])
    ab = nt.nodes.new('ShaderNodeHueSaturation'); ab.inputs['Saturation'].default_value = 1.5; ab.inputs['Value'].default_value = 1.5
    nt.links.new(ab0.outputs['Result'], ab.inputs['Color'])
    # dry, golden grass across most of the farm, greener in hollows
    dry = nt.nodes.new('ShaderNodeHueSaturation'); dry.inputs['Hue'].default_value = 0.43; dry.inputs['Saturation'].default_value = 1.1; dry.inputs['Value'].default_value = 1.5
    nt.links.new(ab.outputs['Color'], dry.inputs['Color'])
    dm = nt.nodes.new('ShaderNodeMapRange'); dm.inputs['From Min'].default_value = 0.42; dm.inputs['From Max'].default_value = 0.6
    nt.links.new(n2.outputs['Fac'], dm.inputs['Value'])
    gd = nt.nodes.new('ShaderNodeMix'); gd.data_type = 'RGBA'
    nt.links.new(dm.outputs['Result'], gd.inputs['Factor']); nt.links.new(ab.outputs['Color'], gd.inputs['A']); nt.links.new(dry.outputs['Color'], gd.inputs['B'])
    # worn bare earth in small patches
    bare = nt.nodes.new('ShaderNodeMapRange'); bare.inputs['From Min'].default_value = 0.66; bare.inputs['From Max'].default_value = 0.74
    nt.links.new(n.outputs['Fac'], bare.inputs['Value'])
    ge = nt.nodes.new('ShaderNodeMix'); ge.data_type = 'RGBA'
    nt.links.new(bare.outputs['Result'], ge.inputs['Factor']); nt.links.new(gd.outputs['Result'], ge.inputs['A']); nt.links.new(d.outputs['Color'], ge.inputs['B'])
    # distance fade to the average colour
    lp = nt.nodes.new('ShaderNodeLightPath')
    far = nt.nodes.new('ShaderNodeMapRange'); far.inputs['From Min'].default_value = 60; far.inputs['From Max'].default_value = 400
    nt.links.new(lp.outputs['Ray Length'], far.inputs['Value'])
    avg = nt.nodes.new('ShaderNodeMix'); avg.data_type = 'RGBA'; avg.inputs['B'].default_value = (0.24, 0.20, 0.07, 1)
    nt.links.new(far.outputs['Result'], avg.inputs['Factor']); nt.links.new(ge.outputs['Result'], avg.inputs['A'])
    nt.links.new(avg.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(ab0.outputs['Result'], bw.inputs['Color'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25; bp.inputs['Distance'].default_value = 0.01
    nt.links.new(bw.outputs['Val'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def ground_gravel(base):
    """Add photo dirt between the procedural gravel stones (the existing material is kept)."""
    nt = base.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    src = b.inputs['Base Color'].links[0].from_socket
    d = _img(nt, 'eztree_dirt_color.jpg'); nt.links.new(_world_xy(nt, 1.9).outputs['Vector'], d.inputs['Vector'])
    lift = nt.nodes.new('ShaderNodeHueSaturation'); lift.inputs['Value'].default_value = 1.9; lift.inputs['Saturation'].default_value = 0.6
    nt.links.new(d.outputs['Color'], lift.inputs['Color'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'OVERLAY'; mx.inputs['Factor'].default_value = 0.45
    nt.links.new(src, mx.inputs['A']); nt.links.new(lift.outputs['Color'], mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    return base


# ---------------------------------------------------------------- props from Poly Haven
def _matte_black(root):
    """Recolour a model to the black of the photo's desk lamp, keeping its texture detail."""
    for o in root.children:
        for slot in o.material_slots:
            m = slot.material
            if m is None or m.get('recoloured'): continue
            nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            if not b.inputs['Base Color'].links: continue
            src = b.inputs['Base Color'].links[0].from_socket
            hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 0.0; hs.inputs['Value'].default_value = 0.05
            nt.links.new(src, hs.inputs['Color']); nt.links.new(hs.outputs['Color'], b.inputs['Base Color'])
            m['recoloured'] = True

def furnish(room, desk):
    """Fill the rear of the workshop and add detail. room: props.ROOM; desk: the desk empty."""
    minX, maxX, back = room['minX'], room['maxX'], room['back']
    t = 0.76
    # desk: a real articulated lamp clamped to the back edge, and a small potted plant
    lamp, _ = place('desk_lamp_arm_01', (-1.05, 0.37, t), rot_z=math.radians(15), parent=desk, label='Desk lamp (Poly Haven)')
    # warm pool of light from the lamp head (the head is the model's lowest-hanging part toward -Y)
    bpy.context.view_layer.update()
    vs = [Vector(v.co) for o in lamp.children for v in o.data.vertices if o.type == 'MESH']
    head = [v for v in vs if v.y < min(w.y for w in vs) + 0.08]
    hc = sum(head, Vector()) / len(head)
    sl = bpy.data.lights.new('Lamp light', 'SPOT'); sl.energy = 12; sl.color = (1, 0.72, 0.42); sl.spot_size = math.radians(95); sl.spot_blend = 0.6; sl.shadow_soft_size = 0.03
    so = bpy.data.objects.new('Lamp light', sl); so.parent = lamp; so.location = (hc.x, hc.y, hc.z - 0.04)
    bpy.context.scene.collection.objects.link(so)
    print('lamp head (lamp space)', tuple(round(c, 3) for c in hc))
    _matte_black(lamp)
    plant, _ = place('potted_plant_02', (-0.66, 0.28, t), rot_z=math.radians(160), scale=0.42, parent=desk, label='Desk plant (Poly Haven)')
    # back wall: low timber cabinet, steel shelving with drawers, floor plant in the corner
    place('modern_wooden_cabinet', (-1.3, back + 0.27, 0), rot_z=math.pi, floor=0.0)
    place('steel_frame_shelves_03', (2.15, back + 0.38, 0), rot_z=math.pi, floor=0.0)
    place('potted_plant_01', (3.65, back + 0.45, 0), rot_z=0.4, floor=0.0)
    place('lantern_01', (-2.0, back + 0.25, 0.68), rot_z=0.3, floor=0.68)
    place('jug_01', (-0.55, back + 0.2, 0.68), rot_z=2.0, floor=0.68)
    # things on the shelving (shelf heights measured from the model: 0.66 full width, 1.09 and 1.75
    # on one half, 1.32 on the other, 2.30 on top; the unit is turned to face the room, so model
    # x maps to world x = shelf_x - x)
    sx, sy = 2.15, back + 0.38
    place('wooden_bucket_01', (sx + 0.55, sy, 0.66), rot_z=0.4, floor=0.66)
    place('cardboard_box_01', (sx - 0.75, sy, 0.66), rot_z=1.57, floor=0.66)
    place('wooden_crate_01', (sx - 0.62, sy, 1.09), rot_z=1.57, floor=1.09)
    place('can_rusted', (sx + 0.35, sy + 0.05, 1.32), rot_z=0.2, floor=1.32)
    place('jug_01', (sx + 0.7, sy - 0.05, 1.32), rot_z=-0.6, floor=1.32)
    place('lantern_01', (sx - 0.4, sy, 1.75), rot_z=0.9, floor=1.75)
    place('can_rusted', (sx - 0.85, sy + 0.08, 1.75), rot_z=1.3, floor=1.75)
    place('cardboard_box_01', (sx + 0.5, sy, 2.3), rot_z=1.5, floor=2.3)
    # left wall, rear: barrel, crates, bucket, a crowbar leaning on the boards
    place('barrel_03', (minX + 0.45, back + 0.5, 0), rot_z=0.8, floor=0.0)
    place('wooden_crate_02', (minX + 0.35, back + 1.75, 0), rot_z=0.0, floor=0.0)
    place('wooden_crate_01', (minX + 0.4, back + 1.6, 0.47), rot_z=0.25, floor=0.475)
    place('wooden_bucket_01', (minX + 0.95, back + 0.6, 0), rot_z=1.0, floor=0.0)
    place('crowbar_01', (minX + 0.13, back + 2.7, 0.3), rot_z=math.pi / 2, tilt=(0.0, math.radians(-14)), floor=0.0)
    # a stool at the ESP32 bench
    place('wooden_stool_01', (1.55, 0.95, 0), rot_z=0.3, floor=0.0)
    # a plastic chair under the shade tree, turned toward the pond
    from props import _height
    cx, cy = 8.4, 10.6
    place('plastic_monobloc_chair_01', (cx, cy, 0), rot_z=math.atan2(14.0 - cx, -(26.0 - cy)), floor=_height(cx, cy))
    return lamp, plant


# ---------------------------------------------------------------- grass blades
def grass_blades(count=650000, radius=55.0, seed=3):
    """Real blades (hair curves) over the grass near the workshop, thinning with distance; none on
    the gravel yard, in the pond or indoors. Beyond `radius` the ground texture carries the grass."""
    import numpy as np
    from props import _height, POND, ROOM
    rng = np.random.default_rng(seed)
    n = count * 3
    r = radius * rng.random(n) ** 0.7 + 1.0            # denser near the eye
    a = rng.random(n) * np.pi * 2
    x, y = np.cos(a) * r, np.sin(a) * r
    gravel = (x > -32) & (x < 4.0) & (y > 4.4) & (y < 34) & ~((x > 0) & (y > 22))
    pond = ((x - POND['cx']) / POND['rx']) ** 2 + ((y - POND['cy']) / POND['ry']) ** 2 < 1.12
    room = (x > ROOM['minX'] - 0.4) & (x < ROOM['maxX'] + 0.4) & (y > ROOM['back'] - 0.4) & (y < ROOM['front'] + 0.6)
    keep = ~(gravel | pond | room)
    x, y = x[keep][:count], y[keep][:count]
    count = len(x)
    z = np.array([_height(float(px), float(py)) for px, py in zip(x, y)])
    d = np.hypot(x, y)
    L = rng.uniform(0.08, 0.22, count) * (1 + 0.8 * np.clip(d / radius, 0, 1)) * (1 + 0.6 * (rng.random(count) < 0.15))
    lean = rng.normal(0, 0.28, (count, 2))
    pts = np.zeros((count, 3, 3), np.float32)
    for k in range(3):
        t = k / 2
        pts[:, k, 0] = x + lean[:, 0] * L * t * t
        pts[:, k, 1] = y + lean[:, 1] * L * t * t
        pts[:, k, 2] = z - 0.01 + L * t * (1 - 0.15 * t)
    hc = bpy.data.hair_curves.new('Grass blades')
    hc.add_curves([3] * count)
    hc.position_data.foreach_set('vector', pts.reshape(-1))
    rad = hc.attributes.new('radius', 'FLOAT', 'POINT')
    w = (0.0016 + 0.0012 * np.clip(d / radius, 0, 1)).astype(np.float32)   # far blades a touch wider (less aliasing)
    rad.data.foreach_set('value', np.stack([w, w * 0.6, w * 0.12], 1).reshape(-1))
    m = bpy.data.materials.new('Grass blade'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ci = nt.nodes.new('ShaderNodeHairInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB'); els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.09, 0.14, 0.03, 1)
    els[1].position, els[1].color = 1.0, (0.46, 0.36, 0.12, 1)
    mid = els.new(0.55); mid.color = (0.22, 0.24, 0.06, 1)
    nt.links.new(ci.outputs['Random'], ramp.inputs['Fac'])
    tip = nt.nodes.new('ShaderNodeMix'); tip.data_type = 'RGBA'; tip.blend_type = 'MULTIPLY'; tip.inputs['B'].default_value = (0.55, 0.5, 0.4, 1)
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(ci.outputs['Intercept'], inv.inputs[1]); nt.links.new(inv.outputs['Value'], tip.inputs['Factor'])
    nt.links.new(ramp.outputs['Color'], tip.inputs['A']); nt.links.new(tip.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.6
    hc.materials.append(m)
    o = bpy.data.objects.new('Grass blades', hc); bpy.context.scene.collection.objects.link(o)
    return o
