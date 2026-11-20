"""Vehicles, modelled from real-world dimensions (no badges, no number plates)."""
import math
import bpy, bmesh
from mathutils import Vector
from props import box, cyl, empty, sphere, _mesh_obj, _height
import materials as M


def paint(name, color, rough=0.3):
    return M.plain(name, color, rough=rough, coat=0.8, coat_rough=0.05)


def wheel(parent, loc, r, w, tyre, rim, mud=False):
    t = cyl('Tyre', r, w, loc, tyre, rot=(0, math.pi / 2, 0), seg=40, parent=parent)
    bev = t.modifiers.new('round', 'BEVEL'); bev.width = r * 0.18; bev.segments = 4
    cyl('Rim', r * 0.58, w + 0.01, loc, rim, rot=(0, math.pi / 2, 0), seg=32, parent=parent)
    cyl('Hub', r * 0.18, w + 0.03, loc, M.plain('Hub', (0.05, 0.05, 0.05), rough=0.5, metal=0.8) if not hasattr(wheel, 'hub') else wheel.hub, rot=(0, math.pi / 2, 0), seg=16, parent=parent)


def land_cruiser(m, loc, rot):
    """Toyota Land Cruiser 79 double cab: 5.2 m long, 1.87 m wide, 1.95 m tall, cream."""
    cream = paint('Cream paint', (0.72, 0.66, 0.53))
    trim = M.plain('Black trim', (0.02, 0.02, 0.02), rough=0.6)
    glass = M.plain('Tinted glass', (0.02, 0.025, 0.03), rough=0.02, coat=1.0, coat_rough=0.0)
    chrome = m['steel']; tyre = M.plain('Tyre rubber', (0.025, 0.025, 0.025), rough=0.85)
    lamp = M.plain('Headlamp', (0.9, 0.9, 0.85), rough=0.05, coat=1.0)
    g = empty('Land Cruiser', loc, rot)        # local +X = forward
    L, W = 5.2, 1.79
    # lower body and bonnet
    box('Body lower', (L - 0.3, W, 0.62), (0.05, 0, 0.82), cream, bevel=0.04, parent=g)
    box('Bonnet', (1.55, W - 0.04, 0.12), (1.7, 0, 1.18), cream, bevel=0.04, parent=g)
    box('Grille', (0.06, 1.2, 0.42), (2.48, 0, 0.98), trim, bevel=0.01, parent=g)
    for i in range(5):
        box('Grille bar', (0.07, 1.16, 0.02), (2.49, 0, 0.84 + i * 0.07), cream, bevel=0.004, parent=g)
    for sy in (-1, 1):
        cyl('Headlight', 0.1, 0.06, (2.49, sy * 0.68, 1.0), lamp, rot=(0, math.pi / 2, 0), parent=g)
        box('Indicator', (0.03, 0.12, 0.05), (2.48, sy * 0.68, 0.84), M.plain('Amber', (0.9, 0.45, 0.05), rough=0.1), bevel=0.005, parent=g)
    box('Bumper', (0.16, W + 0.06, 0.18), (2.62, 0, 0.6), chrome, bevel=0.02, parent=g)
    # cab: double cab with four doors, windows inset with dark glass
    box('Cab', (1.95, W - 0.06, 0.72), (0.12, 0, 1.5), cream, bevel=0.05, parent=g)
    box('Windscreen', (0.05, W - 0.22, 0.56), (1.1, 0, 1.52), glass, rot=(0, math.radians(-12), 0), bevel=0.01, parent=g)
    for sy in (-1, 1):
        for x in (0.55, -0.38):
            box('Side window', (0.78, 0.02, 0.46), (x, sy * (W / 2 - 0.02), 1.56), glass, bevel=0.01, parent=g)
        box('Door line', (0.008, 0.01, 0.95), (-0.05, sy * (W / 2 + 0.002), 1.25), trim, bevel=0, parent=g)
        box('Mirror', (0.06, 0.18, 0.14), (1.0, sy * (W / 2 + 0.12), 1.42), trim, bevel=0.01, parent=g)
        box('Wheel flare front', (0.95, 0.09, 0.2), (1.55, sy * (W / 2 + 0.02), 0.9), trim, bevel=0.03, parent=g)
        box('Wheel flare rear', (0.95, 0.09, 0.2), (-1.65, sy * (W / 2 + 0.02), 0.9), trim, bevel=0.03, parent=g)
        box('Side step', (1.9, 0.18, 0.04), (0.0, sy * (W / 2 + 0.06), 0.42), trim, bevel=0.01, parent=g)
    box('Rear window', (0.03, W - 0.3, 0.4), (-0.86, 0, 1.6), glass, bevel=0.01, parent=g)
    # snorkel up the right A-pillar
    cyl('Snorkel', 0.045, 1.1, (1.12, -W / 2 - 0.05, 1.45), trim, parent=g)
    box('Snorkel head', (0.18, 0.1, 0.12), (1.18, -W / 2 - 0.05, 2.02), trim, bevel=0.02, parent=g)
    # load bed (open tub)
    for sy in (-1, 1):
        box('Bed side', (2.0, 0.05, 0.42), (-1.92, sy * (W / 2 - 0.025), 1.33), cream, bevel=0.02, parent=g)
    box('Tailgate', (0.05, W, 0.42), (-2.92, 0, 1.33), cream, bevel=0.02, parent=g)
    box('Bed floor', (2.0, W - 0.1, 0.03), (-1.92, 0, 1.14), trim, bevel=0, parent=g)
    for sy in (-1, 1):
        box('Tail light', (0.03, 0.1, 0.22), (-2.95, sy * 0.8, 1.15), M.plain('Tail red', (0.6, 0.02, 0.02), rough=0.1), bevel=0.005, parent=g)
    box('Rear bumper', (0.14, W + 0.04, 0.16), (-3.0, 0, 0.6), chrome, bevel=0.02, parent=g)
    box('Chassis', (L - 0.6, 0.9, 0.18), (0, 0, 0.45), trim, bevel=0.01, parent=g)
    # 32-inch all-terrain tyres
    for x in (1.58, -1.6):
        for sy in (-1, 1):
            wheel(g, (x, sy * 0.79, 0.41), 0.41, 0.28, tyre, chrome)
    return g


def sports_car(name, loc, rot, color, length=4.55, width=1.94, height=1.18):
    """A low coupe: a shaped cage smoothed by subdivision, glasshouse and wheels."""
    body_mat = paint(name + ' paint', color, rough=0.25)
    glass = M.plain(name + ' glass', (0.01, 0.012, 0.015), rough=0.02, coat=1.0)
    tyre = M.plain('Tyre', (0.025, 0.025, 0.025), rough=0.8); rim = M.plain('Rim dark', (0.1, 0.1, 0.11), rough=0.3, metal=1.0)
    g = empty(name, loc, rot)
    bm = bmesh.new()
    # profile stations along the length: (x, half width, z bottom, z top)
    st = [(-0.5, 0.86, 0.18, 0.72), (-0.42, 0.95, 0.15, 0.8), (-0.2, 0.97, 0.14, 0.84), (0.05, 0.97, 0.14, 0.78),
          (0.3, 0.96, 0.14, 0.68), (0.47, 0.88, 0.17, 0.56), (0.5, 0.8, 0.22, 0.48)]
    rings = []
    for x, hw, zb, zt in st:
        ring = [bm.verts.new((x * length, sy * hw * width / 2, z * height)) for sy, z in ((-1, zb), (1, zb), (1, zt), (-1, zt))]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    body = _mesh_obj(name + ' body', bm, body_mat, g)
    sub = body.modifiers.new('smooth', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    for p in body.data.polygons: p.use_smooth = True
    # glasshouse
    gh = box(name + ' cabin', (length * 0.42, width * 0.78, height * 0.32), (-0.06 * length, 0, height * 0.92), glass, bevel=0.08, parent=g)
    for x in (0.31 * length, -0.33 * length):
        for sy in (-1, 1):
            cyl('Tyre', 0.34, 0.26, (x, sy * (width / 2 - 0.1), 0.34), tyre, rot=(0, math.pi / 2, 0), seg=32, parent=g)
            cyl('Rim', 0.24, 0.27, (x, sy * (width / 2 - 0.1), 0.34), rim, rot=(0, math.pi / 2, 0), seg=24, parent=g)
    return g


def vehicles(m):
    # the cream Land Cruiser on the gravel, nose toward the right
    x, y = -7.2, 16.0
    land_cruiser(m, (x, y, _height(x, y)), math.radians(-18))
    # inside the garage: orange sports car and dark blue-grey Mustang, parked neatly side by side
    garage = bpy.data.objects.get('Garage')
    if garage:
        for i, (name, col, off) in enumerate((('Orange sports car', (0.85, 0.28, 0.02), -1.45), ('Mustang', (0.06, 0.09, 0.13), 1.45))):
            c = sports_car(name, (off, 0.2, 0.05), math.radians(90), col, length=4.55 if i == 0 else 4.8, height=1.15 if i == 0 else 1.38)
            c.parent = garage
