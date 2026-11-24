"""
Free-range chickens for the 360 view, made like the cows (cow_sprites.py): a skinned body rendered
as sprite frames, 8 headings x a walk cycle (legs stepping, the head bobbing) plus a pecking loop,
seen from ~8 degrees above because the coop is ~11 m out behind the office.

    python blender/chicken_sprites.py <out dir> [cell px] [samples]
"""
import json, math, os, sys, time
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dog_sprites as DS

ELEV = math.radians(8.0)
HEADINGS, WALK, PECK = 8, 6, 6
COATS = {   # feathers, tail
    'brown': ((0.24, 0.085, 0.025), (0.06, 0.03, 0.012)),
    'white': ((0.82, 0.80, 0.74), (0.70, 0.68, 0.62)),
    'black': ((0.03, 0.03, 0.035), (0.02, 0.025, 0.03)),
}
RED, YELLOW = (0.55, 0.03, 0.02), (0.75, 0.52, 0.10)


def skeleton():
    J = {'tailb': ((-0.10, 0, 0.245), 0.09), 'body': ((-0.01, 0, 0.22), (0.13, 0.11)), 'breast': ((0.08, 0, 0.235), (0.1, 0.09)),
         'neck': ((0.11, 0, 0.30), 0.048), 'head': ((0.135, 0, 0.36), 0.036), 'beak': ((0.177, 0, 0.355), 0.009),
         'comb': ((0.13, 0, 0.40), (0.024, 0.008)), 'wattle': ((0.155, 0, 0.33), 0.01),
         'tail': ((-0.18, 0, 0.33), 0.035)}
    E = [('tailb', 'body'), ('body', 'breast'), ('breast', 'neck'), ('neck', 'head'), ('head', 'beak'), ('head', 'comb'),
         ('head', 'wattle'), ('tailb', 'tail')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'thigh{tag}': ((0.0, s * 0.045, 0.14), 0.045), f'shank{tag}': ((0.01, s * 0.045, 0.06), 0.009),
                  f'foot{tag}': ((0.04, s * 0.045, 0.007), 0.008)})
        E += [('body', f'thigh{tag}'), (f'thigh{tag}', f'shank{tag}'), (f'shank{tag}', f'foot{tag}')]
    return J, E


HEAD = ('neck', 'head', 'beak', 'comb', 'wattle')


def pose(rest, kind, phase):
    J = {k: Vector(v[0]) for k, v in rest.items()}
    two = 2 * math.pi
    if kind == 'walk':
        for tag, off in (('l', 0.0), ('r', 0.5)):
            q = (phase + off) % 1.0
            if q < 0.6: u = q / 0.6; dx, dz = 0.05 * (1 - 2 * u), 0.0
            else: u = (q - 0.6) / 0.4; dx, dz = 0.05 * (-1 + 2 * u), 0.035 * math.sin(math.pi * u)
            J[f'foot{tag}'] += Vector((dx, 0, dz)); J[f'shank{tag}'] += Vector((dx * 0.6, 0, dz * 0.8))
        # the head holds still, then snaps forward: a chicken's bob
        bob = 0.025 * (1 - ((phase * 2) % 1.0)) - 0.0125
        for k in HEAD[1:]: J[k].x += bob
        J['neck'].x += bob * 0.5
        sway = 0.006 * math.sin(two * phase)
        for k in J:
            if not k.startswith(('foot', 'shank')): J[k].z += abs(sway)
    else:
        # pecking: tip forward, head down to the ground and back up, twice per loop
        d = 0.5 - 0.5 * math.cos(two * phase * 2)
        tip = 0.35 * d
        for k in ('breast', 'neck', 'head', 'beak', 'comb', 'wattle'):
            p = J[k] - Vector((0.0, 0, 0.22))
            J[k] = Vector((0.0, 0, 0.22)) + Vector((p.x * math.cos(tip) + p.z * math.sin(tip), p.y, -p.x * math.sin(tip) + p.z * math.cos(tip)))
        for k in HEAD[1:]:
            J[k] += Vector((0.04 * d, 0, -0.24 * d))
        J['neck'] += Vector((0.03 * d, 0, -0.12 * d))
        J['tail'].z += 0.04 * d
    return J


def render(out, cell, samples):
    import materials as M
    for name, (feather, tailc) in COATS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s, cam = DS.setup_world(cell, samples)
        rest, E = skeleton()
        body, skin, tris = DS.build_body('Chicken ' + name, rest, E, feather)
        # per-vertex colour by the nearest bone: red comb and wattle, yellow beak and legs
        seg = skin['near'][:, 0]
        cols = np.zeros((len(seg), 4)); cols[:, 3] = 1
        for i, (a, b) in enumerate(E):
            c = RED if b in ('comb', 'wattle') else YELLOW if b in ('beak',) or b.startswith(('shank', 'foot')) else tailc if b == 'tail' else feather
            cols[seg == i, :3] = c
            if b.startswith('shank'):       # feathered thigh, bare yellow shank
                cols[(seg == i) & (skin['rest'][:, 2] > 0.095), :3] = feather
        attr = body.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        attr.data.foreach_set('color', cols.reshape(-1).astype(np.float32))
        m = M.plain('Chicken ' + name, feather, rough=0.75, sheen=0.15)
        nt = m.node_tree; a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'
        nt.links.new(a.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
        body.data.materials.clear(); body.data.materials.append(m)
        eye = []
        for sd in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.007, segments=10, ring_count=5)
            e = bpy.context.active_object; e.data.materials.append(M.plain('Eye', (0.01, 0.008, 0.005), rough=0.05, coat=1.0))
            eye.append((e, Vector((0.012, sd * 0.026, 0.008))))
        root = bpy.data.objects.new('root', None); s.collection.objects.link(root)
        for o in [body] + [e for e, _ in eye]: o.parent = root
        S = 0.7; tz = 0.2
        cam.data.ortho_scale = S
        cam.location = (0, -20 * math.cos(ELEV), tz + 20 * math.sin(ELEV))
        cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        ground_y = 0.5 + tz * math.cos(ELEV) / S
        frames = [('walk', i / WALK) for i in range(WALK)] + [('peck', i / PECK) for i in range(PECK)]
        t0 = time.time()
        for fi, (kind, ph) in enumerate(frames):
            J = {k: np.array(v[:]) for k, v in pose(rest, kind, ph).items()}
            co = DS.deform(skin, J)
            body.data.vertices.foreach_set('co', co.reshape(-1).astype(np.float32)); body.data.update()
            for e, off in eye: e.location = Vector(J['head']) + off
            for h in range(HEADINGS):
                root.rotation_euler = (0, 0, 2 * math.pi * h / HEADINGS)
                idx = fi if kind == 'walk' else fi - WALK
                s.render.filepath = os.path.join(out, f'chicken-{name}_{"walk" if kind == "walk" else "idle"}_{h}_{idx}.png')
                bpy.ops.render.render(write_still=True)
            print(f'chicken {name} frame {fi + 1}/{len(frames)} {time.time() - t0:.0f}s', flush=True)
        json.dump(dict(size=S, groundY=ground_y, elev=8, headings=HEADINGS, walk=WALK, idle=PECK, stride=0.18, speed=0.45),
                  open(os.path.join(out, f'chicken-{name}.json'), 'w'))


if __name__ == '__main__':
    a = sys.argv[1:]
    render(os.path.abspath(a[0]), int(a[1]) if len(a) > 1 else 128, int(a[2]) if len(a) > 2 else 16)
