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
