"""
Render where the monitor's screen is visible in the 360 view (the chair hides part of it), as a
mask in panorama space, and print the uv rectangle it covers for js/pano-view.js (MONITOR_MASK).
    python blender/render_monitor_mask.py assets/workshop-3d/monitor-mask.png [pano width]
"""
import math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[1]); width = int(sys.argv[2]) if len(sys.argv) > 2 else 8192
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
s = bpy.context.scene; cam = bpy.data.objects['PanoCam']; s.camera = cam
eye = cam.matrix_world.translation
scr = bpy.data.objects['Screen']
# uv of each screen corner (Blender: +Y ahead, +X right, +Z up)
def uv(p):
    d = (p - eye).normalized()
    return 0.5 + math.atan2(d.x, d.y) / (2 * math.pi), 0.5 + math.asin(d.z) / math.pi
pts = [uv(scr.matrix_world @ Vector(c)) for c in scr.bound_box]
m = 0.004
u0, u1 = min(p[0] for p in pts) - m, max(p[0] for p in pts) + m
v0, v1 = min(p[1] for p in pts) - m, max(p[1] for p in pts) + m
# render only that patch: narrow the panorama camera to it (same mapping, same pixel density)
c = cam.data
c.longitude_min, c.longitude_max = (u0 - 0.5) * 2 * math.pi, (u1 - 0.5) * 2 * math.pi
c.latitude_min, c.latitude_max = (v0 - 0.5) * math.pi, (v1 - 0.5) * math.pi
s.render.resolution_x = round((u1 - u0) * width); s.render.resolution_y = round((v1 - v0) * width / 2)
s.render.resolution_percentage = 100
s.render.film_transparent = True
scr.is_holdout = True            # the screen punches a hole: alpha 0 wherever it is visible
s.cycles.samples = 16; s.cycles.use_denoising = False
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
tmp = out + '.rgba.png'; s.render.filepath = tmp
bpy.ops.render.render(write_still=True)
img = bpy.data.images.load(tmp)
w, h = img.size; px = list(img.pixels)
mask = bpy.data.images.new('mask', w, h, alpha=False)
mp = [0.0] * (w * h * 4)
for i in range(w * h):
    a = 1.0 - px[i * 4 + 3]
    mp[i * 4:i * 4 + 4] = (a, a, a, 1.0)
mask.pixels = mp; mask.filepath_raw = out; mask.file_format = 'PNG'; mask.save()
os.remove(tmp)
print(f'MASK {w}x{h} rect [{u0:.6f}, {v0:.6f}, {u1:.6f}, {v1:.6f}] -> {out}')
