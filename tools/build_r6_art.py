"""R6 Art Asset Builder
Builds:
- Miso soup icons (miso_yes, miso_no)
- Portion icons (portion_half, portion_full)
- Finale scenes (success_clinic_meal, failure_table_flip)
- Finale doctor comic reactions (splashed & bump for speed, heat, strategy)
"""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SERVICE_OUT = ROOT / 'assets/service'
FINALE_OUT = ROOT / 'assets/finale'
R6_ART_DIR = ROOT / 'assets/art_direction/r6'

SERVICE_OUT.mkdir(parents=True, exist_ok=True)
FINALE_OUT.mkdir(parents=True, exist_ok=True)
R6_ART_DIR.mkdir(parents=True, exist_ok=True)

S = 3

def save_webp(path, im):
    im.save(path, 'WEBP', quality=96, method=6, exact=True)
    with Image.open(path) as check:
        check.load()
        assert check.size == im.size and check.mode == 'RGBA'

def draw_miso_bowl(im, has_soup=True):
    d = ImageDraw.Draw(im)
    # Shadow
    d.ellipse((30*S, 86*S, 114*S, 108*S), fill='#1b2a3328')
    # Lacquer wood bowl (black/dark red lacquer exterior, vermilion interior)
    # Bowl body
    d.pieslice((28*S, 36*S, 116*S, 102*S), 0, 180, fill='#221715', outline='#381f1a', width=2*S)
    # Bowl base foot
    d.rounded_rectangle((52*S, 98*S, 92*S, 108*S), 3*S, fill='#1b1210', outline='#381f1a', width=2*S)
    # Bowl rim inner
    d.ellipse((28*S, 34*S, 116*S, 66*S), fill='#451512', outline='#2b0e0c', width=2*S)
    
    if has_soup:
        # Miso broth surface (golden umami dashi brown with slight cloudiness)
        d.ellipse((32*S, 37*S, 112*S, 63*S), fill='#b87635')
        # Dashi swirl
        d.ellipse((36*S, 40*S, 108*S, 60*S), fill='#c98744')
        # Tofu cubes floating
        for tx, ty in [(50, 45), (72, 48), (88, 43)]:
            d.rectangle(((tx-4)*S, (ty-3)*S, (tx+4)*S, (ty+3)*S), fill='#f8f5ea', outline='#dfd6bf', width=1*S)
        # Scallion rings floating
        for sx, sy in [(60, 42), (80, 52), (45, 51), (98, 49)]:
            d.ellipse(((sx-3)*S, (sy-2)*S, (sx+3)*S, (sy+2)*S), fill='#52994e', outline='#2b5e28', width=1*S)
        # Steam wisps
        for i, (wx, wy) in enumerate([(58, 26), (72, 21), (86, 25)]):
            d.arc(((wx-8)*S, (wy-12)*S, (wx+8)*S, (wy+12)*S), 200, 340, fill='#ffffffaa', width=2*S)
    else:
        # Empty bowl inner shadow
        d.ellipse((32*S, 37*S, 112*S, 63*S), fill='#30110e')
        # Cross (no miso)
        d.ellipse((88*S, 64*S, 134*S, 110*S), fill='#c84a40', outline='#fff6e5', width=3*S)
        d.line([(99*S, 75*S), (123*S, 99*S)], fill='white', width=5*S)
        d.line([(123*S, 75*S), (99*S, 99*S)], fill='white', width=5*S)

def build_miso_icons():
    for yes in (True, False):
        im = Image.new('RGBA', (144*S, 120*S))
        draw_miso_bowl(im, has_soup=yes)
        res = im.resize((144, 120), Image.Resampling.LANCZOS)
        name = 'miso_yes.webp' if yes else 'miso_no.webp'
        save_webp(SERVICE_OUT / name, res)

def build_portion_icons():
    for half in (True, False):
        im = Image.new('RGBA', (144*S, 120*S))
        d = ImageDraw.Draw(im)
        # Plate / tray disc
        d.ellipse((20*S, 20*S, 124*S, 100*S), fill='#1e323d', outline='#3f5e6d', width=3*S)
        # Portion visual fill
        if half:
            # Half plate filled
            d.pieslice((26*S, 24*S, 118*S, 96*S), 90, 270, fill='#e3a84b', outline='#2a404d', width=2*S)
            # Portion label: 1/2
            d.text((76*S, 46*S), '½', fill='#ffffff', stroke_width=2*S, stroke_fill='#15232b')
        else:
            # Full plate filled
            d.ellipse((26*S, 24*S, 118*S, 96*S), fill='#e3a84b', outline='#c48931', width=2*S)
            # Portion label: 1
            d.text((66*S, 46*S), '1', fill='#ffffff', stroke_width=2*S, stroke_fill='#15232b')
        res = im.resize((144, 120), Image.Resampling.LANCZOS)
        name = 'portion_half.webp' if half else 'portion_full.webp'
        save_webp(SERVICE_OUT / name, res)

def build_finale_scenes():
    # 1. Success clinic meal finale: Warm, luminous dining scene (640x360)
    w, h = 640, 360
    im = Image.new('RGBA', (w, h), '#fcf8ee')
    d = ImageDraw.Draw(im)
    
    # Warm clinic background wall
    d.rectangle((0, 0, w, 220), fill='#f5efe2')
    # Soft wood baseboard
    d.rectangle((0, 216, w, 224), fill='#d6c4a8')
    # Warm wood floor
    d.rectangle((0, 224, w, h), fill='#e8dac3')
    for y in range(240, h, 24):
        d.line([(0, y), (w, y)], fill='#d9caa8', width=1)
        
    # Large clinic window with warm sunbeam
    d.rectangle((40, 30, 200, 160), fill='#e4f1f5', outline='#c8dbe3', width=4)
    d.line([(120, 30), (120, 160)], fill='#c8dbe3', width=3)
    d.line([(40, 95), (200, 95)], fill='#c8dbe3', width=3)
    
    # Warm dining table with linen cloth
    d.rounded_rectangle((140, 190, 500, 330), 12, fill='#a36f45', outline='#754d2c', width=4)
    d.rounded_rectangle((160, 200, 480, 315), 8, fill='#fdfbf5', outline='#e8e2ce', width=2)
    
    # Red-rim porcelain serving platter of Mapo Tofu with gleaming red oil
    d.ellipse((260, 220, 380, 275), fill='#a9281a', outline='#3b5b75', width=3)
    d.ellipse((270, 225, 370, 270), fill='#b83020')
    # Tofu cubes
    for cx, cy in [(295, 242), (320, 238), (345, 246), (310, 256), (335, 254)]:
        d.rectangle((cx-7, cy-5, cx+7, cy+5), fill='#faf6eb', outline='#d9ceb4', width=1)
    # Green scallions sprinkled
    for sx, sy in [(285, 248), (325, 245), (355, 240), (305, 235), (330, 262)]:
        d.ellipse((sx-3, sy-2, sx+3, sy+2), fill='#469b3f')
    
    # Two rice bowls & chopsticks (Patient's side and Doctor's side)
    # Left bowl (Doctor)
    d.ellipse((185, 240, 245, 280), fill='#f8f5eb', outline='#3b5b75', width=2)
    d.ellipse((192, 242, 238, 270), fill='#fffdf7')
    # Right bowl (Patient)
    d.ellipse((395, 240, 455, 280), fill='#f8f5eb', outline='#3b5b75', width=2)
    d.ellipse((402, 242, 448, 270), fill='#fffdf7')
    
    # Miso soup bowls
    d.ellipse((195, 215, 235, 238), fill='#231614', outline='#421b18', width=2)
    d.ellipse((405, 215, 445, 238), fill='#231614', outline='#421b18', width=2)
    
    # Rising steam clouds (healing warmth)
    for sx, sy in [(310, 205), (330, 195), (215, 210), (425, 210)]:
        d.arc((sx-12, sy-25, sx+12, sy+5), 200, 340, fill='#e8a84899', width=3)
    
    save_webp(FINALE_OUT / 'success_clinic_meal.webp', im)

    # 2. Failure table flip finale (640x360)
    im_fail = Image.new('RGBA', (w, h), '#261b1b')
    d_fail = ImageDraw.Draw(im_fail)
    
    # Dramatic shock background
    d_fail.rectangle((0, 0, w, 220), fill='#3b2222')
    d_fail.rectangle((0, 220, w, h), fill='#2e1818')
    # Comic impact flash rays
    center = (320, 220)
    for ang in range(0, 360, 20):
        rad = math.radians(ang)
        x1 = center[0] + math.cos(rad) * 40
        y1 = center[1] + math.sin(rad) * 40
        x2 = center[0] + math.cos(rad) * 350
        y2 = center[1] + math.sin(rad) * 350
        d_fail.line([(x1, y1), (x2, y2)], fill='#6b2a2a44', width=4)
        
    # Table tilted up dramatically (flipped)
    d_fail.polygon([(200, 270), (440, 160), (460, 185), (220, 295)], fill='#a36f45', outline='#754d2c')
    
    # Flying bowls and flying tofu cubes
    # Platter flying
    d_fail.ellipse((350, 100, 440, 140), fill='#a9281a', outline='#f2b052', width=3)
    # Tofu cubes tumbling in air
    for tx, ty in [(300, 110), (280, 145), (380, 80), (450, 130), (260, 180)]:
        d_fail.rectangle((tx-8, ty-6, tx+8, ty+6), fill='#faf6eb', outline='#b83020', width=2)
    # Red oil sauce splash droplets
    for dx, dy in [(330, 90), (310, 120), (270, 140), (290, 170), (370, 70), (420, 85)]:
        d_fail.ellipse((dx-5, dy-5, dx+5, dy+5), fill='#cc2b19')
    for dx, dy in [(345, 135), (395, 115), (250, 160)]:
        d_fail.ellipse((dx-7, dy-7, dx+7, dy+7), fill='#e6432f')
        
    save_webp(FINALE_OUT / 'failure_table_flip.webp', im_fail)

def build_doctor_finale_reactions():
    # Derive from existing chibi sprites: speed, heat, strategy
    for who in ('speed', 'heat', 'strategy'):
        chibi_path = ROOT / f'assets/chibi/{who}.webp'
        with Image.open(chibi_path) as atlas:
            # Crop idle south facing cell (0, 0, 112, 144)
            base = atlas.crop((0, 0, 112, 144)).convert('RGBA')
            
            # 1. Splashed state (sauce droplets on white coat)
            im_splash = base.copy()
            d_sp = ImageDraw.Draw(im_splash)
            # Red oil sauce splatter on doctor coat
            d_sp.ellipse((48, 75, 62, 87), fill='#b82818')
            d_sp.ellipse((58, 84, 66, 92), fill='#c93822')
            d_sp.ellipse((42, 90, 52, 98), fill='#961c0e')
            d_sp.ellipse((68, 76, 75, 83), fill='#b82818')
            d_sp.ellipse((53, 96, 61, 103), fill='#a82214')
            # Sweat / shock drops near face
            d_sp.ellipse((78, 48, 84, 56), fill='#6dc6e8')
            d_sp.ellipse((28, 52, 34, 60), fill='#6dc6e8')
            save_webp(FINALE_OUT / f'doctor_{who}_splashed.webp', im_splash)
            
            # 2. Bump state (swollen red bump on head, swirling comic stars, rubbing head)
            im_bump = base.copy()
            d_bm = ImageDraw.Draw(im_bump)
            # Big red bump with highlight
            d_bm.ellipse((72, 8, 92, 28), fill='#ed6a5a', outline='#b83020', width=2)
            d_bm.arc((76, 12, 86, 22), 190, 290, fill='#ffe1ba', width=2)
            # Steam / pain puffs from bump
            d_bm.line([(88, 6), (93, 1)], fill='#c84a40', width=2)
            d_bm.line([(93, 10), (100, 7)], fill='#c84a40', width=2)
            # Swirling stars
            for ang, dist, star_c in [(0, 18, '#ffd43f'), (120, 22, '#ffe375'), (240, 16, '#fca311')]:
                sx = 82 + math.cos(math.radians(ang)) * dist
                sy = 18 + math.sin(math.radians(ang)) * dist
                d_bm.polygon([
                    (sx, sy-4), (sx+1, sy-1), (sx+4, sy), (sx+1, sy+1),
                    (sx, sy+4), (sx-1, sy+1), (sx-4, sy), (sx-1, sy-1)
                ], fill=star_c)
            # Raised arm rubbing head
            d_bm.line([(70, 70), (84, 45), (80, 25)], fill='#ffffff', width=8)
            d_bm.ellipse((76, 20, 84, 28), fill='#edbd94')
            # Dazed swirly eyes or dizzy mouth
            d_bm.arc((52, 70, 64, 78), 0, 180, fill='#684d43', width=2)
            save_webp(FINALE_OUT / f'doctor_{who}_bump.webp', im_bump)

def main():
    build_miso_icons()
    build_portion_icons()
    build_finale_scenes()
    build_doctor_finale_reactions()
    print('R6 art assets generated successfully.')

if __name__ == '__main__':
    main()
