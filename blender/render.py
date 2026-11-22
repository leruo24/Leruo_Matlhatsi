"""
Render a view of blender/workshop.blend.
    python blender/render.py front  out.png [width] [samples]
    python blender/render.py pano   out.png [width] [samples] [tile i/n]
'front' uses the camera matched to the approved photo; 'pano' is the 360-degree view from the
same eye. With NODOGS=1 in the environment the three dogs are left out: the 360 page draws them
live, walking. Long renders can be split into horizontal strips ("tile 0/4", top first), each rendered
as a narrow band of latitude, and stitched with make_pano_assets.py.
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
DOG_ROOTS = ('Golden dog (standing)', 'Golden retriever (lying)', 'Terrier (sitting)')
if os.environ.get('NODOGS') == '1':
    def hide(o):
        o.hide_render = True
        for c in o.children: hide(c)
    for n in DOG_ROOTS: hide(bpy.data.objects[n])
s.render.resolution_x = width
s.render.resolution_y = round(width * 942 / 1670) if view == 'front' else width // 2
s.render.resolution_percentage = 100
s.cycles.samples = samples
s.cycles.use_adaptive_sampling = True
s.cycles.tile_size = 1024   # smaller tiles keep peak memory down on the 7 GB build machine
s.cycles.max_bounces = 6; s.cycles.diffuse_bounces = 3; s.cycles.glossy_bounces = 3; s.cycles.transmission_bounces = 6
s.render.film_transparent = False
s.render.image_settings.file_format = 'PNG'
if tile:
    # each strip is its own render: the camera's latitude range is narrowed to the strip, so memory
    # scales with the strip (a full 8192-wide frame with a render border ran out of memory)
    import math
    i, n = map(int, tile.split('/'))
    cam = s.camera.data
    top = math.pi / 2 - math.pi * i / n
    cam.latitude_max, cam.latitude_min = top, top - math.pi / n
    cam.longitude_min, cam.longitude_max = -math.pi, math.pi
    s.render.resolution_y = (width // 2) // n
s.render.filepath = out
t = time.time()
bpy.ops.render.render(write_still=True)
print(f'RENDERED {view} {s.render.resolution_x}x{s.render.resolution_y} {samples}spp in {time.time() - t:.1f}s -> {out}')
