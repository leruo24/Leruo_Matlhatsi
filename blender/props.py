"""Workshop geometry. Real-world dimensions in metres; layout follows the approved photo."""
import math, os, random
import bpy, bmesh
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
rand = random.Random(7)


# ---------------------------------------------------------------- helpers
def _link(o, parent=None):
    bpy.context.scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), rot_z=0.0, parent=None):
    e = bpy.data.objects.new(name, None); e.location = loc; e.rotation_euler = (0, 0, rot_z)
    return _link(e, parent)


def _mesh_obj(name, bm, mat, parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    if mat is not None:
        o.data.materials.append(mat)
    return _link(o, parent)


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.004, parent=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = _mesh_obj(name, bm, mat, parent); o.location = loc; o.rotation_euler = rot
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 2; m.limit_method = 'ANGLE'
    for p in o.data.polygons: p.use_smooth = False
    return o


def cyl(name, r, h, loc, mat, rot=(0, 0, 0), seg=32, r2=None, parent=None, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = _mesh_obj(name, bm, mat, parent); o.location = loc; o.rotation_euler = rot
    if smooth:
        for p in o.data.polygons: p.use_smooth = len(p.vertices) == 4
    return o


def sphere(name, r, loc, mat, scale=(1, 1, 1), parent=None, seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    o = _mesh_obj(name, bm, mat, parent); o.location = loc; o.scale = scale
    for p in o.data.polygons: p.use_smooth = True
    return o


def tube_path(name, points, radius, mat, parent=None):
    """A wire/cable along points (bezier curve with a round bevel)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu); o.data.materials.append(mat)
    return _link(o, parent)


def boards(name, length, height, loc, rot_z, mat, width=0.19, gap=0.006, depth=0.022, parent=None):
    """A wall of vertical boards with shadow gaps (one board + array modifier)."""
    n = max(1, round(length / (width + gap)))
    w = length / n - gap
    o = box(name, (w, depth, height), (0, 0, 0), mat, bevel=0.002, parent=parent)
    a = o.modifiers.new('array', 'ARRAY'); a.count = n; a.use_relative_offset = False; a.use_constant_offset = True
    a.constant_offset_displace = (w + gap, 0, 0)
    o.modifiers.move(1, 0) if len(o.modifiers) > 1 else None
    c, s = math.cos(rot_z), math.sin(rot_z)
    start = Vector(loc) - Vector((c, s, 0)) * (length / 2 - w / 2)
    o.location = start; o.rotation_euler = (0, 0, rot_z)
    return o


def light_area(name, loc, size, energy, color=(1, 0.85, 0.7), rot=(0, 0, 0)):
    l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = energy; l.color = color
    o = bpy.data.objects.new(name, l); o.location = loc; o.rotation_euler = rot
    return _link(o)


# ---------------------------------------------------------------- the building
ROOM = dict(minX=-5.0, maxX=4.2, back=-3.4, front=4.5, height=3.5, door=(0.6, 4.4), door_h=2.4)


def workshop_shell(m):
    r = ROOM; minX, maxX, back, front, H = r['minX'], r['maxX'], r['back'], r['front'], r['height']
    W, D = maxX - minX, front - back
    box('Floor slab', (W + 0.4, D + 0.2, 0.15), ((minX + maxX) / 2, (back + front) / 2 + 0.1, -0.075), m['concrete'], bevel=0.01)
    # walls: dark backing + vertical boards facing the room
    box('Left wall', (0.1, D, H), (minX - 0.05, (back + front) / 2, H / 2), m['beam'], bevel=0)
    boards('Left wall boards', D, H, (minX + 0.012, (back + front) / 2, H / 2), math.pi / 2, m['boards'])
    box('Back wall', (W, 0.1, H), ((minX + maxX) / 2, back - 0.05, H / 2), m['beam'], bevel=0)
    boards('Back wall boards', W, H, ((minX + maxX) / 2, back + 0.012, H / 2), 0, m['boards'])
    # front wall: only the section left of the big opening (the whiteboard wall in the photo)
    fx0, fx1 = minX, -2.9
    box('Front wall', (fx1 - fx0, 0.12, H), ((fx0 + fx1) / 2, front, H / 2), m['beam'], bevel=0)
    boards('Front wall boards', fx1 - fx0, H, ((fx0 + fx1) / 2, front - 0.072, H / 2), 0, m['boards'])
    box('Corner post', (0.16, 0.16, H), (fx1 + 0.06, front - 0.02, H / 2), m['beam'], bevel=0.01)
    box('Header beam', (W, 0.22, 0.32), ((minX + maxX) / 2, front, H - 0.16), m['beam'], bevel=0.01)
    # right wall with the sliding door slid open
    d0, d1 = r['door']; dh = r['door_h']
    box('Right wall rear', (0.1, d0 - back, H), (maxX + 0.05, (back + d0) / 2, H / 2), m['beam'], bevel=0)
    boards('Right wall boards', d0 - back, H, (maxX - 0.012, (back + d0) / 2, H / 2), math.pi / 2, m['boards'])
    box('Door lintel', (0.12, d1 - d0, H - dh), (maxX + 0.05, (d0 + d1) / 2, (H + dh) / 2), m['beam'], bevel=0.005)
    box('Door track', (0.1, d1 - back - 0.2, 0.05), (maxX - 0.04, (back + d1) / 2, dh + 0.02), m['steel_black'], bevel=0.003)
    box('Door threshold', (0.12, d1 - d0, 0.02), (maxX + 0.05, (d0 + d1) / 2, 0.01), m['steel_black'], bevel=0.003)
    # two glass panels parked in front of the solid wall
    for i, y in enumerate((d0 - 0.95, d0 - 2.75)):
        g = empty(f'Glass panel {i}', (maxX - 0.1 - i * 0.05, y, 0))
        box('frame top', (0.04, 1.85, 0.05), (0, 0, dh - 0.03), m['steel_black'], parent=g)
        box('frame bottom', (0.04, 1.85, 0.06), (0, 0, 0.03), m['steel_black'], parent=g)
        box('frame a', (0.04, 0.05, dh), (0, -0.9, dh / 2), m['steel_black'], parent=g)
        box('frame b', (0.04, 0.05, dh), (0, 0.9, dh / 2), m['steel_black'], parent=g)
        box('pane', (0.008, 1.76, dh - 0.12), (0, 0, dh / 2), m['glass'], bevel=0, parent=g)
    # ceiling boards, rafters and the roof sheeting above
    ceil = boards('Ceiling boards', D, W, ((minX + maxX) / 2, (back + front) / 2, H - 0.011), math.pi / 2, m['ceiling'], depth=0.02)
    ceil.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    ceil.location = ((minX + maxX) / 2, back + 0.1, H - 0.011)
    for x in [minX + 0.4 + i * 0.9 for i in range(int(W / 0.9))]:
        box('Rafter', (0.07, D + 0.7, 0.18), (x, (back + front) / 2 + 0.35, H - 0.09 - 0.02), m['beam'], bevel=0.005)
    box('Roof sheet', (W + 0.6, D + 1.2, 0.02), ((minX + maxX) / 2, (back + front) / 2 + 0.55, H + 0.15), m['corrugated'], rot=(math.radians(-2), 0, 0), bevel=0)
    # soft fill from the open front bounce (the photo's interior is warmly lit)
    # sunlight bouncing off the sunlit yard and floor at the open front, warming the room as the photo shows
    light_area('Front bounce', (-0.8, 5.6, 0.3), 7.0, 900, color=(1.0, 0.72, 0.48), rot=(math.radians(-75), 0, 0))
    light_area('Interior fill', (-1.0, 0.0, 2.85), 3.0, 60)


# ---------------------------------------------------------------- desk, chair, screens
DESK = dict(pivot=(-0.2, 3.85, 0.0), rot=math.radians(-12), top=0.76)


def desk_setup(m):
    d = empty('Desk', DESK['pivot'], DESK['rot'])
    t = DESK['top']
    L, Dp = 2.7, 0.82
    box('Desk top', (L, Dp, 0.05), (0, 0, t - 0.025), m['desk'], bevel=0.008, parent=d)
    # left pedestal: three drawers with black pulls
    box('Left pedestal', (0.5, Dp - 0.06, t - 0.05), (-L / 2 + 0.27, 0, (t - 0.05) / 2), m['desk'], bevel=0.006, parent=d)
    for i in range(3):
        z = 0.12 + i * 0.2
        box('Drawer front', (0.46, 0.02, 0.18), (-L / 2 + 0.27, -Dp / 2 + 0.02, z + 0.06), m['desk'], bevel=0.004, parent=d)
        box('Drawer pull', (0.14, 0.02, 0.012), (-L / 2 + 0.27, -Dp / 2 + 0.005, z + 0.1), m['steel_black'], bevel=0.002, parent=d)
    # right cabinet with black steel corner brackets
    box('Right cabinet', (0.6, Dp - 0.06, t - 0.05), (L / 2 - 0.32, 0, (t - 0.05) / 2), m['desk'], bevel=0.006, parent=d)
    for sx in (-1, 1):
        for z in (t - 0.12, 0.1):
            box('Bracket', (0.08, 0.012, 0.08), (L / 2 - 0.32 + sx * 0.27, -Dp / 2 + 0.024, z), m['steel_black'], bevel=0.002, parent=d)
    box('Modesty panel', (L - 1.1, 0.03, 0.45), (-0.05, Dp / 2 - 0.08, t - 0.28), m['desk'], bevel=0.004, parent=d)

    # monitor: one straight screen on a proper stand (content is rendered by the site)
    mon = empty('Monitor', (0.45, 0.2, t), 0, d)
    box('Stand base', (0.3, 0.2, 0.012), (0, 0.02, 0.006), m['plastic_black'], bevel=0.004, parent=mon)
    box('Stand neck', (0.06, 0.035, 0.24), (0, 0.06, 0.13), m['plastic_black'], bevel=0.004, parent=mon)
    box('Bezel', (1.12, 0.03, 0.5), (0, 0.035, 0.16 + 0.25), m['plastic_black'], bevel=0.004, parent=mon)
    box('Screen', (1.10, 0.002, 0.48), (0, 0.019, 0.16 + 0.25), m['screen'], bevel=0, parent=mon)

    box('Keyboard', (0.44, 0.14, 0.022), (0.3, -0.13, t + 0.011), m['plastic_black'], bevel=0.004, parent=d)
    sphere('Mouse', 0.035, (0.66, -0.13, t + 0.012), m['plastic_black'], scale=(0.9, 1.5, 0.45), parent=d)
    box('Laptop', (0.31, 0.22, 0.016), (-0.95, -0.08, t + 0.008), m['alu'], rot=(0, 0, math.radians(8)), bevel=0.004, parent=d)
    # Stanley tumbler with handle
    cyl('Stanley cup', 0.045, 0.27, (-0.5, 0.1, t + 0.135), m['stanley'], r2=0.05, parent=d)
    cyl('Stanley lid', 0.051, 0.025, (-0.5, 0.1, t + 0.282), m['stanley'], parent=d)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.009, location=(0, 0, 0))
    h = bpy.context.object; h.name = 'Stanley handle'; h.parent = d; h.location = (-0.555, 0.1, t + 0.16)
    h.rotation_euler = (math.pi / 2, 0, 0); h.scale = (0.8, 1.4, 1); h.data.materials.append(m['stanley'])
    # potted plant
    cyl('Plant pot', 0.07, 0.11, (-0.3, 0.27, t + 0.055), m['ceramic'], r2=0.08, parent=d)
    cyl('Soil', 0.074, 0.005, (-0.3, 0.27, t + 0.105), m['soil'], parent=d)
    for i in range(14):
        a = i / 14 * math.tau + rand.random() * 0.3; tilt = 0.4 + rand.random() * 0.5
        lf = sphere('Leaf', 0.06, (-0.3 + math.cos(a) * 0.04, 0.27 + math.sin(a) * 0.04, t + 0.17 + rand.random() * 0.06), m['leaf'], scale=(0.35, 1.0, 0.08), parent=d, seg=12)
        lf.rotation_euler = (tilt, 0, a + math.pi / 2)
    # desk lamp: weighted base, two arms, shade with a warm bulb (a local pool of light)
    lamp = empty('Desk lamp', (-0.78, 0.28, t), 0.4, d)
    cyl('Lamp base', 0.07, 0.025, (0, 0, 0.0125), m['plastic_black'], parent=lamp)
    tube_path('Lamp arm', [(0, 0, 0.02), (0.02, -0.05, 0.25), (0.05, -0.12, 0.44)], 0.008, m['steel_black'], parent=lamp)
    tube_path('Lamp arm 2', [(0.05, -0.12, 0.44), (0.18, -0.2, 0.46), (0.32, -0.26, 0.42)], 0.008, m['steel_black'], parent=lamp)
    shade = cyl('Lamp shade', 0.03, 0.12, (0.36, -0.28, 0.38), m['plastic_black'], r2=0.075, parent=lamp)
    shade.rotation_euler = (math.radians(35), math.radians(-30), 0)
    sphere('Bulb', 0.025, (0.38, -0.3, 0.35), m['bulb'], parent=lamp)
    sl = bpy.data.lights.new('Lamp light', 'SPOT'); sl.energy = 15; sl.color = (1, 0.72, 0.42); sl.spot_size = math.radians(90); sl.spot_blend = 0.6; sl.shadow_soft_size = 0.03
    so = bpy.data.objects.new('Lamp light', sl); so.parent = lamp; so.location = (0.38, -0.3, 0.34); so.rotation_euler = (math.radians(20), math.radians(-25), 0)
    _link(so)
    # tablet propped in its folding cover
    tab = empty('Tablet', (0.98, -0.08, t), math.radians(-8), d)
    box('Tablet cover back', (0.25, 0.006, 0.18), (0, 0.03, 0.085), m['plastic_black'], rot=(math.radians(-18), 0, 0), bevel=0.002, parent=tab)
    box('Tablet', (0.245, 0.007, 0.175), (0, 0.02, 0.09), m['screen'], rot=(math.radians(-18), 0, 0), bevel=0.003, parent=tab)
    box('Cover fold', (0.25, 0.09, 0.005), (0, 0.075, 0.0025), m['plastic_black'], bevel=0.001, parent=tab)
    # Xbox Series S standing, vent circle toward the room, and a white controller
    xb = empty('Xbox', (1.18, 0.18, t), math.radians(-6), d)
    box('Xbox body', (0.151, 0.065, 0.275), (0, 0, 0.1375), m['plastic_white'], bevel=0.006, parent=xb)
    cyl('Xbox vent', 0.05, 0.004, (0, -0.0335, 0.17), m['plastic_black'], rot=(math.pi / 2, 0, 0), parent=xb)
    ctl = empty('Controller', (1.2, -0.17, t + 0.03), math.radians(15), d)
    sphere('Controller body', 0.05, (0, 0, 0), m['plastic_white'], scale=(1.5, 0.9, 0.45), parent=ctl)
    for sx in (-1, 1):
        sphere('Grip', 0.03, (sx * 0.055, -0.03, -0.006), m['plastic_white'], scale=(1, 1.4, 0.9), parent=ctl)
    cyl('Stick L', 0.009, 0.012, (-0.03, 0.005, 0.02), m['plastic_black'], parent=ctl)
    cyl('Stick R', 0.009, 0.012, (0.015, -0.015, 0.02), m['plastic_black'], parent=ctl)
    box('Wallet', (0.11, 0.09, 0.018), (1.05, -0.27, t + 0.009), m['wallet'], rot=(0, 0, math.radians(10)), bevel=0.004, parent=d)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.012, minor_radius=0.0015)
    k = bpy.context.object; k.name = 'Key ring'; k.parent = d; k.location = (0.9, -0.3, t + 0.002); k.data.materials.append(m['steel'])
    box('Key', (0.05, 0.012, 0.003), (0.93, -0.31, t + 0.002), m['steel'], rot=(0, 0, 0.4), bevel=0.0005, parent=d)

    # gaming chair, angled toward the monitor (its back to the viewer)
    mon_world = d.matrix_world @ Vector((0.45, 0.2, 0)) if False else None
    chair_pos = Vector((-0.28, 3.02, 0))
    target = Vector(DESK['pivot']) + Matrix.Rotation(DESK['rot'], 3, 'Z') @ Vector((0.45, 0.2, 0))
    face = math.atan2(-(target.x - chair_pos.x), target.y - chair_pos.y)
    ch = empty('Gaming chair', chair_pos, face)
    for i in range(5):
        a = i / 5 * math.tau
        leg = box('Chair leg', (0.05, 0.3, 0.035), (math.sin(a) * 0.15, math.cos(a) * 0.15, 0.085), m['plastic_black'], rot=(0, 0, -a), bevel=0.008, parent=ch)
        sphere('Caster', 0.03, (math.sin(a) * 0.3, math.cos(a) * 0.3, 0.03), m['rubber'], parent=ch, seg=12)
    cyl('Gas lift', 0.028, 0.32, (0, 0, 0.26), m['steel_black'], parent=ch)
    box('Seat', (0.54, 0.52, 0.11), (0, 0, 0.47), m['leather'], bevel=0.04, parent=ch)
    back = empty('Backrest', (0, -0.27, 0.52), 0, ch); back.rotation_euler = (math.radians(-10), 0, 0)
    box('Back', (0.52, 0.11, 0.82), (0, 0, 0.41), m['leather'], bevel=0.045, parent=back)
    for sx in (-1, 1):
        box('Bolster', (0.07, 0.12, 0.62), (sx * 0.26, 0.02, 0.36), m['leather'], bevel=0.03, parent=back)
    box('Headrest', (0.34, 0.1, 0.16), (0, 0, 0.88), m['leather'], bevel=0.04, parent=back)
    for sx in (-1, 1):
        box('Arm post', (0.04, 0.05, 0.2), (sx * 0.3, 0.02, 0.6), m['plastic_black'], bevel=0.01, parent=ch)
        box('Arm pad', (0.09, 0.26, 0.035), (sx * 0.3, 0.05, 0.71), m['plastic_black'], bevel=0.012, parent=ch)


# ---------------------------------------------------------------- the ESP32 bench (right of the desk)
BENCH = dict(x0=0.5, x1=2.6, y0=1.25, y1=2.0, top=0.9)


def esp32_bench(m):
    b = BENCH; t = b['top']; cx, cy = (b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2
    L, D = b['x1'] - b['x0'], b['y1'] - b['y0']
    box('Bench top', (L, D, 0.05), (cx, cy, t - 0.025), m['bench'], bevel=0.008)
    for x in (b['x0'] + 0.06, b['x1'] - 0.06):
        for y in (b['y0'] + 0.06, b['y1'] - 0.06):
            box('Bench leg', (0.07, 0.07, t - 0.05), (x, y, (t - 0.05) / 2), m['bench'], bevel=0.004)
    box('Bench rail', (L - 0.12, 0.03, 0.08), (cx, b['y0'] + 0.06, t - 0.09), m['bench'], bevel=0.003)
    box('Bench shelf', (L - 0.14, D - 0.12, 0.025), (cx, cy, 0.18), m['bench'], bevel=0.003)
    box('ESD mat', (1.2, 0.52, 0.004), (1.25, cy - 0.02, t + 0.002), m['mat'], bevel=0.001)
    # the unfinished ESP32 project: board, breadboard, jumper wires, multimeter, iron, solder
    box('Breadboard', (0.165, 0.055, 0.01), (1.05, 1.62, t + 0.009), m['plastic_white'], bevel=0.001)
    box('ESP32 board', (0.055, 0.028, 0.0016), (0.9, 1.47, t + 0.006), m['pcb'], bevel=0)
    box('ESP32 module', (0.025, 0.018, 0.003), (0.91, 1.47, t + 0.0085), m['steel'], bevel=0.0005)
    for i, (col, dx) in enumerate((('wire_red', 0.0), ('wire_black', 0.02), ('yellow', 0.04))):
        tube_path(f'Jumper {i}', [(1.0 + dx, 1.62, t + 0.014), (0.98 + dx, 1.56, t + 0.05), (0.92 + dx * 0.3, 1.49, t + 0.01)], 0.0012, m[col])
    mm = empty('Multimeter', (1.5, 1.6, t + 0.004), math.radians(12))
    box('Meter body', (0.09, 0.17, 0.035), (0, 0, 0.0175), m['yellow'], bevel=0.008, parent=mm)
    box('Meter face', (0.07, 0.15, 0.004), (0, 0, 0.036), m['plastic_black'], bevel=0.002, parent=mm)
    box('Meter display', (0.055, 0.035, 0.001), (0, 0.045, 0.0385), m['screen'], bevel=0, parent=mm)
    tube_path('Probe lead red', [(1.48, 1.52, t + 0.02), (1.42, 1.42, t + 0.006), (1.30, 1.40, t + 0.006)], 0.0018, m['wire_red'])
    tube_path('Probe lead black', [(1.52, 1.52, t + 0.02), (1.58, 1.42, t + 0.006), (1.66, 1.38, t + 0.006)], 0.0018, m['wire_black'])
    box('Iron stand', (0.15, 0.1, 0.03), (1.72, 1.86, t + 0.015), m['plastic_black'], bevel=0.004)
    box('Sponge', (0.06, 0.05, 0.012), (1.69, 1.86, t + 0.036), m['yellow'], bevel=0.002)
    iron = cyl('Iron handle', 0.012, 0.16, (1.76, 1.84, t + 0.12), m['plastic_black'], rot=(math.radians(-35), math.radians(20), 0))
    cyl('Iron tip', 0.004, 0.09, (1.79, 1.89, t + 0.05), m['steel'], rot=(math.radians(-35), math.radians(20), 0))
    cyl('Solder spool', 0.04, 0.04, (1.38, 1.88, t + 0.02), m['steel'], rot=(math.pi / 2, 0, 0))
    box('Parts organiser', (0.22, 0.13, 0.045), (1.85, 1.42, t + 0.0225), m['clear'], bevel=0.003)
    cyl('Pen cup', 0.04, 0.1, (2.25, 1.9, t + 0.05), m['ceramic'])
    for i in range(4):
        cyl('Pen', 0.004, 0.15, (2.24 + i * 0.01, 1.9 + (i % 2) * 0.01, t + 0.12), m['plastic_black'], rot=(0.15 * (i - 1.5), 0.1, 0), seg=8)


# ---------------------------------------------------------------- whiteboard wall
def wall_items(m):
    fy = ROOM['front'] - 0.075   # face of the front-wall boards
    wb = empty('Whiteboard', (-3.55, fy, 2.3), 0)
    box('Board frame', (0.92, 0.025, 0.62), (0, -0.0125, 0), m['alu'], bevel=0.004, parent=wb)
    box('Board', (0.88, 0.004, 0.58), (0, -0.026, 0), m['whiteboard'], bevel=0, parent=wb)
    box('Sticky note', (0.076, 0.002, 0.076), (-0.32, -0.029, 0.19), m['note'], rot=(0, math.radians(4), 0), bevel=0, parent=wb)
    for i in range(5):   # faint marker strokes, no readable text
        box('Stroke', (0.18 + rand.random() * 0.25, 0.001, 0.004), (-0.1 + rand.random() * 0.2, -0.0285, 0.15 - i * 0.07), m['marker'], rot=(0, rand.uniform(-0.04, 0.04), 0), bevel=0, parent=wb)
    # cap rack with the two caps (the supplied UCT and Jeppe Boys emblems as decals)
    box('Cap rail', (0.6, 0.03, 0.05), (-3.4, fy - 0.015, 1.86), m['beam'], bevel=0.004)
    for i, (x, logo) in enumerate(((-3.58, 'uct_logo.png'), (-3.22, 'jeppe_crest.png'))):
        cap = empty(f'Cap {i}', (x, fy - 0.11, 1.74), 0)
        sphere('Crown', 0.095, (0, 0, 0), m['cap_black'], scale=(1, 0.95, 0.75), parent=cap)
        box('Brim', (0.17, 0.11, 0.008), (0, -0.1, -0.055), m['cap_black'], rot=(math.radians(-25), 0, 0), bevel=0.003, parent=cap)
        path = os.path.join(HERE, 'refs', logo)
        if os.path.exists(path):
            bpy.ops.mesh.primitive_plane_add(size=0.07)
            dec = bpy.context.object; dec.name = f'Emblem {i}'; dec.parent = cap
            dec.location = (0, -0.087, 0.012); dec.rotation_euler = (math.radians(80), 0, 0)
            dec.data.materials.append(__import__('materials').image(f'Emblem {i}', path, rough=0.7))
    # longboard leaning against the wall
    lb = empty('Longboard', (-2.95, fy - 0.2, 0), 0)
    deck = box('Deck', (0.24, 0.012, 0.98), (0, 0.1, 0.52), m['teal'], rot=(math.radians(-12), 0, 0), bevel=0.01, parent=lb)
    for z in (0.18, 0.86):
        box('Truck', (0.18, 0.04, 0.03), (0, 0.06 + (z - 0.5) * 0.2, z), m['steel'], rot=(math.radians(-12), 0, 0), parent=lb)
        for sx in (-1, 1):
            cyl('Wheel', 0.035, 0.045, (sx * 0.1, 0.03 + (z - 0.5) * 0.2, z), m['plastic_white'], rot=(0, math.pi / 2, 0), parent=lb)
    # steel shelving with yellow-and-black toolboxes (Poly Haven CC0 frame)
    glb = os.path.join(REPO, 'assets', 'models', 'steel_frame_shelves_01.glb')
    if os.path.exists(glb):
        bpy.ops.import_scene.gltf(filepath=glb)
        sh = bpy.context.selected_objects[0]
        while sh.parent: sh = sh.parent
        sh.name = 'Steel shelf'; sh.scale = (0.08, 0.08, 0.08); sh.location = (-3.6, fy - 0.24, 0); sh.rotation_euler = (0, 0, math.pi)
    for i, z in enumerate((0.11, 0.52, 0.93)):
        tb = empty(f'Toolbox {i}', (-3.6, fy - 0.24, z), 0)
        box('Box', (0.42, 0.22, 0.2), (0, 0, 0.1), m['plastic_black'], bevel=0.01, parent=tb)
        box('Lid', (0.43, 0.23, 0.04), (0, 0, 0.21), m['yellow'], bevel=0.008, parent=tb)
        for sx in (-1, 1):
            box('Latch', (0.03, 0.012, 0.05), (sx * 0.15, -0.115, 0.19), m['yellow'], bevel=0.003, parent=tb)


# ---------------------------------------------------------------- outdoors
POND = dict(cx=14.0, cy=26.0, rx=9.0, ry=13.0)


def _height_land(x, y):
    d = max(0.0, y - 6.0)
    rise = 2.2 * (1 - math.exp(-d / 14.0)) + 0.012 * min(d, 300.0)
    hills = noise.noise(Vector((x * 0.008, y * 0.008, 0.3))) * 2.5 * min(1.0, d / 120)
    flat = min(1.0, max(0.0, (math.hypot(x + 0.4, y - 0.6) - 7.0) / 6.0))
    return (rise + hills) * flat - 0.02


def pond_level():
    p = POND
    ring = [_height_land(p['cx'] + math.cos(a) * p['rx'], p['cy'] + math.sin(a) * p['ry']) for a in [k / 24 * math.tau for k in range(24)]]
    return min(ring) - 0.25


def _height(x, y):
    """Ground height: flat around the workshop, the yard rising ~2 m toward the garage and truck,
    farmland that stays low so the far mountains show, and a hollow for the pond."""
    h = _height_land(x, y)
    p = POND
    q = ((x - p['cx']) / p['rx']) ** 2 + ((y - p['cy']) / p['ry']) ** 2
    if q < 1.6:
        bed = pond_level() - 0.8
        t = min(1.0, max(0.0, (q - 0.75) / 0.85))   # 0 inside the pond, 1 beyond its bank
        t = t * t * (3 - 2 * t)
        h = bed + (h - bed) * t
    return h


def outdoors(m, sun_dir):
    # terrain grid (dense near the workshop, coarse far away)
    bm = bmesh.new(); size, n = 2600.0, 200
    verts = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            u, v = i / n - 0.5, j / n - 0.5
            x = math.copysign(abs(u) ** 1.8, u) * size; y = math.copysign(abs(v) ** 1.8, v) * size
            row.append(bm.verts.new((x, y, _height(x, y))))
        verts.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    ground = _mesh_obj('Ground', bm, m['grass'])
    ground.data.materials.append(m['gravel'])
    for p in ground.data.polygons:
        p.use_smooth = True
        c = p.center
        # gravel yard in front of the workshop and toward the garage on the left
        if -32 < c.x < 4.0 and 4.4 < c.y < 34 and not (c.x > 0 and c.y > 22):
            p.material_index = 1
    # pond to the front right: a level water surface in its hollow
    p = POND; level = pond_level()
    bm = bmesh.new()
    vs = [bm.verts.new((p['cx'] + math.cos(a) * p['rx'] * 1.15, p['cy'] + math.sin(a) * p['ry'] * 1.15, level)) for a in [k / 48 * math.tau for k in range(48)]]
    bm.faces.new(vs)
    _mesh_obj('Pond', bm, m['water'])
    # distant mountains at the photo's scale: the main massif left of centre rising 13-16 degrees,
    # lower ground to the right where the city sits, a hazier range behind
    for name, dist, peak, span in (('Near ridge', 6500, 2900, 1.0), ('Far range', 13000, 4200, 0.8)):
        bm = bmesh.new(); cols, rows = 260, 22
        grid = []
        for j in range(rows + 1):
            row = []
            for i in range(cols + 1):
                a = (i / cols - 0.5) * math.radians(176)
                r = dist + j * (dist * 0.05)
                x, y = math.sin(a) * r, math.cos(a) * r
                az = math.degrees(a)
                envelope = math.exp(-((az + 6) / 22) ** 2) * 0.85 + 0.25 + 0.2 * math.exp(-((az - 32) / 15) ** 2)
                envelope *= 0.55 if 6 < az < 24 else 1.0     # a lower saddle behind the city
                ridge = (noise.noise(Vector((i * 0.03, dist * 0.001, 0))) * 0.5 + 0.5)
                ridge = 0.55 * ridge + 0.45 * (noise.noise(Vector((i * 0.13, 3.1, dist * 0.001))) * 0.5 + 0.5)
                h = peak * span * envelope * ridge * math.sin(math.pi * j / rows) ** 0.7
                row.append(bm.verts.new((x, y, h)))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        o = _mesh_obj(name, bm, m['mountain'])
        for p in o.data.polygons: p.use_smooth = True
