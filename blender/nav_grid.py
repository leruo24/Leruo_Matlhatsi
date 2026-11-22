"""
Where the dogs can walk: a 10 cm grid over the workshop floor and the yard in front of it.
    python blender/nav_grid.py assets/workshop-3d/nav.json
For each cell a ray goes straight down from 2.2 m (under the door heads). The cell is free if the
ray lands on the floor or ground within 0.3 m of floor level, and blocked if it hits furniture,
a wall top or the inside of a solid (a downward-facing face). The dogs, grass and leaf cards are
ignored. Output: {x0, y0, cell, w, h, data}, data = base64 bytes, one per cell, row by row from
y0 (Blender's +Y, away from the desk side) : ground height in cm above the workshop floor + 100,
or 255 if blocked.
"""
import base64, json, math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[1])
X0, X1, Y0, Y1, CELL = -5.2, 9.0, -3.6, 11.0, 0.1
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
s = bpy.context.scene

def hide(o):
    o.hide_viewport = True
    for c in o.children: hide(c)
for n in ('Golden dog (standing)', 'Golden retriever (lying)', 'Terrier (sitting)'): hide(bpy.data.objects[n])
for o in s.objects:
    if o.type == 'CURVES' or any(sl.material and sl.material.name.startswith('Leaves') for sl in o.material_slots):
        o.hide_viewport = True
dg = bpy.context.evaluated_depsgraph_get()
w, h = int(round((X1 - X0) / CELL)), int(round((Y1 - Y0) / CELL))
data = bytearray(w * h)
free = 0
for j in range(h):
    y = Y0 + (j + 0.5) * CELL
    for i in range(w):
        x = X0 + (i + 0.5) * CELL
        hit, loc, nrm, *_ = s.ray_cast(dg, Vector((x, y, 2.2)), Vector((0, 0, -1)), distance=5.0)
        ok = hit and nrm.z > 0.7 and -0.6 < loc.z < 0.3
        data[j * w + i] = int(round(loc.z * 100)) + 100 if ok else 255
        free += ok
json.dump(dict(x0=X0, y0=Y0, cell=CELL, w=w, h=h, data=base64.b64encode(bytes(data)).decode()), open(out, 'w'))
print(f'NAV {w}x{h} free {free}/{w * h} -> {out}')
