"""
Distance from the eye for every pixel of the 360 view, so the page can put live things (walking
dogs, the drone, the monitor) behind the furniture, walls and trees in the render.
    python blender/render_depth.py assets/workshop-3d/depth.png [width] [top latitude deg]
Rendered by Cycles from the panorama eye with the same mapping as the 360 render, every surface
replaced by an emission shader that writes its distance. The dogs are left out (the page draws
them live), and so are the trees' leaf cards and the grass blades: they're cut-outs, mostly
holes. Output: an RGB PNG covering latitude -90 deg to `top`, distance d (m) stored as
t = log(d / 0.2) / log(30000 / 0.2) in 16 bits: red = high byte, green = low byte. 1.0 is sky.
"""
import math, os, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[1]); W = int(sys.argv[2]) if len(sys.argv) > 2 else 4096
top = math.radians(float(sys.argv[3]) if len(sys.argv) > 3 else 40.0)
NEAR, FAR = 0.2, 30000.0
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
s = bpy.context.scene
s.camera = bpy.data.objects['PanoCam']

def hide(o):
    o.hide_render = True
    for c in o.children: hide(c)
for n in ('Golden dog (standing)', 'Golden retriever (lying)', 'Terrier (sitting)'): hide(bpy.data.objects[n])
for o in s.objects:
    if o.type == 'CURVES' or any(sl.material and sl.material.name.startswith('Leaves') for sl in o.material_slots):
        o.hide_render = True
for o in s.objects:            # lamps would add light to the emission values
    if o.type == 'LIGHT': o.hide_render = True

# distance -> two bytes, as an emission colour
m = bpy.data.materials.new('Depth'); m.use_nodes = True
nt = m.node_tree; nt.nodes.clear()
outn = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
lp = nt.nodes.new('ShaderNodeLightPath')
def math_node(op, a, b=None):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]
t = math_node('DIVIDE', math_node('LOGARITHM', math_node('MAXIMUM', math_node('DIVIDE', lp.outputs['Ray Length'], NEAR), 1.0), math.e), math.log(FAR / NEAR))
q = math_node('MINIMUM', math_node('MULTIPLY', t, 65535.0), 65535.0)
hi = math_node('DIVIDE', math_node('FLOOR', math_node('DIVIDE', q, 256.0)), 255.0)
lo = math_node('DIVIDE', math_node('FLOOR', math_node('MODULO', q, 256.0)), 255.0)
def srgb_to_linear(v):
    # the Standard view applies the sRGB curve on output; emit its inverse so the bytes come out exact
    low = math_node('DIVIDE', v, 12.92)
    high = math_node('POWER', math_node('DIVIDE', math_node('ADD', v, 0.055), 1.055), 2.4)
    k = math_node('LESS_THAN', v, 0.04045)
    return math_node('ADD', math_node('MULTIPLY', low, k), math_node('MULTIPLY', high, math_node('SUBTRACT', 1.0, k)))
comb = nt.nodes.new('ShaderNodeCombineColor')
nt.links.new(srgb_to_linear(hi), comb.inputs[0]); nt.links.new(srgb_to_linear(lo), comb.inputs[1])
nt.links.new(comb.outputs[0], em.inputs['Color']); em.inputs['Strength'].default_value = 1.0
nt.links.new(em.outputs[0], outn.inputs['Surface'])
s.view_layers[0].material_override = m
w = bpy.data.worlds.new('Depth sky'); s.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 0, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0

c = s.camera.data
c.latitude_min, c.latitude_max = -math.pi / 2, top
c.longitude_min, c.longitude_max = -math.pi, math.pi
s.render.resolution_x = W; s.render.resolution_y = int(round((top + math.pi / 2) / math.pi * W / 2)); s.render.resolution_percentage = 100
s.cycles.samples = 1; s.cycles.use_denoising = False; s.cycles.use_adaptive_sampling = False
s.cycles.filter_width = 0.01; s.render.dither_intensity = 0.0
s.cycles.max_bounces = 0
s.view_settings.view_transform = 'Standard'
s.view_settings.look = 'None'; s.view_settings.exposure = 0; s.view_settings.gamma = 1
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGB'; s.render.image_settings.color_depth = '8'
s.render.film_transparent = False
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print(f'DEPTH {W}x{s.render.resolution_y} lat -90..{math.degrees(top):.1f} -> {out}')
