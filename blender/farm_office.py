"""
Pass 6: the modern farm office and a farm you can see from it.

- interior(): pendant lights, a jute rug, framed photos (Leruo's own, from assets/), books, a
  window seat and a floor lamp, so the room reads as a clean, modern farm-style office.
- esp32_kit(): the bench made obviously an ESP32 build: a DevKit on a breadboard with jumpers, a
  second board in a printed case wired to soil probes in a seedling tray, a DHT22, a relay and a
  little pump, an OLED readout, a USB lead, a pinout card and a folded label card.
- farm(): crop fields, a windpump and dam, silos by a bigger barn, a chicken coop in the yard and a
  tractor; mountains(): ranges all the way round; city(): a skyline in front of them.
Lights and glowing materials that belong to the interior are named 'Int ...' so timeofday.py can
switch them per time of day.
"""
import math, os, random
import bmesh, bpy
from mathutils import Vector, noise
from props import box, cyl, sphere, tube_path, empty, _mesh_obj, _height, ROOM, DESK, BENCH
import materials as M

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
GEN = os.path.join(HERE, 'assets', 'gen')

# crop fields (x0, x1, y0, y1, kind): the grass blades and trees keep out of them
FIELDS = [(-62, -18, 46, 104, 'maize'), (14, 62, 70, 140, 'wheat'), (-70, 30, -110, -24, 'rows'),
          (-130, -26, -46, 16, 'ploughed'), (-80, -40, 108, 170, 'rows'), (64, 120, 20, 90, 'maize')]
COOP = (-6.5, 12.5)     # chicken coop in the yard (the chickens are drawn live on the page)


def in_field(x, y, pad=0.0):
    return any(x0 - pad < x < x1 + pad and y0 - pad < y < y1 + pad for x0, x1, y0, y1, _ in FIELDS)


def _light(name, kind, loc, energy, color, size=0.05, parent=None):
    L = bpy.data.lights.new(name, kind); L.energy = energy; L.color = color
    if kind in ('POINT', 'SPOT'): L.shadow_soft_size = size
    o = bpy.data.objects.new(name, L); o.location = loc
    if parent is not None: o.parent = parent
    bpy.context.scene.collection.objects.link(o)
    o['base_energy'] = energy
    return o


def _img_mat(name, path, rough=0.4, emit=0.0):
    m = M.image(name, path, rough=rough, alpha=False)
    if emit:
        nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        nt.links.new(tex.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    return m


def _woven(name, a, b, scale=60.0):
    """Jute / linen weave: two crossing wave textures."""
    m, nt, bs = M._new(name)
    mp = M._coords(nt, scale)
    w1 = nt.nodes.new('ShaderNodeTexWave'); w1.wave_type = 'BANDS'; w1.bands_direction = 'X'
    w2 = nt.nodes.new('ShaderNodeTexWave'); w2.wave_type = 'BANDS'; w2.bands_direction = 'Y'
    for w in (w1, w2):
        w.inputs['Distortion'].default_value = 1.5; w.inputs['Detail'].default_value = 3
        nt.links.new(mp.outputs['Vector'], w.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'
    nt.links.new(w1.outputs['Fac'], mx.inputs[0]); nt.links.new(w2.outputs['Fac'], mx.inputs[1])
    r = M._ramp(nt, [(0.2, b), (0.9, a)]); nt.links.new(mx.outputs['Value'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], bs.inputs['Base Color'])
    M._set(bs, rough=0.9, sheen=0.4)
    M._bump(nt, bs, mx.outputs['Value'], 0.3, 0.003)
    return m


# ---------------------------------------------------------------- the room
def pendant(name, loc, m, shade, cord=0.9):
    H = ROOM['height']
    p = empty(name, (loc[0], loc[1], H - 0.02))
    cyl('Ceiling rose', 0.05, 0.02, (0, 0, -0.01), m['steel_black'], parent=p)
    cyl('Cord', 0.004, cord, (0, 0, -cord / 2), m['wire_black'], parent=p, seg=8)
    for nm, mat, r0, r1, dz in (('Shade', shade, 0.21, 0.025, 0.0), ('Shade lining', m['plastic_white'], 0.205, 0.022, -0.004)):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=40, radius1=r0, radius2=r1, depth=0.2)
        o = _mesh_obj(nm, bm, mat, p); o.location = (0, 0, -cord - 0.08 + dz)
        for f in o.data.polygons: f.use_smooth = True
    sphere('Bulb', 0.045, (0, 0, -cord - 0.17), BULB, parent=p, seg=16)
    return _light('Int ' + name, 'POINT', (loc[0], loc[1], H - 0.02 - cord - 0.22), 55.0, (1.0, 0.80, 0.58), 0.04)


def frame(name, path, w, h, loc, rot_z, m, mat_border=0.05):
    f = empty(name, loc, rot_z)
    box('Frame', (w + 0.04, 0.025, h + 0.04), (0, 0, 0), m['steel_black'], bevel=0.003, parent=f)
    box('Mount', (w, 0.002, h), (0, -0.0135, 0), m['plastic_white'], bevel=0, parent=f)
    pw, ph = w - 2 * mat_border, h - 2 * mat_border
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    pic = bpy.context.object; pic.name = name + ' photo'; pic.parent = f
    pic.location = (0, -0.0148, 0); pic.rotation_euler = (math.pi / 2, 0, 0); pic.scale = (pw, ph, 1)
    pic.data.materials.append(_img_mat(name + ' print', path, rough=0.35))
    return f


def books(x0, y, z, length, rot_z, seed, m):
    """A row of plain cloth-bound books (no titles)."""
    rnd = random.Random(seed)
    cols = [(0.12, 0.18, 0.14), (0.55, 0.50, 0.42), (0.10, 0.12, 0.18), (0.42, 0.20, 0.12), (0.72, 0.68, 0.60), (0.18, 0.25, 0.22)]
    c, s = math.cos(rot_z), math.sin(rot_z)
    u = 0.0
    while u < length:
        t = rnd.uniform(0.02, 0.045); hgt = rnd.uniform(0.18, 0.26); dpt = rnd.uniform(0.14, 0.18)
        mat = M.plain(f'Book {seed}', rnd.choice(cols), rough=0.7)
        box('Book', (t, dpt, hgt), (x0 + c * (u + t / 2), y + s * (u + t / 2), z + hgt / 2), mat, rot=(0, 0, rot_z), bevel=0.002)
        u += t + 0.002


BULB = None


def interior(m):
    global BULB
    BULB = M.emission('Int pendant bulb', (1.0, 0.82, 0.6), 18.0)
    enamel = M.plain('Black enamel', (0.015, 0.015, 0.015), rough=0.25, coat=0.6)
    # three pendants along the desk, two over the bench
    dp, dr = Vector(DESK['pivot']), DESK['rot']
    for i, u in enumerate((-0.9, 0.0, 0.9)):
        p = dp + Vector((math.cos(dr) * u, math.sin(dr) * u, 0))
        pendant(f'Desk pendant {i}', (p.x, p.y - 0.05), m, enamel, cord=1.1)
    for i, x in enumerate((1.05, 2.05)):
        pendant(f'Bench pendant {i}', (x, (BENCH['y0'] + BENCH['y1']) / 2), m, enamel, cord=1.25)
    # jute rug under the desk and chair
    rug = box('Jute rug', (3.1, 2.2, 0.012), (-0.3, 3.3, 0.006), _woven('Jute rug', (0.62, 0.50, 0.34), (0.40, 0.31, 0.19)),
              rot=(0, 0, DESK['rot']), bevel=0.004)
    box('Rug border', (3.1, 2.2, 0.011), (-0.3, 3.3, 0.0055), M.plain('Rug border', (0.10, 0.09, 0.08), rough=0.9), rot=(0, 0, DESK['rot']), bevel=0.006).scale = (1.03, 1.04, 1)
    # framed photographs (Leruo's own photos from assets/)
    A = os.path.join(REPO, 'assets')
    fy = ROOM['front'] - 0.075
    frame('Photo outdoors', os.path.join(A, 'leruo-outdoors.jpg'), 0.42, 0.32, (-4.5, fy - 0.0125, 2.25), math.pi, m)
    frame('Photo headshot', os.path.join(A, 'leruo-headshot.jpg'), 0.3, 0.38, (-4.5, fy - 0.0125, 1.62), math.pi, m)
    back = ROOM['back'] + 0.0125
    frame('Photo standing', os.path.join(A, 'leruo-standing.jpg'), 0.36, 0.5, (0.72, back + 0.0125, 1.75), 0.0, m)
    # window seat under the left window, linen cushion, two throw pillows
    lx = ROOM['minX']
    box('Window seat', (0.5, 3.0, 0.42), (lx + 0.27, 0.25, 0.21), m['beam'], bevel=0.01)
    linen = _woven('Linen', (0.80, 0.77, 0.70), (0.66, 0.63, 0.56), scale=120)
    box('Seat cushion', (0.48, 2.96, 0.08), (lx + 0.27, 0.25, 0.46), linen, bevel=0.03)
    for y, c in ((-0.9, (0.25, 0.32, 0.26)), (1.25, (0.55, 0.42, 0.28))):
        box('Throw pillow', (0.12, 0.42, 0.38), (lx + 0.12, y, 0.68), M.plain('Pillow', c, rough=0.9, sheen=0.5), rot=(0, math.radians(-12), 0), bevel=0.05)
    # tripod floor lamp beside the seat
    fl = empty('Floor lamp', (lx + 0.45, -1.75, 0), 0)
    for k in range(3):
        a = k / 3 * math.tau
        cyl('Lamp leg', 0.012, 1.55, (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.76), m['beam'], rot=(math.sin(a) * 0.18, -math.cos(a) * 0.18, 0), parent=fl, seg=10)
    cyl('Drum shade', 0.22, 0.3, (0, 0, 1.6), linen, parent=fl, seg=40)
    _light('Int floor lamp', 'POINT', (lx + 0.45, -1.75, 1.55), 35.0, (1.0, 0.78, 0.55), 0.1)
    # books on the back shelving and the window seat
    books(1.25, ROOM['back'] + 0.3, 1.32, 0.55, 0.0, 3, m)
    books(2.35, ROOM['back'] + 0.3, 0.66, 0.4, 0.0, 4, m)
    # a stack on the window seat
    for k, c in enumerate(((0.12, 0.18, 0.14), (0.55, 0.50, 0.42), (0.42, 0.20, 0.12))):
        box('Book stack', (0.2, 0.26, 0.035), (lx + 0.3, 0.6, 0.517 + k * 0.036), M.plain('Book', c, rough=0.7), rot=(0, 0, 0.1 * k), bevel=0.003)
    # a big fiddle-leaf plant in the front left corner
    import assets as AS
    AS.place('potted_plant_01', (lx + 0.5, 3.75, 0), rot_z=1.2, scale=1.25, floor=0.0, label='Corner plant (Poly Haven)')


# ---------------------------------------------------------------- the ESP32 bench
def esp32_kit(m):
    b = BENCH; t = b['top'] + 0.004
    pcb = M.plain('PCB black', (0.02, 0.022, 0.025), rough=0.35, coat=0.5)
    shield = M.plain('Module shield', (0.70, 0.71, 0.73), rough=0.22, metal=1.0)
    gold = M.plain('Pin gold', (0.85, 0.62, 0.25), rough=0.25, metal=1.0)
    blue = M.plain('Relay blue', (0.05, 0.22, 0.65), rough=0.3)
    led_r = M.emission('Int LED red', (1.0, 0.05, 0.02), 25.0)
    led_b = M.emission('Int LED blue', (0.1, 0.35, 1.0), 25.0)

    def devkit(name, loc, rot, parent=None):
        d = empty(name, loc, rot, parent)
        box('DevKit PCB', (0.055, 0.028, 0.0016), (0, 0, 0.0008), pcb, bevel=0, parent=d)
        box('WROOM shield', (0.018, 0.0175, 0.0032), (0.012, 0, 0.0032), shield, bevel=0.0004, parent=d)
        box('Antenna', (0.007, 0.018, 0.0008), (0.0245, 0, 0.002), M.plain('Antenna PCB', (0.02, 0.12, 0.07), rough=0.4), bevel=0, parent=d)
        box('USB port', (0.006, 0.008, 0.003), (-0.026, 0, 0.0031), m['steel'], bevel=0.0005, parent=d)
        for sy in (-1, 1):
            box('Header', (0.048, 0.0025, 0.0085), (-0.001, sy * 0.0125, -0.004), m['plastic_black'], bevel=0, parent=d)
            for k in range(15):
                box('Pin', (0.0006, 0.0006, 0.006), (-0.0245 + k * 0.00254 * 1.3, sy * 0.0125, -0.009), gold, bevel=0, parent=d)
        box('LED', (0.0016, 0.001, 0.0008), (-0.018, 0.008, 0.002), led_r, bevel=0, parent=d)
        box('LED', (0.0016, 0.001, 0.0008), (-0.018, -0.008, 0.002), led_b, bevel=0, parent=d)
        for sx in (-0.022, -0.016):
            box('Button', (0.003, 0.003, 0.0018), (sx, -0.011, 0.0025), m['steel'], bevel=0.0003, parent=d)
        return d

    # board 1 plugged into a full breadboard, with a DHT22 and the OLED
    bb = empty('Breadboard kit', (1.02, 1.6, t), math.radians(6))
    box('Breadboard', (0.165, 0.055, 0.0095), (0, 0, 0.00475), m['plastic_white'], bevel=0.001, parent=bb)
    for k in range(2):
        box('Rail stripe', (0.16, 0.0012, 0.0002), (0, (-1 if k else 1) * 0.024, 0.0096), m['wire_red' if k else 'wire_black'], bevel=0, parent=bb)
    devkit('ESP32 DevKit', (-0.035, 0, 0.0185), 0, bb)
    dht = empty('DHT22', (0.035, 0.012, 0.0095), 0, bb)
    box('DHT22 body', (0.015, 0.006, 0.025), (0, 0, 0.0125), m['plastic_white'], bevel=0.0008, parent=dht)
    for k in range(4):
        box('DHT grille', (0.012, 0.0008, 0.0014), (0, -0.0031, 0.006 + k * 0.004), m['plastic_black'], bevel=0, parent=dht)
    oled = empty('OLED', (0.06, -0.008, 0.0095), 0, bb)
    box('OLED PCB', (0.027, 0.0015, 0.027), (0, 0, 0.0135), M.plain('OLED blue PCB', (0.02, 0.1, 0.35), rough=0.4), bevel=0, parent=oled)
    box('OLED glass', (0.024, 0.0012, 0.013), (0, -0.0012, 0.015), M.plain('OLED glass', (0, 0, 0), rough=0.1), bevel=0, parent=oled)
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    scr = bpy.context.object; scr.name = 'Int OLED screen'; scr.parent = oled
    scr.location = (0, -0.0019, 0.015); scr.rotation_euler = (math.pi / 2, 0, 0); scr.scale = (0.022, 0.011, 1)
    scr.data.materials.append(_img_mat('Int OLED', os.path.join(GEN, 'oled.png'), rough=0.1, emit=4.0))
    # jumpers from the board to the sensors and down to the relay
    cols = ('wire_red', 'wire_black', 'yellow', 'teal', 'wire_red', 'yellow')
    bbw = lambda x, y, z: (1.02 + x, 1.6 + y, t + z)
    for i, c in enumerate(cols):
        x0 = -0.05 + i * 0.006
        tube_path(f'Jumper {i}', [bbw(x0, 0.02, 0.011), bbw(x0 + 0.03, 0.05 + 0.006 * i, 0.04), bbw(0.03 + i * 0.006, 0.02, 0.011)], 0.0011, m[c])
    # relay module and a little pump in a jar of water
    rl = empty('Relay module', (1.24, 1.72, t), math.radians(-10))
    box('Relay PCB', (0.05, 0.026, 0.0016), (0, 0, 0.0008), M.plain('Relay PCB', (0.03, 0.2, 0.08), rough=0.4), bevel=0, parent=rl)
    box('Relay', (0.019, 0.015, 0.016), (-0.006, 0, 0.0096), blue, bevel=0.0008, parent=rl)
    box('Terminal', (0.01, 0.015, 0.01), (0.018, 0, 0.0066), M.plain('Terminal blue', (0.05, 0.3, 0.7), rough=0.3), bevel=0.0005, parent=rl)
    box('LED', (0.0016, 0.001, 0.0008), (-0.02, 0.009, 0.0018), led_r, bevel=0, parent=rl)
    tube_path('Relay lead a', [(1.12, 1.63, t + 0.011), (1.17, 1.7, t + 0.03), (1.22, 1.72, t + 0.003)], 0.0011, m['wire_red'])
    tube_path('Relay lead b', [(1.122, 1.632, t + 0.011), (1.18, 1.69, t + 0.025), (1.224, 1.716, t + 0.003)], 0.0011, m['yellow'])
    jar = cyl('Water jar', 0.035, 0.11, (1.33, 1.82, t + 0.055), m['clear'], seg=32)
    cyl('Water', 0.033, 0.07, (1.33, 1.82, t + 0.036), M.plain('Jar water', (0.7, 0.85, 0.9), rough=0.02, trans=1.0, ior=1.33), seg=32)
    cyl('Pump', 0.012, 0.03, (1.33, 1.82, t + 0.017), m['plastic_black'], seg=16)
    sil = M.plain('Silicone tube', (0.85, 0.88, 0.86), rough=0.15, trans=0.5)
    tube_path('Pump tube', [(1.33, 1.82, t + 0.03), (1.34, 1.83, t + 0.14), (1.42, 1.83, t + 0.13), (1.47, 1.76, t + 0.07)], 0.003, sil)
    tube_path('Pump lead', [(1.25, 1.73, t + 0.012), (1.29, 1.79, t + 0.02), (1.32, 1.81, t + 0.02)], 0.0011, m['wire_black'])
    # seedling tray with soil probes, wired to board 2 in a printed case
    tray = empty('Seedling tray', (1.52, 1.75, t), math.radians(4))
    box('Tray', (0.24, 0.16, 0.05), (0, 0, 0.025), M.plain('Tray black', (0.03, 0.03, 0.03), rough=0.6), bevel=0.003, parent=tray)
    box('Tray soil', (0.23, 0.15, 0.004), (0, 0, 0.046), m['soil'], bevel=0, parent=tray)
    rnd = random.Random(8)
    leafm = M.plain('Seedling', (0.12, 0.38, 0.08), rough=0.5, sheen=0.4)
    for i in range(4):
        for j in range(3):
            if (i, j) == (1, 1): continue
            sx, sy = -0.09 + i * 0.06, -0.05 + j * 0.05
            h = rnd.uniform(0.03, 0.06)
            cyl('Stem', 0.0015, h, (sx, sy, 0.048 + h / 2), leafm, parent=tray, seg=6)
            for a in (0.3, 0.3 + math.pi):
                sphere('Seed leaf', 0.012, (sx + math.cos(a) * 0.01, sy + math.sin(a) * 0.01, 0.048 + h), leafm, scale=(1, 0.5, 0.15), parent=tray, seg=8)
    probe = M.plain('Probe PCB', (0.02, 0.022, 0.025), rough=0.35, coat=0.5)
    for k, (sx, sy) in enumerate(((-0.03, 0.0), (0.06, -0.02))):
        box('Soil probe', (0.022, 0.0016, 0.09), (sx, sy, 0.065), probe, bevel=0.0003, parent=tray)
        box('Probe header', (0.01, 0.006, 0.006), (sx, sy, 0.112), m['plastic_black'], bevel=0, parent=tray)
    case = empty('ESP32 case', (1.74, 1.62, t), math.radians(-14))
    box('Printed case', (0.075, 0.05, 0.028), (0, 0, 0.014), M.plain('Printed PLA', (0.86, 0.85, 0.80), rough=0.55), bevel=0.004, parent=case)
    box('Case window', (0.03, 0.002, 0.012), (0.01, -0.025, 0.017), M.plain('Smoke acrylic', (0.02, 0.02, 0.02), rough=0.1), bevel=0, parent=case)
    box('LED', (0.003, 0.001, 0.003), (-0.025, -0.0255, 0.02), led_b, bevel=0, parent=case)
    tube_path('Probe cable', [(1.49, 1.75, t + 0.115), (1.6, 1.72, t + 0.08), (1.7, 1.63, t + 0.02)], 0.0016, m['wire_black'])
    tube_path('Probe cable 2', [(1.58, 1.73, t + 0.115), (1.66, 1.68, t + 0.06), (1.72, 1.635, t + 0.02)], 0.0016, m['wire_black'])
    # USB lead from the breadboard's board to a power bank
    tube_path('USB lead', [(0.975, 1.6, t + 0.02), (0.92, 1.58, t + 0.006), (0.84, 1.52, t + 0.006), (0.75, 1.5, t + 0.012)], 0.0022, m['wire_black'])
    box('Power bank', (0.07, 0.14, 0.016), (0.72, 1.48, t + 0.008), M.plain('Power bank', (0.15, 0.16, 0.17), rough=0.4), rot=(0, 0, 0.3), bevel=0.004)
    # a spare DevKit and a bag of jumpers on the mat
    devkit('Spare DevKit', (0.92, 1.42, t + 0.0095), math.radians(28))
    # pinout card on a clipboard, leaning on the parts organiser
    cb = empty('Pinout clipboard', (2.05, 1.88, t), math.radians(-8))
    tilt = empty('Clipboard tilt', (0, 0, 0), 0, cb); tilt.rotation_euler = (math.radians(-18), 0, 0)
    box('Clipboard', (0.17, 0.004, 0.23), (0, 0.004, 0.115), m['beam'], bevel=0.002, parent=tilt)
    box('Clip', (0.05, 0.01, 0.015), (0, 0.0, 0.225), m['steel'], bevel=0.002, parent=tilt)
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    pc = bpy.context.object; pc.name = 'Pinout card'; pc.parent = tilt
    pc.location = (0, -0.0005, 0.108); pc.rotation_euler = (math.pi / 2, 0, 0); pc.scale = (0.15, 0.2, 1)
    pc.data.materials.append(_img_mat('Pinout card', os.path.join(GEN, 'pinout.png'), rough=0.6))
    # folded label card at the front edge of the bench, facing the room
    tc = empty('Label card', (1.25, 1.31, t), math.radians(4))
    for sgn in (-1, 1):
        a = math.radians(62) * sgn
        bpy.ops.mesh.primitive_plane_add(size=1.0)
        pl = bpy.context.object; pl.parent = tc; pl.name = 'Card face' if sgn < 0 else 'Card back'
        pl.scale = (0.16, 0.0625, 1)
        pl.rotation_euler = (math.radians(62) * (1 if sgn < 0 else -1), 0, 0)
        pl.location = (0, sgn * 0.0155, 0.029)
        pl.data.materials.append(_img_mat('Label card', os.path.join(GEN, 'esp32_card.png'), rough=0.7) if sgn < 0 else m['plastic_white'])
    # magnifier lamp clamped to the bench's far edge
    ml = empty('Magnifier lamp', (0.62, 1.95, t), math.radians(20))
    cyl('Clamp', 0.02, 0.05, (0, 0, 0.0), m['steel_black'], parent=ml)
    tube_path('Lamp arm', [(0.62, 1.95, t + 0.02), (0.63, 1.9, t + 0.32), (0.72, 1.72, t + 0.38)], 0.008, m['steel_black'])
    cyl('Magnifier ring', 0.075, 0.03, (0.74, 1.68, t + 0.36), m['plastic_white'], rot=(math.radians(40), 0, 0), seg=40)
    cyl('Magnifier lens', 0.065, 0.006, (0.74, 1.68, t + 0.36), m['clear'], rot=(math.radians(40), 0, 0), seg=40)
    _light('Int magnifier lamp', 'POINT', (0.74, 1.66, t + 0.32), 6.0, (0.95, 0.97, 1.0), 0.06)


# ---------------------------------------------------------------- the farm
def crop_material(kind):
    """Crops as shading on the ground: rows of plants and soil, or a wheat field."""
    m, nt, b = M._new('Crop ' + kind)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.08; n.inputs['Detail'].default_value = 6
    nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    fine = nt.nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 6.0; fine.inputs['Detail'].default_value = 4
    nt.links.new(tc.outputs['Object'], fine.inputs['Vector'])
    pitch = {'maize': 0.9, 'rows': 0.75, 'ploughed': 0.5, 'wheat': 0.25}[kind]
    s = nt.nodes.new('ShaderNodeMath'); s.operation = 'MULTIPLY'; s.inputs[1].default_value = 2 * math.pi / pitch
    nt.links.new(sep.outputs['X'], s.inputs[0])
    sn = nt.nodes.new('ShaderNodeMath'); sn.operation = 'SINE'; nt.links.new(s.outputs[0], sn.inputs[0])
    row = nt.nodes.new('ShaderNodeMapRange'); row.inputs['From Min'].default_value = -0.2 if kind != 'ploughed' else -1
    row.inputs['From Max'].default_value = 0.6 if kind != 'ploughed' else 1
    nt.links.new(sn.outputs[0], row.inputs['Value'])
    soil = {'ploughed': (0.16, 0.10, 0.06), 'wheat': (0.42, 0.33, 0.16)}.get(kind, (0.13, 0.09, 0.06))
    crop = {'maize': (0.10, 0.22, 0.05), 'rows': (0.16, 0.30, 0.07), 'ploughed': (0.24, 0.16, 0.10), 'wheat': (0.62, 0.50, 0.24)}[kind]
    crop2 = tuple(c * 0.75 for c in crop)
    cm = nt.nodes.new('ShaderNodeMix'); cm.data_type = 'RGBA'
    cm.inputs['A'].default_value = (*crop2, 1); cm.inputs['B'].default_value = (*crop, 1)
    nt.links.new(n.outputs['Fac'], cm.inputs['Factor'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs['A'].default_value = (*soil, 1)
    nt.links.new(row.outputs['Result'], mx.inputs['Factor']); nt.links.new(cm.outputs['Result'], mx.inputs['B'])
    nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    M._set(b, rough=0.92, sheen=0.3 if kind != 'ploughed' else 0.0)
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'MULTIPLY_ADD'; h.inputs[2].default_value = 0.0
    nt.links.new(row.outputs['Result'], h.inputs[0]); nt.links.new(fine.outputs['Fac'], h.inputs[1])
    M._bump(nt, b, h.outputs[0], 0.6, 0.08)
    return M.add_haze(m, distance=1800.0)


def windpump(m, loc):
    x, y = loc; g = empty('Windpump', (x, y, _height(x, y)), math.radians(-30))
    H = 9.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            tube_path('Tower leg', [(x + sx * 1.3, y + sy * 1.3, _height(x, y)), (x + sx * 0.18, y + sy * 0.18, _height(x, y) + H)], 0.035, m['steel'])
    for k in range(1, 7):
        z = k * H / 7; w = 1.3 - (1.3 - 0.18) * z / H
        for (a, b2) in (((-w, -w), (w, -w)), ((w, -w), (w, w)), ((w, w), (-w, w)), ((-w, w), (-w, -w))):
            tube_path('Tower brace', [(x + a[0], y + a[1], _height(x, y) + z), (x + b2[0], y + b2[1], _height(x, y) + z)], 0.015, m['steel'])
    hub = empty('Windpump head', (0, 0, H + 0.3), 0, g)
    box('Gearbox', (0.4, 0.6, 0.35), (0, 0, 0), m['steel'], bevel=0.02, parent=hub)
    wheel = empty('Wheel', (0, -0.45, 0.05), 0, hub); wheel.rotation_euler = (0, math.radians(12), 0)
    for k in range(18):
        a = k / 18 * math.tau
        blade = box('Blade', (0.28, 0.02, 1.2), (math.cos(a) * 0.95, 0, math.sin(a) * 0.95), m['steel'], rot=(0, -a + math.pi / 2, 0), bevel=0.003, parent=wheel)
        blade.rotation_euler = (math.radians(25), -a + math.pi / 2, 0)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.55, minor_radius=0.025)
    rim = bpy.context.object; rim.name = 'Wheel rim'; rim.parent = wheel; rim.rotation_euler = (math.pi / 2, 0, 0); rim.data.materials.append(m['steel'])
    box('Tail boom', (0.06, 2.2, 0.06), (0, 1.2, 0.05), m['steel'], bevel=0.005, parent=hub)
    box('Tail vane', (0.02, 1.0, 0.75), (0, 2.3, 0.1), m['steel'], bevel=0.005, parent=hub)
    # round concrete dam beside it
    dx, dy = x + 3.6, y + 1.4
    cyl('Dam wall', 2.4, 1.1, (dx, dy, _height(dx, dy) + 0.55), m['concrete_out'], seg=48)
    cyl('Dam water', 2.3, 0.02, (dx, dy, _height(dx, dy) + 0.95), m['water'], seg=48)
    tube_path('Dam pipe', [(x, y, _height(x, y) + 1.0), (x + 1.5, y + 0.6, _height(x, y) + 1.3), (dx - 2.2, dy - 0.2, _height(dx, dy) + 1.15)], 0.04, m['steel'])


def silo(m, x, y, r, h, mat):
    z = _height(x, y)
    cyl('Silo', r, h, (x, y, z + h / 2), mat, seg=48)
    cyl('Silo roof', r * 1.02, r * 0.55, (x, y, z + h + r * 0.27), mat, r2=0.15, seg=48)
    for k in range(1, 8):
        bpy.ops.mesh.primitive_torus_add(major_radius=r * 1.005, minor_radius=0.03, location=(x, y, z + k * h / 8))
        bpy.context.object.data.materials.append(mat)


def chicken_coop(m, extra):
    x, y = COOP; z = _height(x, y)
    g = empty('Chicken coop', (x, y, z), math.radians(20))
    white = M.plain('Coop white', (0.80, 0.79, 0.74), rough=0.7)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Coop leg', (0.08, 0.08, 0.55), (sx * 0.85, sy * 0.55, 0.275), m['beam'], bevel=0.005, parent=g)
    box('Coop house', (1.8, 1.2, 0.95), (0, 0, 0.55 + 0.475), white, bevel=0.01, parent=g)
    for k in range(9):
        box('Coop batten', (0.03, 0.02, 0.95), (-0.8 + k * 0.2, -0.61, 1.025), m['beam'], bevel=0.003, parent=g)
    box('Coop roof a', (2.1, 0.8, 0.04), (0, -0.33, 1.68), m['corrugated'], rot=(math.radians(-28), 0, 0), bevel=0, parent=g)
    box('Coop roof b', (2.1, 0.8, 0.04), (0, 0.33, 1.68), m['corrugated'], rot=(math.radians(28), 0, 0), bevel=0, parent=g)
    box('Pop hole', (0.28, 0.02, 0.32), (0.5, -0.615, 0.72), extra['dark_interior'], bevel=0, parent=g)
    ramp = box('Ramp', (0.3, 0.9, 0.025), (0.5, -1.0, 0.3), m['beam'], rot=(math.radians(-38), 0, 0), bevel=0.003, parent=g)
    box('Nest box', (0.6, 0.4, 0.4), (-0.45, 0.75, 0.85), white, bevel=0.01, parent=g)
    box('Nest lid', (0.64, 0.44, 0.03), (-0.45, 0.75, 1.07), m['corrugated'], rot=(math.radians(15), 0, 0), bevel=0, parent=g)
    # feeder and a water drum
    cyl('Feeder', 0.15, 0.4, (x + 1.6, y - 0.6, z + 0.2), M.plain('Feeder', (0.6, 0.62, 0.6), rough=0.4, metal=0.7), r2=0.2)
    cyl('Waterer', 0.18, 0.3, (x - 1.5, y - 0.9, z + 0.15), M.plain('Waterer red', (0.55, 0.08, 0.05), rough=0.4))
    # a straw patch around the coop
    straw = M.plain('Straw', (0.55, 0.45, 0.25), rough=0.95, sheen=0.4)
    bm = bmesh.new()
    vs = [bm.verts.new((x + math.cos(a) * 2.6 * (1 + 0.2 * math.sin(a * 3)), y + math.sin(a) * 2.0, _height(x + math.cos(a) * 2.6, y + math.sin(a) * 2.0) + 0.012)) for a in [k / 40 * math.tau for k in range(40)]]
    bm.faces.new(vs)
    _mesh_obj('Straw patch', bm, straw)


def tractor(m, loc, rot):
    x, y = loc; g = empty('Tractor', (x, y, _height(x, y)), rot)
    body = M.plain('Tractor green', (0.08, 0.20, 0.10), rough=0.35, coat=0.5)
    rimc = M.plain('Rim grey', (0.55, 0.55, 0.55), rough=0.4, metal=0.5)
    tyre = M.plain('Tyre', (0.02, 0.02, 0.02), rough=0.85)
    for sx in (-1, 1):
        cyl('Rear tyre', 0.8, 0.45, (sx * 0.95, 0.6, 0.8), tyre, rot=(0, math.pi / 2, 0), seg=40, parent=g)
        cyl('Rear rim', 0.5, 0.47, (sx * 0.95, 0.6, 0.8), rimc, rot=(0, math.pi / 2, 0), seg=32, parent=g)
        cyl('Front tyre', 0.48, 0.3, (sx * 0.8, -1.7, 0.48), tyre, rot=(0, math.pi / 2, 0), seg=32, parent=g)
        cyl('Front rim', 0.3, 0.32, (sx * 0.8, -1.7, 0.48), rimc, rot=(0, math.pi / 2, 0), seg=24, parent=g)
    box('Bonnet', (0.8, 2.2, 0.75), (0, -1.1, 1.05), body, bevel=0.06, parent=g)
    box('Grille', (0.7, 0.04, 0.55), (0, -2.21, 1.0), m['plastic_black'], bevel=0.01, parent=g)
    box('Cab floor', (1.4, 1.3, 0.12), (0, 0.55, 1.25), body, bevel=0.03, parent=g)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Cab post', (0.06, 0.06, 1.35), (sx * 0.65, 0.55 + sy * 0.6, 1.95), m['steel_black'], bevel=0.005, parent=g)
        box('Fender', (0.5, 1.4, 0.06), (sx * 0.95, 0.6, 1.62), body, bevel=0.02, parent=g)
    box('Cab roof', (1.5, 1.45, 0.1), (0, 0.55, 2.66), body, bevel=0.03, parent=g)
    for sy in (-1, 1):
        box('Cab glass', (1.3, 0.01, 1.25), (0, 0.55 + sy * 0.6, 1.95), m['thin_glass'], bevel=0, parent=g)
    box('Seat', (0.45, 0.4, 0.4), (0, 0.75, 1.5), m['leather'], bevel=0.04, parent=g)
    cyl('Exhaust', 0.04, 1.0, (0.3, -1.6, 1.8), m['steel_black'], parent=g)


def farm(m, extra):
    # crop fields: extra ground materials, assigned by face
    ground = bpy.data.objects['Ground']
    kinds = sorted({f[4] for f in FIELDS})
    base = len(ground.data.materials)
    for k in kinds: ground.data.materials.append(crop_material(k))
    for p in ground.data.polygons:
        c = p.center
        for x0, x1, y0, y1, kind in FIELDS:
            if x0 < c.x < x1 and y0 < c.y < y1:
                p.material_index = base + kinds.index(kind); break
    fence_pts = [((-62, 46), (-18, 46)), ((14, 70), (62, 70)), ((-70, -24), (30, -24)), ((-26, -46), (-26, 16))]
    import nature as N
    for a, b in fence_pts:
        N.fence(m, [a, b], post_gap=4.0)
    windpump(m, (-10.0, 46.0))
    chicken_coop(m, extra)
    tractor(m, (12.0, 50.0), math.radians(120))
    tractor(m, (-34.0, -30.0), math.radians(10))
    galv = M.plain('Galvanised silo', (0.62, 0.63, 0.64), rough=0.3, metal=0.9)
    silo(m, 16.0, 115.0, 2.4, 13.0, galv)
    silo(m, 21.5, 118.0, 2.4, 13.0, galv)
    silo(m, -22.0, -60.0, 2.0, 10.0, galv)
    # a big steel shed behind the office, seen through the back window
    sx, sy = 8.0, -42.0
    shed = N.gable_building('Implement shed', (sx, sy, _height(sx, sy)), math.radians(180 + 15), 16.0, 9.0, 4.2, 1.4,
                            extra['cladding'], m['corrugated'], open_front=(13.0, 3.8), inner=extra['dark_interior'])


# ---------------------------------------------------------------- mountains and the city
def mountain_material():
    m, nt, b = M._new('Mountains v2')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs['Vector'])
    pos = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], pos.inputs['Vector'])
    mp = M._coords(nt, 1.0)
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.0015; n.inputs['Detail'].default_value = 12; n.inputs['Roughness'].default_value = 0.6
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    bush = nt.nodes.new('ShaderNodeTexNoise'); bush.inputs['Scale'].default_value = 0.012; bush.inputs['Detail'].default_value = 8
    nt.links.new(mp.outputs['Vector'], bush.inputs['Vector'])
    slope = nt.nodes.new('ShaderNodeMapRange'); slope.inputs['From Min'].default_value = 0.55; slope.inputs['From Max'].default_value = 0.85
    nt.links.new(sep.outputs['Z'], slope.inputs['Value'])
    rock = M._ramp(nt, [(0.3, (0.20, 0.18, 0.16)), (0.7, (0.42, 0.37, 0.31))]); nt.links.new(n.outputs['Fac'], rock.inputs['Fac'])
    veld = M._ramp(nt, [(0.35, (0.10, 0.13, 0.05)), (0.5, (0.22, 0.24, 0.09)), (0.65, (0.40, 0.36, 0.17))]); nt.links.new(bush.outputs['Fac'], veld.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(slope.outputs['Result'], mix.inputs['Factor']); nt.links.new(rock.outputs['Color'], mix.inputs['A']); nt.links.new(veld.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    M._set(b, rough=0.95)
    M._bump(nt, b, n.outputs['Fac'], 0.4, 40.0)
    return m


def _ridge(x, y, scale, seed):
    p = Vector((x * scale, y * scale, seed))
    try:
        v = noise.ridged_multi_fractal(p, 0.9, 2.1, 6, 1.0, 2.0, noise_basis='PERLIN_ORIGINAL')
        return max(0.0, min(1.0, v / 2.2))
    except Exception:
        return 1 - abs(noise.noise(p))


def mountains(m):
    """Two ranges right round the horizon: a nearer, rugged one (5-7 km, up to ~800 m) and a high,
    hazier one behind (10-14 km, up to ~1700 m). Lower in front, where the city sits."""
    mat = M.add_haze(mountain_material(), color=(0.62, 0.66, 0.78), distance=22000.0, strength=0.25)
    for name, dist, depth, peak, seed in (('Near range', 5400.0, 2200.0, 1150.0, 1.3), ('Far range', 10500.0, 4000.0, 2300.0, 7.7)):
        bm = bmesh.new(); cols, rows = 900, 26
        grid = []
        for j in range(rows + 1):
            row = []
            for i in range(cols):
                a = i / cols * math.tau
                r = dist + depth * j / rows + 300 * noise.noise(Vector((math.cos(a) * 3, math.sin(a) * 3, seed)))
                x, y = math.sin(a) * r, math.cos(a) * r
                az = math.degrees(math.atan2(math.sin(a), math.cos(a)))
                env = 0.55 + 0.45 * (noise.noise(Vector((math.cos(a) * 1.6, math.sin(a) * 1.6, seed + 4))) * 0.5 + 0.5)
                if name == 'Near range':
                    env *= 1 - 0.6 * math.exp(-((az - 19) / 14) ** 2)     # a low gap in front, behind the city
                prof = max(0.0, math.sin(math.pi * j / rows)) ** 0.8
                h = peak * env * (0.25 + 0.75 * _ridge(x, y, 0.00045, seed) ** 1.4) * prof
                row.append(bm.verts.new((x, y, h - 40)))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                bm.faces.new((grid[j][i], grid[j][(i + 1) % cols], grid[j + 1][(i + 1) % cols], grid[j + 1][i]))
        o = _mesh_obj(name, bm, mat)
        for p in o.data.polygons: p.use_smooth = True


def city_material():
    """Concrete and glass towers; lit windows (a brick pattern of random cells) that glow at night."""
    m, nt, b = M._new('City v2')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.25; br.offset = 0.0
    br.inputs['Brick Width'].default_value = 3.2; br.inputs['Row Height'].default_value = 3.6
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    rnd = nt.nodes.new('ShaderNodeTexWhiteNoise'); nt.links.new(br.outputs['Color'], rnd.inputs['Vector'])
    lit = nt.nodes.new('ShaderNodeMath'); lit.operation = 'GREATER_THAN'; lit.inputs[1].default_value = 0.62
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(rnd.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs[0], lit.inputs[0])
    notm = nt.nodes.new('ShaderNodeMath'); notm.operation = 'SUBTRACT'; notm.inputs[0].default_value = 1.0
    nt.links.new(br.outputs['Fac'], notm.inputs[1])
    win = nt.nodes.new('ShaderNodeMath'); win.operation = 'MULTIPLY'
    nt.links.new(lit.outputs[0], win.inputs[0]); nt.links.new(notm.outputs[0], win.inputs[1])
    tone = nt.nodes.new('ShaderNodeMix'); tone.data_type = 'RGBA'
    tone.inputs['A'].default_value = (0.58, 0.58, 0.60, 1); tone.inputs['B'].default_value = (0.30, 0.36, 0.42, 1)
    nt.links.new(sep.outputs[1], tone.inputs['Factor'])
    nt.links.new(tone.outputs['Result'], b.inputs['Base Color'])
    M._set(b, rough=0.35, metal=0.3)
    em = nt.nodes.new('ShaderNodeEmission'); em.name = 'City lights'; em.inputs['Color'].default_value = (1.0, 0.78, 0.5, 1)
    em.inputs['Strength'].default_value = 0.0
    add = nt.nodes.new('ShaderNodeAddShader')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    nt.links.new(b.outputs['BSDF'], add.inputs[0])
    # strength = window mask x 'City lights' strength (set per time of day)
    sm = nt.nodes.new('ShaderNodeMath'); sm.operation = 'MULTIPLY'; sm.name = 'City lights level'; sm.inputs[1].default_value = 0.0
    nt.links.new(win.outputs[0], sm.inputs[0]); nt.links.new(sm.outputs[0], em.inputs['Strength'])
    nt.links.new(em.outputs['Emission'], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return M.add_haze(m, color=(0.62, 0.66, 0.78), distance=16000.0, strength=0.25)


def city(m, extra):
    """A skyline 3-4 km off, a little right of straight ahead, in front of the low gap in the range.
    Generic towers (no real landmarks), a few tall ones and a telecom mast."""
    rnd = random.Random(21)
    mat = city_material()
    for i in range(95):
        az = math.radians(rnd.gauss(19, 4.5)); r = rnd.uniform(3000, 4300)
        w = rnd.uniform(18, 45); d = w * rnd.uniform(0.7, 1.3)
        tall = rnd.random() < 0.18
        h = (rnd.uniform(120, 230) if tall else rnd.uniform(25, 95)) * (1.0 - 0.4 * abs(math.degrees(az) - 19) / 16)
        x, y = math.sin(az) * r, math.cos(az) * r
        o = box('Tower', (w, d, h), (x, y, h / 2 - 5), mat, rot=(0, 0, rnd.uniform(0, math.pi)), bevel=0)
        if tall and rnd.random() < 0.6:
            box('Tower crown', (w * 0.7, d * 0.7, h * 0.12), (x, y, h + h * 0.06 - 5), mat, rot=o.rotation_euler, bevel=0)
    a = math.radians(21); r = 3600
    cyl('Telecom mast', 7, 240, (math.sin(a) * r, math.cos(a) * r, 115), mat, seg=12)
    cyl('Mast head', 13, 22, (math.sin(a) * r, math.cos(a) * r, 230), mat, seg=12)
    red = M.emission('City beacon', (1.0, 0.1, 0.05), 0.0)
    sphere('Mast beacon', 3.0, (math.sin(a) * r, math.cos(a) * r, 262), red, seg=8)
