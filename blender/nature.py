"""Trees, fences, farm buildings and the distant skyline."""
import math, os, random
import bpy, bmesh
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
from props import _mesh_obj, box, cyl, empty, _height, light_area  # noqa: E402
import materials as M  # noqa: E402


# ---------------------------------------------------------------- materials local to nature
def leaf_material():
    m = bpy.data.materials.new('Leaves card'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(os.path.join(HERE, 'refs', 'leaf.png'))
    info = nt.nodes.new('ShaderNodeObjectInfo')
    hsv = nt.nodes.new('ShaderNodeHueSaturation')
    # each tree gets its own slightly different green, drier toward yellow
    hue = nt.nodes.new('ShaderNodeMapRange'); hue.inputs['To Min'].default_value = 0.44; hue.inputs['To Max'].default_value = 0.53
    nt.links.new(info.outputs['Random'], hue.inputs['Value']); nt.links.new(hue.outputs['Result'], hsv.inputs['Hue'])
    nt.links.new(tex.outputs['Color'], hsv.inputs['Color'])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.55
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
    m = bpy.data.materials.new('Bark'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (12, 12, 2.5)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 4; n.inputs['Detail'].default_value = 10
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (0.06, 0.05, 0.04, 1); r.color_ramp.elements[1].color = (0.28, 0.24, 0.20, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.9
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.7
    nt.links.new(n.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


# ---------------------------------------------------------------- trees
def tree(name, base, height, trunk_r, spread, seed, leaf_mat, bark_mat, cards=4000, umbrella=0.5, lean=Vector((0, 0, 0)), card=0.32):
    """Recursive branching trunk + leaf cards gathered at the branch tips.
    umbrella: 0 = round crown, 1 = flat acacia-like crown."""
    rnd = random.Random(seed)
    bm = bmesh.new(); tips = []

    def segment(p0, p1, r0, r1):
        d = p1 - p0; L = d.length
        if L < 1e-4: return
        rot = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
        M = Matrix.Translation((p0 + p1) / 2) @ rot
        bmesh.ops.create_cone(bm, cap_ends=False, segments=max(5, int(10 * r0 / trunk_r) + 4), radius1=r0, radius2=r1, depth=L, matrix=M)

    def branch(p, direction, length, r, level):
        steps = 4 if level == 0 else 3
        pts = [p]
        dvec = direction.normalized()
        for i in range(steps):
            wob = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.5))) * (0.18 + 0.1 * level)
            dvec = (dvec + wob + lean * 0.05).normalized()
            pts.append(pts[-1] + dvec * (length / steps))
        for i in range(steps):
            segment(pts[i], pts[i + 1], r * (1 - 0.55 * i / steps), r * (1 - 0.55 * (i + 1) / steps))
        if level >= 3 or r < 0.012:
            tips.append(pts[-1]); return
        kids = 3 if level == 0 else rnd.randint(2, 3)
        for k in range(kids):
            start = pts[rnd.randint(max(1, steps - 2), steps)]
            a = rnd.uniform(0, math.tau) if level else k / kids * math.tau + rnd.uniform(-0.4, 0.4)
            up = 0.9 - umbrella * 0.75 + rnd.uniform(-0.15, 0.15)
            nd = Vector((math.cos(a), math.sin(a), up)).normalized()
            branch(start, nd, length * (0.62 if level else spread / height * 1.25), r * 0.55, level + 1)

    trunk_h = height * (0.38 + 0.15 * umbrella)
    branch(Vector(base), Vector((0, 0, 1)) + lean * 0.2, trunk_h, trunk_r, 0)
    wood = _mesh_obj(name + ' wood', bm, bark_mat)
    for p in wood.data.polygons: p.use_smooth = True
    # leaf cards: random orientation, denser toward the outside of each cluster
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    per = max(1, cards // max(1, len(tips)))
    for t in tips:
        for _ in range(per):
            off = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 0.55))).normalized() * rnd.uniform(0.2, 1.0) * (spread * 0.22)
            c = t + off
            q = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized().to_track_quat('Z', 'Y')
            s = card * rnd.uniform(0.7, 1.2)
            corners = [q @ Vector(v) * s + c for v in ((-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0))]
            f = bm.faces.new([bm.verts.new(v) for v in corners])
            for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[uv].uv = (u, v)
    leaves = _mesh_obj(name + ' leaves', bm, leaf_mat)
    leaves.visible_shadow = True
    return wood, leaves, tips


def trees(m):
    import assets as AS
    bark = AS.bark_material()
    oak = AS.leaf_material('eztree_oak_leaf.png', 'Leaves oak twig')
    leaf = AS.leaf_material('eztree_ash_leaf.png', 'Leaves ash twig')
    # the big shade tree at the front right; its canopy reaches over the yard (photo top right)
    wood, leaves, tips = tree('Shade tree', (7.7, 9.2, 0), 10.0, 0.36, 12.0, 11, oak, bark, cards=14000, umbrella=0.35, lean=Vector((-0.6, -0.2, 0)), card=0.6)
    # the hanging lamp from a low branch
    lamp = empty('Hanging lamp', (4.6, 6.2, 3.55), 0)
    cyl('Lamp cord', 0.004, 1.2, (0, 0, 0.6), m['wire_black'], parent=lamp)
    cyl('Lamp shade', 0.05, 0.16, (0, 0, -0.02), m['plastic_black'], r2=0.2, parent=lamp)
    from props import sphere
    sphere('Lamp bulb', 0.035, (0, 0, -0.08), m['bulb'], parent=lamp)
    pl = bpy.data.lights.new('Hanging lamp light', 'POINT'); pl.energy = 25; pl.color = (1, 0.7, 0.4); pl.shadow_soft_size = 0.05
    plo = bpy.data.objects.new('Hanging lamp light', pl); plo.parent = lamp; plo.location = (0, 0, -0.12); bpy.context.scene.collection.objects.link(plo)
    # farm trees: acacia-like crowns across the fields, none in the yard, pond or on the driveway,
    # and none whose long low-sun shadow would fall across the yard (the photo's yard is sunlit)
    rnd = random.Random(5); placed = []
    spots = [(-26, 18), (-32, 44), (-10, 62), (9, 70), (-30, 75), (24, 90), (-12, 95), (-40, 55), (2, 140), (30, 150),
             (-55, 120), (46, 70), (60, 110), (-70, 160), (-20, 180), (15, 210), (75, 190), (-95, 220), (40, 260), (-45, 300),
             (36, 45), (-34, 28), (-48, 34)]
    from farm_office import in_field
    spots += [(x, -118) for x in range(-66, 32, 9)] + [(-134, y) for y in range(-40, 20, 10)]
    for i, (x, y) in enumerate(spots):
        h = rnd.uniform(5.5, 9.0)
        if in_field(x, y, 2.0): continue
        tree(f'Farm tree {i}', (x, y, _height(x, y)), h, h * 0.035, h * rnd.uniform(1.0, 1.5), 100 + i, leaf, bark,
             cards=int(5000 + 2500 * rnd.random()), umbrella=rnd.uniform(0.45, 0.85), card=0.85)


# ---------------------------------------------------------------- farm structures
def fence(m, points, post_gap=3.0, mat=None):
    mat = mat or m['beam']
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(L / post_gap)); a = math.atan2(y1 - y0, x1 - x0)
        for i in range(n + 1):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            box('Fence post', (0.1, 0.1, 1.3), (x, y, _height(x, y) + 0.6), mat, bevel=0.01)
        for zr in (0.45, 0.85, 1.15):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            box('Fence rail', (L, 0.05, 0.07), (cx, cy, _height(cx, cy) + zr), mat, rot=(0, 0, a), bevel=0.005)


def gable_building(name, loc, rot, w, d, h, roof_h, wall_mat, roof_mat, door=None, windows=(), open_front=None, inner=None):
    g = empty(name, loc, rot)
    # hollow walls: an open-topped box, thickened inward, so openings show a real interior
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=Vector((w, d, h)), verts=bm.verts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.5], context='FACES')
    walls = _mesh_obj('Walls', bm, wall_mat, g); walls.location = (0, 0, h / 2)
    if inner is not None: walls.data.materials.append(inner)
    sol = walls.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.15; sol.offset = -1; sol.material_offset = 1 if inner is not None else 0
    if open_front:
        ow, oh = open_front
        cbm = bmesh.new(); bmesh.ops.create_cube(cbm, size=1.0); bmesh.ops.scale(cbm, vec=Vector((ow, 1.0, oh)), verts=cbm.verts)
        cutter = _mesh_obj('Opening cutter', cbm, None, g); cutter.location = (0, -d / 2, oh / 2); cutter.hide_render = True; cutter.hide_viewport = True
        bo = walls.modifiers.new('opening', 'BOOLEAN'); bo.object = cutter; bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'
    floor = box('Floor', (w - 0.3, d - 0.3, 0.05), (0, 0, 0.025), inner or wall_mat, bevel=0, parent=g)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w / 2 - 0.3, -d / 2 - 0.3, h), (w / 2 + 0.3, -d / 2 - 0.3, h), (0, -d / 2 - 0.3, h + roof_h),
                                   (-w / 2 - 0.3, d / 2 + 0.3, h), (w / 2 + 0.3, d / 2 + 0.3, h), (0, d / 2 + 0.3, h + roof_h))]
    bm.faces.new((v[0], v[2], v[5], v[3])); bm.faces.new((v[2], v[1], v[4], v[5]))
    bm.faces.new((v[0], v[1], v[2])); bm.faces.new((v[3], v[5], v[4]))
    roof = _mesh_obj('Roof', bm, roof_mat, g)
    sol = roof.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.06
    if door:
        dw, dh, mat = door
        box('Doorway', (dw, 0.05, dh), (0, -d / 2 - 0.01, dh / 2), mat, bevel=0, parent=g)
    for (x, z, ww, wh, mat) in windows:
        box('Window', (ww, 0.04, wh), (x, -d / 2 - 0.01, z), mat, bevel=0.005, parent=g)
    return g


def buildings(m, extra):
    face = lambda x, y: math.atan2(-x, y)   # turns a building's front (local -Y) toward the eye at the origin
    # garage at the far left with an open roller door (cars added by vehicles.py)
    gx, gy = -18.0, 35.0
    gar = gable_building('Garage', (gx, gy, _height(gx, gy)), face(gx, gy) - 0.3, 7.0, 6.5, 3.0, 0.8, extra['cladding'], m['corrugated'],
                         open_front=(5.8, 2.5), inner=extra['dark_interior'])
    box('Garage ceiling', (6.7, 6.2, 0.05), (0, 0, 2.98), extra['dark_interior'], bevel=0, parent=gar)
    lo = light_area('Garage light', (0, 0, 2.6), 3.0, 260, color=(1, 0.9, 0.78)); lo.parent = gar
    # LED batten strips on the ceiling, as in the photo, and a concrete floor
    strip = M.emission('LED batten', (1, 0.93, 0.82), 25.0)
    for x in (-2.0, 0.0, 2.0):
        for y in (-1.8, 0.4, 2.2):
            box('LED batten', (1.2, 0.06, 0.03), (x, y, 2.95), strip, bevel=0, parent=gar)
    box('Garage slab', (6.7, 6.2, 0.04), (0, 0, 0.06), m['concrete'], bevel=0, parent=gar)
    # barn and water tank in the middle distance
    bx, by = 4.0, 118.0
    gable_building('Barn', (bx, by, _height(bx, by)), face(bx, by), 14.0, 10.0, 5.0, 2.6, extra['barn_wood'], m['corrugated'],
                   door=(3.2, 3.8, extra['dark_interior']), windows=((4.6, 3.0, 1.4, 1.0, extra['dark_interior']), (-4.6, 3.0, 1.4, 1.0, extra['dark_interior'])))
    tank = empty('Water tank', (bx - 12.0, by + 2.0, _height(bx - 12.0, by + 2.0)), 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Stand leg', (0.12, 0.12, 3.0), (sx * 1.0, sy * 1.0, 1.5), m['steel'], bevel=0.005, parent=tank)
    cyl('Tank', 1.35, 2.2, (0, 0, 4.1), extra['tank_green'], parent=tank)
    cyl('Tank lid', 1.4, 0.3, (0, 0, 5.35), extra['tank_green'], r2=0.4, parent=tank)
    # farmhouse beyond the pond: timber, stone chimney, verandah, warmly lit windows
    hx, hy = 39.0, 56.0
    win = [(x, 1.4, 1.2, 1.4, extra['window_lit']) for x in (-5.5, -3.2, 2.5, 4.8)]
    house = gable_building('Farmhouse', (hx, hy, _height(hx, hy)), face(hx, hy) * 0.8, 16.0, 9.0, 3.2, 2.2, extra['house_wood'], extra['roof_dark'],
                           door=(1.2, 2.2, extra['window_lit']), windows=win)
    box('Chimney', (1.3, 1.1, 7.2), (6.3, 1.5, 3.6), extra['stone'], bevel=0.03, parent=house)
    box('Verandah roof', (16.5, 2.8, 0.12), (0, -5.8, 3.0), extra['roof_dark'], rot=(math.radians(8), 0, 0), bevel=0.01, parent=house)
    for x in range(-8, 9, 2):
        box('Verandah post', (0.15, 0.15, 2.9), (x, -7.0, 1.45), extra['house_wood'], bevel=0.01, parent=house)
    box('Verandah deck', (16.5, 2.8, 0.25), (0, -5.8, 0.12), extra['house_wood'], bevel=0.01, parent=house)
    # fence line across the fields (the cow pen is now outside the left window: farm_office.cow_pen)
    fence(m, [(-45, 40), (-20, 42), (6, 41), (12, 47)])


def skyline(m, extra):
    """Johannesburg, far off to the right of centre: kept small and hazy."""
    rnd = random.Random(21)
    city = extra['city']
    for i in range(46):
        a = math.radians(rnd.uniform(8, 22)); r = rnd.uniform(21000, 24000)
        w = rnd.uniform(25, 60); h = rnd.choice((40, 60, 80, 110, 140, 170, 210)) * rnd.uniform(0.7, 1.1)
        box('Tower', (w, w, h), (math.sin(a) * r, math.cos(a) * r, h / 2 + 30), city, bevel=0)
    # the tall telecom tower
    a = math.radians(15); r = 22000
    cyl('Telecom tower', 9, 260, (math.sin(a) * r, math.cos(a) * r, 160), city, seg=12)
    cyl('Tower head', 16, 24, (math.sin(a) * r, math.cos(a) * r, 270), city, seg=12)


def extra_materials():
    import materials as M
    return {
        'cladding': M.corrugated('Garage cladding', (0.6, 0.61, 0.6)),
        'dark_interior': M.plain('Dark interior', (0.05, 0.045, 0.04), rough=0.9),
        'barn_wood': M.wood('Barn timber', (0.45, 0.30, 0.18), (0.25, 0.15, 0.08), scale=1.0),
        'tank_green': M.plain('Tank green', (0.10, 0.30, 0.20), rough=0.4),
        'house_wood': M.wood('House timber', (0.50, 0.33, 0.20), (0.30, 0.18, 0.10), scale=0.8),
        'roof_dark': M.plain('Dark roof', (0.08, 0.08, 0.09), rough=0.5, metal=0.6),
        'stone': M.mountain('Chimney stone'),
        'window_lit': M.emission('Lit window', (1.0, 0.72, 0.42), 6.0),
        'city': M.add_haze(M.plain('City', (0.55, 0.50, 0.46), rough=0.6), color=(0.86, 0.70, 0.60), distance=30000.0),
    }
