"""
Grazing cows for the 360 view: like the dogs (dog_sprites.py), each cow coat is rendered as
sprite frames, 8 headings x a walk cycle plus a grazing loop (head down, nosing the grass from
side to side, tail swishing), seen almost level because the pen is ~65 m away across the farm.

    python blender/cow_sprites.py <out dir> [cell px] [samples]
"""
import json, math, os, sys, time
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dog_sprites as DS

ELEV = math.radians(4.0)
HEADINGS, WALK, GRAZE = 8, 8, 6
COATS = {
    'brown': ('Brown and white coat', (0.32, 0.16, 0.07), (0.82, 0.78, 0.72)),
    'black': ('Black and white coat', (0.03, 0.03, 0.03), (0.85, 0.82, 0.78)),
    'red': ('Red coat', (0.36, 0.13, 0.05), (0.42, 0.18, 0.08)),
}


def skeleton():
    """The scene's cow (animals.cow), standing, head up."""
    J = {'hip': ((-0.65, 0, 1.15), (0.3, 0.28)), 'belly': ((-0.15, 0, 1.08), (0.4, 0.36)), 'chest': ((0.4, 0, 1.12), (0.34, 0.3)),
         'neck': ((0.75, 0, 1.15), 0.2), 'head': ((1.0, 0, 1.25), (0.13, 0.11)), 'muzzle': ((1.12, 0, 1.1), 0.09),
         'tail0': ((-0.9, 0, 1.25), 0.05), 'tail1': ((-0.95, 0, 0.6), 0.03)}
    E = [('hip', 'belly'), ('belly', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('hip', 'tail0'), ('tail0', 'tail1')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'f0{tag}': ((0.4, s * 0.18, 0.9), 0.12), f'f1{tag}': ((0.42, s * 0.18, 0.45), 0.07), f'f2{tag}': ((0.42, s * 0.18, 0.04), 0.055),
                  f'h0{tag}': ((-0.62, s * 0.2, 0.9), 0.16), f'h1{tag}': ((-0.55, s * 0.2, 0.5), 0.08), f'h2{tag}': ((-0.62, s * 0.2, 0.04), 0.055),
                  f'ear{tag}': ((0.98, s * 0.16, 1.3), (0.05, 0.02)), f'horn{tag}': ((1.0, s * 0.09, 1.36), 0.018)})
        E += [('chest', f'f0{tag}'), (f'f0{tag}', f'f1{tag}'), (f'f1{tag}', f'f2{tag}'), ('hip', f'h0{tag}'), (f'h0{tag}', f'h1{tag}'), (f'h1{tag}', f'h2{tag}'),
              ('head', f'ear{tag}'), ('head', f'horn{tag}')]
    return J, E


LEGS = [(['f0l', 'f1l', 'f2l'], 0.25), (['f0r', 'f1r', 'f2r'], 0.75), (['h0l', 'h1l', 'h2l'], 0.0), (['h0r', 'h1r', 'h2r'], 0.5)]
HEAD = ('head', 'muzzle', 'earl', 'earr', 'hornl', 'hornr')


def pose(rest, kind, phase):
    J = {k: Vector(v[0]) for k, v in rest.items()}
    two = 2 * math.pi
    if kind == 'walk':
        bob = -0.012 * math.cos(2 * two * phase)
        for k in J:
            if k[:2] not in ('f1', 'f2', 'h1', 'h2'): J[k].z += bob
        for chain, off in LEGS:
            s0, m1, hoof = chain
            q = (phase + off) % 1.0
            A, lift = 0.22, 0.09
            if q < 0.65: u = q / 0.65; dx, dz = A * (1 - 2 * u), 0.0
            else: u = (q - 0.65) / 0.35; sm = u * u * (3 - 2 * u); dx, dz = A * (-1 + 2 * sm), lift * math.sin(math.pi * u)
            rh, rk, rs = Vector(rest[hoof][0]), Vector(rest[m1][0]), Vector(rest[s0][0])
            J[hoof] = rh + Vector((dx, 0, dz))
            J[m1] = DS._ik(J[s0], J[hoof], (rk - rs).length, (Vector(rest[hoof][0]) - rk).length, rk)
        nod = 0.03 * math.sin(2 * two * phase)
        for k in HEAD: J[k].z += nod
        swish = 0.06 * math.sin(two * phase)
    else:
        # grazing: neck and head down to the grass, sweeping slowly side to side, jaw working
        sweep = 0.12 * math.sin(two * phase); chew = 0.015 * math.sin(3 * two * phase)
        J['neck'] = Vector((0.85, sweep * 0.4, 0.85))
        base = {'head': (1.12, 0.38), 'muzzle': (1.2, 0.14), 'earl': (1.08, 0.46), 'earr': (1.08, 0.46), 'hornl': (1.06, 0.5), 'hornr': (1.06, 0.5)}
        for k, (x, z) in base.items():
            y0 = rest[k][0][1]
            J[k] = Vector((x, y0 + sweep, z + (chew if k == 'muzzle' else 0)))
        swish = 0.1 * math.sin(two * phase * 2)
    J['tail1'].y += swish
    return J


def render(out, cell, samples):
    for name, (cname, base, patch) in COATS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s, cam = DS.setup_world(cell, samples)
        from animals import cow_coat
        rest, E = skeleton()
        body, skin, tris = DS.build_body('Cow ' + name, rest, E, base)
        body.data.materials.clear(); body.data.materials.append(cow_coat(cname, base, patch))
        # dark muzzle, eyes and horns ride on the head joint
        import materials as M
        parts = []
        for sd in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=12, ring_count=6)
            e = bpy.context.active_object; e.data.materials.append(M.plain('Cow eye', (0.01, 0.008, 0.006), rough=0.05, coat=1.0))
            parts.append((e, 'head', Vector((0.06, sd * 0.11, 0.04))))
        root = bpy.data.objects.new('root', None); s.collection.objects.link(root)
        for o in [body] + [p[0] for p in parts]: o.parent = root
        S = 3.0; tz = 0.85
        cam.data.ortho_scale = S
        cam.location = (0, -20 * math.cos(ELEV), tz + 20 * math.sin(ELEV))
        cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        ground_y = 0.5 + tz * math.cos(ELEV) / S
        frames = [('walk', i / WALK) for i in range(WALK)] + [('graze', i / GRAZE) for i in range(GRAZE)]
        t0 = time.time()
        for fi, (kind, ph) in enumerate(frames):
            J = {k: np.array(v[:]) for k, v in pose(rest, kind, ph).items()}
            co = DS.deform(skin, J)
            body.data.vertices.foreach_set('co', co.reshape(-1).astype(np.float32)); body.data.update()
            for o, jk, off in parts: o.location = Vector(J[jk]) + off
            for h in range(HEADINGS):
                root.rotation_euler = (0, 0, 2 * math.pi * h / HEADINGS)
                idx = fi if kind == 'walk' else fi - WALK
                s.render.filepath = os.path.join(out, f'cow-{name}_{kind if kind == "walk" else "idle"}_{h}_{idx}.png')
                bpy.ops.render.render(write_still=True)
            print(f'cow {name} frame {fi + 1}/{len(frames)} {time.time() - t0:.0f}s', flush=True)
        json.dump(dict(size=S, groundY=ground_y, elev=4, headings=HEADINGS, walk=WALK, idle=GRAZE, stride=0.44, speed=0.35),
                  open(os.path.join(out, f'cow-{name}.json'), 'w'))


if __name__ == '__main__':
    a = sys.argv[1:]
    render(os.path.abspath(a[0]), int(a[1]) if len(a) > 1 else 160, int(a[2]) if len(a) > 2 else 24)
