# Workshop scene in Blender (work in progress)

One Blender scene for the whole workshop, so every view (a camera matched to the approved photo, and the 360° panorama from the same eye) comes from the same geometry, materials and light. Not yet used by the site.

Build and render with Blender's Python module (`pip install bpy==5.3.0`, Python 3.13):

    python blender/build_scene.py                         # writes blender/workshop.blend
    python blender/render.py front out.png 1200 48        # photo-matched view
    python blender/render.py pano  out.png 4096 64 [0/4]  # 360° equirectangular, optional tiles

## Files
- `build_scene.py`: scene setup, the two cameras, and the sun and sky. The sun is from the photo's sun position.
- `materials.py`: procedural Cycles materials (concrete, straight-grain timber, gravel, water, distance haze). The ground uses photo textures from `assets.py`.
- `props.py`: the building (with `picture_window()`), desk setup, ESP32 bench, whiteboard wall, terrain and pond.
- `nature.py`: procedural trees with leaf cards, fences, the garage, barn and tank, and the farmhouse (the old skyline function is no longer called).
- `vehicles.py`: the Land Cruiser 79 double cab (separate body panels with 4 mm shut lines, a hollow cab with real glass and seats, black flares, steel bumper, round headlamps, chassis, axles, springs, mud-terrain tyres with tread blocks and multi-spoke wheels), plus the orange mid-engined car and the dark fastback in the garage. All are built from published dimensions, with no badges or number plates.
- `assets.py`: the free third-party assets: Poly Haven props placed around the room, photo leaf and bark materials for the trees, textured grass and gravel, and grass blades (hair curves) near the workshop.
- `animals.py`: the three dogs (Skin-modifier bodies with hair-curve fur in their coat colours) and the cows.
- `farm_office.py` (pass 6): the modern farm office (pendants, rug, framed photos, books, window seat, floor lamp, corner plant), the ESP32 kit on the bench, the farm (crop fields, windpump and dam, silos, implement shed, chicken coop, tractors), the mountain ranges and the city.
- `timeofday.py`: the four lighting presets (sunrise, day, sunset, night). `render.py` applies one when `TIME=<name>` is set. Interior lights and glowing materials named `Int ...` are switched per preset.
- `gen_textures.py` (system Python + Pillow): the bench's printed label card, OLED readout and DevKit pinout card, in `assets/gen/`. They are plain text and shapes, with no logos.
- `chicken_sprites.py`: the hens as sprite frames (8 headings × a walk with a head bob, plus a pecking loop).

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
Sixth pass (23 November 2026): a modern farm office, the farm around it, and four times of day.
- **Room.** It now has white painted board walls, a limed ceiling and oak beams. Big black-framed picture windows are cut into the back and left walls (`picture_window()` in `props.py`). There are pendants, a jute rug, framed photos of Leruo (his own, from `../assets/`), books, a window seat and a floor lamp. The barrel, bucket, crowbar, rusty cans and cardboard boxes are removed. The tablet now stands in portrait.
- **ESP32 bench.** The old single board, breadboard and jumpers are replaced by the kit in `farm_office.esp32_kit()`. The multimeter and solder spool moved along the bench to make room.
- **Farm.** It has crop fields (as ground shading with row bump, assigned by face), a windpump and dam, a barn twice the size with silos, an implement shed, a chicken coop and two tractors. Farm trees that fell inside a field are dropped, and a windbreak runs behind the back field. The grass blades keep out of the fields and the coop.
- **Mountains and city.** These replace the old flat ridges and the hidden 22 km skyline. There are two ridged ranges right round the horizon (near: 5.4 km, up to ~1.1 km high; far: 10.5 km, up to ~2.3 km), with slope-based rock and veld shading. A generic skyline stands 3–4 km out at about 19° right of ahead, in a low gap in the near range, with lit windows at night. Haze colour and strength follow the time of day.
- **Times of day.** Sunrise has the sun low on the right (east) and a pink sky. Day has a high sun front-left and a blue sky, with the lamps off. Sunset is the original golden look. Night has a starry sky, a moon, every lamp on, and lit farmhouse and city windows.
- **Renders.** Each time of day is 16 strips at 8192 px and 6 samples, denoised: 100-110 s a strip and about 28 minutes a time of day on 2 cores. `make_pano_assets.py` writes them to `../assets/workshop-3d/<TIME>/`.
- **Nav grid.** It now spans x −11..9 and y −3.6..17, so it covers the coop. Outside, it accepts open ground up to 1.5 m high (the yard rises), and it blocks the glass front wall explicitly.
- **After the first look (24 November).** The cow pen moved outside the left window (`farm_office.cow_pen()`: fence, trough, bales, hay ring, lean-to) and the coop moved behind the office, off the front yard. The city moved to about 70° right at 5.5–7.5 km. The left wall's Poly Haven shelf is replaced by `farmhouse_corner()`. The frames were turned to face the room. The nav grid now spans x −16..9 and y −15.5..17, and `pen.json` covers the new pen.
- **Second round (24 November).**
  - `longboards()`: two shaped decks with UV-mapped bottom graphics from `gen_textures.py`.
  - `farmhouse()`: a modern farmhouse at (25, 62), replacing the old one in `nature.buildings()`.
  - `city()`: rewritten (setbacks, round and tapered towers, crowns, spires, mid-rise blocks, a telecom tower).
  - A rebalanced `day` preset.
  - Cows: a smoother spine, slimmer lower legs, darker coats and daylight sprite lighting. `COWTEST=1` renders a single test frame.
- **Limits.**
  - The crops are shading, not plants, so they read as fields from the office but go flat close up.
  - The hens are small skin-modifier sprites, readable at the coop's distance but not up close.
  - The city is generic boxes, small and hazy by day.

Fifth pass (23 November 2026):
- **Front wall.** The front is a steel-framed glass wall (`thin_glass`) with a corner post, so the office has four walls and corners.
- **Desk.** The laptop is open, with a separate screen object. The tablet is an old 10-inch Android-style tablet in a folio cover, also with a separate screen object.
- **Caps.** The steel shelf moved to the left wall, so the whiteboard and caps show.
- **Cows.** `render.py` takes `NOCOWS=1`. `cow_sprites.py` renders the grazing cows, and `export_screens.py` replaces `render_monitor_mask.py`, covering all three screens.
- **Depth map.** It ignores glass, so things outside stay visible through the windows.

Fourth pass (22 November 2026): the dogs walk.
- `dog_sprites.py` renders each dog as sprite frames for the 360 page: 8 headings × an 8-frame walk cycle (a four-beat walk) and a 4-frame idle with a wagging tail, 320 px, 24 samples.
  - All three dogs are rebuilt standing, from the golden dog's skeleton with different proportions, ears and tails. The retriever is no longer lying down and the terrier no longer sits.
  - The skin-modifier body is baked once at rest, because its topology changes when the skeleton moves. It is then skinned to the skeleton's segments (each vertex follows its two nearest). Every fur strand is carried with the triangle it grows from.
  - Rendered with an orthographic camera looking 25° down, soft workshop light, the scene's AgX settings and a shadow catcher for the contact shadow. That took about 50 minutes on 2 CPU cores.
- `render.py` with `NODOGS=1` leaves the dogs out of the 360 render. Only the four strips that showed them (8–11 of 16) were re-rendered.
- `render_depth.py` writes the distance map the page uses for occlusion, and `nav_grid.py` writes the floor grid the dogs walk on.
- Limits:
  - The dogs are still the procedural skin-modifier dogs and still look soft-toy-like up close.
  - The walk is one gait, played faster when they run for the ball.
  - Their light is a fixed soft key, only dimmed toward the floor's brightness on the page, so they don't cast the scene's hard sun shadows.

Third pass (22 November 2026):
- The Land Cruiser is rebuilt from a box model to a detailed procedural model, matched to the photo's truck. The snorkel is gone, because the photo shows none.
- The garage has corrugated cladding, LED battens and a concrete slab, and its open front now faces the camera. The farmhouse and barn faced away from the eye because of an angle bug; that's fixed, and the farmhouse's lit windows now show and reflect in the pond.
- The garage and truck have moved so the left of the frame reads like the photo: the garage with both cars, then the truck.
- The sports cars have arches, glass, tread tyres and lamps. They are still simple shapes.
- The dog fur is thinner, about four times denser, clumped and patchy. The standing dog's legs are slimmer. The dogs still read as soft toys: their skin-modifier bodies aren't anatomical sculpts, and no free, licence-verified dog model was reachable (download.blender.org is blocked as well).

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
