"""
The three screens the 360 page draws live (monitor, laptop, old tablet): their corners as seen
from the eye, and for each a visibility mask in panorama space (where nothing in front hides it).
    python blender/export_screens.py assets/workshop-3d [pano width]
Writes screens.json and mask-<name>.png. Corners are in three.js coordinates relative to the eye
(x right, y up, -z ahead), ordered top-left, top-right, bottom-right, bottom-left.
"""
import json, math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1]); width = int(sys.argv[2]) if len(sys.argv) > 2 else 8192
SCREENS = {'monitor': 'Screen', 'laptop': 'Laptop screen', 'tablet': 'Tablet screen'}
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
s = bpy.context.scene; cam = bpy.data.objects['PanoCam']; s.camera = cam
eye = cam.matrix_world.translation.copy()
for o in s.objects:     # the dogs and cows are drawn live, so they don't hide the screens
    if o.name.endswith('(cow)') or o.name in ('Golden dog (standing)', 'Golden retriever (lying)', 'Terrier (sitting)'):
        stack = [o]
        while stack:
            q = stack.pop(); q.hide_render = True; stack += list(q.children)
to3 = lambda p: [round(p.x - eye.x, 4), round(p.z - eye.z, 4), round(-(p.y - eye.y), 4)]
def uv(p):
    d = (p - eye).normalized()
    return 0.5 + math.atan2(d.x, d.y) / (2 * math.pi), 0.5 + math.asin(d.z) / math.pi
out = {}
s.render.film_transparent = True; s.cycles.samples = 16; s.cycles.use_denoising = False
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
c = cam.data
for key, name in SCREENS.items():
    o = bpy.data.objects[name]; W = o.matrix_world; me = o.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    yf = min((min(ys), max(ys)), key=lambda y: (W @ Vector((0, y, 0)) - eye).length)
    quad = [W @ Vector((min(xs), yf, max(zs))), W @ Vector((max(xs), yf, max(zs))), W @ Vector((max(xs), yf, min(zs))), W @ Vector((min(xs), yf, min(zs)))]
    pts = [uv(W @ Vector(b)) for b in o.bound_box]
    m = 0.003
    u0, u1 = min(p[0] for p in pts) - m, max(p[0] for p in pts) + m
    v0, v1 = min(p[1] for p in pts) - m, max(p[1] for p in pts) + m
    c.longitude_min, c.longitude_max = (u0 - 0.5) * 2 * math.pi, (u1 - 0.5) * 2 * math.pi
    c.latitude_min, c.latitude_max = (v0 - 0.5) * math.pi, (v1 - 0.5) * math.pi
    s.render.resolution_x = max(8, round((u1 - u0) * width)); s.render.resolution_y = max(8, round((v1 - v0) * width / 2)); s.render.resolution_percentage = 100
    for q in s.objects: q.is_holdout = False
    o.is_holdout = True            # the screen punches a hole: alpha 0 wherever it is visible
    tmp = os.path.join(OUT, f'_mask_{key}.png'); s.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp); w, h = img.size; px = list(img.pixels)
    mask = bpy.data.images.new('mask', w, h, alpha=False)
    mp = [0.0] * (w * h * 4)
    for i in range(w * h):
        a = 1.0 - px[i * 4 + 3]; mp[i * 4:i * 4 + 4] = (a, a, a, 1.0)
    mask.pixels = mp; mask.filepath_raw = os.path.join(OUT, f'mask-{key}.png'); mask.file_format = 'PNG'; mask.save()
    os.remove(tmp)
    out[key] = dict(quad=[to3(p) for p in quad], mask=f'mask-{key}.png', rect=[round(u0, 6), round(v0, 6), round(u1, 6), round(v1, 6)])
    print(f'SCREEN {key} {w}x{h}', flush=True)
json.dump(out, open(os.path.join(OUT, 'screens.json'), 'w'), indent=1)
