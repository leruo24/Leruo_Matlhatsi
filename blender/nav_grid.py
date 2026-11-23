"""
Where the dogs can walk: a 10 cm grid over the workshop floor and the yard in front of it.
    python blender/nav_grid.py assets/workshop-3d/nav.json
For each cell a ray goes straight down from 2.2 m (under the door heads). The cell is free if the
ray lands on the floor within 0.3 m of floor level (indoors) or on open ground (outside, up to
1.5 m: the yard rises), and blocked if it hits furniture,
a wall top or the inside of a solid (a downward-facing face). The dogs, grass and leaf cards are
ignored. Output: {x0, y0, cell, w, h, data}, data = base64 bytes, one per cell, row by row from
y0 (Blender's +Y, away from the desk side) : ground height in cm above the workshop floor + 100,
or 255 if blocked.
Also writes pen.json next to it: the ground height (m) on a 1 m grid over the cow pen.
"""
import base64, json, math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[1])
X0, X1, Y0, Y1, CELL = -11.0, 9.0, -3.6, 17.0, 0.1
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
        indoors = -5.0 < x < 4.2 and -3.4 < y < 4.5
        roofed = -5.5 < x < 4.7 and -3.9 < y < 5.9     # under the roof overhang and door heads
        hit, loc, nrm, _, obj, _ = s.ray_cast(dg, Vector((x, y, 2.2 if roofed else 4.0)), Vector((0, 0, -1)), distance=6.0)
        if indoors: ok = hit and nrm.z > 0.7 and -0.6 < loc.z < 0.3
        # outside, the yard rises toward the garage: any open ground (not the truck, coop, trees...)
        else: ok = hit and nrm.z > 0.7 and obj.name in ('Ground', 'Straw patch', 'Floor slab', 'Concrete apron', 'Door threshold') and -0.6 < loc.z < 1.5
        if -2.95 < x < 4.3 and 4.38 < y < 4.62: ok = False     # the glass front wall (panes too thin for the grid)
        data[j * w + i] = int(round(loc.z * 100)) + 100 if ok else 255
        free += ok
json.dump(dict(x0=X0, y0=Y0, cell=CELL, w=w, h=h, data=base64.b64encode(bytes(data)).decode()), open(out, 'w'))
print(f'NAV {w}x{h} free {free}/{w * h} -> {out}')

# the cow pen (fence at x -14..2, y 60..74): ground heights for the grazing cows
sys.path.insert(0, HERE)
from props import _height
px0, px1, py0, py1 = -14, 2, 60, 74
pen = dict(x0=px0, y0=py0, cell=1, w=px1 - px0 + 1, h=py1 - py0 + 1,
           heights=[[round(_height(px0 + i, py0 + j), 3) for i in range(px1 - px0 + 1)] for j in range(py1 - py0 + 1)])
json.dump(pen, open(os.path.join(os.path.dirname(out), 'pen.json'), 'w'))
