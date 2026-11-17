# Leruo Matlhatsi · Step into my workshop

An interactive look into my world: the projects I build, the problems I solve, and how I bring software, hardware and business thinking together.

A photoreal portfolio. You arrive at my workshop at golden hour: a desk with my computer, a games console, an ESP32 workbench, my Jeppe and UCT caps on the rack, the dog, a 4x4 and a sports car outside, the farm and the river. **Almost everything can be clicked**, and the camera pulls focus onto it with a short card. Take a seat at the computer to use **LeruOS**, my portfolio, with projects, CV, contact and two games.

### How it works: a real photo plus live 3D layers
- **Photo with depth:** a depth map (made with the Depth Anything V2 AI model) lets the room shift in true 3D as you move the mouse.
- **Matched 3D camera:** a Three.js camera is matched to the photo (focal length, horizon, camera height). Real 3D objects sit in the scene: the **second monitor running Overland Run**, the **home-lab rack** under the desk (blinking router and switch), the **3D printer** printing a part, and the **whiteboard** with awards. Every 3D pixel is checked against the photo's depth, so the chair, desk edge, fence rails and leaves pass in front correctly.
- **Life in the scene:** the photo's own cows were lifted out and now wander and graze. Impact sprinklers sweep the crop rows, flocks of birds cross the sky, and the dog breathes and snores.
- **Moving water and wind:** the river flows downstream, faster on screen where it is nearer, and clouds drift slowly. One wind value drives the trees, the grass and the wind sound together. The hanging lamp sways a little.
- **Ground:** real surface detail is projected in perspective onto the dirt yard and the concrete floor.
- **Sound:** CC0 field recordings (cows, birds, crickets, wind, the dog's snore, a diesel idle, mouse and keyboard) mixed with synthesised layers (river, PC fan, the boot sequence, sprinkler ticks). Each sound is panned to where it is in the scene.
- **Camera feel:** depth-of-field focus pulls, a gentle grade, vignette and film grain over everything.

No build step. It runs on GitHub Pages as is, at about **2.8 MB** in total.

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
Everything you read lives in **`os/content.js`**: bio, experience, projects, awards, links, and the cards for each hotspot. Add your CV as `assets/Leruo-Matlhatsi-CV.pdf`.

Hotspot positions (which part of the photo each one covers) are at the top of `js/world.js` under `HOTSPOTS`.

## Changing the scene image
The scene is `assets/workshop.jpg`, with the two cows painted out (they live in `assets/cow0.png` and `cow1.png` and are animated). It comes with:
- a matching depth map (`workshop-depth.png`),
- an animation mask (`workshop-masks.png`: red = water, green = leaves, blue = sky),
- a ground mask (`workshop-masks2.png`: red = dirt yard, green = concrete, blue = grass).

A new image needs new maps, new monitor-corner coordinates (`SCREEN` in `js/world.js`), and new positions for the 3D objects.

## Credits
- Scene image: supplied by Leruo
- Depth map generated offline with [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) (small model, Apache-2.0). The cows were painted out with [LaMa](https://github.com/advimman/lama) (Apache-2.0). Neither model is shipped.
- Sound recordings: CC0 clips from freesound.org, taken from the [ESC-50 dataset](https://github.com/karolpiczak/ESC-50): cows by felix.blume and others, birdsong, crickets, wind, "Dog Snores", a diesel truck idling, mouse clicks and typing. Per-clip credits are in that repo's LICENSE file. The supercar rev, river, PC and sprinkler sounds are synthesised.
- [Three.js](https://threejs.org) (MIT). Concept inspired by [Henry Heffernan's portfolio](https://henryheffernan.com).
