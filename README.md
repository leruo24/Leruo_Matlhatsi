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
- **An outpainted margin** (LaMa, 240 px either side, 144 px above, 210 px below) widens the photo to about 94° × 70°. Its tone is matched to the photo along the edges.
- **Everything the photo never saw is modelled:**
  - Side, back and front walls, with planks sampled from the photo's wall.
  - Ceiling and rafters, and a concrete floor tinted to the photo's floor.
  - The open glass sliding door in the right wall, with a meadow, sky and the farm's tree line outside.
  - Poly Haven props: steel shelving, a table, a stool, crates, boxes, a jug and a lantern.
  - The photo's edge is feathered over 90 px into this.
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
- **The outpainted margin is generated.** It's softer than the photo. LaMa turned the edge of the electronics bench into a low platform, and part of the chair base at the bottom edge is missing.
- **Visible seams where the photo hands over to the modelled room**, especially where the photo shows the tree and the meadow and the modelled side shows the sliding door. The ceiling is darker than the photo's beam.
- **Simple outdoor view.** It's a mirrored strip of the photo's own tree line, so it repeats if you look for it.
- **The modelled walls, floor and ceiling are flat planes** with photo-sampled textures, not detailed geometry.

### Asset sources and licences

- `assets/models/*.glb`: Poly Haven models, CC0, from the `ezEngine/store-sample` mirror. Converted to GLB and decimated with glTF-Transform. Sources: `steel_frame_shelves_01` (scaled 0.1, the mirror's copy is in decimetres), `WoodenTable_03`, `wooden_stool_01`, `wooden_crate_01`, `cardboard_box_01`, `jug_01`, `Lantern_01`.
- `assets/room/photo-wide.jpg`: the workshop photo plus a LaMa-outpainted margin.
- `assets/room/wood-planks.jpg`, `grass.jpg` and `backdrop.jpg`: sampled from the workshop photo.
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
