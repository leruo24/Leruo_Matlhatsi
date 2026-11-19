# Tablet entry: camera zoom only

These two generated stills supersede the hand/pickup concept. The tablet remains stationary on its folio stand throughout.

Sequence: seated desk → approach → close-up → interactive tablet UI. Reverse the camera path on exit. No hands, lifting, or rotating the tablet.

These are visual pose references, not a frame sequence. Background and tablet proportions drift between generated views. Build a single consistent tablet and animate the camera toward its screen; do not crossfade these pictures and call that continuous 3D. Keep the existing authoritative workshop layout.

Suggested implementation: ease camera position and target together over approximately 1 second, finish perpendicular to the tablet screen, then transition to responsive HTML UI. Match the screen background colour during the handoff. Provide instant entry for reduced-motion users and an accessible Back control. Do not preload unrelated high-resolution views. Actual smoothness requires device testing.

Generated with the built-in image generator; prompts are included in prompts.json. No site behaviour has been changed by this asset pack.
