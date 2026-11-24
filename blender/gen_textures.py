"""
Small generated textures for the ESP32 bench (system Python + Pillow, run once):
    python3 blender/gen_textures.py   -> blender/assets/gen/*.png
A folded label card, the OLED's readout and a hand-drawn style DevKit pinout card. Plain text and
shapes only: no logos or brand marks.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'gen')
os.makedirs(OUT, exist_ok=True)
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
font = lambda p, s: ImageFont.truetype(p, s)

# folded tent card on the bench
im = Image.new('RGB', (1024, 400), (238, 234, 222)); d = ImageDraw.Draw(im)
d.rectangle((24, 24, 1000, 376), outline=(40, 40, 40), width=6)
d.text((512, 150), 'ESP32', font=font(SANS, 150), fill=(25, 25, 25), anchor='mm')
d.text((512, 290), 'soil + climate node', font=font(SANS, 64), fill=(60, 110, 60), anchor='mm')
im.save(os.path.join(OUT, 'esp32_card.png'))

# 128x64 OLED readout, drawn at 4x
im = Image.new('RGB', (512, 256), (0, 0, 0)); d = ImageDraw.Draw(im)
c = (150, 210, 255)
d.text((16, 10), 'SOIL  42%', font=font(MONO, 64), fill=c)
d.text((16, 92), 'T 24.1C H 51%', font=font(MONO, 50), fill=c)
for i, h in enumerate((20, 34, 28, 46, 40, 58, 52, 64, 60, 70, 66, 72)):
    d.rectangle((20 + i * 40, 250 - h, 46 + i * 40, 250), fill=c)
im.save(os.path.join(OUT, 'oled.png'))

# DevKit pinout card (clipboard on the bench)
W, H = 768, 1024
im = Image.new('RGB', (W, H), (246, 244, 238)); d = ImageDraw.Draw(im)
d.text((W / 2, 70), 'ESP32 DevKit', font=font(SANS, 64), fill=(20, 20, 20), anchor='mm')
d.text((W / 2, 130), 'pinout', font=font(SANS, 40), fill=(90, 90, 90), anchor='mm')
bx0, by0, bx1, by1 = 264, 200, 504, 940
d.rounded_rectangle((bx0, by0, bx1, by1), 18, fill=(28, 28, 30))
d.rectangle((bx0 + 40, by0 + 30, bx1 - 40, by0 + 300), fill=(180, 182, 186))      # shielded module
d.rectangle((bx0 + 40, by0 + 30, bx1 - 40, by0 + 90), fill=(30, 80, 50))         # antenna strip
d.rectangle((bx0 + 95, by1 - 60, bx1 - 95, by1), fill=(170, 170, 175))           # USB port
left = ['3V3', 'EN', 'VP 36', 'VN 39', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13']
right = ['GND', '23', '22', 'TX 1', 'RX 3', '21', 'GND', '19', '18', '5', '17', '16', '4', '0', '2']
fs = font(SANS, 22)
for i, (a, b) in enumerate(zip(left, right)):
    y = by0 + 325 + i * 27
    for x, lab, side in ((bx0, a, -1), (bx1, b, 1)):
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(212, 175, 55))
        col = (190, 40, 40) if lab in ('3V3',) else (30, 30, 30) if 'GND' in lab else (40, 90, 160)
        d.text((x + side * 22, y), lab, font=fs, fill=col, anchor='rm' if side < 0 else 'lm')
d.text((W / 2, 985), 'soil probe -> 34   DHT22 -> 4   relay -> 26', font=font(SANS, 24), fill=(60, 110, 60), anchor='mm')
im.save(os.path.join(OUT, 'pinout.png'))
print('wrote', os.listdir(OUT))

# longboard bottoms (u across the deck, v along it): plain shapes, no text or brand marks
import random as _r
def _grain(w, h, base, dark, seed):
    rnd = _r.Random(seed); im = Image.new('RGB', (w, h), base); d = ImageDraw.Draw(im)
    for k in range(140):
        x = rnd.uniform(0, w); c = tuple(int(b + (dk - b) * rnd.uniform(0.2, 0.7)) for b, dk in zip(base, dark))
        pts = [(x + 6 * __import__('math').sin(y / rnd.uniform(60, 140) + k), y) for y in range(0, h + 8, 8)]
        d.line(pts, fill=c, width=rnd.choice((1, 1, 2)))
    return im, d
W, H = 256, 1024
im, d = _grain(W, H, (92, 58, 34), (52, 30, 16), 3)                       # stained pintail
for k, (c, off) in enumerate((((24, 120, 112), 0), ((235, 232, 220), 46), ((24, 120, 112), 92))):
    d.polygon([(0, 380 + off), (W, 300 + off), (W, 330 + off), (0, 410 + off)], fill=c)
im.save(os.path.join(OUT, 'board_pintail.png'))
im, d = _grain(W, H, (206, 170, 120), (160, 122, 78), 7)                  # maple drop-through
for r in range(110, 0, -2):                                               # sunset disc
    t = r / 110; d.ellipse((W / 2 - r, 560 - r, W / 2 + r, 560 + r), fill=(int(240 - 40 * t), int(150 - 70 * t), int(70 - 20 * t)))
d.polygon([(0, 640), (50, 560), (95, 610), (140, 530), (190, 600), (W, 570), (W, 700), (0, 700)], fill=(38, 48, 40))
d.rectangle((0, 700, W, 712), fill=(38, 48, 40))
for y in (240, 252, 780, 792):
    d.rectangle((24, y, W - 24, y + 4), fill=(40, 40, 40))
im.save(os.path.join(OUT, 'board_drop.png'))
print('boards done')
