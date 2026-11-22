"""Vehicles, modelled from published dimensions (no badges, no number plates).

Land Cruiser 79 double cab: 5.22 m long, 1.79 m body width, 3.18 m wheelbase, lifted about 5 cm on
33-inch mud-terrain tyres, as in the approved photo (cream paint, black flares, black steel bumper,
round headlamps in a black grille, dark multi-spoke wheels). Body panels are separate pieces with
4 mm gaps and rounded edges, so the shut lines read the way they do on a real car.
"""
import math
import bpy, bmesh
from mathutils import Vector, Matrix
from props import box, cyl, empty, sphere, _mesh_obj, _link, _height
import materials as M


# ---------------------------------------------------------------- materials
def paint(name, color, rough=0.32, ground_z=None, dust=0.0):
    """Clear-coated paint. With dust > 0 the lower body picks up fine road dust, fading out by 0.9 m."""
    m = M.plain(name, color, rough=rough, coat=1.0, coat_rough=0.03)
    if dust <= 0:
        return m
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    h = nt.nodes.new('ShaderNodeMapRange'); h.inputs['From Min'].default_value = ground_z + 0.95; h.inputs['From Max'].default_value = ground_z + 0.35
    nt.links.new(sep.outputs['Z'], h.inputs['Value'])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 9.0; n.inputs['Detail'].default_value = 8
    nt.links.new(geo.outputs['Position'], n.inputs['Vector'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    nt.links.new(h.outputs['Result'], mul.inputs[0]); nt.links.new(n.outputs['Fac'], mul.inputs[1])
    amt = nt.nodes.new('ShaderNodeMath'); amt.operation = 'MULTIPLY'; amt.inputs[1].default_value = dust * 1.6; amt.use_clamp = True
    nt.links.new(mul.outputs['Value'], amt.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (*color, 1); mix.inputs['B'].default_value = (0.42, 0.34, 0.25, 1)
    nt.links.new(amt.outputs['Value'], mix.inputs['Factor']); nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough; rr.inputs['To Max'].default_value = 0.85
    nt.links.new(amt.outputs['Value'], rr.inputs['Value']); nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs['To Min'].default_value = 1.0; cr.inputs['To Max'].default_value = 0.1
    nt.links.new(amt.outputs['Value'], cr.inputs['Value']); nt.links.new(cr.outputs['Result'], b.inputs['Coat Weight'])
    return m


def textured_plastic(name, color=(0.025, 0.025, 0.025)):
    """Black textured plastic (flares, mirrors, bumpers trim): fine stipple bump, satin."""
    m = M.plain(name, color, rough=0.55)
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 900.0
    M._bump(nt, b, n.outputs['Fac'], strength=0.08, distance=0.001)
    return m


def glass_mat(name, tint=(0.55, 0.6, 0.6)):
    m = M.plain(name, tint, rough=0.0)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['IOR'].default_value = 1.5
    return m


def rubber():
    m = M.plain('Tyre rubber', (0.028, 0.027, 0.026), rough=0.82)
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    # dusty, worn rubber: a little brown in the grooves and on the shoulders
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 60.0; n.inputs['Detail'].default_value = 6
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (0.028, 0.027, 0.026, 1); mix.inputs['B'].default_value = (0.12, 0.095, 0.07, 1)
    r = nt.nodes.new('ShaderNodeMapRange'); r.inputs['From Min'].default_value = 0.45; r.inputs['From Max'].default_value = 0.75; r.inputs['To Max'].default_value = 0.55
    nt.links.new(n.outputs['Fac'], r.inputs['Value']); nt.links.new(r.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    M._bump(nt, b, n.outputs['Fac'], strength=0.1, distance=0.002)
    return m


# ---------------------------------------------------------------- mesh helpers
def _finish(o, bevel=0.012, seg=3, angle=30, smooth=True):
    for p in o.data.polygons: p.use_smooth = smooth
    if bevel > 0:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'
        bv.angle_limit = math.radians(angle); bv.harden_normals = True
    return o


def prism_y(name, pts, y0, y1, mat, parent, bevel=0.012, seg=3):
    """A side profile [(x, z)...] (counter-clockwise seen from +Y) extruded from y0 to y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_obj(name, bm, mat, parent), bevel, seg)


def prism_z(name, pts, z0, z1, mat, parent, bevel=0.01, seg=2):
    """A plan outline [(x, y)...] extruded from z0 to z1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in pts]
    b = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_obj(name, bm, mat, parent), bevel, seg)


def cutter_box(parent, size, loc, rot=(0, 0, 0), mat=None):
    c = box('cutter', size, loc, mat, rot=rot, bevel=0, parent=parent)
    c.hide_render = True; c.display_type = 'WIRE'; c.hide_viewport = True
    return c


def cutter_cyl(parent, r, h, loc, mat=None):
    c = cyl('cutter', r, h, loc, mat, rot=(math.pi / 2, 0, 0), seg=64, parent=parent)
    c.hide_render = True; c.display_type = 'WIRE'; c.hide_viewport = True
    return c


def cutter_prism(parent, pts, y0, y1, mat=None):
    c = prism_y('cutter', pts, y0, y1, mat, parent, bevel=0)
    c.hide_render = True; c.display_type = 'WIRE'; c.hide_viewport = True
    return c


def arch_liner(parent, x, z, r, y0, y1, mat, a0=-12, a1=192):
    """The inside of a wheel arch: a curved liner and an inner wall, so the arch is not a hole."""
    bm = bmesh.new(); segs = 28
    A = [bm.verts.new((x + r * math.cos(math.radians(a0 + (a1 - a0) * k / segs)), y0, z + r * math.sin(math.radians(a0 + (a1 - a0) * k / segs)))) for k in range(segs + 1)]
    B = [bm.verts.new((v.co.x, y1, v.co.z)) for v in A]
    for i in range(segs):
        bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
    c = bm.verts.new((x, y0, z))
    for i in range(segs):
        bm.faces.new((c, A[i + 1], A[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _mesh_obj('Arch liner', bm, mat, parent)
    sol = o.modifiers.new('t', 'SOLIDIFY'); sol.thickness = 0.01
    return o


def cut(o, cutter, first=True):
    bo = o.modifiers.new('cut', 'BOOLEAN'); bo.object = cutter; bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'
    bo.material_mode = 'TRANSFER'
    # booleans go before the bevel so the cut edges are rounded too
    o.modifiers.move(len(o.modifiers) - 1, 0 if first else len(o.modifiers) - 1)
    return bo


def _add_box(bm, size, mat4):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r['verts']
    bmesh.ops.scale(bm, vec=Vector(size), verts=vs)
    bmesh.ops.transform(bm, matrix=mat4, verts=vs)


def revolve_y(name, profile, seg, mat, parent, loc):
    """Revolve a profile [(r, y)...] about the local Y axis (an axle)."""
    bm = bmesh.new()
    rings = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        rings.append([bm.verts.new((r * math.cos(a), y, r * math.sin(a))) for r, y in profile])
    for k in range(seg):
        A, B = rings[k], rings[(k + 1) % seg]
        for i in range(len(profile) - 1):
            bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _mesh_obj(name, bm, mat, parent); o.location = loc
    for p in o.data.polygons: p.use_smooth = True
    return o


# ---------------------------------------------------------------- wheels
def wheel(parent, loc, side, tyre, rim, R=0.42, width=0.29, rim_r=0.216, spokes=8, mt=True, sidewall=None):
    """A tyre with a real tread (mud-terrain blocks or a road pattern), a dished multi-spoke rim,
    lug nuts and a brake disc. side: +1 for the car's left, -1 for the right (outward = side * Y)."""
    cx, cy, cz = loc
    s = side
    hw = width / 2
    sw = (R - rim_r) if sidewall is None else sidewall
    prof = [(rim_r + 0.006, -hw + 0.02), (rim_r + sw * 0.35, -hw - 0.012), (rim_r + sw * 0.75, -hw - 0.006),
            (R - 0.022, -hw + 0.004), (R - 0.006, -hw + 0.03), (R - 0.006, hw - 0.03), (R - 0.022, hw - 0.004),
            (rim_r + sw * 0.75, hw + 0.006), (rim_r + sw * 0.35, hw + 0.012), (rim_r + 0.006, hw - 0.02)]
    t = revolve_y('Tyre', prof, 96, tyre, parent, (cx, cy, cz))
    # tread blocks, built in one mesh
    bm = bmesh.new()
    n = 34 if mt else 60
    for k in range(n):
        for half in (0, 1):
            a = 2 * math.pi * (k + 0.5 * half) / n
            rot = Matrix.Rotation(-a, 4, 'Y')
            if mt:
                # staggered centre blocks and big shoulder lugs that wrap onto the sidewall
                yc = (-0.045 if half == 0 else 0.045)
                _add_box(bm, (0.017, 0.07, 0.05), rot @ Matrix.Translation((R + 0.002, yc, 0)))
                ys = (hw - 0.035) * (1 if half == 0 else -1)
                _add_box(bm, (0.02, 0.07, 0.058), rot @ Matrix.Translation((R + 0.001, ys, 0)))
                _add_box(bm, (0.05, 0.016, 0.05), rot @ Matrix.Translation((R - 0.03, (hw + 0.004) * (1 if ys > 0 else -1), 0)))
            else:
                yc = (-0.06 if half == 0 else 0.06)
                _add_box(bm, (0.006, 0.08, 0.03), rot @ Matrix.Translation((R - 0.002, yc, 0)) @ Matrix.Rotation(0.5 if half else -0.5, 4, 'X'))
    tr = _mesh_obj('Tread', bm, tyre, parent); tr.location = (cx, cy, cz)
    bv = tr.modifiers.new('bevel', 'BEVEL'); bv.width = 0.004 if mt else 0.0015; bv.segments = 2
    # rim barrel (inner, dark) and outer lip
    revolve_y('Rim barrel', [(rim_r - 0.005, -hw + 0.03), (rim_r - 0.012, -hw + 0.05), (rim_r - 0.012, hw - 0.05), (rim_r - 0.005, hw - 0.03)],
              64, rim, parent, (cx, cy, cz))
    face_y = s * (hw - 0.035)                       # outer face of the spokes
    lip = revolve_y('Rim lip', [(rim_r - 0.03, face_y), (rim_r + 0.008, face_y + s * 0.006), (rim_r + 0.012, face_y - s * 0.01), (rim_r - 0.005, face_y - s * 0.04)],
                    64, rim, parent, (cx, cy, cz))
    # spokes: each a tapered, slightly dished bar from the hub to the lip
    bm = bmesh.new()
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        rot = Matrix.Rotation(-a, 4, 'Y')
        for sub in (-1, 1):   # split spokes (pairs) read like the photo's multi-spoke wheel
            off = Matrix.Rotation(-sub * 0.09, 4, 'Y')
            _add_box(bm, (rim_r - 0.07, 0.03, 0.022), rot @ off @ Matrix.Translation(((rim_r + 0.07) / 2, face_y - s * 0.012, 0)) @ Matrix.Rotation(s * 0.12, 4, 'Z'))
    sp = _mesh_obj('Spokes', bm, rim, parent); sp.location = (cx, cy, cz)
    bv = sp.modifiers.new('bevel', 'BEVEL'); bv.width = 0.005; bv.segments = 2
    for p in sp.data.polygons: p.use_smooth = True
    hub = cyl('Hub', 0.075, 0.05, (cx, cy + s * (hw - 0.05), cz), rim, rot=(math.pi / 2, 0, 0), seg=32, parent=parent)
    _finish(hub, 0.008, 3)
    cyl('Centre cap', 0.032, 0.012, (cx, cy + s * (hw - 0.022), cz), M.plain('Cap', (0.02, 0.02, 0.02), rough=0.3), rot=(math.pi / 2, 0, 0), seg=24, parent=parent)
    nut = M.plain('Lug nut', (0.6, 0.6, 0.6), rough=0.25, metal=1.0)
    for k in range(6):
        a = 2 * math.pi * k / 6
        cyl('Lug nut', 0.011, 0.02, (cx + 0.055 * math.cos(a), cy + s * (hw - 0.03), cz + 0.055 * math.sin(a)), nut, rot=(math.pi / 2, 0, 0), seg=6, parent=parent)
    cyl('Brake disc', rim_r - 0.04, 0.025, (cx, cy + s * (hw - 0.13), cz), M.plain('Brake', (0.18, 0.17, 0.16), rough=0.4, metal=1.0), rot=(math.pi / 2, 0, 0), seg=40, parent=parent)
    return t


# ---------------------------------------------------------------- Land Cruiser 79 double cab
def land_cruiser(m, loc, rot):
    gz = loc[2]
    cream = paint('Cream paint', (0.66, 0.61, 0.50), ground_z=gz, dust=0.7)
    black = textured_plastic('Black plastic')
    steel_black = M.plain('Black steel', (0.03, 0.03, 0.032), rough=0.45, metal=0.6)
    gl = glass_mat('Car glass', (0.42, 0.46, 0.46))
    seal = M.plain('Window seal', (0.015, 0.015, 0.015), rough=0.7)
    interior = M.plain('Interior grey', (0.06, 0.06, 0.065), rough=0.8)
    under = M.plain('Underbody', (0.05, 0.048, 0.045), rough=0.8, metal=0.2)
    chrome = M.plain('Lamp reflector', (0.85, 0.85, 0.85), rough=0.08, metal=1.0)
    lens = glass_mat('Lamp lens', (0.95, 0.95, 0.95))
    amber = M.plain('Amber lens', (0.9, 0.42, 0.04), rough=0.08)
    red = M.plain('Tail lens', (0.55, 0.02, 0.02), rough=0.08, coat=1.0)
    rim = M.plain('Wheel gunmetal', (0.12, 0.115, 0.11), rough=0.35, metal=1.0)
    tyre = rubber()

    g = empty('Land Cruiser', loc, rot)        # local +X = forward, +Y = left (right-hand drive: wheel on -Y)
    W = 1.79; hw = W / 2
    FA, RA, WR = 1.59, -1.59, 0.42             # axles and wheel radius
    AR = 0.53                                  # wheel-arch radius

    # arch cutters only reach 0.35 m in from each side, so the body keeps an inner wall
    arches = {(ax, sy): cutter_cyl(g, AR, 0.5, (ax, sy * (hw - 0.1), WR)) for ax in (FA, RA) for sy in (-1, 1)}
    for (ax, sy) in arches:
        arch_liner(g, ax, WR, AR - 0.004, sy * (hw - 0.33), sy * (hw + 0.01), under)

    # --- front: fenders, bonnet, grille panel, engine bay closure
    fender = [(2.30, 0.74), (2.36, 0.80), (2.37, 1.26), (2.31, 1.31), (0.66, 1.355), (0.62, 1.30), (0.62, 0.66), (1.0, 0.66)]
    for sy in (-1, 1):
        y0, y1 = (0.704, hw) if sy > 0 else (-hw, -0.704)
        f = prism_y('Front fender', fender, y0, y1, cream, g, bevel=0.016)
        cut(f, arches[(FA, sy)])
    bon = [(2.33, 1.20), (2.36, 1.255), (2.30, 1.305), (0.68, 1.355), (0.68, 1.31), (2.28, 1.255)]
    prism_y('Bonnet', bon, -0.70, 0.70, cream, g, bevel=0.012)
    box('Engine bay', (1.62, 1.39, 0.5), (1.48, 0, 1.03), under, bevel=0, parent=g)
    grille = prism_y('Grille panel', [(2.335, 0.82), (2.385, 0.82), (2.395, 1.25), (2.345, 1.25)], -0.86, 0.86, black, g, bevel=0.008)
    for i in range(6):
        box('Grille slat', (0.03, 0.80, 0.022), (2.40, 0, 0.92 + i * 0.05), steel_black, bevel=0.004, parent=g)
    for sy in (-1, 1):
        y = sy * 0.62
        box('Headlamp bezel', (0.04, 0.27, 0.25), (2.40, y, 1.07), black, bevel=0.012, parent=g)
        bowl = sphere('Headlamp reflector', 0.09, (2.40, y, 1.07), chrome, scale=(0.5, 1, 1), parent=g, seg=32)
        sphere('Headlamp lens', 0.092, (2.405, y, 1.07), lens, scale=(0.35, 1, 1), parent=g, seg=32)
        box('Indicator', (0.03, 0.07, 0.16), (2.39, sy * 0.81, 1.06), amber, bevel=0.006, parent=g)
    # --- black steel bumper with a skid plate
    bump = [(2.34, -0.93), (2.47, -0.93), (2.56, -0.74), (2.57, 0.0), (2.56, 0.74), (2.47, 0.93), (2.34, 0.93)]
    prism_z('Front bumper', bump, 0.62, 0.86, steel_black, g, bevel=0.012)
    box('Skid plate', (0.55, 0.9, 0.012), (2.15, 0, 0.6), steel_black, rot=(0, math.radians(-8), 0), bevel=0.004, parent=g)
    for sy in (-1, 1):
        box('Recovery point', (0.1, 0.03, 0.06), (2.6, sy * 0.45, 0.7), M.plain('Red recovery', (0.5, 0.03, 0.02), rough=0.4), bevel=0.006, parent=g)

    # --- cab: one shell, hollowed, with window openings (the cut faces take the black seal material)
    cab = [(0.64, 0.64), (0.64, 1.40), (0.42, 1.99), (0.38, 2.02), (-1.25, 2.02), (-1.30, 1.98), (-1.31, 0.64)]
    shell = prism_y('Cab', cab, -hw, hw, cream, g, bevel=0.02)
    inner = cutter_box(g, (1.82, W - 0.11, 1.15), (-0.32, 0, 1.36), mat=interior)
    ws = cutter_box(g, (0.2, W - 0.24, 0.52), (0.535, 0, 1.70), rot=(0, math.radians(-20.5), 0), mat=seal)
    rw = cutter_box(g, (0.3, W - 0.5, 0.36), (-1.30, 0, 1.70), mat=seal)
    # side windows: the front one follows the A-pillar (pillar line x(z) = 0.64 - 0.373 (z - 1.40))
    z0, z1 = 1.465, 1.935
    xf = lambda z: 0.64 - 0.373 * (z - 1.40) - 0.075
    FRONT_WIN = [(-0.19, z0), (xf(z0), z0), (xf(z1), z1), (-0.19, z1)]
    REAR_WIN = [(-1.05, z0), (-0.35, z0), (-0.35, z1), (-1.05, z1)]
    wins = [cutter_prism(g, FRONT_WIN, -hw - 0.2, hw + 0.2, seal), cutter_prism(g, REAR_WIN, -hw - 0.2, hw + 0.2, seal)]
    for c in [inner, ws, rw] + wins + [arches[(RA, -1)], arches[(RA, 1)]]:
        cut(shell, c)
    # door shut lines: 4 mm grooves, 8 mm deep
    for sy in (-1, 1):
        for x0 in (-0.23, -1.21):
            cut(shell, cutter_box(g, (0.004, 0.016, 1.34), (x0, sy * hw, 1.32), mat=seal))
        cut(shell, cutter_box(g, (0.004, 0.016, 0.76), (0.60, sy * hw, 1.02), mat=seal))
    # glass (5 mm, real transmission) in each opening
    box('Windscreen', (0.005, W - 0.26, 0.56), (0.528, 0, 1.70), gl, rot=(0, math.radians(-20.5), 0), bevel=0, parent=g)
    box('Rear window', (0.005, W - 0.52, 0.36), (-1.285, 0, 1.70), gl, bevel=0, parent=g)
    for sy in (-1, 1):
        y = sy * (hw - 0.025)
        yg = (y - 0.0025, y + 0.0025)
        prism_y('Door glass', FRONT_WIN, *yg, gl, g, bevel=0)
        prism_y('Rear door glass', REAR_WIN, *yg, gl, g, bevel=0)
        box('B-pillar trim', (0.16, 0.006, 0.47), (-0.27, sy * (hw + 0.002), 1.70), seal, bevel=0.002, parent=g)
        # handles, mirrors, step
        for x in (0.05, -1.05):
            box('Door handle', (0.14, 0.03, 0.035), (x, sy * (hw + 0.012), 1.30), black, bevel=0.01, parent=g)
        arm = box('Mirror arm', (0.12, 0.10, 0.04), (0.56, sy * (hw + 0.05), 1.46), black, bevel=0.01, parent=g)
        mh = box('Mirror', (0.08, 0.2, 0.25), (0.55, sy * (hw + 0.17), 1.52), black, bevel=0.03, parent=g)
        box('Mirror glass', (0.005, 0.17, 0.21), (0.505, sy * (hw + 0.17), 1.52), M.plain('Mirror', (0.9, 0.9, 0.9), rough=0.02, metal=1.0), bevel=0, parent=g)
        box('Side step', (1.75, 0.16, 0.035), (-0.30, sy * (hw + 0.03), 0.52), steel_black, bevel=0.008, parent=g)
        for x in (0.4, -1.0):
            box('Step bracket', (0.05, 0.12, 0.12), (x, sy * (hw - 0.04), 0.58), steel_black, bevel=0.004, parent=g)
    # wipers and aerial
    for y in (-0.35, 0.25):
        box('Wiper', (0.012, 0.52, 0.012), (0.66, y, 1.44), black, rot=(0, math.radians(-20), math.radians(8)), bevel=0.003, parent=g)
    cyl('Aerial', 0.003, 0.7, (0.62, 0.86, 1.68), black, rot=(0, math.radians(-15), 0), seg=8, parent=g)
    box('Rain gutter', (1.65, 0.015, 0.012), (-0.43, hw - 0.005, 2.01), cream, bevel=0.004, parent=g)
    box('Rain gutter', (1.65, 0.015, 0.012), (-0.43, -hw + 0.005, 2.01), cream, bevel=0.004, parent=g)

    # --- interior seen through the glass (right-hand drive)
    box('Dashboard', (0.32, W - 0.14, 0.24), (0.48, 0, 1.32), interior, bevel=0.03, parent=g)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=False, segments=32, radius1=0.19, radius2=0.19, depth=0.025)
    sw = _mesh_obj('Steering wheel', bm, interior, g); sw.location = (0.30, -0.38, 1.42); sw.rotation_euler = (0, math.radians(62), 0)
    sol = sw.modifiers.new('t', 'SOLIDIFY'); sol.thickness = 0.03
    for x, ys in ((-0.02, (-0.38, 0.38)), (-0.95, (-0.38, 0.0, 0.38))):
        for y in ys:
            box('Seat base', (0.5, 0.36 if len(ys) == 2 else 0.4, 0.28), (x, y, 0.93), interior, bevel=0.04, parent=g)
            box('Seat back', (0.13, 0.36 if len(ys) == 2 else 0.4, 0.62), (x - 0.25, y, 1.38), interior, rot=(0, math.radians(-12), 0), bevel=0.05, parent=g)
            box('Headrest', (0.09, 0.22, 0.16), (x - 0.32, y, 1.78), interior, rot=(0, math.radians(-12), 0), bevel=0.04, parent=g)

    # --- load tub
    tub = prism_y('Tub', [(-1.37, 0.86), (-1.37, 1.39), (-2.81, 1.39), (-2.81, 0.86)], -hw, hw, cream, g, bevel=0.015)
    cut(tub, cutter_box(g, (1.34, W - 0.1, 0.8), (-2.09, 0, 1.40)))
    cut(tub, arches[(RA, -1)]); cut(tub, arches[(RA, 1)])
    cut(tub, cutter_box(g, (0.004, W + 0.1, 0.46), (-2.785, 0, 1.13)))    # tailgate shut line
    box('Tub floor', (1.34, W - 0.1, 0.02), (-2.09, 0, 1.01), M.plain('Bed liner', (0.03, 0.03, 0.03), rough=0.9), bevel=0, parent=g)
    for i in range(6):
        box('Bed rib', (1.32, 0.03, 0.012), (-2.09, -0.65 + i * 0.26, 1.026), M.plain('Bed liner', (0.03, 0.03, 0.03), rough=0.9), bevel=0.004, parent=g)
    for sy in (-1, 1):
        box('Tail light', (0.03, 0.11, 0.30), (-2.82, sy * 0.80, 1.14), red, bevel=0.008, parent=g)
        box('Tail light amber', (0.031, 0.11, 0.06), (-2.82, sy * 0.80, 0.96), amber, bevel=0.006, parent=g)
        box('Tub rail cap', (1.44, 0.07, 0.02), (-2.09, sy * (hw - 0.03), 1.395), black, bevel=0.006, parent=g)
    box('Tailgate latch', (0.02, 0.18, 0.04), (-2.82, 0, 1.30), black, bevel=0.005, parent=g)
    box('Rear step bumper', (0.16, W - 0.1, 0.13), (-2.86, 0, 0.74), steel_black, bevel=0.012, parent=g)
    box('Tow hitch', (0.25, 0.07, 0.07), (-2.98, 0, 0.62), steel_black, bevel=0.006, parent=g)

    # --- flares (black, following each arch) and mud flaps
    for ax in (FA, RA):
        for sy in (-1, 1):
            bm = bmesh.new()
            segs = 28; a0, a1 = math.radians(-12), math.radians(192)
            r0, r1 = AR - 0.005, AR + 0.11
            y0, y1 = sy * (hw - 0.02), sy * (hw + 0.075)
            ring = []
            for k in range(segs + 1):
                a = a0 + (a1 - a0) * k / segs
                c, s_ = math.cos(a), math.sin(a)
                ring.append([bm.verts.new((ax + r * c, y, WR + r * s_)) for r, y in ((r0, y0), (r0, y1), (r1, y1), (r1, y0))])
            for A, B in zip(ring, ring[1:]):
                for i in range(4):
                    bm.faces.new((A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]))
            bm.faces.new(ring[0]); bm.faces.new(ring[-1][::-1])
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            _finish(_mesh_obj('Wheel flare', bm, black, g), 0.012, 3)
        if ax == RA:
            for sy in (-1, 1):
                box('Mud flap', (0.012, 0.3, 0.32), (RA - 0.55, sy * (hw - 0.12), 0.42), black, bevel=0.004, parent=g)

    # --- chassis and running gear (it shows under a lifted truck)
    for sy in (-1, 1):
        box('Chassis rail', (5.0, 0.07, 0.2), (-0.15, sy * 0.43, 0.70), under, bevel=0.006, parent=g)
    for x in (2.1, 0.9, -0.6, -2.2):
        box('Cross member', (0.08, 0.86, 0.1), (x, 0, 0.70), under, bevel=0.005, parent=g)
    for ax, dx in ((FA, 0.12), (RA, 0.0)):
        cyl('Axle', 0.045, 1.5, (ax, 0, WR), under, rot=(math.pi / 2, 0, 0), seg=16, parent=g)
        sphere('Differential', 0.15, (ax, 0.1 if ax > 0 else 0.0, WR), under, scale=(1, 0.8, 0.95), parent=g)
        for sy in (-1, 1):
            cyl('Shock absorber', 0.03, 0.42, (ax + (0.12 if ax > 0 else -0.18), sy * 0.52, 0.62), M.plain('Shock', (0.55, 0.3, 0.05), rough=0.4, metal=0.3), rot=(0, math.radians(10), 0), seg=12, parent=g)
            if ax > 0:   # front coils
                for i in range(7):
                    tor = cyl('Coil', 0.075, 0.015, (ax - 0.08, sy * 0.43, WR + 0.08 + i * 0.035), under, seg=20, parent=g)
            else:        # rear leaf springs
                for i in range(4):
                    box('Leaf', (1.25 - i * 0.18, 0.07, 0.012), (ax, sy * 0.43, WR + 0.07 - i * 0.014), under, bevel=0.003, parent=g)
    box('Fuel tank', (0.8, 0.45, 0.25), (-0.7, -0.15, 0.66), under, bevel=0.03, parent=g)
    cyl('Exhaust', 0.03, 3.0, (-1.0, 0.25, 0.6), under, rot=(0, math.pi / 2, 0), seg=12, parent=g)
    cyl('Propshaft', 0.035, 2.6, (0.0, 0.0, 0.55), under, rot=(0, math.pi / 2, 0), seg=12, parent=g)
    box('Transfer case', (0.4, 0.3, 0.25), (0.75, 0, 0.62), under, bevel=0.03, parent=g)
    revolve_y('Spare tyre', [(0.22, -0.14), (0.32, -0.15), (0.41, -0.13), (0.42, 0.0), (0.41, 0.13), (0.32, 0.15), (0.22, 0.14)], 48, tyre, g, (-2.25, 0, 0.56)).rotation_euler = (math.pi / 2, 0, 0)

    # --- wheels
    for ax in (FA, RA):
        for sy in (-1, 1):
            wheel(g, (ax, sy * 0.78, WR), sy, tyre, rim, R=WR, width=0.29, rim_r=0.216, spokes=6, mt=True)
    return g


# ---------------------------------------------------------------- sports cars
def sports_car(name, loc, rot, color, kind='mid'):
    """Two coupes, from station profiles smoothed by subdivision: a mid-engined car (low nose, cab
    forward) and a front-engined fastback (long bonnet). Glass, lights and wheels in their arches."""
    if kind == 'mid':
        L, Wd, H, wb, R = 4.55, 1.96, 1.17, 2.65, 0.34
        # (x/L, half width/W, bottom z, shoulder z, top z, top half width/W)
        st = [(0.5, 0.80, 0.13, 0.42, 0.50, 0.70), (0.47, 0.92, 0.11, 0.50, 0.58, 0.82), (0.36, 0.98, 0.10, 0.62, 0.68, 0.88),
              (0.22, 0.97, 0.10, 0.66, 0.86, 0.66), (0.05, 0.96, 0.10, 0.70, 1.0, 0.56), (-0.12, 0.98, 0.10, 0.72, 0.98, 0.55),
              (-0.28, 1.0, 0.10, 0.74, 0.86, 0.66), (-0.40, 0.99, 0.11, 0.74, 0.80, 0.84), (-0.48, 0.92, 0.14, 0.72, 0.76, 0.86),
              (-0.5, 0.84, 0.2, 0.66, 0.70, 0.80)]
        glass_band = (0.22, -0.28)
    else:
        L, Wd, H, wb, R = 4.79, 1.92, 1.38, 2.72, 0.35
        st = [(0.5, 0.82, 0.16, 0.52, 0.58, 0.72), (0.46, 0.94, 0.13, 0.60, 0.66, 0.84), (0.30, 0.98, 0.12, 0.66, 0.72, 0.88),
              (0.12, 0.98, 0.12, 0.68, 0.76, 0.86), (0.02, 0.97, 0.12, 0.70, 0.96, 0.62), (-0.14, 0.97, 0.12, 0.70, 1.0, 0.58),
              (-0.30, 0.99, 0.12, 0.71, 0.86, 0.62), (-0.42, 0.98, 0.13, 0.71, 0.76, 0.84), (-0.49, 0.9, 0.18, 0.70, 0.74, 0.86),
              (-0.5, 0.84, 0.24, 0.64, 0.70, 0.80)]
        glass_band = (0.04, -0.36)
    gz = 0.0
    body_mat = paint(name + ' paint', color, rough=0.22)
    gl = M.plain(name + ' glass', (0.008, 0.009, 0.011), rough=0.02, coat=1.0)
    tyre = rubber(); rim = M.plain(name + ' rim', (0.08, 0.08, 0.085), rough=0.3, metal=1.0)
    g = empty(name, loc, rot)
    bm = bmesh.new()
    rings = []
    for x, hw, zb, zs, zt, tw in st:
        X = x * L
        pts = [(-0.9 * hw, zb), (0.9 * hw, zb), (hw, zb + 0.12), (hw, zs), (tw * 0.98, zs + 0.04), (tw, min(zt, zs + 0.08)),
               (tw * 0.75, zt), (-tw * 0.75, zt), (-tw, min(zt, zs + 0.08)), (-tw * 0.98, zs + 0.04), (-hw, zs), (-hw, zb + 0.12)]
        rings.append([bm.verts.new((X, p[0] * Wd / 2, p[1] * H)) for p in pts])
    n = len(rings[0])
    gfaces = []
    for i, (a, b) in enumerate(zip(rings, rings[1:])):
        x_mid = (st[i][0] + st[i + 1][0]) / 2
        for k in range(n):
            f = bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
            # the cabin's upper faces (sides and screens) are glass
            if glass_band[1] < x_mid < glass_band[0] and (k in (4, 5, 7, 8) or (k == 6 and x_mid > glass_band[0] - 0.2)):
                gfaces.append(f)
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in gfaces: f.material_index = 1
    body = _mesh_obj(name + ' body', bm, body_mat, g); body.data.materials.append(gl)
    for p in body.data.polygons: p.use_smooth = True
    sub = body.modifiers.new('smooth', 'SUBSURF'); sub.levels = 2; sub.render_levels = 3
    for x in (wb / 2, -wb / 2):
        for sy in (-1, 1):
            cut(body, cutter_cyl(g, R + 0.06, 0.6, (x, sy * Wd / 2, R)), first=False)
            arch_liner(g, x, R, R + 0.055, sy * (Wd / 2 - 0.3), sy * (Wd / 2 + 0.01), M.plain('Well', (0.01, 0.01, 0.01), rough=0.9))
            wheel(g, (x, sy * (Wd / 2 - 0.16), R), sy, tyre, rim, R=R, width=0.27, rim_r=0.24, spokes=5, mt=False, sidewall=0.10)
    lamp = M.emission(name + ' lamp', (1, 0.95, 0.88), 3.0)
    tail = M.emission(name + ' tail', (0.9, 0.05, 0.03), 0.6)
    front = st[0][0] * L
    for sy in (-1, 1):
        box('Headlamp', (0.12, 0.30, 0.04), (front - 0.10, sy * Wd * 0.33, st[1][3] * H - 0.04), lamp, rot=(0, math.radians(-12), sy * math.radians(10)), bevel=0.01, parent=g)
        box('Tail lamp', (0.03, 0.4, 0.05), (-L / 2 - 0.0, sy * Wd * 0.28, st[-2][3] * H - 0.05), tail, bevel=0.01, parent=g)
    return g


def vehicles(m):
    # the cream Land Cruiser on the gravel, nose toward the right
    x, y = -4.8, 17.0
    land_cruiser(m, (x, y, _height(x, y)), math.radians(-18))
    # inside the garage: orange sports car and dark blue-grey Mustang-style fastback, noses out
    garage = bpy.data.objects.get('Garage')
    if garage:
        for name, col, off, kind in (('Orange sports car', (0.85, 0.25, 0.02), -1.5, 'mid'), ('Fastback', (0.07, 0.09, 0.12), 1.5, 'front')):
            c = sports_car(name, (off, 0.4, 0.08), math.radians(-90), col, kind)
            c.parent = garage
