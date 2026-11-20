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

A preview of the workshop as a room you can turn around in. It's linked from the main experience as "3D preview" and labelled "in production" until it looks as good as the photo.

How it's built (`js/room.js`, `js/look-around.js`, shared code in `js/photo-layer.js`):
- **The eye stays where the photo was taken** (1.3 m up) and only turns. The photo is mapped onto a shell from that exact point, so it's pixel-exact at every angle and objects can't drift between views.
- **The photo is live.** It uses the same shader as the main experience: pond, trees, grass, clouds, dogs (blinks, ears, tail, head tilt), grazing cows, working sprinklers, the lit monitor, and the drone. The drone has the same sky controller.
- **A thin generated margin** (LaMa: 60 px left, 40 px right, 40 px above, 60 px below) gives the photo's edges room to fade. Further out the generated pixels smeared, so modelled geometry takes over there (see "Seam pass" below).
- **Everything the photo never saw is modelled:**
  - Side, back and front walls, with planks sampled from the photo's wall.
  - Ceiling and rafters, and a concrete floor tinted to the photo's floor.
  - The open glass sliding door in the right wall, with a meadow, sky and the farm's tree line outside.
  - Poly Haven props: steel shelving, a table, a stool, crates, boxes, a jug and a lantern.
  - Each edge fades into the modelled room over 60–80 px.
- **Light is matched to the photo:** a low warm sun from the front left (from the sun's position in the photo), a warm sky/bounce light and a workshop lamp. There's no tone curve, so textures sampled from the photo keep its colours.
- **The PC:** select the monitor or Enter computer. The view turns and zooms to the screen without moving, then opens LeruOS. The tablet remains decorative; Field Notes has been removed.
- **Rendering cost:**
  - Only the part of the photo that's on screen is rendered, at screen resolution.
  - While the photo fills the view, the modelled room isn't drawn.
  - Pixel ratio adapts to sustained load.
  - Reduced-motion and "Pause scenery" stop the animation.
  - Without WebGL, a still image is shown.

### Measuring performance

Add `?perf` to the URL (e.g. `look-around.html?perf`) to show frame rate, frame time, 95th-percentile frame time, draw calls, triangles and pixel ratio, measured live. Please check it on your own devices; numbers from my test machine (below) don't predict real ones.

Last measured in headless Chrome with **software** WebGL (SwiftShader on 2 CPU cores, no GPU). Absolute numbers are far below a real GPU; only the comparison means something:

| View | Main experience | 3D preview room |
| --- | --- | --- |
| Desktop 1440×810, home view | 3.4 fps | 3.5 fps (10 draw calls) |
| Phone 390×844 @3×, home view | 29.4 fps | 30.5 fps |
| Desktop, looking left or right (photo plus room) | n/a | 1.6–2.0 fps (20–31 draw calls) |
| Desktop, looking at the back wall (room only) | n/a | 0.4 fps (64 draw calls, 53k triangles) |

The back of the room is the heaviest view in software rendering. Real-GPU numbers are still unmeasured.

### What still doesn't match the photo (honest gaps)

- **No 3D models of the photo's subjects.** I couldn't reach free photoreal models of the dogs, cows, Land Cruiser, sports cars, trees, drone, gaming chair, monitor, console or tablet from here. Poly Haven, Sketchfab and similar sites are blocked from my build machine; only workshop props were reachable, through a mirror. Those subjects stay part of the live photo. That's correct from the fixed eye, but you can't walk around them.
- **The thin generated margin** is slightly softer than the photo next to it.
- **The seams are still visible.** See "Seam pass" below for what was measured, what was fixed and what's left.
- **Simple outdoor view.** Procedural ridges, a tree line and a pond in the photo's colours. It doesn't repeat, but it's plainer than the photo.
- **The floor is a flat plane** with low-amplitude variation. The walls and ceiling are individual boards.

### Asset sources and licences

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
