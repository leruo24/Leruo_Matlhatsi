"""
Export blender/workshop.blend as a compressed glTF model for the walk and superhero views:
    python export_web.py ../assets/world/farm.glb

What it does to a copy of the scene (the .blend itself is not saved):
  * leaves out the dogs, the cows, the hair curves (grass blades, fur), hidden helpers, lights and cameras
    (the page draws its own light, and the 360 view keeps the live animals);
  * thins heavy meshes with a Decimate modifier: detailed in and around the office, lighter out on the farm,
    very light for the far city;
  * turns procedural colours (noise-mixed wood, soil, etc.) into a single representative colour, which glTF
    can carry;
  * shrinks images to at most 1024 px and writes them as WebP;
  * (geometry compression and merging happen afterwards in glTF-Transform; see blender/README.md).
"""
import os, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(HERE, '..', 'assets', 'world', 'farm.glb'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
scene = bpy.context.scene

DOG_ROOTS = ('Golden dog (standing)', 'Golden retriever (lying)', 'Terrier (sitting)')
drop = set()
def tree(o):
    drop.add(o)
    for c in o.children: tree(c)
for n in DOG_ROOTS:
    if n in bpy.data.objects: tree(bpy.data.objects[n])
for o in bpy.data.objects:
    if o.name.endswith('(cow)') or o.type in ('CURVES', 'LIGHT', 'CAMERA') or o.hide_render:
        tree(o)
# cut the window openings for real first: the cutters are hidden helpers, and removing them would leave the
# walls solid (and the car bodies without their window holes)
dg0 = bpy.context.evaluated_depsgraph_get()
for o in list(bpy.data.objects):
    if o.type == 'MESH' and any(m.type == 'BOOLEAN' for m in o.modifiers) and o not in drop:
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(dg0), preserve_all_data_layers=True, depsgraph=dg0)
        o.modifiers.clear(); o.data = mesh
for o in drop:
    bpy.data.objects.remove(o, do_unlink=True)

# roofs of the office and garage get their own material copies (suffix [roof]) so the page can lift them
# off in the superhero view and you can look inside
ROOFS = ('Roof sheet', 'Roof', 'Ceiling boards')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name in ROOFS:
        for slot in o.material_slots:
            if slot.material and not slot.material.name.endswith('[roof]'):
                slot.material = slot.material.copy(); slot.material.name = slot.material.name.rstrip('.0123456789') + ' [roof]'
                for n in slot.material.node_tree.nodes:   # a hair different, so glTF-Transform does not merge it back
                    if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Roughness'].is_linked:
                        n.inputs['Roughness'].default_value = min(1.0, n.inputs['Roughness'].default_value + 0.0137)

# instanced pieces (the windpump tower's braces and legs) become real objects
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.instance_type != 'NONE' and o.instance_collection:
        o.select_set(True)
if bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.object.duplicates_make_real()

# decimate by distance from the office (the 360 camera stands at the origin)
dg = bpy.context.evaluated_depsgraph_get()
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        continue
    e = o.evaluated_get(dg); m = e.to_mesh(); faces = len(m.polygons); e.to_mesh_clear()
    d = o.matrix_world.translation.xy.length
    cap = 6000 if d < 30 else 2500 if d < 1000 else 300
    if o.name in ('Near range', 'Far range', 'Ground'):
        continue   # big smooth surfaces: decimating them tears the field edges and lifts the ground through floors
    if faces > cap:
        mod = o.modifiers.new('web', 'DECIMATE'); mod.ratio = max(0.02, cap / faces)

# keep the terrain under the office and its apron below floor level (it peeks through the slab otherwise)
g = bpy.data.objects.get('Ground')
if g:
    inv = g.matrix_world.inverted(); mw = g.matrix_world
    for v in g.data.vertices:
        w = mw @ v.co
        if -6.0 < w.x < 5.5 and -4.5 < w.y < 6.0 and w.z > -0.06:
            w.z = -0.06; v.co = inv @ w

# colours for surfaces whose look comes from procedural shading (averaging their nodes gives grey)
OVERRIDE = {
    'Crop maize': (0.07, 0.17, 0.035), 'Crop rows': (0.09, 0.19, 0.04), 'Crop wheat': (0.42, 0.30, 0.10),
    'Crop ploughed': (0.12, 0.075, 0.045), 'Mountains v2': (0.11, 0.11, 0.075), 'Pond water': (0.015, 0.035, 0.035),
}

# procedural colours -> one colour
def colour_of(sock, depth=0):
    if not sock.is_linked:
        v = sock.default_value
        return tuple(v[:3]) if hasattr(v, '__len__') and len(v) >= 3 else None
    if depth > 6:
        return None
    n = sock.links[0].from_node
    if n.type == 'TEX_IMAGE':
        return 'image'
    if n.type == 'RGB':
        return tuple(n.outputs[0].default_value[:3])
    if n.type == 'VALTORGB':
        els = n.color_ramp.elements
        return tuple(sum(e.color[i] for e in els) / len(els) for i in range(3))
    picks = []
    for inp in n.inputs:
        if inp.type in ('RGBA', 'VECTOR') and inp.name not in ('Vector', 'Normal'):
            c = colour_of(inp, depth + 1)
            if c == 'image':
                return 'image'
            if c is not None and len(c) == 3:
                picks.append(c)
    if picks:
        return tuple(sum(p[i] for p in picks) / len(picks) for i in range(3))
    return None

for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    for bsdf in [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']:
        base = bsdf.inputs['Base Color']
        if mat.name in OVERRIDE:
            if base.is_linked: mat.node_tree.links.remove(base.links[0])
            base.default_value = (*OVERRIDE[mat.name], 1.0)
        if base.is_linked:
            c = colour_of(base)
            if c not in (None, 'image'):
                mat.node_tree.links.remove(base.links[0])
                base.default_value = (*c, 1.0)
        for name in ('Roughness', 'Metallic', 'Normal'):
            s = bsdf.inputs.get(name)
            if s is not None and s.is_linked and s.links[0].from_node.type != 'TEX_IMAGE' and s.links[0].from_node.type != 'NORMAL_MAP':
                mat.node_tree.links.remove(s.links[0])

# smaller images
for img in bpy.data.images:
    if img.size[0] > 1024 or img.size[1] > 1024:
        k = 1024 / max(img.size[0], img.size[1])
        img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))

os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', export_apply=True, export_yup=True,
    export_image_format='WEBP', export_image_quality=80,
    export_lights=False, export_cameras=False, export_animations=False, export_extras=False,
    export_tangents=False, export_attributes=False,
)
print('wrote', out, round(os.path.getsize(out) / 1e6, 2), 'MB')
