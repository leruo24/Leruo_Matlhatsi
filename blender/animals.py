"""
The three dogs and the cows. Bodies are skeletons turned into smooth meshes by the Skin modifier;
the dogs get real particle-hair fur in their coat colours (from the dogs in the approved image):
  - a golden, short-coated dog standing with a curled tail
  - a golden retriever lying down
  - a small white terrier with tan head and ear patches, sitting
"""
import math
import bpy, bmesh
from mathutils import Vector
from props import empty, sphere, _height
import materials as M


def skin_body(name, joints, edges, scale=1.0, sub=2):
    """joints: {key: ((x, y, z), radius or (rx, ry))}; edges: [(a, b)]. Returns a real mesh object."""
    keys = list(joints)
    bm = bmesh.new()
    vs = {k: bm.verts.new(Vector(joints[k][0]) * scale) for k in keys}
    for a, b in edges:
        bm.edges.new((vs[a], vs[b]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    sv = me.skin_vertices[0].data
    for i, k in enumerate(keys):
        r = joints[k][1]; r = (r, r) if isinstance(r, (int, float)) else r
        sv[i].radius = (r[0] * scale, r[1] * scale)
    sv[0].use_root = True
    ss = o.modifiers.new('smooth', 'SUBSURF'); ss.levels = sub; ss.render_levels = sub
    # bake the modifiers into a plain mesh so hair can grow from it
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    for mod in list(o.modifiers): o.modifiers.remove(mod)
    o.data = mesh
    for p in o.data.polygons: p.use_smooth = True
    return o


def hair_material(name, melanin, redness, roughness=0.35):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); h = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
    h.parametrization = 'MELANIN'
    h.inputs['Melanin'].default_value = melanin; h.inputs['Melanin Redness'].default_value = redness
    h.inputs['Roughness'].default_value = roughness; h.inputs['Radial Roughness'].default_value = 0.4
    nt.links.new(h.outputs['BSDF'], out.inputs['Surface'])
    return m


def fur(obj, mat, length, count=60000, group=None, flow=(-1.0, 0.0, -0.35), seed=1, short_below=None, **_):
    """Fur as native hair curves: strands sampled over the body by area, lying back along the
    body (flow, in the body's local space) and drooping slightly. Shorter on the face and legs."""
    import numpy as np
    rng = np.random.default_rng(seed)
    me = obj.data; me.calc_loop_triangles()
    tris = np.array([t.vertices[:] for t in me.loop_triangles])
    co = np.array([v.co[:] for v in me.vertices])
    if group is not None:   # only where the vertex group is painted
        gi = obj.vertex_groups[group].index
        w = np.array([next((g.weight for g in v.groups if g.group == gi), 0.0) for v in me.vertices])
        tris = tris[w[tris].mean(1) > 0.5]
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    pick = rng.choice(len(tris), size=count, p=area / area.sum())
    u, v = rng.random(count), rng.random(count)
    flip = u + v > 1; u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    P = a[pick] + (b[pick] - a[pick]) * u[:, None] + (c[pick] - a[pick]) * v[:, None]
    N = np.cross(b - a, c - a)[pick]; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    flowv = np.array(flow, float); flowv /= np.linalg.norm(flowv)
    D = 0.45 * N + 0.9 * flowv + rng.normal(0, 0.18, (count, 3))
    D /= np.linalg.norm(D, axis=1, keepdims=True)
    L = length * rng.uniform(0.7, 1.15, count)
    if short_below is not None:   # legs and paws: short hair
        L = np.where(P[:, 2] < short_below, L * 0.45, L)
    head_x = co[:, 0].max() - 0.12 * (co[:, 0].max() - co[:, 0].min())
    L = np.where(P[:, 0] > head_x, L * 0.5, L)   # face: short hair
    pts = np.zeros((count, 4, 3))
    for k in range(4):
        t = k / 3
        pts[:, k] = P - N * 0.002 + D * (L * t)[:, None] + np.array([0, 0, -1.0]) * (0.25 * L * t * t)[:, None]
    hc = bpy.data.hair_curves.new(obj.name + ' fur')
    hc.add_curves([4] * count)
    hc.position_data.foreach_set('vector', pts.reshape(-1).astype(np.float32))
    rad = hc.attributes.new('radius', 'FLOAT', 'POINT')
    rad.data.foreach_set('value', np.tile(np.array([0.00045, 0.00035, 0.00022, 0.00006], np.float32), count))
    hc.materials.append(mat)
    o = bpy.data.objects.new(obj.name + ' fur', hc); bpy.context.scene.collection.objects.link(o)
    o.parent = obj
    return o


def eyes_and_nose(parent, head, fwd, side, r_eye=0.012, nose=(0.02, Vector((0, 0, 0)))):
    eye = M.plain('Dog eye', (0.02, 0.012, 0.006), rough=0.02, coat=1.0)
    nmat = M.plain('Dog nose', (0.01, 0.01, 0.01), rough=0.3)
    for s in (-1, 1):
        e = sphere('Eye', r_eye, head + fwd + Vector((0, s * side, 0.012)), eye, parent=parent, seg=16)
    sphere('Nose', nose[0], nose[1], nmat, scale=(1, 1.2, 0.85), parent=parent, seg=16)


def standing_dog(loc, rot):
    J = {
        'hip': ((-0.30, 0, 0.50), (0.105, 0.1)), 'spine': ((-0.05, 0, 0.53), 0.13), 'chest': ((0.17, 0, 0.47), (0.15, 0.13)),
        'withers': ((0.27, 0, 0.58), 0.1), 'neck': ((0.36, 0, 0.71), 0.07), 'head': ((0.45, 0, 0.78), 0.085),
        'muzzle': ((0.56, 0, 0.75), 0.045), 'nosetip': ((0.62, 0, 0.745), 0.028),
        'tail0': ((-0.38, 0, 0.55), 0.04), 'tail1': ((-0.47, 0, 0.7), 0.035), 'tail2': ((-0.40, 0, 0.83), 0.03), 'tail3': ((-0.30, 0, 0.82), 0.02),
    }
    E = [('hip', 'spine'), ('spine', 'chest'), ('chest', 'withers'), ('withers', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('muzzle', 'nosetip'),
         ('hip', 'tail0'), ('tail0', 'tail1'), ('tail1', 'tail2'), ('tail2', 'tail3')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'fs{tag}': ((0.21, s * 0.08, 0.45), 0.06), f'fe{tag}': ((0.21, s * 0.08, 0.28), 0.045), f'fw{tag}': ((0.22, s * 0.08, 0.07), 0.03), f'fp{tag}': ((0.26, s * 0.08, 0.025), (0.04, 0.035)),
                  f'hs{tag}': ((-0.29, s * 0.08, 0.44), 0.075), f'hk{tag}': ((-0.22, s * 0.085, 0.29), 0.055), f'hh{tag}': ((-0.35, s * 0.08, 0.13), 0.034), f'hp{tag}': ((-0.31, s * 0.08, 0.025), (0.04, 0.035)),
                  f'ea{tag}': ((0.43, s * 0.05, 0.85), 0.032), f'et{tag}': ((0.42, s * 0.065, 0.94), 0.007)})
        E += [('chest', f'fs{tag}'), (f'fs{tag}', f'fe{tag}'), (f'fe{tag}', f'fw{tag}'), (f'fw{tag}', f'fp{tag}'),
              ('hip', f'hs{tag}'), (f'hs{tag}', f'hk{tag}'), (f'hk{tag}', f'hh{tag}'), (f'hh{tag}', f'hp{tag}'),
              ('head', f'ea{tag}'), (f'ea{tag}', f'et{tag}')]
    body = skin_body('Golden dog', J, E)
    body.data.materials.append(M.plain('Golden skin', (0.45, 0.28, 0.12), rough=0.8))
    fur(body, hair_material('Golden short coat', 0.42, 0.78), 0.03, count=90000, short_below=0.3, seed=1)
    g = empty('Golden dog (standing)', loc, rot); body.parent = g
    eyes_and_nose(g, Vector((0.45, 0, 0.78)), Vector((0.07, 0, 0.01)), 0.035, nose=(0.024, Vector((0.635, 0, 0.75))))
    return g


def lying_dog(loc, rot):
    J = {
        'hip': ((-0.33, 0, 0.17), (0.13, 0.15)), 'spine': ((-0.08, 0, 0.21), (0.15, 0.15)), 'chest': ((0.16, 0, 0.2), (0.16, 0.15)),
        'withers': ((0.26, 0, 0.27), 0.11), 'neck': ((0.33, 0, 0.38), 0.08), 'head': ((0.41, 0, 0.45), 0.095),
        'muzzle': ((0.52, 0, 0.42), 0.05), 'nosetip': ((0.58, 0, 0.415), 0.03),
        'tail0': ((-0.45, 0, 0.12), 0.045), 'tail1': ((-0.62, 0.05, 0.05), 0.04), 'tail2': ((-0.78, 0.12, 0.035), 0.03),
    }
    E = [('hip', 'spine'), ('spine', 'chest'), ('chest', 'withers'), ('withers', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('muzzle', 'nosetip'),
         ('hip', 'tail0'), ('tail0', 'tail1'), ('tail1', 'tail2')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'fs{tag}': ((0.2, s * 0.1, 0.14), 0.06), f'fe{tag}': ((0.27, s * 0.1, 0.05), 0.045), f'fp{tag}': ((0.47, s * 0.1, 0.03), (0.045, 0.04)),
                  f'hs{tag}': ((-0.3, s * 0.13, 0.14), 0.09), f'hk{tag}': ((-0.12, s * 0.17, 0.07), 0.06), f'hp{tag}': ((-0.03, s * 0.16, 0.03), (0.045, 0.04)),
                  f'ea{tag}': ((0.39, s * 0.085, 0.47), (0.045, 0.02)), f'et{tag}': ((0.4, s * 0.1, 0.36), (0.04, 0.012))})
        E += [('chest', f'fs{tag}'), (f'fs{tag}', f'fe{tag}'), (f'fe{tag}', f'fp{tag}'),
              ('hip', f'hs{tag}'), (f'hs{tag}', f'hk{tag}'), (f'hk{tag}', f'hp{tag}'),
              ('head', f'ea{tag}'), (f'ea{tag}', f'et{tag}')]
    body = skin_body('Retriever', J, E, scale=1.05)
    body.data.materials.append(M.plain('Retriever skin', (0.5, 0.33, 0.15), rough=0.8))
    fur(body, hair_material('Retriever coat', 0.3, 0.72), 0.06, count=110000, short_below=0.08, seed=2)
    g = empty('Golden retriever (lying)', loc, rot); body.parent = g
    eyes_and_nose(g, Vector((0.43, 0, 0.47)), Vector((0.07, 0, 0.01)), 0.04, r_eye=0.013, nose=(0.026, Vector((0.6, 0, 0.42))))
    return g


def terrier(loc, rot):
    J = {
        'hip': ((-0.1, 0, 0.1), (0.08, 0.075)), 'spine': ((-0.03, 0, 0.17), 0.075), 'chest': ((0.05, 0, 0.23), (0.08, 0.07)),
        'neck': ((0.08, 0, 0.32), 0.05), 'head': ((0.12, 0, 0.38), 0.06), 'muzzle': ((0.2, 0, 0.36), 0.03), 'nosetip': ((0.24, 0, 0.355), 0.018),
        'tail0': ((-0.17, 0, 0.06), 0.022), 'tail1': ((-0.24, 0.06, 0.03), 0.016),
    }
    E = [('hip', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('muzzle', 'nosetip'), ('hip', 'tail0'), ('tail0', 'tail1')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'fs{tag}': ((0.07, s * 0.045, 0.2), 0.035), f'fw{tag}': ((0.08, s * 0.045, 0.04), 0.02), f'fp{tag}': ((0.1, s * 0.045, 0.012), (0.024, 0.02)),
                  f'hs{tag}': ((-0.08, s * 0.07, 0.09), 0.055), f'hk{tag}': ((0.0, s * 0.075, 0.05), 0.035), f'hp{tag}': ((0.05, s * 0.07, 0.012), (0.026, 0.02)),
                  f'ea{tag}': ((0.11, s * 0.045, 0.43), 0.022), f'et{tag}': ((0.14, s * 0.06, 0.42), 0.01)})
        E += [('chest', f'fs{tag}'), (f'fs{tag}', f'fw{tag}'), (f'fw{tag}', f'fp{tag}'),
              ('hip', f'hs{tag}'), (f'hs{tag}', f'hk{tag}'), (f'hk{tag}', f'hp{tag}'),
              ('head', f'ea{tag}'), (f'ea{tag}', f'et{tag}')]
    body = skin_body('Terrier', J, E)
    body.data.materials.append(M.plain('Terrier skin', (0.75, 0.7, 0.65), rough=0.8))
    # tan on the head and ears, white everywhere else (density vertex groups)
    tan = body.vertex_groups.new(name='tan'); white = body.vertex_groups.new(name='white')
    for v in body.data.vertices:
        p = v.co
        is_tan = (p.z > 0.33 and p.x < 0.19) or (p.z > 0.4)
        is_tan = is_tan and not (p.x > 0.15 and abs(p.y) < 0.02)   # white blaze down the muzzle
        (tan if is_tan else white).add([v.index], 1.0, 'REPLACE')
    fur(body, hair_material('Terrier white coat', 0.03, 0.4), 0.014, count=45000, group='white', short_below=0.06, seed=3)
    fur(body, hair_material('Terrier tan coat', 0.45, 0.85), 0.012, count=15000, group='tan', seed=4)
    g = empty('Terrier (sitting)', loc, rot); body.parent = g
    eyes_and_nose(g, Vector((0.12, 0, 0.38)), Vector((0.05, 0, 0.005)), 0.026, r_eye=0.009, nose=(0.015, Vector((0.25, 0, 0.36))))
    return g


def cow(name, loc, rot, coat, grazing=True):
    J = {
        'hip': ((-0.65, 0, 1.15), (0.3, 0.28)), 'belly': ((-0.15, 0, 1.08), (0.4, 0.36)), 'chest': ((0.4, 0, 1.12), (0.34, 0.3)),
        'neck': ((0.75, 0, 1.15 if not grazing else 0.95), 0.2), 'head': ((1.0, 0, 1.25 if not grazing else 0.45), (0.13, 0.11)),
        'muzzle': ((1.12, 0, 1.1 if not grazing else 0.18), 0.09), 'tail0': ((-0.9, 0, 1.25), 0.05), 'tail1': ((-0.95, 0, 0.6), 0.03),
    }
    E = [('hip', 'belly'), ('belly', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'muzzle'), ('hip', 'tail0'), ('tail0', 'tail1')]
    for s, tag in ((1, 'l'), (-1, 'r')):
        J.update({f'f0{tag}': ((0.4, s * 0.18, 0.9), 0.12), f'f1{tag}': ((0.42, s * 0.18, 0.45), 0.07), f'f2{tag}': ((0.42, s * 0.18, 0.04), 0.055),
                  f'h0{tag}': ((-0.62, s * 0.2, 0.9), 0.16), f'h1{tag}': ((-0.55, s * 0.2, 0.5), 0.08), f'h2{tag}': ((-0.62, s * 0.2, 0.04), 0.055)})
        E += [('chest', f'f0{tag}'), (f'f0{tag}', f'f1{tag}'), (f'f1{tag}', f'f2{tag}'), ('hip', f'h0{tag}'), (f'h0{tag}', f'h1{tag}'), (f'h1{tag}', f'h2{tag}')]
    body = skin_body(name, J, E, sub=1)
    body.data.materials.append(coat)
    g = empty(name + ' (cow)', loc, rot); body.parent = g
    return g


def cow_coat(name, base, patch):
    m = M.plain(name, base, rough=0.75, sheen=0.4)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 2.2; n.inputs['Detail'].default_value = 3
    nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'
    r.color_ramp.elements[0].color = (*base, 1); r.color_ramp.elements[1].position = 0.55; r.color_ramp.elements[1].color = (*patch, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    return m


def animals():
    standing_dog((-2.25, 3.95, 0), math.radians(-110))
    lying_dog((-2.05, 3.45, 0), math.radians(-55))
    terrier((-1.75, 3.1, 0), math.radians(-100))
    coats = [cow_coat('Brown and white coat', (0.32, 0.16, 0.07), (0.82, 0.78, 0.72)),
             cow_coat('Black and white coat', (0.03, 0.03, 0.03), (0.85, 0.82, 0.78)),
             cow_coat('Red coat', (0.36, 0.13, 0.05), (0.42, 0.18, 0.08))]
    for i, (x, y, r, gz) in enumerate(((-10, 64, 30, True), (-5, 67, -60, True), (-2, 63, 120, False), (-8, 70, 200, True))):
        cow(f'Cow {i}', (x, y, _height(x, y)), math.radians(r), coats[i % 3], grazing=gz)
