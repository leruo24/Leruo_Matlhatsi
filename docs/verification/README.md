# Verification: 18 November 2026

- `npm test`: 2 tests passed. Farm simulation runs ten minutes with the same scene objects and geometries; paused cow poses remain fixed and photo parallax is applied consistently.
- `node --check`: passed for boot, fallback, farm, office, world, sound, OS and content modules.
- `git diff --check`: passed.
- Browser: office entry, fallback transition, Open CV, CV-to-portfolio navigation, empty gallery/slideshow guard, back to workshop and sound-toggle state checked.
- Screenshot: `workshop-fallback.jpg` shows the static fallback, not the GPU animation path.

The QA browser reports WebGL disabled. The full workshop shaders, perspective alignment of added motion, visual quality during animation, mobile rendering and frame rate remain unverified. No claim of lag-free operation is made. Validate the feature branch in a GPU-enabled browser before merging.

The CV PDF is absent in the current repository. `resumeUrl` is null until the actual PDF is supplied; a contact/portfolio fallback is displayed. Placeholder gallery entries are hidden rather than presented as completed highlights.

## Smooth-motion update: 19 November 2026

Six tests now pass. Additional tests cover identical spring motion at simulated 30/60/120 FPS, pause/reversal stability, ignoring isolated frame stalls, and sustained resolution recovery. Camera and drone use exact critically damped interpolation; the idle camera follows a restrained elliptical depth-parallax path. Bird banking is continuous. These are live interpolated frames, not a new full-angle 3D reconstruction or an image sequence. The WebGL visual/performance limitation above remains.
