"""
Pack the dog sprite frames from dog_sprites.py into one atlas per dog for the 360 page.
    python3 blender/make_dog_atlases.py <sprite dir>
Writes assets/workshop-3d/dog-<name>.webp (rows = 8 headings, columns = walk frames then idle
frames), a half-size dog-<name>-half.webp for phones, dog-<name>-carry(-half).webp with the
walk-with-the-ball frames, and dogs.json with the layout. Cow sprites
from cow_sprites.py (cow-<coat>) go to cow-<coat>.webp and cows.json the same way, and chickens
(chicken_sprites.py) to chicken-<coat>.webp and chickens.json. Needs Pillow.
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'workshop-3d')
src = sys.argv[1]
import glob
groups = {'dogs': {}, 'cows': {}, 'chickens': {}}
for mp in sorted(glob.glob(os.path.join(src, '*.json'))):
    name = os.path.splitext(os.path.basename(mp))[0]
    cow = name.startswith(('cow-', 'chicken-'))
    m = json.load(open(mp))
    cols = m['walk'] + m['idle']; rows = m['headings']
    cell = Image.open(os.path.join(src, f'{name}_walk_0_0.png')).width
    atlas = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
    for h in range(rows):
        for f in range(cols):
            kind, fi = ('walk', f) if f < m['walk'] else ('idle', f - m['walk'])
            atlas.paste(Image.open(os.path.join(src, f'{name}_{kind}_{h}_{fi}.png')).convert('RGBA'), (f * cell, h * cell))
    base = name if cow else f'dog-{name}'
    atlas.save(os.path.join(OUT, f'{base}.webp'), quality=78, method=4)
    entry = dict(m, cols=cols, rows=rows, cell=cell, file=f'{base}.webp', half=f'{base}.webp')
    if not cow:
        atlas.resize((atlas.width // 2, atlas.height // 2), Image.LANCZOS).save(os.path.join(OUT, f'{base}-half.webp'), quality=78, method=4)
        entry['half'] = f'{base}-half.webp'
        if m.get('carry'):
            ca = Image.new('RGBA', (m['carry'] * cell, rows * cell), (0, 0, 0, 0))
            for h in range(rows):
                for f in range(m['carry']):
                    ca.paste(Image.open(os.path.join(src, f'{name}_carry_{h}_{f}.png')).convert('RGBA'), (f * cell, h * cell))
            ca.save(os.path.join(OUT, f'{base}-carry.webp'), quality=78, method=4)
            ca.resize((ca.width // 2, ca.height // 2), Image.LANCZOS).save(os.path.join(OUT, f'{base}-carry-half.webp'), quality=78, method=4)
            entry.update(carryFile=f'{base}-carry.webp', carryHalf=f'{base}-carry-half.webp', carryCols=m['carry'])
    groups['chickens' if name.startswith('chicken-') else 'cows' if cow else 'dogs'][name] = entry
    print(name, atlas.size, os.path.getsize(os.path.join(OUT, f'{base}.webp')) // 1024, 'KB')
for g, meta in groups.items():
    if meta: json.dump(meta, open(os.path.join(OUT, f'{g}.json'), 'w'), indent=1)
