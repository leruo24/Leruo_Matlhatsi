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

A new image needs new maps, new monitor-corner coordinates (`SCREEN` in `js/world.js`), and new positions for the dogs' eyes and ears (in the photo shader).

The intro headline is `intro.headline` in `os/content.js`, and the intro images are `assets/intro-office.jpg` and `assets/intro-headset.jpg`.

## Credits
- Scene and intro images, the Jeppe Boys and UCT emblems, and the dog photos: supplied by Leruo
- Depth map generated offline with [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) (small model, Apache-2.0). Image clean-up (badges, the intro's baked-in text) was done with [LaMa](https://github.com/advimman/lama) (Apache-2.0). Neither model is shipped.
- Whiteboard handwriting fonts: Permanent Marker (Apache-2.0) and Caveat (OFL), baked into the image
- Sound recordings: CC0 clips from freesound.org, taken from the [ESC-50 dataset](https://github.com/karolpiczak/ESC-50): cows by felix.blume and others, birdsong, crickets, wind, "Dog Snores", a diesel truck idling, mouse clicks and typing. Per-clip credits are in that repo's LICENSE file. The supercar rev, river, PC and sprinkler sounds are synthesised.
- [Three.js](https://threejs.org) (MIT). Concept inspired by [Henry Heffernan's portfolio](https://henryheffernan.com).

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

`assets/scene-keyframes/`, `assets/tablet-zoom/` and `assets/panorama/workshop.png` are reference images and aren't loaded by the site.
