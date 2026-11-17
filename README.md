# Leruo Matlhatsi · Step into my workshop

An interactive look into my world: the projects I build, the problems I solve, and how I bring software, hardware and business thinking together.

A photoreal portfolio. You arrive at my workshop at golden hour: a desk with my computer, a games console, an ESP32 workbench, my Jeppe and UCT caps on the rack, the dog, a 4x4 and a sports car outside, the farm and the river. **Almost everything can be clicked**, and the camera pulls focus onto it with a short card. Take a seat at the computer to use **LeruOS**, my portfolio, with projects, CV, contact and two games.

### How it works: a real photo plus live 3D layers
- **The room is just the room.** There are no dots or pop-ups. The only things you can use are the computer screens: the main screen opens LeruOS, and the second screen opens Overland Run.
- **Photo with depth:** a depth map (made with the Depth Anything V2 AI model) lets the room shift in true 3D as you move the mouse.
- **Matched 3D camera:** real 3D objects sit in the photo and hide correctly behind the chair, the desk and the fence. They include the **second monitor** (butted against the main screen and angled in, running Overland Run), the **home-lab rack** under the desk, the **3D printer** and the **whiteboard** (to-do list and wins).
- **Life:**
  - The photo's own cows wander and graze, sprinklers sweep the crops and birds cross the sky.
  - The river flows and the clouds drift.
  - The dog breathes, follows your cursor with his eyes, blinks, and thumps his tail when you come close.
- **Details:** the real Jeppe and UCT emblems are embroidered onto the caps, the desk's front-left leg now reaches the floor, and there's a faint city in the valley.
- **LeruOS:** a Windows XP-style computer with a boot screen, a log-on screen, a start menu, taskbar, balloon tips and windows. Showcase opens like a web browser with an address bar. Minesweeper and Overland Run are on the desktop.
- **Sound:** CC0 field recordings (cows, birds, crickets, wind, a diesel idle, mouse and keyboard) plus a synthesised river, the PC boot and sprinkler ticks.

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
Everything you read on the computer lives in **`os/content.js`**: bio, experience, projects, awards and links. Add your CV as `assets/Leruo-Matlhatsi-CV.pdf`.

The clickable screens are defined at the top of `js/world.js` under `HOTSPOTS`. The whiteboard's to-do list is in `drawBoard()` in the same file.

## Changing the scene image
The scene is `assets/workshop.jpg`, with the two cows painted out (they live in `assets/cow0.png` and `cow1.png` and are animated). It comes with:
- a matching depth map (`workshop-depth.png`),
- an animation mask (`workshop-masks.png`: red = water, green = leaves, blue = sky),
- a ground mask (`workshop-masks2.png`: red = dirt yard, green = concrete, blue = grass).

A new image needs new maps, new monitor-corner coordinates (`SCREEN` in `js/world.js`), and new positions for the 3D objects.

## Credits
- Scene image, Jeppe Boys and UCT emblems: supplied by Leruo
- Depth map generated offline with [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) (small model, Apache-2.0). The cows were painted out with [LaMa](https://github.com/advimman/lama) (Apache-2.0). Neither model is shipped.
- Sound recordings: CC0 clips from freesound.org, taken from the [ESC-50 dataset](https://github.com/karolpiczak/ESC-50): cows by felix.blume and others, birdsong, crickets, wind, "Dog Snores", a diesel truck idling, mouse clicks and typing. Per-clip credits are in that repo's LICENSE file. The supercar rev, river, PC and sprinkler sounds are synthesised.
- [Three.js](https://threejs.org) (MIT). Concept inspired by [Henry Heffernan's portfolio](https://henryheffernan.com).
