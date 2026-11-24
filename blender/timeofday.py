"""
Time-of-day lighting for the one workshop scene. The 360 page picks the set that matches the
viewer's clock (sunrise, day, sunset or night); render.py applies a preset when TIME=<name>.

Directions use the scene's convention: azimuth 0 is straight out of the front (+Y), positive to the
right (+X). +Y is taken as north, so the sun rises on the right (east), sets on the left (west)
and stands in the north (the front) at midday: the farm is in the southern hemisphere.
"""
import math
import bpy
from mathutils import Vector

PRESETS = {
    # sun low in the east, pink and gold sky, the room's lamps still on
    'sunrise': dict(sky_el=3.5, az=62.0, lamp_el=9.0, energy=4.0, color=(1.0, 0.76, 0.62), sky=0.42, sun_int=0.45,
                    clouds=((0.42, 0.36, 0.55), (1.45, 0.92, 1.0)), cover=(0.48, 0.74), night=0.0,
                    haze=(0.80, 0.74, 0.84), haze_k=1.2, exposure=-0.35, interior=0.6, windows=0.6, city=0.12,
                    bounce=(420.0, (1.0, 0.75, 0.6)), fill=1.2),
    # early afternoon: high sun a little left of the front, blue sky, white clouds, lamps off
    'day': dict(sky_el=50.0, az=-35.0, lamp_el=50.0, energy=4.2, color=(1.0, 0.96, 0.90), sky=1.0, sun_int=1.0,
                clouds=((0.62, 0.66, 0.74), (1.5, 1.5, 1.5)), cover=(0.55, 0.78), night=0.0,
                haze=(0.70, 0.78, 0.92), haze_k=1.6, exposure=-1.45, interior=0.0, windows=0.0, city=0.0,
                bounce=(520.0, (1.0, 0.95, 0.88)), fill=1.4),
    # golden hour (the original look, matched to the approved photo)
    'sunset': dict(sky_el=2.0, az=-28.0, lamp_el=14.0, energy=9.0, color=(1.0, 0.62, 0.34), sky=0.3, sun_int=0.7,
                   clouds=((0.60, 0.26, 0.20), (1.8, 0.80, 0.38)), cover=(0.46, 0.70), night=0.0,
                   haze=(0.95, 0.62, 0.42), haze_k=1.0, exposure=-0.3, interior=0.6, windows=0.8, city=0.25,
                   bounce=(900.0, (1.0, 0.72, 0.48)), fill=1.0),
    # night: moonlight, stars, every lamp in the room on, the farmhouse and the city lit
    'night': dict(sky_el=-12.0, az=35.0, lamp_el=38.0, energy=0.06, color=(0.55, 0.65, 1.0), sky=0.3, sun_int=0.0,
                  clouds=((0.01, 0.012, 0.02), (0.03, 0.035, 0.05)), cover=(0.5, 0.72), night=1.0,
                  haze=(0.03, 0.04, 0.07), haze_k=0.3, exposure=0.2, interior=1.0, windows=1.5, city=1.0,
                  bounce=(0.0, (1, 1, 1)), fill=0.5),
}
# lamps that count as the room's (or the farm's) lights
LAMPS = ('Lamp light', 'Hanging lamp light', 'Garage light')


def _dir(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))


def _scale_light(o, k):
    if 'base_energy' not in o: o['base_energy'] = o.data.energy
    o.data.energy = o['base_energy'] * k
    o.hide_render = k <= 0.0


def _glow(m, k):
    for n in m.node_tree.nodes:
        if n.name == 'Glow':
            if 'base_strength' not in n: n['base_strength'] = n.inputs['Strength'].default_value
            n.inputs['Strength'].default_value = n['base_strength'] * k


def apply(name):
    p = PRESETS[name]
    s = bpy.context.scene
    s.view_settings.exposure = p['exposure']
    nt = s.world.node_tree; N = nt.nodes
    sky = N['Sky']
    sky.sun_elevation = math.radians(max(p['sky_el'], -5.0)); sky.sun_rotation = math.radians(p['az'])
    if hasattr(sky, 'sun_intensity'): sky.sun_intensity = p['sun_int']
    N['SkyBG'].inputs['Strength'].default_value = p['sky']
    tone = N['CloudTone'].color_ramp.elements
    tone[0].color = (*p['clouds'][0], 1); tone[1].color = (*p['clouds'][1], 1)
    N['CloudCover'].inputs['From Min'].default_value, N['CloudCover'].inputs['From Max'].default_value = p['cover']
    N['NightMix'].inputs['Fac'].default_value = p['night']
    # sun (or moon) lamp
    sun = bpy.data.objects['Sun']
    d = _dir(p['az'], p['lamp_el'])
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sun.data.energy = p['energy']; sun.data.color = p['color']
    sun.data.angle = math.radians(0.5 if p['night'] else 0.8)
    moon = bpy.data.objects.get('Moon')
    if moon:
        moon.hide_render = not p['night']
        moon.location = _dir(p['az'], p['lamp_el']) * 30000.0
    # aerial haze on the ground, mountains and city
    for m in bpy.data.materials:
        if not m.use_nodes or m.node_tree is None: continue
        for n in m.node_tree.nodes:
            if n.name == 'Haze':
                if 'base_strength' not in n: n['base_strength'] = n.inputs['Strength'].default_value
                n.inputs['Strength'].default_value = n['base_strength'] * p['haze_k']
                n.inputs['Color'].default_value = (*p['haze'], 1)
            elif n.name == 'City lights level':
                n.inputs[1].default_value = 1.2 * p['city']
        if m.name.startswith('Int ') and m.name not in ('Int OLED', 'Int LED red', 'Int LED blue'):
            _glow(m, p['interior'])
        elif m.name.startswith(('Warm bulb', 'LED batten')):
            _glow(m, max(p['interior'], 0.0))
        elif m.name.startswith('Lit window'):
            _glow(m, p['windows'])
        elif m.name.startswith('City beacon'):
            for n in m.node_tree.nodes:
                if n.name == 'Glow': n.inputs['Strength'].default_value = 40.0 * p['city']
    # lights
    for o in bpy.data.objects:
        if o.type != 'LIGHT': continue
        if o.name.startswith('Int ') and not o.name.startswith('Int magnifier'):
            _scale_light(o, p['interior'])
        elif o.name.startswith('Int magnifier'):
            _scale_light(o, max(0.3, p['interior']))
        elif o.name.startswith(LAMPS):
            _scale_light(o, p['interior'])
        elif o.name.startswith('Front bounce'):
            if 'base_energy' not in o: o['base_energy'] = o.data.energy
            o.data.energy = p['bounce'][0]; o.data.color = p['bounce'][1]; o.hide_render = p['bounce'][0] <= 0
        elif o.name.startswith('Interior fill'):
            _scale_light(o, p['fill'])
    print('time of day:', name)
