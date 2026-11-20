# Reference archive

Concept art and reference images used while designing the site. **The live site doesn't load anything in this folder.** It's kept for reference: layout, mood, lighting and the intended look of the 3D room.

| Folder | What it is |
|---|---|
| `scene-keyframes/` | Concept keyframes (office, headset, workshop views, seated desk, monitor entry, bench). Use them as references for the 3D room, not as an animation sequence. Open `scene-keyframes/index.html` to browse them. |
| `tablet-zoom/` | Concepts for approaching the tablet and its close-up. |
| `panorama/workshop.png` | An earlier generated panorama. (`assets/panorama/workshop-open-door.png` stays in `assets/` because the 3D room uses it as a no-WebGL fallback.) |

Before moving anything else here, check that nothing in `index.html`, `look-around.html`, `tablet/`, `os/`, `js/` or `css/` references it.

## unused-room-assets/

Moved out of the runtime folders after checking nothing in the site references them:
- `backdrop.jpg`: a mirrored strip of the photo's tree line, once used outside the 3D room's door. Replaced by procedural ridges, because the mirrored strip visibly repeated.
- `wood-planks.jpg`: a wall texture sampled from the photo. Replaced by individual timber boards.
- `wooden_table_03.glb`: Poly Haven CC0 table, replaced by the fitted rear bench.
