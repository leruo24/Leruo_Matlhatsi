# Scene keyframes for Leruo’s ideal world

Nine separate views: office, headset lift, world reveal, original workshop, left/right views, seated desk, monitor close-up and hardware bench. Open index.html to browse them. Three existing photographs are reused; six new reference images were made with the built-in image-generation tool. Exact prompts are in prompts.json.

## What these files are

Visual camera/composition references, not a functioning 3D room, calibrated stereo pairs, cubemap faces or a frame-by-frame video. Generated views change some small details (including whiteboard lettering, object scale and placement); the hardware view especially reinterprets the arrangement. Use the original workshop photograph as the layout authority. Do not morph or rapidly alternate these files: that would create flicker and apparent object movement.

## Transition plan (proposed timings, not measured)

| Transition | Suggested implementation | Duration |
| --- | --- | --- |
| Office → headset | Animate the headset/hands foreground toward the camera over a fixed office background | 1.4 s |
| Headset → world | Brief dark occlusion, then open a procedural lens mask over the live scene | 0.8 s |
| Workshop home → left/right | Small continuous camera arc over the existing depth scene; use angle images as composition references | 1.5 s |
| Home → seated | Camera path toward desk; chair needs geometry or a clean occlusion layer to pass it correctly | 1.8 s |
| Seated → monitor | Dolly toward the actual screen plane, align a DOM desktop using measured corners | 1.1 s |
| Home → hardware | Camera yaw/dolly toward a modeled bench; do not switch the underlying photo mid-motion | 1.6 s |
| Return from PC | Reverse the same camera path and restore prior focus | 1.1 s |

## Required for a genuinely rotatable room

Model the floor, roof beams, wall, desk, separate bench, chair and monitor as geometry. Use measured dimensions and a fixed coordinate system; match the original photograph before adding detail. Build separate low-poly device props and use licensed/created dog, vehicle and plant models where movement exposes their sides. A projected photograph alone cannot reveal hidden back faces. The unseen back wall has not been invented in this pack.

Use one shared camera and light rig. Keep laptop/console/tablet proportions consistent. Make the screen an emissive plane; transition to the existing interactive DOM desktop once aligned. Keep dogs and cows grounded, with rigged idle/grazing cycles and different timing. Use one instanced sprinkler particle system and pooled bird objects. The existing image masks belong only to the original workshop image and must not be reused for new angles.

## Smoothness and loading

Use the existing frame-independent springs for camera changes. Preload only the next required asset; do not load all reference PNGs into GPU textures on startup. Limit pixel ratio and retain sustained-load adaptive resolution. Share geometry/materials; pause hidden/offscreen animation. Prefer baked lighting and limited real-time shadows. Respect reduced motion and retain the no-WebGL fallback. Measure actual frame times on mobile and desktop; no FPS guarantee has been established here.

## Current integration

This pack is added separately under assets/scene-keyframes. This pack now lives in reference-archive/scene-keyframes. The live scene and its original depth/animation maps are unchanged. The preview is a static keyframe browser, not a 3D renderer. GitHub upload remains blocked by the connection’s write permissions.
