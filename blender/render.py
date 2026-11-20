"""
Render a view of blender/workshop.blend.
    python blender/render.py front  out.png [width] [samples]
    python blender/render.py pano   out.png [width] [samples] [tile i/n]
'front' uses the camera matched to the approved photo; 'pano' is the 360-degree view from the
same eye. Long renders can be split into horizontal tiles ("tile 0/4") and stitched afterwards.
"""
import os, sys, time
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
view, out = sys.argv[1], os.path.abspath(sys.argv[2])
width = int(sys.argv[3]) if len(sys.argv) > 3 else 835
samples = int(sys.argv[4]) if len(sys.argv) > 4 else 64
tile = sys.argv[5] if len(sys.argv) > 5 else None

bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
s = bpy.context.scene
s.camera = bpy.data.objects['PhotoCam' if view == 'front' else 'PanoCam']
s.render.resolution_x = width
s.render.resolution_y = round(width * 942 / 1670) if view == 'front' else width // 2
s.render.resolution_percentage = 100
s.cycles.samples = samples
s.cycles.use_adaptive_sampling = True
s.cycles.max_bounces = 6; s.cycles.diffuse_bounces = 3; s.cycles.glossy_bounces = 3; s.cycles.transmission_bounces = 6
s.render.film_transparent = False
s.render.image_settings.file_format = 'PNG'
if tile:
    i, n = map(int, tile.split('/'))
    s.render.use_border = True; s.render.use_crop_to_border = False
    s.render.border_min_x, s.render.border_max_x = 0, 1
    s.render.border_min_y, s.render.border_max_y = 1 - (i + 1) / n, 1 - i / n
s.render.filepath = out
t = time.time()
bpy.ops.render.render(write_still=True)
print(f'RENDERED {view} {s.render.resolution_x}x{s.render.resolution_y} {samples}spp in {time.time() - t:.1f}s -> {out}')
