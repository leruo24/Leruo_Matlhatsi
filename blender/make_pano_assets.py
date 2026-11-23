"""
Turn the rendered 360 strips into the files the look-around page loads.
    TIME=day python3 blender/make_pano_assets.py blender/renders/day_{0..15}.png
Writes assets/workshop-3d/<TIME>/: pano-8k-0..3.jpg (2048x4096 quarters of the 8192x4096 panorama),
pano-4k-0..1.jpg (2048x2048 halves of a 4096x2048 copy, for phones) and pano-2k.jpg (2048x1024,
shown first and used as the still fallback). Needs Pillow.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'workshop-3d', os.environ.get('TIME', ''))
strips = [Image.open(p).convert('RGB') for p in sys.argv[1:]]   # top strip first
W = strips[0].width
H = sum(s.height for s in strips)
assert H == W // 2, (W, H)
pano = Image.new('RGB', (W, H)); y = 0
for s in strips:
    pano.paste(s, (0, y)); y += s.height
os.makedirs(OUT, exist_ok=True)
q = dict(quality=84, optimize=True, progressive=True, subsampling='4:2:0')
for i in range(4):
    pano.crop((i * W // 4, 0, (i + 1) * W // 4, H)).save(os.path.join(OUT, f'pano-8k-{i}.jpg'), **q)
mid = pano.resize((4096, 2048), Image.LANCZOS)
for i in range(2):
    mid.crop((i * 2048, 0, (i + 1) * 2048, 2048)).save(os.path.join(OUT, f'pano-4k-{i}.jpg'), **q)
pano.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, 'pano-2k.jpg'), **q)
for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
