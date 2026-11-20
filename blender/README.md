# Workshop scene in Blender (work in progress)

One Blender scene for the whole workshop, so every view (a camera matched to the approved photo, and the 360° panorama from the same eye) comes from the same geometry, materials and light. Not yet used by the site.

Build and render with Blender's Python module (`pip install bpy==5.3.0`, Python 3.13):

    python blender/build_scene.py                         # writes blender/workshop.blend
    python blender/render.py front out.png 1200 48        # photo-matched view
    python blender/render.py pano  out.png 4096 64 [0/4]  # 360° equirectangular, optional tiles

## Files
- `build_scene.py`: scene setup, the two cameras, and the sun and sky. The sun is from the photo's sun position.
- `materials.py`: procedural Cycles materials (concrete, straight-grain timber, gravel, water, distance haze). The ground uses photo textures from `assets.py`.
- `props.py`: the building, desk setup, ESP32 bench, whiteboard wall, terrain, pond and mountains.
- `nature.py`: procedural trees with leaf cards, fences, the garage, barn and tank, the farmhouse, and the distant skyline.
- `vehicles.py`: the Land Cruiser 79 double cab, the orange sports car and the Mustang. They're modelled from real dimensions, with no badges or number plates.
- `assets.py`: the free third-party assets: Poly Haven props placed around the room, photo leaf and bark materials for the trees, textured grass and gravel, and grass blades (hair curves) near the workshop.
- `animals.py`: the three dogs (Skin-modifier bodies with hair-curve fur in their coat colours) and the cows.

## Assets and licences
Supplied or made here:
- `refs/uct_logo.png` and `refs/jeppe_crest.png`: the cap emblems Leruo supplied.
- `refs/leaf.png`: drawn by code in this project. No longer used by the trees; kept for reference.

Poly Haven models, CC0 (public domain). Taken from the `ezEngine/store-sample` GitHub mirror (commit ee6100b) because polyhaven.com is blocked from the build machine. I converted each one to GLB with glTF-Transform (`copy`, textures resized to 1024 px or less, `simplify` at ratio 0.5, `prune`). The models are in metres.
- `assets/models/`: `desk_lamp_arm_01`, `potted_plant_01`, `potted_plant_02`, `barrel_03`, `wooden_bucket_01`, `wooden_crate_02`, `crowbar_01`, `modern_wooden_cabinet`, `plastic_monobloc_chair_01`, `can_rusted` and `steel_frame_shelves_03`.
- `../assets/models/`: the site's existing copies (`steel_frame_shelves_01`, `wooden_crate_01`, `wooden_stool_01`, `cardboard_box_01`, `jug_01` and `lantern_01`) are reused here.
- Change: the desk lamp is recoloured to matte black, to match the photo. The texture detail is kept.
- The mirror's potted-plant leaf textures have lost their alpha channel. The leaves are leaf-shaped geometry, so a test render showed no visible effect.

Textures, from the npm package `@dgreenheck/ez-tree` 1.1.0. MIT licence, copyright 2024 Daniel Greenheck; the full text is in `assets/textures/EZ-TREE-LICENSE.txt`.
- `assets/textures/eztree_oak_leaf.png` and `eztree_ash_leaf.png`: photo twig cards, used for the shade tree (oak) and the farm trees (ash).
- `assets/textures/eztree_grass.jpg`, `eztree_dirt_color.jpg` and `eztree_dirt_normal.jpg`: ground textures. The grass is sampled at two scales and blended with noise so the tile doesn't visibly repeat, and it fades to a flat colour in the distance. The dirt is mixed into the gravel and appears as bare patches in the grass.
- `assets/textures/bark_brown_02_*_1k.jpg`: the package's README credits this bark to Poly Haven (`bark_brown_02`, CC0). It is box-projected onto the trunks.
- The package doesn't name a source for the leaf, grass and dirt images, so I've treated them as covered by its MIT licence.

Not used:
- The Ferrari model in the three.js repository: I couldn't verify its licence.
- The Metal_Water_Tank model in the same mirror: its readme gives no licence.
- No free, licence-verified realistic models of dogs, cows or cars were reachable. Sketchfab, Poly Haven's site, Blender Studio and Hugging Face are all blocked here, and the CGTrader results were paid. Those stay procedural.

## Layout notes
The approved photo isn't physically consistent. The desk only reads as 0.76 m high if the camera is about 1.6 m up, the dogs and the console come out oversized, and the gravel yard sits above the horizon line. So this scene keeps the photo's arrangement and camera angle but uses real-world sizes, with a yard that rises gently.

## Status
Second pass (20 November 2026):
- Poly Haven props at the desk (lamp, plant) and in the rear of the room (cabinet, shelving with crates, boxes, cans, a jug and a lantern, a barrel, a bucket, a stool and a crowbar), plus a plastic chair under the shade tree.
- A window in the back wall.
- Photo leaf cards and bark on the trees.
- Textured grass and grass blades. The ground no longer reads as grey sand.
- Warmer gravel and a brighter sky and sun.
- The land stays low around the pond, so the water shows to the right of the desk.
- Three farm trees moved, so their low-sun shadows don't fall on the yard.
- The sun lamp is at 16° while the visible sun is at 9.7°. At the true angle, every tree and the garage would put the yard (sunlit in the photo) in shade.

Still not good enough:
- The dogs read as plush toys.
- The Land Cruiser and the other cars are simple models.
- The garage and house are small in the view.
- The left and back walls are still fairly plain.
- The sky is paler than the photo's sunset.

First pass (20 November 2026):
Done:
- the building, furniture, desk items, bench, wall items, sun, sky and clouds
- the terrain, pond, mountains, trees and buildings
- the vehicles, dogs and cows

At the time, the dogs read as plush, the ground and grass were flat, the Land Cruiser was a box model, the back half of the room was empty and the exterior was dull.
