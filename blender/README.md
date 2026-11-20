# Workshop scene in Blender (work in progress)

One Blender scene for the whole workshop, so every view (a camera matched to the approved photo, and the 360° panorama from the same eye) comes from the same geometry, materials and light. Not yet used by the site.

Build and render with Blender's Python module (`pip install bpy==5.3.0`, Python 3.13):

    python blender/build_scene.py                         # writes blender/workshop.blend
    python blender/render.py front out.png 1200 48        # photo-matched view
    python blender/render.py pano  out.png 4096 64 [0/4]  # 360° equirectangular, optional tiles

## Files
- `build_scene.py`: scene setup, the two cameras, and the sun and sky. The sun is from the photo's sun position.
- `materials.py`: procedural Cycles materials (concrete, straight-grain timber, gravel, grass, water, distance haze). There are no photo textures.
- `props.py`: the building, desk setup, ESP32 bench, whiteboard wall, terrain, pond and mountains.
- `nature.py`: procedural trees with leaf cards, fences, the garage, barn and tank, the farmhouse, and the distant skyline.
- `vehicles.py`: the Land Cruiser 79 double cab, the orange sports car and the Mustang. They're modelled from real dimensions, with no badges or number plates.
- `animals.py`: the three dogs (Skin-modifier bodies with hair-curve fur in their coat colours) and the cows.

## Assets and licences
- `refs/uct_logo.png` and `refs/jeppe_crest.png`: the cap emblems Leruo supplied.
- `refs/leaf.png`: drawn by code in this project (three leaflets on a transparent card).
- `../assets/models/steel_frame_shelves_01.glb`: Poly Haven, CC0.
- Everything else is modelled procedurally in these scripts.
- I didn't use the Ferrari model in the three.js repository, because I couldn't verify its licence.

## Layout notes
The approved photo isn't physically consistent. The desk only reads as 0.76 m high if the camera is about 1.6 m up, the dogs and the console come out oversized, and the gravel yard sits above the horizon line. So this scene keeps the photo's arrangement and camera angle but uses real-world sizes, with a yard that rises gently.

## Status (first pass, 20 November 2026)
Done:
- the building, furniture, desk items, bench, wall items, sun, sky and clouds
- the terrain, pond, mountains, trees and buildings
- the vehicles, dogs and cows

Not yet good enough:
- The dogs read as plush toys.
- The ground and grass are flat.
- The Land Cruiser is a box model.
- The garage and house are only just visible.
- The back half of the room is empty.
- The exterior lighting is duller than the photo's.
