"""
Grazing cows for the 360 view: like the dogs (dog_sprites.py), each cow coat is rendered as
sprite frames, 8 headings x a walk cycle plus a grazing loop (head down, nosing the grass from
side to side, tail swishing), seen from a little above because the pen is 15-25 m out from the left window.

    python blender/cow_sprites.py <out dir> [cell px] [samples]
"""
import json, math, os, sys, time
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dog_sprites as DS

ELEV = math.radians(5.5)
HEADINGS, WALK, GRAZE = 8, 8, 6
COATS = {   # coat, patches, patch scale (Nguni-style patterns), nose
    'brown': ('Brown and white coat', (0.075, 0.032, 0.013), (0.72, 0.68, 0.62), 1.6, (0.30, 0.20, 0.18)),
    'black': ('Black and white coat', (0.018, 0.018, 0.018), (0.74, 0.72, 0.68), 1.4, (0.05, 0.04, 0.04)),
    'red': ('Red speckled coat', (0.11, 0.035, 0.012), (0.66, 0.58, 0.50), 5.0, (0.30, 0.19, 0.16)),
}
DARK, HORN, UDDER = (0.03, 0.025, 0.02), (0.72, 0.66, 0.55), (0.62, 0.42, 0.38)


def coat_material(name, base, patch, scale):
    """Patches from noise on the rest pose (a 'rest' attribute), so they stay put as the cow walks;
    a 'Detail' colour attribute (alpha = how much) paints hooves, nose, horns, udder and switch."""
    import materials as M
    m = M.plain(name, base, rough=0.62, sheen=0.12)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    rest = nt.nodes.new('ShaderNodeAttribute'); rest.attribute_name = 'rest'
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 4; n.inputs['Roughness'].default_value = 0.55
    nt.links.new(rest.outputs['Vector'], n.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position = 0.56; r.color_ramp.elements[0].color = (*base, 1)
    r.color_ramp.elements[1].position = 0.6; r.color_ramp.elements[1].color = (*patch, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    det = nt.nodes.new('ShaderNodeAttribute'); det.attribute_name = 'Detail'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(det.outputs['Alpha'], mix.inputs['Factor']); nt.links.new(r.outputs['Color'], mix.inputs['A']); nt.links.new(det.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    fur = nt.nodes.new('ShaderNodeTexNoise'); fur.inputs['Scale'].default_value = 180.0
    nt.links.new(rest.outputs['Vector'], fur.inputs['Vector'])
    M._bump(nt, b, fur.outputs['Fac'], 0.3, 0.003)
    return m


def skeleton():
    """A Nguni-type cow: level back with a slight hump over the shoulders, deep barrel, pin bones at
    the rump, a dewlap, an udder, a long face with a broad muzzle, sideways ears, lyre horns, slim
    lower legs and a tail ending in a dark switch."""
    # a smooth spine (tailhead to shoulder) so the barrel reads as one body, not a string of lumps
    J = {'rump': ((-1.0, 0, 1.16), (0.16, 0.14)), 'pins': ((-0.84, 0, 1.17), (0.27, 0.22)), 'hip': ((-0.58, 0, 1.15), (0.33, 0.3)),
         'belly': ((-0.2, 0, 1.06), (0.4, 0.4)), 'chest': ((0.2, 0, 1.06), (0.36, 0.38)), 'wither': ((0.42, 0, 1.18), (0.25, 0.27)),
         'neck': ((0.74, 0, 1.16), (0.2, 0.21)), 'dewlap': ((0.62, 0, 0.86), (0.06, 0.1)),
         'head': ((0.99, 0, 1.22), (0.13, 0.12)), 'face': ((1.11, 0, 1.08), (0.1, 0.095)), 'muzzle': ((1.2, 0, 0.98), (0.092, 0.088)),
         'udder': ((-0.45, 0, 0.76), 0.11),
         'tail0': ((-1.06, 0, 1.16), 0.04), 'tail1': ((-1.04, 0, 0.72), 0.022), 'tail2': ((-1.04, 0, 0.42), 0.05)}
    E = [('pins', 'rump'), ('pins', 'hip'), ('hip', 'belly'), ('belly', 'chest'), ('chest', 'wither'), ('wither', 'neck'), ('chest', 'dewlap'),
         ('neck', 'head'), ('head', 'face'), ('face', 'muzzle'), ('belly', 'udder'), ('rump', 'tail0'), ('tail0', 'tail1'), ('tail1', 'tail2')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'f0{tag}': ((0.38, s * 0.17, 0.86), 0.11), f'f1{tag}': ((0.4, s * 0.17, 0.42), 0.042), f'f2{tag}': ((0.4, s * 0.17, 0.05), 0.04),
                  f'h0{tag}': ((-0.6, s * 0.19, 0.9), 0.15), f'h1{tag}': ((-0.68, s * 0.19, 0.45), 0.046), f'h2{tag}': ((-0.62, s * 0.19, 0.05), 0.04),
                  f'ear{tag}': ((0.95, s * 0.21, 1.25), (0.07, 0.02)), f'horn{tag}': ((1.0, s * 0.13, 1.33), 0.026), f'tip{tag}': ((1.04, s * 0.21, 1.45), 0.011)})
        E += [('chest', f'f0{tag}'), (f'f0{tag}', f'f1{tag}'), (f'f1{tag}', f'f2{tag}'), ('hip', f'h0{tag}'), (f'h0{tag}', f'h1{tag}'), (f'h1{tag}', f'h2{tag}'),
              ('head', f'ear{tag}'), ('head', f'horn{tag}'), (f'horn{tag}', f'tip{tag}')]
    return J, E


LEGS = [(['f0l', 'f1l', 'f2l'], 0.25), (['f0r', 'f1r', 'f2r'], 0.75), (['h0l', 'h1l', 'h2l'], 0.0), (['h0r', 'h1r', 'h2r'], 0.5)]
HEAD = ('head', 'face', 'muzzle', 'earl', 'earr', 'hornl', 'hornr', 'tipl', 'tipr')


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
        base = {'head': (1.1, 0.42), 'face': (1.17, 0.26), 'muzzle': (1.2, 0.12), 'earl': (1.06, 0.48), 'earr': (1.06, 0.48),
                'hornl': (1.04, 0.54), 'hornr': (1.04, 0.54), 'tipl': (1.0, 0.66), 'tipr': (1.0, 0.66)}
        for k, (x, z) in base.items():
            y0 = rest[k][0][1]
            J[k] = Vector((x, y0 + sweep, z + (chew if k == 'muzzle' else 0)))
        swish = 0.1 * math.sin(two * phase * 2)
    J['tail1'].y += swish; J['tail2'].y += swish * 1.6
    return J


def render(out, cell, samples):
    for name, (cname, base, patch, scale, nose) in COATS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s, cam = DS.setup_world(cell, samples)
        # outdoor daylight rather than the dogs' warm room light: blue sky, a neutral sun-like key
        bg = s.world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.63, 0.78, 1); bg.inputs[1].default_value = 0.7
        for o in s.objects:
            if o.type == 'LIGHT':
                o.data.color = {'Key': (1.0, 0.96, 0.9), 'Fill': (0.78, 0.86, 1.0), 'Rim': (1.0, 0.97, 0.92)}.get(o.name, o.data.color)
                if o.name == 'Key': o.data.energy = 380
        rest, E = skeleton()
        body, skin, tris = DS.build_body('Cow ' + name, rest, E, base)
        co0 = np.array([v.co[:] for v in body.data.vertices])
        ra = body.data.attributes.new('rest', 'FLOAT_VECTOR', 'POINT'); ra.data.foreach_set('vector', co0.reshape(-1).astype(np.float32))
        seg = skin['near'][:, 0]; det = np.zeros((len(seg), 4))
        for i, (a, b) in enumerate(E):
            sel = seg == i
            if b.startswith(('f2', 'h2')):
                low = sel & (co0[:, 2] < 0.12); det[low, :3] = DARK; det[low, 3] = 1
            elif b == 'muzzle':
                end = sel & (co0[:, 0] > 1.2); det[end, :3] = nose; det[end, 3] = 1
            elif b.startswith(('horn', 'tip')):
                det[sel, :3] = HORN if b.startswith('horn') else DARK; det[sel, 3] = 1
            elif b == 'udder':
                lo = sel & (co0[:, 2] < 0.74); det[lo, :3] = UDDER; det[lo, 3] = 1
            elif b == 'tail2':
                det[sel, :3] = DARK; det[sel, 3] = 1
        da = body.data.color_attributes.new('Detail', 'FLOAT_COLOR', 'POINT'); da.data.foreach_set('color', det.reshape(-1).astype(np.float32))
        body.data.materials.clear(); body.data.materials.append(coat_material(cname, base, patch, scale))
        # dark muzzle, eyes and horns ride on the head joint
        import materials as M
        parts = []
        for sd in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=12, ring_count=6)
            e = bpy.context.active_object; e.data.materials.append(M.plain('Cow eye', (0.01, 0.008, 0.006), rough=0.05, coat=1.0))
            parts.append((e, 'head', Vector((0.04, sd * 0.115, 0.02))))
        root = bpy.data.objects.new('root', None); s.collection.objects.link(root)
        for o in [body] + [p[0] for p in parts]: o.parent = root
        S = 3.0; tz = 0.85
        cam.data.ortho_scale = S
        cam.location = (0, -20 * math.cos(ELEV), tz + 20 * math.sin(ELEV))
        cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        ground_y = 0.5 + tz * math.cos(ELEV) / S
        frames = [('walk', i / WALK) for i in range(WALK)] + [('graze', i / GRAZE) for i in range(GRAZE)]
        t0 = time.time()
        if os.environ.get('COWTEST'): frames = frames[:1]
        for fi, (kind, ph) in enumerate(frames):
            J = {k: np.array(v[:]) for k, v in pose(rest, kind, ph).items()}
            co = DS.deform(skin, J)
            body.data.vertices.foreach_set('co', co.reshape(-1).astype(np.float32)); body.data.update()
            for o, jk, off in parts: o.location = Vector(J[jk]) + off
            for h in (range(HEADINGS) if not os.environ.get('COWTEST') else (0, 2)):
                root.rotation_euler = (0, 0, 2 * math.pi * h / HEADINGS)
                idx = fi if kind == 'walk' else fi - WALK
                s.render.filepath = os.path.join(out, f'cow-{name}_{kind if kind == "walk" else "idle"}_{h}_{idx}.png')
                bpy.ops.render.render(write_still=True)
            print(f'cow {name} frame {fi + 1}/{len(frames)} {time.time() - t0:.0f}s', flush=True)
        json.dump(dict(size=S, groundY=ground_y, elev=5.5, headings=HEADINGS, walk=WALK, idle=GRAZE, stride=0.44, speed=0.35),
                  open(os.path.join(out, f'cow-{name}.json'), 'w'))


if __name__ == '__main__':
    a = sys.argv[1:]
    render(os.path.abspath(a[0]), int(a[1]) if len(a) > 1 else 160, int(a[2]) if len(a) > 2 else 24)
