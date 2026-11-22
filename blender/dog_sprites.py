"""
Walking dogs for the 360 view: each dog is rendered as sprite frames (8 headings x a walk cycle,
plus a standing idle with a wagging tail) that the page plays back on the floor in real time.

    python blender/dog_sprites.py <out dir> [cell px] [samples] [dog name ...]

The dogs are the scene's skin-modifier dogs, rebuilt standing. Each frame moves the skeleton
(a four-beat walk: left hind, left fore, right hind, right fore), re-evaluates the body and carries
every fur strand with the triangle it grows from, so the coat moves with the body.
Rendered with an orthographic camera looking 25 deg down (about how the eye sees the floor),
soft workshop light, the scene's colour management and a shadow catcher for the contact shadow.
"""
import json, math, os, sys
import bpy
import numpy as np
from mathutils import Vector, noise as mnoise, kdtree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ELEV = math.radians(25.0)
HEADINGS = 8
WALK_FRAMES = 8
IDLE_FRAMES = 4


# ---------------------------------------------------------------- skeletons (standing)
def golden_skeleton(s=1.0, ears='up', tail='curl', leg=1.0, body=1.0):
    """The scene's standing golden dog, with knobs for the other two dogs."""
    J = {
        'hip': ((-0.30, 0, 0.50), (0.105, 0.1)), 'spine': ((-0.05, 0, 0.53), 0.13), 'chest': ((0.17, 0, 0.47), (0.15, 0.13)),
        'withers': ((0.27, 0, 0.58), 0.1), 'neck': ((0.36, 0, 0.71), 0.07), 'head': ((0.45, 0, 0.78), 0.085),
        'muzzle': ((0.56, 0, 0.75), 0.045), 'nosetip': ((0.62, 0, 0.745), 0.028),
    }
    if tail == 'curl':
        J.update({'tail0': ((-0.38, 0, 0.55), 0.04), 'tail1': ((-0.47, 0, 0.7), 0.035), 'tail2': ((-0.40, 0, 0.83), 0.03), 'tail3': ((-0.30, 0, 0.82), 0.02)})
    elif tail == 'feather':
        J.update({'tail0': ((-0.39, 0, 0.52), 0.045), 'tail1': ((-0.52, 0, 0.45), 0.04), 'tail2': ((-0.63, 0, 0.36), 0.032), 'tail3': ((-0.70, 0, 0.27), 0.02)})
    else:   # short, carried up
        J.update({'tail0': ((-0.38, 0, 0.55), 0.035), 'tail1': ((-0.44, 0, 0.66), 0.03), 'tail2': ((-0.47, 0, 0.75), 0.022), 'tail3': ((-0.48, 0, 0.8), 0.014)})
    E = [('hip', 'spine'), ('spine', 'chest'), ('chest', 'withers'), ('withers', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('muzzle', 'nosetip'),
         ('hip', 'tail0'), ('tail0', 'tail1'), ('tail1', 'tail2'), ('tail2', 'tail3')]
    for sd, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'fs{tag}': ((0.21, sd * 0.075, 0.45), 0.05), f'fe{tag}': ((0.21, sd * 0.075, 0.28), 0.033), f'fw{tag}': ((0.22, sd * 0.075, 0.07), 0.022), f'fp{tag}': ((0.255, sd * 0.075, 0.022), (0.034, 0.03)),
                  f'hs{tag}': ((-0.29, sd * 0.075, 0.44), 0.07), f'hk{tag}': ((-0.22, sd * 0.08, 0.29), 0.042), f'hh{tag}': ((-0.35, sd * 0.075, 0.13), 0.025), f'hp{tag}': ((-0.31, sd * 0.075, 0.022), (0.034, 0.03))})
        if ears == 'up':
            J.update({f'ea{tag}': ((0.43, sd * 0.05, 0.85), 0.032), f'et{tag}': ((0.42, sd * 0.065, 0.94), 0.007)})
        elif ears == 'flop':
            J.update({f'ea{tag}': ((0.43, sd * 0.075, 0.82), (0.045, 0.02)), f'et{tag}': ((0.44, sd * 0.1, 0.70), (0.04, 0.012))})
        else:   # folded button ears
            J.update({f'ea{tag}': ((0.44, sd * 0.06, 0.85), (0.03, 0.015)), f'et{tag}': ((0.49, sd * 0.07, 0.83), (0.022, 0.008))})
        E += [('chest', f'fs{tag}'), (f'fs{tag}', f'fe{tag}'), (f'fe{tag}', f'fw{tag}'), (f'fw{tag}', f'fp{tag}'),
              ('hip', f'hs{tag}'), (f'hs{tag}', f'hk{tag}'), (f'hk{tag}', f'hh{tag}'), (f'hh{tag}', f'hp{tag}'),
              ('head', f'ea{tag}'), (f'ea{tag}', f'et{tag}')]
    # proportions: leg < 1 shortens the legs (body lowered to match), body scales girth
    out = {}
    lift = 0.45 * (leg - 1.0)   # how far the body drops with shorter legs (legs ~0.45 m)
    for k, (p, r) in J.items():
        x, y, z = p
        is_leg = k[:2] in ('fe', 'fw', 'fp', 'hk', 'hh', 'hp')
        if is_leg:
            # legs are scaled toward the ground
            z = z * leg
        else:
            z = z + lift
        rr = tuple(v * body for v in r) if isinstance(r, tuple) else r * body
        if is_leg:
            rr = tuple(v * (0.5 + 0.5 * body) for v in rr) if isinstance(rr, tuple) else rr * (0.5 + 0.5 * body)
        out[k] = ((x * s, y * s * (0.6 + 0.4 * body), z * s), tuple(v * s for v in rr) if isinstance(rr, tuple) else rr * s)
    return out, E


DOGS = {
    # name: skeleton, coat(s), fur length, strands, stride (half, m), lift, ortho size (m)
    'golden': dict(skel=lambda: golden_skeleton(), coats=[('Golden short coat', 0.42, 0.78, None)], skin=(0.3, 0.16, 0.06),
                   length=0.034, count=260000, stride=0.11, lift=0.05, size=1.25, speed=1.0),
    'retriever': dict(skel=lambda: golden_skeleton(1.08, ears='flop', tail='feather', body=1.18), coats=[('Retriever coat', 0.3, 0.72, None)], skin=(0.34, 0.2, 0.08),
                      length=0.058, count=320000, stride=0.12, lift=0.05, size=1.4, speed=0.9),
    'terrier': dict(skel=lambda: golden_skeleton(0.62, ears='fold', tail='short', leg=0.82, body=0.95), coats=[('Terrier white coat', 0.03, 0.4, 'white'), ('Terrier tan coat', 0.45, 0.85, 'tan')],
                    skin=(0.75, 0.7, 0.65), length=0.017, count=200000, stride=0.07, lift=0.035, size=0.85, speed=1.2),
}

LEGS = [('fl', ['fsl', 'fel', 'fwl', 'fpl'], 0.25, 'front'), ('fr', ['fsr', 'fer', 'fwr', 'fpr'], 0.75, 'front'),
        ('hl', ['hsl', 'hkl', 'hhl', 'hpl'], 0.0, 'hind'), ('hr', ['hsr', 'hkr', 'hhr', 'hpr'], 0.5, 'hind')]


def _ik(a, c, l1, l2, rest_b):
    """2-bone IK in the leg's XZ plane: elbow/knee b between a and c, nearest the rest bend."""
    a2 = Vector((a.x, a.z)); c2 = Vector((c.x, c.z))
    d = (c2 - a2).length
    d = max(min(d, l1 + l2 - 1e-4), abs(l1 - l2) + 1e-4)
    t = (c2 - a2).normalized()
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - x * x))
    n = Vector((-t.y, t.x))
    cands = [a2 + t * x + n * h, a2 + t * x - n * h]
    rb = Vector((rest_b.x, rest_b.z))
    b2 = min(cands, key=lambda p: (p - rb).length)
    return Vector((b2.x, (a.y + c.y) / 2, b2.y))


def pose(rest, kind, phase, p):
    """Joint positions for one frame. kind 'walk' (phase 0..1 of a stride) or 'idle'."""
    J = {k: Vector(v[0]) for k, v in rest.items()}
    body = [k for k in J if k[:2] not in ('fe', 'fw', 'fp', 'hk', 'hh', 'hp')]
    tail = sorted(k for k in J if k.startswith('tail'))
    two = 2 * math.pi
    if kind == 'walk':
        bob = -0.007 * math.cos(2 * two * phase)
        for k in body: J[k].z += bob
        for k in ('head', 'muzzle', 'nosetip', 'eal', 'ear', 'etl', 'etr'):
            if k in J: J[k].z += 0.006 * math.sin(2 * two * phase + 1.0)
        wag = 0.05 * math.sin(two * 2 * phase)
        for legname, chain, off, fh in LEGS:
            s0, m1, m2, paw = chain
            q = (phase + off) % 1.0
            if q < 0.62:
                u = q / 0.62; dx = p['stride'] * (1 - 2 * u); dz = 0.0
            else:
                u = (q - 0.62) / 0.38; sm = u * u * (3 - 2 * u)
                dx = p['stride'] * (-1 + 2 * sm); dz = p['lift'] * math.sin(math.pi * u)
            rp = Vector(rest[paw][0]); rw = Vector(rest[m2][0]); rs = Vector(rest[s0][0]); re = Vector(rest[m1][0])
            newpaw = rp + Vector((dx, 0, dz))
            fold = 0.35 * dz * (1 if fh == 'front' else -1)          # the pastern folds in the swing
            newm2 = newpaw + (rw - rp) + Vector((-fold, 0, 0.3 * dz))
            l1 = (re - rs).length; l2 = (rw - re).length
            J[paw] = newpaw; J[m2] = newm2
            J[m1] = _ik(J[s0], newm2, l1, l2, re)
    else:
        wag = 0.07 * math.sin(two * phase)
        breathe = 0.003 * math.sin(two * phase)
        for k in ('chest', 'withers', 'spine'): J[k].z += breathe
        turn = 0.015 * math.sin(two * phase * 0.5)
        for k in ('head', 'muzzle', 'nosetip', 'eal', 'ear', 'etl', 'etr'):
            if k in J: J[k].y += turn
    for i, k in enumerate(tail):
        J[k].y += wag * (i / max(1, len(tail) - 1)) ** 1.3
    return J


# ---------------------------------------------------------------- body + fur that follows it
def build_body(name, rest, E, skin_rgb):
    """Bake the skin-modifier body once at rest (its topology changes if the skeleton moves), then
    bind it to the skeleton's segments for linear-blend skinning."""
    from animals import skin_body
    import materials as M
    o = skin_body(name, rest, E)
    o.data.materials.append(M.plain(name + ' skin', skin_rgb, rough=0.8))
    co = np.empty(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    o.data.calc_loop_triangles()
    tris = np.empty(len(o.data.loop_triangles) * 3, np.int64); o.data.loop_triangles.foreach_get('vertices', tris)
    A = np.array([rest[a][0] for a, b in E]); B = np.array([rest[b][0] for a, b in E])
    # distance from each vertex to each skeleton segment; each vertex follows its two nearest
    ab = B - A; L2 = (ab * ab).sum(1)
    t = np.clip(((co[:, None, :] - A[None]) * ab[None]).sum(2) / L2[None], 0, 1)
    d = np.linalg.norm(co[:, None, :] - (A[None] + t[..., None] * ab[None]), axis=2)
    near = np.argsort(d, axis=1)[:, :2]
    dn = np.take_along_axis(d, near, 1)
    w = 1.0 / (dn + 0.004) ** 4; w /= w.sum(1, keepdims=True)
    skin = dict(E=E, near=near, w=w, rest=co, A=A, B=B)
    return o, skin, tris.reshape(-1, 3)


def _rot_between(u, v):
    """Rotation matrices taking directions u to v (one per row), minimal rotation."""
    u = u / np.linalg.norm(u, axis=1, keepdims=True); v = v / np.linalg.norm(v, axis=1, keepdims=True)
    c = (u * v).sum(1); ax = np.cross(u, v); s = np.linalg.norm(ax, axis=1)
    K = np.zeros((len(u), 3, 3))
    K[:, 0, 1], K[:, 0, 2], K[:, 1, 0], K[:, 1, 2], K[:, 2, 0], K[:, 2, 1] = -ax[:, 2], ax[:, 1], ax[:, 2], -ax[:, 0], -ax[:, 1], ax[:, 0]
    f = np.where(s > 1e-9, (1 - c) / np.maximum(s * s, 1e-18), 0.5)
    return np.eye(3)[None] + K + K @ K * f[:, None, None]


def deform(skin, J):
    """Linear-blend skinning: each segment's rest-to-pose rotation and translation, blended."""
    E = skin['E']
    A1 = np.array([J[a] for a, b in E]); B1 = np.array([J[b] for a, b in E])
    R = _rot_between(skin['B'] - skin['A'], B1 - A1)
    v = skin['rest']; out = np.zeros_like(v)
    for k in range(2):
        bi = skin['near'][:, k]
        out += skin['w'][:, k:k + 1] * (np.einsum('nij,nj->ni', R[bi], v - skin['A'][bi]) + A1[bi])
    return out


def tri_frames(co, tris):
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    e1 = b - a; e1 /= np.linalg.norm(e1, axis=1, keepdims=True) + 1e-12
    n = np.cross(b - a, c - a); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    e2 = np.cross(n, e1)
    return a, np.stack([e1, e2, n], axis=2), n   # R: columns are the frame axes


def grow_fur(co, tris, length, count, seed, flow=(-1.0, 0.0, -0.35), clump=0.45, mask=None, short_below=0.3, head_x=None):
    """Strands in rest pose: returns tri index per strand and the strand points (S, 4, 3)."""
    rng = np.random.default_rng(seed)
    T = tris if mask is None else tris[mask]
    idx = np.arange(len(tris)) if mask is None else np.nonzero(mask)[0]
    a, b, c = co[T[:, 0]], co[T[:, 1]], co[T[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    pick = rng.choice(len(T), size=count, p=area / area.sum())
    u, v = rng.random(count), rng.random(count)
    f = u + v > 1; u[f], v[f] = 1 - u[f], 1 - v[f]
    P = a[pick] + (b[pick] - a[pick]) * u[:, None] + (c[pick] - a[pick]) * v[:, None]
    N = np.cross(b - a, c - a)[pick]; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    fl = np.array(flow) / np.linalg.norm(flow)
    D = 0.45 * N + 0.9 * fl + rng.normal(0, 0.18, (count, 3)); D /= np.linalg.norm(D, axis=1, keepdims=True)
    L = length * rng.uniform(0.7, 1.15, count)
    L = np.where(P[:, 2] < short_below, L * 0.45, L)
    if head_x is not None: L = np.where(P[:, 0] > head_x, L * 0.5, L)
    Ln = np.array([mnoise.noise(Vector(p) * 18.0) for p in P])
    L = L * (1 + 0.35 * Ln) * np.where(rng.random(count) < 0.08, 1.45, 1.0)
    tips = P + D * L[:, None]
    nc = max(50, count // 40); ci = rng.choice(count, nc, replace=False)
    kd = kdtree.KDTree(nc)
    for j, i in enumerate(ci): kd.insert(P[i], j)
    kd.balance()
    near = np.array([kd.find(p)[1] for p in P]); ctip = tips[ci[near]]
    pull = clump * rng.uniform(0.6, 1.0, count)
    pts = np.zeros((count, 4, 3))
    for k in range(4):
        t = k / 3
        own = P - N * 0.002 + D * (L * t)[:, None] + np.array([0, 0, -1.0]) * (0.25 * L * t * t)[:, None]
        tgt = own + (ctip - tips) * (t ** 1.5)
        pts[:, k] = own * (1 - pull[:, None] * t) + tgt * (pull[:, None] * t)
    return idx[pick], pts


class Coat:
    def __init__(self, name, mat, tri_idx, pts, rest_co, tris, radius=(0.00034, 0.00026, 0.00015, 0.00004)):
        self.t = tri_idx
        a, R, _ = tri_frames(rest_co, tris)
        # strand points in their triangle's local frame
        self.local = np.einsum('sji,skj->ski', R[self.t], pts - a[self.t][:, None, :])
        self.tris = tris
        hc = bpy.data.hair_curves.new(name)
        hc.add_curves([4] * len(tri_idx))
        r = hc.attributes.new('radius', 'FLOAT', 'POINT')
        r.data.foreach_set('value', np.tile(np.array(radius, np.float32), len(tri_idx)))
        hc.materials.append(mat)
        self.obj = bpy.data.objects.new(name, hc); bpy.context.scene.collection.objects.link(self.obj)
        self.update(rest_co)

    def update(self, co):
        a, R, _ = tri_frames(co, self.tris)
        p = a[self.t][:, None, :] + np.einsum('sij,skj->ski', R[self.t], self.local)
        self.obj.data.position_data.foreach_set('vector', p.reshape(-1).astype(np.float32))
        self.obj.data.update_tag()


# ---------------------------------------------------------------- one dog
def setup_world(cell, samples):
    s = bpy.context.scene
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = True; s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.render.film_transparent = True
    s.render.use_persistent_data = True   # headings only turn the dog: keep the scene loaded between renders
    s.render.resolution_x = s.render.resolution_y = cell; s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'; s.view_settings.exposure = -0.4
    w = bpy.data.worlds.new('Sprite world'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.47, 0.38, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    # warm key from the open front (camera-left, above), cool-ish fill, and the floor's bounce
    def area(name, loc, size, energy, color):
        L = bpy.data.lights.new(name, 'AREA'); L.size = size; L.energy = energy; L.color = color
        o = bpy.data.objects.new(name, L); o.location = loc; s.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0.35)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('Key', (-2.2, -2.0, 2.6), 2.5, 300, (1.0, 0.86, 0.68))
    area('Fill', (2.5, -1.2, 1.4), 3.0, 80, (0.85, 0.9, 1.0))
    area('Rim', (0.5, 2.5, 1.8), 2.0, 110, (1.0, 0.9, 0.75))
    # shadow catcher floor
    bpy.ops.mesh.primitive_plane_add(size=6)
    fl = bpy.context.active_object; fl.name = 'Shadow catcher'; fl.is_shadow_catcher = True
    cam = bpy.data.objects.new('Sprite cam', bpy.data.cameras.new('Sprite cam')); s.collection.objects.link(cam); s.camera = cam
    cam.data.type = 'ORTHO'
    return s, cam


def render_dog(name, out, cell, samples):
    p = DOGS[name]
    s, cam = setup_world(cell, samples)
    import materials as M
    from animals import hair_material
    rest, E = p['skel']()
    body, skin, tris = build_body(name, rest, E, p['skin'])
    co0 = skin['rest']
    xs = co0[:, 0]; head_x = xs.max() - 0.12 * (xs.max() - xs.min())
    coats = []
    for i, (cname, mel, red, group) in enumerate(p['coats']):
        mask = None
        if group:
            cen = co0[tris].mean(1)
            hz = rest['head'][0][2]
            tan = ((cen[:, 2] > hz - 0.06) & (cen[:, 0] > rest['neck'][0][0] - 0.02)) | (cen[:, 2] > hz + 0.03)
            tan &= ~((cen[:, 0] > rest['muzzle'][0][0] - 0.02) & (np.abs(cen[:, 1]) < 0.012))
            mask = tan if group == 'tan' else ~tan
        n = int(p['count'] * (0.75 if group == 'white' else 0.3 if group == 'tan' else 1.0))
        ti, pts = grow_fur(co0, tris, p['length'], n, seed=7 + i, mask=mask, head_x=head_x, short_below=0.3 * rest['hip'][0][2] / 0.5)
        coats.append(Coat(name + ' ' + cname, hair_material(cname, mel, red), ti, pts, co0, tris))
    # eyes and nose ride on the head joint
    eye = M.plain('Dog eye', (0.02, 0.012, 0.006), rough=0.02, coat=1.0); nm = M.plain('Dog nose', (0.01, 0.01, 0.01), rough=0.3)
    hs = rest['head'][1]; hr = hs if isinstance(hs, (int, float)) else hs[0]
    parts = []
    for sd in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=hr * 0.14, segments=16, ring_count=8)
        e = bpy.context.active_object; e.data.materials.append(eye)
        parts.append((e, 'head', Vector((hr * 0.62, sd * hr * 0.5, hr * 0.22))))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=rest['nosetip'][1] * 0.95, segments=16, ring_count=8)
    nose = bpy.context.active_object; nose.data.materials.append(nm); nose.scale = (1, 1.2, 0.85)
    parts.append((nose, 'nosetip', Vector((rest['nosetip'][1] * 0.6, 0, 0.004))))
    root = bpy.data.objects.new(name + ' root', None); s.collection.objects.link(root)
    for o in [body] + [c.obj for c in coats] + [q[0] for q in parts]: o.parent = root
    # camera: orthographic, 25 deg down, framing the dog's standing height
    S = p['size']; tz = 0.42 * S
    cam.data.ortho_scale = S
    cam.location = (0, -10 * math.cos(ELEV), tz + 10 * math.sin(ELEV))
    cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    ground_y = 0.5 + tz * math.cos(ELEV) / S        # ground point, as a fraction of the cell from the top
    os.makedirs(out, exist_ok=True)
    frames = [('walk', i / WALK_FRAMES) for i in range(WALK_FRAMES)] + [('idle', i / IDLE_FRAMES) for i in range(IDLE_FRAMES)]
    import time
    t0 = time.time()
    print(f'{name}: setup done', flush=True)
    for fi, (kind, ph) in enumerate(frames):
        J = {k: np.array(v[:]) for k, v in pose(rest, kind, ph, p).items()}
        co = deform(skin, J)
        body.data.vertices.foreach_set('co', co.reshape(-1).astype(np.float32)); body.data.update()
        for c in coats: c.update(co)
        for o, jk, off in parts: o.location = Vector(J[jk]) + off
        for h in range(HEADINGS):
            # heading 0 = facing screen right, counter-clockwise seen from above
            root.rotation_euler = (0, 0, 2 * math.pi * h / HEADINGS)
            s.render.filepath = os.path.join(out, f'{name}_{kind}_{h}_{fi if kind == "walk" else fi - WALK_FRAMES}.png')
            tr = time.time(); bpy.ops.render.render(write_still=True)
            pass
        print(f'{name} frame {fi + 1}/{len(frames)} {time.time() - t0:.0f}s', flush=True)
    meta = dict(size=S, groundY=ground_y, elev=25, headings=HEADINGS, walk=WALK_FRAMES, idle=IDLE_FRAMES, stride=p['stride'] * 2, speed=p['speed'])
    json.dump(meta, open(os.path.join(out, f'{name}.json'), 'w'))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out = os.path.abspath(args[0]); cell = int(args[1]) if len(args) > 1 else 320; spp = int(args[2]) if len(args) > 2 else 24
    names = args[3:] or list(DOGS)
    for n in names:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        render_dog(n, out, cell, spp)
