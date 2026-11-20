"""
Builds the workshop as one Blender scene, so every view (the photo-matched front view and the
360-degree panorama) comes from the same geometry, materials and light.

Run with Blender's Python module (bpy 5.x):
    python blender/build_scene.py            -> writes blender/workshop.blend

Units are metres. Axes: X right, Y forward (out through the open front), Z up.
The eye is where the approved photo was taken: (0, 0, 1.6), looking along +Y. Layout follows
the photo's arrangement; sizes follow real-world dimensions where the photo exaggerates.
"""
import math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import materials as M  # noqa: E402
import props as P      # noqa: E402
import nature as N     # noqa: E402
import vehicles as V   # noqa: E402
import animals as A    # noqa: E402
import assets as AS    # noqa: E402

EYE = Vector((0.0, 0.0, 1.6))
# the approved photo's camera: 1670 x 942 px, focal length 1000 px, horizon at row 367
PHOTO_W, PHOTO_H, PHOTO_F, PHOTO_YH = 1670, 942, 1000, 367


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    s.view_settings.exposure = -0.4
    return s


def cameras(scene):
    # photo-matched camera (for side-by-side checks with the approved image)
    cam = bpy.data.cameras.new('PhotoCam')
    cam.sensor_fit = 'HORIZONTAL'; cam.sensor_width = 36.0
    cam.lens = 36.0 * PHOTO_F / PHOTO_W
    cam.shift_y = -((PHOTO_H / 2) - PHOTO_YH) / PHOTO_W
    cam.clip_start = 0.05; cam.clip_end = 60000
    o = bpy.data.objects.new('PhotoCam', cam); o.location = EYE; o.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(o)
    # 360 camera at the same eye
    pano = bpy.data.cameras.new('PanoCam')
    pano.type = 'PANO'
    pano.panorama_type = 'EQUIRECTANGULAR'
    pano.clip_start = 0.05; pano.clip_end = 60000
    p = bpy.data.objects.new('PanoCam', pano); p.location = EYE; p.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(p)
    scene.camera = o
    return o, p


def world_light(scene):
    """Low late-afternoon sun from the front left, as in the photo (sun at photo px 300, 196)."""
    az = math.atan2((300 - 835) / PHOTO_F, 1.0)             # -28 deg: left of straight ahead
    el = math.atan((PHOTO_YH - 196) / PHOTO_F)               # ~9.7 deg above the horizon
    w = bpy.data.worlds.new('World'); scene.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'SINGLE_SCATTERING', 'HOSEK_WILKIE'):
        try:
            sky.sky_type = t; break
        except TypeError:
            continue
    # Blender's sky: rotation 0 puts the sun along +Y; positive rotation turns it to the left (-X)
    # the sky's sun sits a little lower than the shadow-casting lamp: at 9.7 deg Blender's physical
    # sky is still pale; the photo's sky has the colour of a sun only a few degrees up
    for attr, val in (('sun_elevation', math.radians(4.0)), ('sun_rotation', az), ('altitude', 1500.0), ('air_density', 1.4), ('aerosol_density', 2.2), ('ozone_density', 1.0)):
        if hasattr(sky, attr):
            setattr(sky, attr, val)
    if hasattr(sky, 'sun_intensity'): sky.sun_intensity = 0.6
    bg.inputs['Strength'].default_value = 0.3
    # a band of warm, sunlit clouds low in the sky (procedural, never a repeated image)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    band = nt.nodes.new('ShaderNodeMapRange'); band.inputs['From Min'].default_value = 0.02; band.inputs['From Max'].default_value = 0.12
    nt.links.new(sep.outputs['Z'], band.inputs['Value'])
    fade = nt.nodes.new('ShaderNodeMapRange'); fade.inputs['From Min'].default_value = 0.45; fade.inputs['From Max'].default_value = 0.2
    nt.links.new(sep.outputs['Z'], fade.inputs['Value'])
    sc = nt.nodes.new('ShaderNodeMapping'); sc.inputs['Scale'].default_value = (1.0, 1.0, 5.0)
    nt.links.new(tc.outputs['Generated'], sc.inputs['Vector'])
    cl = nt.nodes.new('ShaderNodeTexNoise'); cl.inputs['Scale'].default_value = 3.5; cl.inputs['Detail'].default_value = 9; cl.inputs['Roughness'].default_value = 0.62
    nt.links.new(sc.outputs['Vector'], cl.inputs['Vector'])
    cov = nt.nodes.new('ShaderNodeMapRange'); cov.inputs['From Min'].default_value = 0.5; cov.inputs['From Max'].default_value = 0.72
    nt.links.new(cl.outputs['Fac'], cov.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; nt.links.new(cov.outputs['Result'], m1.inputs[0]); nt.links.new(band.outputs['Result'], m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; nt.links.new(m1.outputs['Value'], m2.inputs[0]); nt.links.new(fade.outputs['Result'], m2.inputs[1])
    tone = nt.nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (0.55, 0.30, 0.30, 1); tone.color_ramp.elements[1].color = (1.6, 0.85, 0.5, 1)
    nt.links.new(cl.outputs['Fac'], tone.inputs['Fac'])
    mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
    nt.links.new(m2.outputs['Value'], mixc.inputs['Factor']); nt.links.new(sky.outputs['Color'], mixc.inputs['A']); nt.links.new(tone.outputs['Color'], mixc.inputs['B'])
    nt.links.new(mixc.outputs['Result'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    # a sun lamp carries the crisp shadows
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 8.0; sun.angle = math.radians(0.8)
    sun.color = (1.0, 0.78, 0.55)
    so = bpy.data.objects.new('Sun', sun)
    # the shadow-casting lamp sits higher than the visible sun (16 vs 9.7 deg): at the true angle every
    # tree throws a 50 m shadow and the yard, sunlit in the photo, would be in shade
    el_lamp = math.radians(16.0)
    d = Vector((math.sin(az) * math.cos(el_lamp), math.cos(az) * math.cos(el_lamp), math.sin(el_lamp)))  # direction to the sun
    so.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(so)
    return d


def build():
    scene = reset()
    cameras(scene)
    sun_dir = world_light(scene)
    mats = M.all_materials()
    P.workshop_shell(mats)
    P.desk_setup(mats)
    P.esp32_bench(mats)
    P.wall_items(mats)
    AS.furnish(P.ROOM, bpy.data.objects['Desk'])
    P.outdoors(mats, sun_dir)
    extra = N.extra_materials()
    N.trees(mats)
    AS.grass_blades()
    N.buildings(mats, extra)
    N.skyline(mats, extra)
    V.vehicles(mats)
    A.animals()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'workshop.blend'))
    print('saved', os.path.join(HERE, 'workshop.blend'))


if __name__ == '__main__':
    build()
