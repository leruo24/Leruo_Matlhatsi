# Consistent workshop geometry

The WebGL view in ../../look-around.html now uses ../../js/room.js, not the panorama sphere. The old generated panoramas remain reference artwork and the no-WebGL fallback only.

The scene graph uses metres: 8 × 8 m floor, 3.4 m walls, fixed eye position, separate desks, roof beams, shelves, chair, monitor, tablet, console, electronics props and an open right-side doorway. The glass panel is parked beside the opening. Objects share one world coordinate system for every viewing angle. Screen click targets and camera destinations derive from the screen meshes' world transforms. PC/tablet entry interpolates camera position and orientation over 0.85 seconds, then opens the existing HTML portfolio. Exit returns to the original eye position. Reduced-motion skips the interpolation.

This is a simplified geometry build, not a photoreal reconstruction. Exterior trees, truck, garage, pond and house are basic models; the dogs, cows, skyline and detailed vehicles from the photo have not been modelled in this view. Existing living-workshop photo and animations remain available via the back link. The original portfolio UI is shared by PC and tablet.

Rendering remains on demand, pixel ratio adapts to sustained load, geometry/materials are shared, and static shadow maps render once. No frame sequence or generated panorama is loaded in the successful WebGL path. Texture loading requests a redraw when complete.

Validation: 16 Node tests pass, including doorway clearance, separated desks, finite object bounds, screen ray targeting, camera timing and angle bounds. Device/browser visual testing is pending at the user's request. Tests do not establish a measured frame rate.

## Interface and materials refinement

The room uses a generated oak base-colour texture, bevelled shared furniture geometry, desk accessories, keys, controller, lamp light and labelled screen textures. The tablet opens tablet/index.html, a separate responsive project reader using the existing portfolio content, while the PC retains LeruOS. Camera controls are locked during device transitions. A late dialog-close event cannot blank a newly opened device.

Browser verification: tablet layout rendered correctly; project navigation and contribution disclosure worked; returning to the room and opening the PC worked. The cloud browser entered the no-WebGL fallback, so the 3D materials, appearance and actual frame rate remain unverified. The simplified outdoor models are still not photorealistic.
