# Leruo Matlhatsi · Step into my workshop

An interactive look into my world: the projects I build, the problems I solve, and how I bring software, hardware and business thinking together.

A photograph-based portfolio: enter a busy grayscale office, put on the VR headset, then explore a golden-hour workshop with three dogs, a Land Cruiser, two cars in the garage, a pond and a farmhouse. Open the desk computer to use LeruOS for projects, experience and contact details.
### How it works
- **Intro:** you start in a busy, black-and-white office. Click **Put on headset**: hands lift the headset to your eyes, the padding closes the view, and my golden-hour workshop fades in through the lenses. The office sounds crossfade into birds, breeze and the pond. Takes about 4.6 seconds. There's **Skip intro** (or press Esc), a **mute** button, and a simple fade for anyone with reduced motion turned on.
- **The workshop:** a photoreal scene with depth parallax (Depth Anything V2). It has my three dogs, the Land Cruiser, both sports cars in the garage, a pond, the farmhouse, the drone and the Johannesburg skyline. The real UCT and Jeppe Boys emblems are on the caps, and a readable to-do list is on the whiteboard.
- **Click the dogs:** each one barks in its own voice and reacts.
- **Sound:** a drone buzz that grows when your mouse is near it, farm sounds, wind chimes and rustling leaves.
- **Gentle motion:**
  - The dogs breathe, blink and flick their ears, each on its own clock.
  - The pond ripples, the leaves and grass sway in the same wind, the clouds drift and the drone hovers.
  - The lamp sways a touch, and birds cross now and then.
- **Moving through it:** click the computer to **take a seat** at the desk, then click the screen to log in to LeruOS. Esc steps back. The **?** on the desk, and **Help** on the computer, explain everything.
- **LeruOS:** a Windows XP-style computer with My Computer, My Documents, a Recycle Bin and original XP-style sounds.
  - **Showcase** is a captioned photo gallery.
  - **Portfolio** has projects, experience and contact.
  - Apps: Resume, **Paint**, **Solitaire**, **LeruAmp** (three original generated tunes), **Command Prompt** (type `help`), Overland Run and Minesweeper.

No build step. It runs on GitHub Pages as static files. Generated imagery is included in the repository.

## Put it online (GitHub Pages)
Repo: `leruo24/Leruo_Matlhatsi` → **https://leruo24.github.io/Leruo_Matlhatsi/**

1. Commit and push changes to the repository without replacing its history.
2. In **Settings → Pages**, select **Deploy from a branch → `main` / `(root)`** if Pages is not already configured.
3. Merge a reviewed feature branch into `main` to publish through the existing configuration.

## Run it locally (VS Code terminal)
The site uses JavaScript modules, so it has to be served over http, not opened as a file. From the repo folder, run either:
```bash
npm start                    # needs Node.js; serves on http://localhost:8000
python -m http.server 8000   # or this, if you have Python
```
Then open http://localhost:8000. Click once to turn on the sound (browsers block audio until you interact).

## Edit content
Everything you read on the computer lives in **`os/content.js`**: bio, experience, projects, awards, links, the help text, and the **Showcase gallery**.

**Adding gallery photos:** put them in `assets/gallery/`, then add a line for each one to `gallery:` in `os/content.js`:
```js
{ src: "../assets/gallery/bpm-prizegiving.jpg", title: "2nd place, UCT BPM", date: "2026", text: "What happened and why it mattered." },
```
Add your CV as `assets/Leruo-Matlhatsi-CV.pdf`, then set `resumeUrl` to `"../assets/Leruo-Matlhatsi-CV.pdf"`. Until then, Resume offers the portfolio and contact options without a broken download. Entries containing TODO are hidden from the public gallery.

The clickable screens are defined at the top of `js/world.js` under `HOTSPOTS`. The whiteboard's to-do list is in `drawBoard()` in the same file.

## Changing the scene image
The scene is `assets/workshop.jpg`. It comes with:
- a matching depth map (`workshop-depth.png`),
- an animation mask (`workshop-masks.png`: red = water, green = leaves, blue = sky),
- a second mask (`workshop-masks2.png`: blue = grass and reeds that sway).

A new image needs new maps, new monitor-corner coordinates (`SCREEN` in `js/world.js`, and `MONITOR`/`TABLET` in `js/photo-layer.js` for the 3D preview), a new outpainted `assets/room/photo-wide.jpg`, and new positions for the dogs' eyes and ears (in the photo shader).

The intro headline is `intro.headline` in `os/content.js`, and the intro images are `assets/intro-office.jpg` and `assets/intro-headset.jpg`.

## Credits
- Scene and intro images, the Jeppe Boys and UCT emblems, and the dog photos: supplied by Leruo
- Depth map generated offline with [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) (small model, Apache-2.0). Image clean-up (badges, the intro's baked-in text) was done with [LaMa](https://github.com/advimman/lama) (Apache-2.0). Neither model is shipped.
- Whiteboard handwriting fonts: Permanent Marker (Apache-2.0) and Caveat (OFL), baked into the image
- Sound recordings: CC0 clips from freesound.org, taken from the [ESC-50 dataset](https://github.com/karolpiczak/ESC-50): cows by felix.blume and others, birdsong, crickets, wind, "Dog Snores", a diesel truck idling, mouse clicks and typing. Per-clip credits are in that repo's LICENSE file. The supercar rev, river, PC and sprinkler sounds are synthesised.
- [Three.js](https://threejs.org) (MIT). Concept inspired by [Henry Heffernan's portfolio](https://henryheffernan.com).

## 3D preview room (`look-around.html`)

A preview of the workshop that you can turn all the way round in. It's linked from the main experience as "3D preview" and labelled "in production".

Since 22 November 2026 the page shows a 360° render of the Blender scene in `blender/`, instead of the photo stitched onto a modelled three.js room. That approach left a visible seam where the photo met the model. Now the whole view comes from one scene, with one light and one camera height. The look comes from the render, not from the approved photo: it is CG, and the dogs in particular still read as soft toys (see `blender/README.md`).

**Pass 6 (23 November 2026): a modern farm office, the farm around it, and the time of day.**
- **The intro is back in front of it.** `look-around.html` opens with the main experience's intro (`js/vr-intro.js`, reusing `js/office.js` and the same images): click to enter, the black-and-white office with the headset, Put on headset, the lean-in, dark, then the workshop comes into focus inside the lenses. Skip intro or Esc crossfades; reduced motion skips the animation; `?nointro` skips it all. The office murmur crossfades to the farm's ambience (the main page's `js/sound.js`), and Sound off on the main page still mutes it.
- **Header.** Only a "3D look around" label and the time chip are left at the top.
- **Time of day.** There are four renders of the same scene: sunrise, afternoon, sunset and night (`blender/timeofday.py`, in `assets/workshop-3d/<time>/`). The page picks the one that matches the viewer's clock: sunrise 05:00–07:59, afternoon 08:00–16:29, sunset 16:30–19:29, night otherwise. It re-checks every minute. The chip at the top cycles through them and back to "your time", and `?time=sunrise|day|sunset|night` pins one. At night the room's pendants, floor lamp and desk lamp are on, the farmhouse and the city are lit, there are stars and a moon, and the live drone, birds, hens and cows are lit to match.
- **The room.** It is now a clean, modern farm-style office:
  - painted white board walls, a limed timber ceiling and oak beams;
  - big black-framed picture windows in the back and left walls, so you see the farm all round;
  - black enamel pendants over the desk and bench, and a jute rug;
  - three framed photos of Leruo (his own photos from `assets/`), books, a window seat with cushions, a tripod floor lamp and a large corner plant.
  - The rusty barrel, cans, crowbar and cardboard boxes are gone.
- **The ESP32 bench** is now plainly an ESP32 build. It has a DevKit (shielded module, antenna, pin headers, LEDs) on a breadboard with a DHT22 and a glowing OLED readout, and a second board in a printed case wired to soil probes in a seedling tray. A relay drives a little pump in a jar, and there are a USB lead and power bank, a magnifier lamp, a DevKit pinout card and a folded "ESP32 · soil + climate node" card. These are plain text and shapes, with no logos. Selecting the bench opens a short note on what's on it.
- **The farm.** You can see more of it now:
  - crop fields (maize, wheat, young rows, ploughed ground) on four sides;
  - a classic windpump with a round concrete dam;
  - a barn twice the size, with galvanised silos;
  - an implement shed behind the office, two tractors and a chicken coop in the yard;
  - mountain ranges all the way round, nearer and taller than before, with rock and veld shading and haze that changes with the time of day;
  - a generic city skyline 3–4 km out, front right, in a low gap in the range. Its windows light up at night.
- **Hens and birds.** Six hens peck around the coop and trot about (`js/chickens.js`, sprites from `blender/chicken_sprites.py`). They walk on the same floor grid as the dogs, which now covers the rising yard. A small flock of birds wheels over the farm, except at night.
- **The drone** is a small 3D quadcopter (body, arms, motors, spinning props with blur discs, a camera gimbal, and navigation lights at night and dawn) instead of a flat picture. It is lit by a sun and sky light that match each render.
- **The tablet** stands upright on the desk, and its view on the page is portrait on every screen, so it is easy to use on a phone.
- **Checked** on 24 November 2026 in headless Chrome with software WebGL (SwiftShader, no GPU), at 1400 × 800 and on a 390 × 844 touch viewport:
  - The intro plays through to the 3D view.
  - All four time sets load at 8K, and the chip switches between them.
  - The hens walk by the coop, the bench note opens, and the 3D drone and birds draw.
  - On the phone the tablet opens portrait (374 × 565).
  - There were no page errors or failed requests, and the 40 unit tests pass.
  - Not yet checked on a real GPU or a real phone. Each time set is about 2.4–2.9 MB at 8K, and only one set loads per visit.

How it's built (`js/pano-view.js`, `js/look-around.js`):
- **One eye, turning only.** The 360° image is rendered in Blender from the same eye as the photo-matched camera. The page shows it on a sphere around the camera. The camera only turns, so anything placed at its real position in the scene lines up with the render exactly.
- **Loading.** A 2048 × 1024 preview appears first. Then the sharp version loads: 8192 × 4096 in four 2048 × 4096 quarters on desktops, or 4096 × 2048 in two halves on touch devices and GPUs limited to 4096 px textures.
- **The office.** Since 23 November the front of the workshop is a black steel-framed glass wall (six bays, a transom at door height), so the office has its four walls and corners. You still see out over the yard. The glass is a thin-sheet shader: see-through, with a Fresnel reflection and no refraction. The right-hand sliding door stays open. The steel shelf moved to the left wall, so the whiteboard and the two caps (UCT, Jeppe) are in clear view.
- **Monitor, laptop and tablet.** Each screen's lock screen is drawn live on a flat panel at the screen's real position, from `assets/workshop-3d/screens.json`. A Blender-rendered visibility mask (`mask-<screen>.png`) keeps the chair and anything else in front of them; `blender/export_screens.py` writes both.
  - The monitor and the open laptop show LeruOS's lock screen (live time and date). Select either, or press Enter computer, to turn and zoom to it and open LeruOS.
  - The tablet is an old 10-inch Android-style tablet (thick black bezel, silver rim, front camera, folio cover) showing its lock screen. On a phone the main button reads **Open tablet**. Selecting the tablet zooms in and opens `tablet/`, a 2012-style tablet home screen (Holo look, system bar with back, home and recents keys, no logos) inside a tablet bezel. Its apps (About me, Projects, Experience, Skills, Education, Interests, Contact) are built from `os/content.js`, the same file the computer uses, and empty sections are left out.
- **Depth.** The panorama also writes depth. `assets/workshop-3d/depth.png` comes from `blender/render_depth.py`: a Cycles render from the same eye, with every surface replaced by a shader that writes its distance (16 bits, logarithmic between 0.2 m and 30 km). The sky sphere sets each pixel's depth from it. Live objects (the drone, the dogs, the ball) are then hidden by nearer walls, furniture and tree trunks. Leaf cards and grass are left out of the map because they're mostly holes, so the drone is not hidden by foliage.
- **Walking dogs.** The three dogs are no longer in the render; they walk about live (`js/dogs.js`).
  - Each is a set of sprite frames rendered in Blender (`blender/dog_sprites.py`): 8 headings × an 8-frame walk cycle (a four-beat walk), plus a 4-frame idle with a wagging tail.
  - They are the scene's skin-modifier dogs rebuilt standing. Every frame moves the skeleton, skins the body to it, and carries each fur strand with the triangle it grows from.
  - On the page, each dog stands on the floor facing the eye. The frame comes from the dog's heading relative to the line of sight and from how far it has walked.
  - Each dog has one depth, just in front of it, so the desk, chair and walls hide it and other dogs overlap correctly. Its brightness follows the floor under it in the panorama, so it darkens out of the sun.
  - They find their way on a 10 cm floor grid (`assets/workshop-3d/nav.json`, from `blender/nav_grid.py`, which ray-casts down over the floor and yard). The grid is grown by the dog's radius, and A* finds the paths, shortened wherever the way is clear.
  - They wander the workshop and the yard in front of it, stop, wag, and keep a little room between each other.
- **Things to do.**
  - Select a dog and a small card offers **Call over** (it trots up in front of you, turns to face you and barks, with a "Woof!" bubble; sound is off if it's switched off on the main page) or **Walk this dog**.
  - **Walk a dog** opens a panel with a choice of dog and a stick, like the drone remote: up walks it away from you along the view, down brings it toward you, left and right go across, and further means faster. Arrow keys / WASD work too, Space barks, and Esc lets it go. It slides along walls and furniture, picks up the ball if you walk it there, and the view turns to keep it in sight.
  - **Throw ball** (or B, or double-click a spot on the floor) throws a tennis ball. The dogs race for it, and the first one there carries it back to you.
- **The cows** graze in their pen across the farm (about 65 m out) and amble a few metres to fresh grass now and then, keeping clear of each other and the fence (`js/cows.js`). Like the dogs, they're Blender sprite frames (`blender/cow_sprites.py`, three coats, a walk cycle and a grazing loop with the head down and the tail swishing). They're no longer in the render, and their ground heights come from `pen.json`.
- **Controls.** A dock holds Walk a dog, Throw ball, Fly drone and Pause, next to the main button. Messages appear as a short toast above it, and **?** explains everything. On touch screens the look pad is hidden, because dragging does the same.
- **The drone** uses the same autopilot and two-stick remote as the main experience, but in the 360 view the remote can fly it all the way round the workshop, 12 m out and between 3° and 31° up, at 2.2 times the main page's speed. While you fly it, the view turns to keep it in sight, and the walls and roof hide it when it goes behind them (you can see it through the back window). The autopilot keeps to the sky in front. Pause scenery and reduced motion stop it, and the dogs as well.
- **Unchanged:** dragging, the arrow keys and on-screen pad, Home to re-centre, `?perf` and `?debug`. Without WebGL the page pans the 2048-px panorama as a still image.
- **Rendering cost.** One sphere, one screen panel, one drone sprite, three dog sprites and the ball. The dogs are always doing something, so frames are drawn continuously unless scenery is paused, reduced motion is on, the tab is hidden or the PC is open. Then the page only wakes every 30 s to keep the clock current.
- **Rebuilding the files** (`blender/`):
  - The scene: `python build_scene.py` (the bench's printed textures come from `python3 gen_textures.py`).
  - The 360 renders, one per time of day: `TIME=<time> NODOGS=1 NOCOWS=1 python render.py pano renders/<time>_<i>.png 8192 6 <i>/16` for i = 0–15. Each strip is a narrow band of latitude, because a full 8192-wide frame ran out of memory on the 7 GB build machine. Then run `TIME=<time> python3 make_pano_assets.py renders/<time>_{0..15}.png`. On the build machine (2 CPU cores) a time of day took about 28 minutes at 6 samples (denoised).
  - The screens and their masks: `python export_screens.py ../assets/workshop-3d`.
  - The depth map: `python render_depth.py ../assets/workshop-3d/depth.png 4096 40`.
  - The floor grid (workshop, yard and coop) and the cow pen heights: `python nav_grid.py ../assets/workshop-3d/nav.json`.
  - The dogs: `python dog_sprites.py <dir> 320 24`. The cows: `python cow_sprites.py <dir> 160 24`. The hens: `python chicken_sprites.py <dir> 128 16`. Then run `python3 make_dog_atlases.py <dir>` for each folder.

Checked on 22 November 2026 in headless Chrome with **software** WebGL (SwiftShader, 2 CPU cores, no GPU):
- The 8K tiles loaded on desktop and the 4K halves on a 390 × 844 touch viewport.
- Turning left, right and to the back works.
- Hovering the monitor shows a pointer, and clicking it opens LeruOS. Back to look-around returns.
- The drone remote flies the drone.
- `?nowebgl` shows the still fallback.
- There were no console errors and no failed requests.
- `?perf` at 1600 × 900: 3 draw calls and 9,028 triangles, 12.7–16.9 fps with the pixel ratio adapting down to 0.6–0.9. That is software rendering; real-GPU numbers are unmeasured.

The old room modules (`js/room.js`, `js/room-seam.js`, `js/room-detail.js` and their tests) are still in the repository, but the page no longer loads them. The notes further down about the seam, room revisions and measured frame rates describe that earlier version.

### Asset sources and licences

- `assets/workshop-3d/`: rendered from the Blender scene in `blender/`. The models and textures in that scene, with their sources and licences, are listed in `blender/README.md`.
- `assets/models/*.glb`: Poly Haven models, CC0, from the `ezEngine/store-sample` mirror. Converted to GLB and decimated with glTF-Transform. Sources: `steel_frame_shelves_01` (scaled 0.1, the mirror's copy is in decimetres), `wooden_stool_01`, `wooden_crate_01`, `cardboard_box_01`, `jug_01`, `Lantern_01`.
- `assets/room/photo-wide.jpg`: the workshop photo plus a thin LaMa-outpainted margin (cropped from the earlier wide version).
- `assets/room/grass.jpg`: patch-synthesised from the photo's meadow.
- Moved out of the runtime folders (unused): `backdrop.jpg`, `wood-planks.jpg`, `wooden_table_03.glb`. They're now in `reference-archive/unused-room-assets/`.
- `vendor/three/addons/`: GLTFLoader and BufferGeometryUtils from three.js r170 (MIT).

## Scene motion and verification

- `js/farm.js`: two photo cutout cows placed behind the paddock fence, with small independent grazing/chewing movements. Two bounded GPU particle emitters animate rotating sprinkler spray. Placement uses coordinates in the 1670 × 942 photo.
- `js/office.js`: a clean office plate, slight local colleague movement and an occasional aisle walker. Walking intervals vary; the foreground masks the walker.
- Birds share geometry, arrive at variable intervals and alternate flapping with smooth glides. At most two flocks are active.
- Pause scenery freezes workshop motion. Reduced-motion preferences are respected. The workshop does not render behind the full-screen PC, and hidden tabs suspend ambience.
- `js/boot.js` loads a static workshop/PC fallback if WebGL initialization fails. This keeps the portfolio usable on unsupported devices.
- No added sharpening, grain or gravel/concrete texture overlay.

Validation: `npm test` checks bounded farm allocation over ten simulated minutes, pause behavior and parallax. JavaScript syntax checks and browser checks of the fallback/PC flows. The available QA browser has WebGL disabled, so 3D shader rendering, visual alignment and frame rate still require a GPU-enabled browser. Motion uses photo warping and sprites; it is not a fully rigged 3D environment.

### Smooth camera motion

`js/motion.js` provides frame-rate-independent camera/drone springs and a resolution controller with separate overload/recovery delays. The view follows a small elliptical depth-parallax path when idle, while birds bank gently. Reused vectors avoid camera allocations every frame. Run `npm test` for the six motion and allocation checks. Full orbit rotation is intentionally unsupported: the background is a single photograph, not a complete 3D model.

### GPU browser check (integration)

Checked in a WebGL-enabled browser after merging. Fixes made:
- The sprinkler spray shader used mismatched precision between its two halves, which ANGLE (Chrome on Windows) rejects. It now uses `highp` in both, so the spray renders.
- Manual drone flight now answers the sliders in about 1.5 s; autopilot keeps its slow drift.
- The drone passes behind the tree's leaves instead of drawing over them.
- The look-around and tablet pages now have a tab icon (this removes a 404).

Concept images (scene keyframes, tablet-zoom concepts and the old panorama) live in `reference-archive/`. The site doesn't load them.

## Drone remote update

Both pages use the same two-stick remote. Drag the left stick for horizontal flight and altitude; drag the right stick horizontally for banking. Keyboard: arrows or WASD to fly, Q/E to bank, Escape to close. Release to hover; Centre drone resets its target and Resume autopilot restores automatic flight. The existing distant-sky bounds remain enforced. Banking rotates the existing photo-layer drone; this update does not add a 3D drone model or a drone camera feed.

Input resets on pointer cancellation, focus loss, panel closure, and hidden tabs. The input animation loop runs only while a stick or key is held. Paused scenery must be resumed for visible flight. Field Notes, its button, and its tablet click target have been removed.

## Room interior revision

The modelled sides and rear now use individual timber boards, skirting, posts and ceiling boards. A fitted 0.9 m high maker bench replaces the isolated rear cabinet, with drawers, a slatted tool panel, hand tools, component bins, a breadboard and a small radio board. Storage cases sit at the measured shelf heights of the existing shelf asset. Ceiling fixtures and an under-shelf strip accompany revised, less orange lighting. Concrete uses low-amplitude procedural variation rather than the old floor image.

Repeated details are instanced. Static rear views stop requesting frames once camera movement settles; moving the camera wakes rendering, and visible farm scenery keeps animating. This is an implementation optimisation, not a measured device-FPS claim.

Validation: 25 Node tests pass, including clear door aperture, fixed photo projection, PC hit target, finite bounds and batched joinery. An offline geometry render was used to check the rear layout; it is not a browser screenshot and uses different lighting. WebGL visual verification and device speed remain unconfirmed. The photo-to-room boundary still uses the existing feathered projection and can remain visible.

### WebGL check of the remote and room revision

Checked in headless Chrome with software WebGL (SwiftShader):
- The two-stick remote flies the drone on both pages: stick drag, bank, A/D keys and Escape all work.
- The PC transition opens LeruOS. There were no console errors and no missing files.
- The revised room renders the maker bench, tool board, stocked shelves and ceiling boards.

Fixed during the check: the room kept rendering the off-screen photo when you faced the back wall, so it never went idle. The visible-photo test now returns nothing when no part of the photo is in view (`photoInView` in `js/room.js`, covered by a test). After settling, the rear view now draws 0 frames, and the photo view keeps animating.

The neutral grey floor now meets the warmer photo floor with a visible colour change at the seam. Real-GPU frame rates are still unmeasured; use `?perf`.

## Seam pass: where the photo meets the modelled room (20 November 2026)

**How it was checked.** I rendered the room in headless Chrome with software WebGL and measured each edge: the mean colour of the photo just inside its opaque core against the modelled room just outside it, at 25 points along each edge. I also checked by eye, and every prop and detail went through a downward-raycast contact check.

**What the renders showed:**
- The generated margins were the main problem. Beyond about 40–60 px from the real photo, LaMa smeared: blotchy foliage on the right, smeared shelving on the left, a streaky beam at the top, and the electronics bench turned into a floor slab at the bottom right.
- Objects that cross the photo's edge stopped dead at the seam: the ESP32 bench, the shade tree's trunk and the pond.
- The modelled floor was grey-green against the photo's warm concrete. The hemisphere light's sky colour was a cool neutral.
- The left wall was much darker than the photo's warmly lit front wall. The ceiling was dark and red.
- The first rafter sat inside the photo's feathered edge and showed through it as a second beam.
- A wall strip at the front right sat inside the feathered edge, where the photo shows open outdoors.
- The outdoor view was a mirrored, repeating strip of the photo.
- The stacked crate floated 16 cm above the lower crate.

**What changed:**
- The margin is cut to a thin band, 40–60 px depending on the side, with per-side feathering. The home view fits itself to the opaque area at any aspect ratio.
- New `js/room-seam.js` continues three objects in 3D from measured photo pixels, so they line up from the eye by construction:
  - **ESP32 bench.** Top at 0.76 m, 0.58 m deep, 4 cm thick, with legs under the corners where the photo draws them. It leaves 1.1 m of walking space to the sliding door.
  - **Shade tree's trunk.** About 7.5 m out, 0.56 m across, with procedural bark (no stretched image).
  - **Pond.** Continued to the right in colours sampled from the photo's pond.
- The sliding-door opening starts at the front corner, so the photo's open outdoors continues into the open door.
- **Light:** the hemisphere sky colour is warm-neutral, with a brighter bounce from the floor. A small warm bounce light at the open front lifts the front wall, as the photo shows.
- **Materials:**
  - The floor is tinted to the measured photo floor.
  - The ceiling and the bench keep the oak grain but lose most of its orange.
  - The lawn is brightened by the measured ratio and has large-scale patches so its tiling doesn't show.
- The outdoor view is procedural: hazy ridges, hills and an irregular tree line in colours sampled from the photo. It doesn't repeat.
- The first rafter moved just past the photo's top edge.
- The stacked crate now sits on the lower crate's lid. A test caught the trunk's root flare sinking 2.5 cm, and that's fixed.
- Unused runtime assets moved to `reference-archive/unused-room-assets/`.

**Measured result** (photo against model mean RGB, 0–255, at the final edges):

| Edge | Photo | Model |
| --- | --- | --- |
| Left | 94, 67, 46 | 106, 68, 42 |
| Bottom | 120, 92, 73 | 114, 84, 63 |
| Top | 76, 58, 29 | 57, 36, 25 |
| Bench top | 85, 59, 39 | 91, 62, 43 |

The mean absolute difference per point is still 32–41. Detail doesn't match point for point: the photo's boards, caps and grass sit next to plainer modelled surfaces. These figures aren't comparable with the earlier ones, because those sampled the generated margin, not the photo's real edge. The right-edge number isn't meaningful because its samples straddle the trunk.

**Verification:**
- 27 Node tests pass. New tests cover:
  - the home view staying on the opaque core at five aspect ratios
  - bench edges projecting onto the measured photo rows
  - the trunk leaving the frame at the photo's edge
  - legs and root flare resting on the ground
  - walking space to the door
  - the visible-photo check
- **Browser checks (software WebGL, desktop and phone):**
  - looking around, and the PC transition with its return
  - the two-stick remote on both pages, including that drone keys don't turn the room
  - pause and resume, reduced motion, and the no-WebGL fallback
  - the rear view going idle once settled
  - no console errors and no missing files
- **Performance, same machine, software rendering:**
  - Main experience: 5.0 fps desktop, 40 fps phone.
  - Room home view: 4.8 fps desktop, 43 fps phone.
  - These aren't real-device numbers.
- **Asset path check:** 31 asset references found in the site's code. All exist with matching case, except `assets/Leruo-Matlhatsi-CV.pdf`, which LeruOS links to and which hasn't been supplied yet.

**Still not right:**
- The seams remain visible, mostly as a change of detail.
- The photo's yellow-and-black toolbox shelf, the hanging lamp and the pen cup are cut where the left and right edges fade.
- The photo's top right is foliage, while the modelled side above it is the ceiling.
- The chair base stops at the bottom edge.
- The modelled bench is a simple slab and frame, and the trunk ends where the lintel hides it.
- Real-GPU appearance and frame rates are unverified.
