"""
Pack the dog sprite frames from dog_sprites.py into one atlas per dog for the 360 page.
    python3 blender/make_dog_atlases.py <sprite dir>
Writes assets/workshop-3d/dog-<name>.webp (rows = 8 headings, columns = walk frames then idle
frames), a half-size dog-<name>-half.webp for phones, and dogs.json with the layout. Needs Pillow.
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'workshop-3d')
src = sys.argv[1]
meta_all = {}
for name in ('golden', 'retriever', 'terrier'):
    mp = os.path.join(src, f'{name}.json')
    if not os.path.exists(mp):
        continue
    m = json.load(open(mp))
    cols = m['walk'] + m['idle']; rows = m['headings']
    cell = Image.open(os.path.join(src, f'{name}_walk_0_0.png')).width
    atlas = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
    for h in range(rows):
        for f in range(cols):
            kind, fi = ('walk', f) if f < m['walk'] else ('idle', f - m['walk'])
            atlas.paste(Image.open(os.path.join(src, f'{name}_{kind}_{h}_{fi}.png')).convert('RGBA'), (f * cell, h * cell))
    atlas.save(os.path.join(OUT, f'dog-{name}.webp'), quality=78, method=4)
    atlas.resize((atlas.width // 2, atlas.height // 2), Image.LANCZOS).save(os.path.join(OUT, f'dog-{name}-half.webp'), quality=78, method=4)
    meta_all[name] = dict(m, cols=cols, rows=rows, cell=cell, file=f'dog-{name}.webp', half=f'dog-{name}-half.webp')
    print(name, atlas.size, os.path.getsize(os.path.join(OUT, f'dog-{name}.webp')) // 1024, 'KB')
json.dump(meta_all, open(os.path.join(OUT, 'dogs.json'), 'w'), indent=1)
