# Leruo Matlhatsi · Step into my workshop

An interactive look into my world: the projects I build, the problems I solve, and how I bring software, hardware and business thinking together.

A photoreal portfolio. You arrive at my workshop at golden hour: a desk with my computer, a games console, an ESP32 workbench, my Jeppe and UCT caps on the rack, the dog, a 4x4 and a sports car outside, the farm and the river. **Almost everything can be clicked**, and the camera pulls focus onto it with a short card. Take a seat at the computer to use **LeruOS**, my portfolio, with projects, CV, contact and two games.

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

No build step. It runs on GitHub Pages as is, at about **3.4 MB** in total.

## Put it online (GitHub Pages)
Repo: `leruo24/Leruo_Matlhatsi` → **https://leruo24.github.io/Leruo_Matlhatsi/**

1. Delete the old files from the repo (or start fresh), then **Add file → Upload files** and drag in *everything inside* this folder, including the hidden `.nojekyll`. Commit.
2. Go to **Settings → Pages → Deploy from a branch → `main` / `(root)`** and save. Wait a minute.

PowerShell, one line:
```powershell
cd C:\path\to\site; git init; git add .; git commit -m "Photoreal workshop portfolio"; git branch -M main; git remote add origin https://github.com/leruo24/Leruo_Matlhatsi.git; git push -u origin main --force
```
(`--force` replaces what's in the repo. Leave it off if you want to keep the old history.)

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
``` Add your CV as `assets/Leruo-Matlhatsi-CV.pdf`.

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
