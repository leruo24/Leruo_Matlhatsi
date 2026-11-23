"""Procedural Cycles materials for the workshop: no photo textures, so nothing stretches or repeats."""
import math
import bpy


def _new(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf


def _set(bsdf, **kw):
    names = {'color': 'Base Color', 'rough': 'Roughness', 'metal': 'Metallic', 'spec': 'Specular IOR Level',
             'coat': 'Coat Weight', 'coat_rough': 'Coat Roughness', 'trans': 'Transmission Weight', 'ior': 'IOR',
             'emit': 'Emission Color', 'emit_str': 'Emission Strength', 'alpha': 'Alpha', 'sheen': 'Sheen Weight'}
    for k, v in kw.items():
        sock = bsdf.inputs.get(names[k])
        if sock is not None:
            sock.default_value = (*v, 1.0) if isinstance(v, tuple) and len(v) == 3 else v


def plain(name, color, rough=0.5, metal=0.0, **kw):
    m, nt, b = _new(name); _set(b, color=color, rough=rough, metal=metal, **kw); return m


def _ramp(nt, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos); e.color = (*col, 1)
    return r


def _coords(nt, scale=1.0, kind='Object'):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs[kind], mp.inputs['Vector'])
    return mp


def _bump(nt, bsdf, height_socket, strength=0.15, distance=0.01):
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = distance
    nt.links.new(height_socket, bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])


def wood(name, light, dark, scale=3.0, rough=0.55, stretch=(1, 1, 12), coat=0.0):
    """Straight-grained timber: long fine streaks along the board (local Z by default, or the axis
    given by stretch), soft colour variation between boards, no ring or zigzag patterns."""
    m, nt, b = _new(name)
    mp = _coords(nt); mp.inputs['Scale'].default_value = (scale * 6 / stretch[0], scale * 6 / stretch[1], scale * 6 / stretch[2])
    streak = nt.nodes.new('ShaderNodeTexNoise'); streak.inputs['Scale'].default_value = 4.0; streak.inputs['Detail'].default_value = 12; streak.inputs['Roughness'].default_value = 0.7
    nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
    mp2 = _coords(nt); mp2.inputs['Scale'].default_value = (scale * 0.6, scale * 0.6, scale * 0.6)
    tone = nt.nodes.new('ShaderNodeTexNoise'); tone.inputs['Scale'].default_value = 1.5; tone.inputs['Detail'].default_value = 2
    nt.links.new(mp2.outputs['Vector'], tone.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'; mix.inputs[1].default_value = 0.6
    nt.links.new(streak.outputs['Fac'], mix.inputs[0]); nt.links.new(tone.outputs['Fac'], mix.inputs[2])
    mid = tuple((a + c) / 2 for a, c in zip(light, dark))
    ramp = _ramp(nt, [(0.45, dark), (0.65, mid), (0.85, light)])
    nt.links.new(mix.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _set(b, rough=rough, coat=coat, coat_rough=0.25)
    _bump(nt, b, streak.outputs['Fac'], 0.05, 0.002)
    return m


def concrete(name, base=(0.46, 0.36, 0.27), var=0.14, rough=0.38):
    """Polished-ish workshop concrete: soft blotches, fine aggregate, gentle sheen like the photo's floor."""
    m, nt, b = _new(name)
    mp = _coords(nt, 1.0)
    big = nt.nodes.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 0.6; big.inputs['Detail'].default_value = 6
    fine = nt.nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 90; fine.inputs['Detail'].default_value = 2
    for n in (big, fine): nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    dark = tuple(c * (1 - var) for c in base); light = tuple(min(1, c * (1 + var)) for c in base)
    ramp = _ramp(nt, [(0.3, dark), (0.7, light)])
    nt.links.new(big.outputs['Fac'], ramp.inputs['Fac'])
    mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'; mixc.inputs['Factor'].default_value = 0.25
    nt.links.new(ramp.outputs['Color'], mixc.inputs['A']); nt.links.new(fine.outputs['Color'], mixc.inputs['B'])
    nt.links.new(mixc.outputs['Result'], b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough - 0.12; rr.inputs['To Max'].default_value = rough + 0.15
    nt.links.new(big.outputs['Fac'], rr.inputs['Value']); nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    _bump(nt, b, fine.outputs['Fac'], 0.05, 0.002)
    return m


def gravel(name):
    """Irregular stones with earth between them (Voronoi cells, varied colour, bumped)."""
    m, nt, b = _new(name)
    mp = _coords(nt, 1.0, 'Generated' if False else 'Object')
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 38; vor.inputs['Randomness'].default_value = 1.0
    vor2 = nt.nodes.new('ShaderNodeTexVoronoi'); vor2.inputs['Scale'].default_value = 38; vor2.feature = 'DISTANCE_TO_EDGE'
    patch = nt.nodes.new('ShaderNodeTexNoise'); patch.inputs['Scale'].default_value = 0.35; patch.inputs['Detail'].default_value = 5
    for n in (vor, vor2, patch): nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    stones = _ramp(nt, [(0.0, (0.38, 0.30, 0.22)), (0.5, (0.62, 0.52, 0.40)), (1.0, (0.80, 0.72, 0.60))])
    nt.links.new(vor.outputs['Color'], stones.inputs['Fac'])
    earth = (0.45, 0.33, 0.21)
    edge = nt.nodes.new('ShaderNodeMapRange'); edge.inputs['From Max'].default_value = 0.12
    nt.links.new(vor2.outputs['Distance'], edge.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['B'].default_value = (*earth, 1)
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(edge.outputs['Result'], inv.inputs[1]); nt.links.new(inv.outputs['Value'], mix.inputs['Factor'])
    nt.links.new(stones.outputs['Color'], mix.inputs['A'])
    # patches of bare earth and tyre wear
    mix2 = nt.nodes.new('ShaderNodeMix'); mix2.data_type = 'RGBA'; mix2.inputs['B'].default_value = (0.40, 0.30, 0.20, 1)
    pm = nt.nodes.new('ShaderNodeMapRange'); pm.inputs['From Min'].default_value = 0.55; pm.inputs['From Max'].default_value = 0.7
    nt.links.new(patch.outputs['Fac'], pm.inputs['Value']); nt.links.new(pm.outputs['Result'], mix2.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], mix2.inputs['A'])
    nt.links.new(mix2.outputs['Result'], b.inputs['Base Color'])
    _set(b, rough=0.85)
    _bump(nt, b, edge.outputs['Result'], 0.6, 0.02)
    return m


def grass(name, near=True):
    """Dry golden-green grass ground colour (blade geometry is added separately close up)."""
    m, nt, b = _new(name)
    mp = _coords(nt, 1.0)
    n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 0.15; n1.inputs['Detail'].default_value = 6
    n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 25; n2.inputs['Detail'].default_value = 4
    for n in (n1, n2): nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    r = _ramp(nt, [(0.35, (0.14, 0.17, 0.04)), (0.55, (0.30, 0.27, 0.07)), (0.75, (0.45, 0.33, 0.10))])
    nt.links.new(n1.outputs['Fac'], r.inputs['Fac'])
    mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'; mixc.inputs['Factor'].default_value = 0.35
    nt.links.new(r.outputs['Color'], mixc.inputs['A']); nt.links.new(n2.outputs['Color'], mixc.inputs['B'])
    nt.links.new(mixc.outputs['Result'], b.inputs['Base Color'])
    _set(b, rough=0.9, sheen=0.3)
    _bump(nt, b, n2.outputs['Fac'], 0.3, 0.02)
    return m


def water(name):
    m, nt, b = _new(name)
    mp = _coords(nt, 1.0)
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 3.0; n.inputs['Detail'].default_value = 4
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    _set(b, color=(0.05, 0.07, 0.06), rough=0.03, ior=1.33, spec=0.6)
    _bump(nt, b, n.outputs['Fac'], 0.06, 0.01)
    return m


def terrain(name):
    m, nt, b = _new(name)
    mp = _coords(nt, 1.0)
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.02; n.inputs['Detail'].default_value = 8
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    r = _ramp(nt, [(0.35, (0.16, 0.16, 0.07)), (0.55, (0.30, 0.27, 0.12)), (0.7, (0.42, 0.34, 0.18))])
    nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    _set(b, rough=0.95)
    return m


def mountain(name):
    """Rock and scrub, coloured by slope (via geometry normal) and noise."""
    m, nt, b = _new(name)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs['Vector'])
    mp = _coords(nt, 1.0)
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.004; n.inputs['Detail'].default_value = 10
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    slope = nt.nodes.new('ShaderNodeMapRange'); slope.inputs['From Min'].default_value = 0.65; slope.inputs['From Max'].default_value = 0.9
    nt.links.new(sep.outputs['Z'], slope.inputs['Value'])
    rock = _ramp(nt, [(0.3, (0.22, 0.19, 0.17)), (0.7, (0.38, 0.33, 0.28))]); nt.links.new(n.outputs['Fac'], rock.inputs['Fac'])
    scrub = _ramp(nt, [(0.3, (0.15, 0.15, 0.07)), (0.7, (0.30, 0.27, 0.13))]); nt.links.new(n.outputs['Fac'], scrub.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(slope.outputs['Result'], mix.inputs['Factor']); nt.links.new(rock.outputs['Color'], mix.inputs['A']); nt.links.new(scrub.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    _set(b, rough=0.95)
    return m


def add_haze(m, color=(0.86, 0.70, 0.60), distance=5000.0, strength=0.11):
    """Aerial perspective: blend toward a sunlit haze with distance from the camera."""
    nt = m.node_tree; out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    surf = out.inputs['Surface'].links[0].from_socket
    lp = nt.nodes.new('ShaderNodeLightPath')
    div = nt.nodes.new('ShaderNodeMath'); div.operation = 'DIVIDE'; div.inputs[1].default_value = -distance
    ex = nt.nodes.new('ShaderNodeMath'); ex.operation = 'EXPONENT'
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(lp.outputs['Ray Length'], div.inputs[0]); nt.links.new(div.outputs['Value'], ex.inputs[0]); nt.links.new(ex.outputs['Value'], inv.inputs[1])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*color, 1); em.inputs['Strength'].default_value = strength
    em.name = 'Haze'; em['base_strength'] = strength
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(inv.outputs['Value'], mix.inputs['Fac']); nt.links.new(surf, mix.inputs[1]); nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def corrugated(name, color, along='xy', pitch=0.076, rough=0.42, metal=0.75):
    """Corrugated sheeting: a sine profile in the bump, ribs running vertically on walls (along='xy')
    or down the slope of a gable roof (along='y')."""
    m, nt, b = _new(name); _set(b, color=color, rough=rough, metal=metal)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    if along == 'xy':
        add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
        nt.links.new(sep.outputs['X'], add.inputs[0]); nt.links.new(sep.outputs['Y'], add.inputs[1]); src = add.outputs[0]
    else:
        src = sep.outputs['Y']
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 2 * math.pi / pitch
    nt.links.new(src, mul.inputs[0])
    sn = nt.nodes.new('ShaderNodeMath'); sn.operation = 'SINE'; nt.links.new(mul.outputs[0], sn.inputs[0])
    _bump(nt, b, sn.outputs[0], strength=0.6, distance=0.01)
    # light weathering streaks
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 3.0; n.inputs['Detail'].default_value = 8
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (6.0, 6.0, 0.4)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*color, 1)
    mx.inputs['B'].default_value = (color[0] * 0.75, color[1] * 0.73, color[2] * 0.7, 1)
    nt.links.new(n.outputs['Fac'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    return m


def thin_glass(name):
    """Architectural glass as a thin sheet: see-through (light and shadows pass), with a Fresnel
    reflection and a faint green tint. No refraction, so a single pane doesn't distort or add noise."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.93, 0.97, 0.95, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.02
    fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.52
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(fr.outputs[0], mx.inputs['Fac']); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = strength
    e.name = 'Glow'; e['base_strength'] = strength
    nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    return m


def image(name, path, rough=0.5, alpha=True):
    """A supplied artwork (e.g. a cap emblem) as a decal; transparent where the PNG is."""
    m, nt, b = _new(name)
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(path)
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    _set(b, rough=rough)
    return m


def all_materials():
    return {
        'concrete': concrete('Concrete floor', base=(0.50, 0.48, 0.45), var=0.08, rough=0.3),
        'concrete_out': concrete('Concrete apron', base=(0.47, 0.42, 0.36), rough=0.6),
        'boards': wood('Wall boards (painted)', (0.80, 0.79, 0.75), (0.72, 0.71, 0.67), scale=2.0, rough=0.62),
        'beam': wood('Oak beams', (0.44, 0.31, 0.19), (0.25, 0.16, 0.09), scale=2.0),
        'ceiling': wood('Ceiling boards (limed)', (0.80, 0.75, 0.66), (0.66, 0.59, 0.49), scale=2.0, rough=0.6),
        'desk': wood('Desk timber', (0.42, 0.21, 0.08), (0.15, 0.07, 0.025), scale=3.0, rough=0.45, coat=0.25, stretch=(12, 1, 1)),
        'bench': wood('Bench timber', (0.50, 0.27, 0.12), (0.22, 0.11, 0.04), scale=3.0, rough=0.45, coat=0.2, stretch=(12, 1, 1)),
        'steel_black': plain('Black steel', (0.02, 0.02, 0.02), rough=0.4, metal=0.9),
        'steel': plain('Steel', (0.6, 0.6, 0.62), rough=0.3, metal=1.0),
        'alu': plain('Aluminium', (0.75, 0.75, 0.77), rough=0.25, metal=1.0),
        'plastic_black': plain('Black plastic', (0.015, 0.015, 0.015), rough=0.45),
        'plastic_white': plain('White plastic', (0.82, 0.82, 0.80), rough=0.35),
        'leather': plain('Black leather', (0.012, 0.012, 0.012), rough=0.38, coat=0.3, coat_rough=0.3),
        'rubber': plain('Rubber', (0.02, 0.02, 0.02), rough=0.8),
        'screen': plain('Screen glass', (0.002, 0.0025, 0.003), rough=0.3, spec=0.15),
        'ceramic': plain('White ceramic', (0.85, 0.83, 0.80), rough=0.2),
        'stanley': plain('Stanley green', (0.12, 0.25, 0.14), rough=0.35, metal=0.6),
        'leaf': plain('Leaves', (0.08, 0.20, 0.05), rough=0.5, sheen=0.3),
        'soil': plain('Soil', (0.10, 0.07, 0.05), rough=0.9),
        'wallet': plain('Brown leather', (0.25, 0.12, 0.05), rough=0.45),
        'whiteboard': plain('Whiteboard', (0.88, 0.89, 0.88), rough=0.12, coat=0.6),
        'note': plain('Sticky note', (0.95, 0.80, 0.10), rough=0.6),
        'marker': plain('Faint marker', (0.25, 0.35, 0.55), rough=0.3),
        'yellow': plain('Tool yellow', (0.85, 0.62, 0.02), rough=0.4),
        'pcb': plain('PCB green', (0.03, 0.18, 0.10), rough=0.4),
        'mat': plain('ESD mat', (0.03, 0.035, 0.035), rough=0.75),
        'copper': plain('Copper', (0.80, 0.42, 0.25), rough=0.3, metal=1.0),
        'wire_red': plain('Red wire', (0.55, 0.03, 0.02), rough=0.4),
        'wire_black': plain('Black wire', (0.02, 0.02, 0.02), rough=0.4),
        'clear': plain('Clear plastic', (0.9, 0.9, 0.9), rough=0.08, trans=0.9, ior=1.45),
        'glass': plain('Glass', (0.9, 0.95, 0.95), rough=0.0, trans=1.0, ior=1.5),
        'thin_glass': thin_glass('Window glass (thin)'),
        'alu_dark': plain('Dark aluminium', (0.3, 0.3, 0.32), rough=0.35, metal=1.0),
        'bezel_gloss': plain('Gloss black bezel', (0.01, 0.01, 0.012), rough=0.08, coat=1.0),
        'folio': plain('Folio cover', (0.06, 0.055, 0.05), rough=0.7),
        'bulb': emission('Warm bulb', (1.0, 0.75, 0.45), 30.0),
        'teal': plain('Board graphic teal', (0.05, 0.35, 0.33), rough=0.4),
        'cap_black': plain('Cap fabric', (0.02, 0.02, 0.025), rough=0.85, sheen=0.5),
        'gravel': __import__('assets').ground_gravel(gravel('Gravel')),
        'grass': add_haze(__import__('assets').ground_grass('Grass'), distance=1800.0),
        'water': water('Pond water'),
        'terrain': add_haze(terrain('Terrain'), distance=2500.0),
        'mountain': add_haze(mountain('Mountains'), color=(0.62, 0.52, 0.55), distance=16000.0),
        'corrugated': corrugated('Roof sheeting', (0.35, 0.36, 0.37), along='y'),
    }
