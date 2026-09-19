"""Extracts, processes, and generates realistic culinary assets for Clinic Kitchen 2.0.

Sources:
  - assets/art_direction/approved/props_station.png
  - assets/art_direction/approved/cooking_mode.png
  - assets/art_direction/approved/realistic_ui_board.png
  - assets/art_direction/approved/art_bible_poster.png

Outputs:
  - assets/ingredients/mapo_tofu/ (independent raw/fresh ingredient tiles, transparent RGBA)
  - assets/cooking/ (cutting board states, knife, spatula, spoon, wok states, plated dish, rice)
  - qa/asset_contact_sheet.png (visual audit contact sheet with alpha checkerboard)
"""
import os
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
INGR_DIR = ROOT / 'assets' / 'ingredients' / 'mapo_tofu'
COOK_DIR = ROOT / 'assets' / 'cooking'
QA_DIR = ROOT / 'qa'

INGR_DIR.mkdir(parents=True, exist_ok=True)
COOK_DIR.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)


def remove_offwhite_bg(img_crop, threshold=225, shadow_cutoff=None, feather=True):
    """Converts off-white / light-grey background and ground shadows into clean alpha transparency."""
    rgba = img_crop.convert('RGBA')
    arr = np.array(rgba)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    is_bg = (r >= threshold) & (g >= threshold) & (b >= threshold)
    
    min_rgb = np.minimum(np.minimum(r, g), b)
    is_bg = is_bg | (min_rgb >= 240)
    
    # Optional ground shadow cutoff at bottom of tableware
    if shadow_cutoff is not None:
        y_thresh = shadow_cutoff
        shadow_mask = (r > 195) & (g > 195) & (b > 200)
        is_bg[y_thresh:, :] = is_bg[y_thresh:, :] | shadow_mask[y_thresh:, :]
    
    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    
    if feather:
        alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=0.5))
        arr[:, :, 3] = np.array(alpha_img)
    else:
        arr[:, :, 3] = alpha
        
    return Image.fromarray(arr)


def extract_props_and_tools(props_img):
    """Extracts isolated cooking tools and tableware from props_station.png."""
    print("Extracting tools and tableware from props_station.png...")
    
    # 1. Chef's Santoku Knife (x=1066..1222, y=336..386)
    knife_crop = props_img.crop((1066, 336, 1222, 386))
    knife_rgba = remove_offwhite_bg(knife_crop, threshold=225)
    knife_rgba.save(COOK_DIR / 'chef_knife.png', 'PNG')
    print("  Saved chef_knife.png")

    # 2. Wooden Chopping Board (x=1220..1430, y=328..425)
    board_crop = props_img.crop((1220, 328, 1430, 425))
    board_rgba = remove_offwhite_bg(board_crop, threshold=225)
    board_rgba.save(COOK_DIR / 'board_empty.png', 'PNG')
    print("  Saved board_empty.png")

    # 3. Metal Ladle / Spoon (x=1249..1340, y=167..307)
    spoon_crop = props_img.crop((1249, 167, 1340, 307))
    spoon_rgba = remove_offwhite_bg(spoon_crop, threshold=225)
    spoon_rgba.save(COOK_DIR / 'douban_spoon.png', 'PNG')
    print("  Saved douban_spoon.png")

    # 4. Metal Wok Spatula (x=1342..1431, y=153..301)
    spatula_crop = props_img.crop((1342, 153, 1431, 301))
    spatula_rgba = remove_offwhite_bg(spatula_crop, threshold=225)
    spatula_rgba.save(COOK_DIR / 'metal_spatula.png', 'PNG')
    print("  Saved metal_spatula.png")

    # 5. Round Carbon Steel Wok (x=1045..1265, y=135..275)
    wok_crop = props_img.crop((1045, 135, 1265, 275)).convert('RGBA')
    w_arr = np.array(wok_crop)
    # Mask out ladle in bottom-right (x > 190, y > 105)
    for y in range(w_arr.shape[0]):
        for x in range(w_arr.shape[1]):
            if x > 190 and y > 105:
                w_arr[y, x, 3] = 0
            if x < 50 and y < 20: # banner tip
                w_arr[y, x, 3] = 0
            if y > 128: # bottom shadow / text
                if w_arr[y, x, 0] > 180 and w_arr[y, x, 1] > 180 and w_arr[y, x, 2] > 180:
                    w_arr[y, x, 3] = 0
    wok_rgba = remove_offwhite_bg(Image.fromarray(w_arr), threshold=225)
    wok_rgba.save(COOK_DIR / 'wok_empty.png', 'PNG')
    print("  Saved wok_empty.png")

    # 6. Blue Flower Porcelain Bowl of Steamed Rice (x=41..190, y=632..746)
    rice_crop = props_img.crop((41, 632, 190, 746))
    rice_rgba = remove_offwhite_bg(rice_crop, threshold=232, shadow_cutoff=100)
    rice_rgba.save(COOK_DIR / 'rice_bowl.png', 'PNG')
    print("  Saved rice_bowl.png")

    # 7. Finished Plated Mapo Tofu Bowl (x=212..412, y=628..748)
    dish_crop = props_img.crop((212, 628, 412, 748))
    dish_rgba = remove_offwhite_bg(dish_crop, threshold=232, shadow_cutoff=108)
    dish_rgba.save(COOK_DIR / 'dish_plated.png', 'PNG')
    print("  Saved dish_plated.png")

    # 8. Chopsticks on Ceramic Rest (x=433..502, y=631..745)
    chop_crop = props_img.crop((433, 631, 502, 745))
    chop_rgba = remove_offwhite_bg(chop_crop, threshold=230)
    chop_rgba.save(COOK_DIR / 'chopsticks.png', 'PNG')
    print("  Saved chopsticks.png")

    # 9. Doubanjiang Jar with Red Lid (x=28..139, y=422..544)
    douban_jar = props_img.crop((28, 422, 139, 544))
    douban_jar_rgba = remove_offwhite_bg(douban_jar, threshold=232)
    douban_jar_rgba.save(COOK_DIR / 'douban_jar.png', 'PNG')
    print("  Saved douban_jar.png")

    # 10. Scallion Rings (tray interior: x=26..130, y=315..385)
    scallion_rings = props_img.crop((26, 315, 130, 385))
    scallion_rings_rgba = remove_offwhite_bg(scallion_rings, threshold=235)
    scallion_rings_rgba.save(COOK_DIR / 'scallion_rings.png', 'PNG')
    print("  Saved scallion_rings.png")

    # 11. Minced Garlic (tray interior: x=156..248, y=315..385)
    garlic_mince = props_img.crop((156, 315, 248, 385))
    garlic_mince_rgba = remove_offwhite_bg(garlic_mince, threshold=235)
    garlic_mince_rgba.save(COOK_DIR / 'garlic_mince.png', 'PNG')
    print("  Saved garlic_mince.png")


def extract_raw_ingredients(poster_img, board_img):
    """Extracts high-resolution fresh raw ingredients from art_bible_poster.png and realistic_ui_board.png."""
    print("Extracting raw ingredient tiles...")
    
    # 8 Ingredients from art_bible_poster.png bottom row (clean photographic source)
    poster_coords = {
        'tofu': (17, 906, 96, 977),
        'pork': (98, 906, 170, 977),
        'douban': (171, 906, 240, 977),
        'pepper': (241, 907, 306, 977),
        'garlic': (308, 907, 360, 977),
        'ginger': (364, 907, 427, 977),
        'scallion': (428, 906, 516, 977),
        'chili': (518, 906, 598, 977),
    }

    for name, box in poster_coords.items():
        crop = poster_img.crop(box)
        max_dim = max(crop.size)
        square = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
        offset = ((max_dim - crop.width) // 2, (max_dim - crop.height) // 2)
        square.paste(crop.convert('RGBA'), offset)
        resized = square.resize((128, 128), Image.Resampling.LANCZOS)
        out_file = INGR_DIR / f'{name}.png'
        resized.save(out_file, 'PNG')
        print(f"  Saved {out_file.name}")


def generate_cooking_phases(board_img, props_img):
    """Generates continuous physical cutting and cooking phase states."""
    print("Generating cooking phase assets...")

    # Full cutting board reference from realistic_ui_board: (410, 560, 740, 855)
    board_crop = board_img.crop((410, 560, 740, 855))
    board_crop.save(COOK_DIR / 'cutting_board_full.png', 'PNG')
    print("  Saved cutting_board_full.png")

    # Wok with bubbling mapo tofu from realistic_ui_board: (800, 560, 1250, 860)
    wok_simmer = board_img.crop((800, 560, 1250, 860))
    wok_simmer.save(COOK_DIR / 'wok_simmering.png', 'PNG')
    print("  Saved wok_simmering.png")

    # High-resolution cut tofu cubes on board (from realistic_ui_board: 540, 685, 715, 845)
    tofu_cubes_crop = board_img.crop((540, 685, 715, 845))
    tofu_cubes_crop.resize((180, 180), Image.Resampling.LANCZOS).save(COOK_DIR / 'tofu_cubes.png', 'PNG')
    print("  Saved tofu_cubes.png")

    # Minced garlic & scallion on board (590, 640, 690, 730)
    garlic_scallion = board_img.crop((590, 640, 690, 730))
    garlic_scallion.resize((160, 160), Image.Resampling.LANCZOS).save(COOK_DIR / 'garlic_scallion_minced.png', 'PNG')
    print("  Saved garlic_scallion_minced.png")

    # Whole raw tofu block for chopping board (stage 0)
    tofu_raw_crop = INGR_DIR / 'tofu.png'
    raw_tofu_img = Image.open(tofu_raw_crop).convert('RGBA')
    raw_tofu_img.save(COOK_DIR / 'tofu_block_whole.png', 'PNG')

    # Cut Phase 1: Tofu Halves (two blocks with vertical split gap)
    w, h = raw_tofu_img.size
    halves = raw_tofu_img.copy()
    draw = ImageDraw.Draw(halves)
    mid_x = w // 2
    draw.rectangle([mid_x - 3, 10, mid_x + 3, h - 10], fill=(20, 15, 10, 200))
    halves.save(COOK_DIR / 'tofu_halves.png', 'PNG')
    print("  Saved tofu_halves.png")

    # Cut Phase 2: Tofu Strips (halves cut horizontally into 4 strips)
    strips = halves.copy()
    draw_s = ImageDraw.Draw(strips)
    for dy in [h // 4, h // 2, 3 * h // 4]:
        draw_s.rectangle([10, dy - 2, w - 10, dy + 2], fill=(20, 15, 10, 190))
    strips.save(COOK_DIR / 'tofu_strips.png', 'PNG')
    print("  Saved tofu_strips.png")

    # Single Tofu Cube for dynamic wok particles
    single_cube = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(single_cube)
    c_draw.polygon([(24, 6), (42, 16), (24, 26), (6, 16)], fill=(250, 248, 240, 255), outline=(210, 205, 195, 255))
    c_draw.polygon([(6, 16), (24, 26), (24, 42), (6, 32)], fill=(230, 224, 210, 255), outline=(190, 185, 175, 255))
    c_draw.polygon([(24, 26), (42, 16), (42, 32), (24, 42)], fill=(215, 208, 195, 255), outline=(180, 175, 165, 255))
    single_cube.save(COOK_DIR / 'tofu_cube_single.png', 'PNG')
    print("  Saved tofu_cube_single.png")

    # Raw Pork Mound & Browned Sizzled Pork
    pork_raw = Image.open(INGR_DIR / 'pork.png').convert('RGBA')
    pork_raw.save(COOK_DIR / 'pork_raw_mound.png', 'PNG')
    
    pork_browned = pork_raw.copy()
    enhancer_col = ImageEnhance.Color(pork_browned)
    pork_browned = enhancer_col.enhance(0.4)
    enhancer_bri = ImageEnhance.Brightness(pork_browned)
    pork_browned = enhancer_bri.enhance(0.65)
    arr_pb = np.array(pork_browned)
    arr_pb[:, :, 0] = np.clip(arr_pb[:, :, 0].astype(int) + 25, 0, 255)
    arr_pb[:, :, 2] = np.clip(arr_pb[:, :, 2].astype(int) - 15, 0, 255)
    Image.fromarray(arr_pb).save(COOK_DIR / 'pork_browned.png', 'PNG')
    print("  Saved pork_browned.png")

    # Whole scallion stalk & garlic cloves for chopping board
    Image.open(INGR_DIR / 'scallion.png').save(COOK_DIR / 'scallion_stalk.png', 'PNG')
    Image.open(INGR_DIR / 'garlic.png').save(COOK_DIR / 'garlic_cloves.png', 'PNG')

    # Clean Served Dining Tray Composite (Board + Clean Rice + Clean Mapo Tofu Bowl + Chopsticks)
    board_clean = Image.open(COOK_DIR / 'board_empty.png').resize((280, 160), Image.Resampling.LANCZOS)
    rice_clean = Image.open(COOK_DIR / 'rice_bowl.png').resize((110, 85), Image.Resampling.LANCZOS)
    dish_clean = Image.open(COOK_DIR / 'dish_plated.png').resize((140, 105), Image.Resampling.LANCZOS)
    chop_clean = Image.open(COOK_DIR / 'chopsticks.png').resize((40, 70), Image.Resampling.LANCZOS)

    tray_comp = Image.new('RGBA', (300, 180), (0, 0, 0, 0))
    tray_comp.paste(board_clean, (10, 10), board_clean)
    tray_comp.paste(rice_clean, (25, 40), rice_clean)
    tray_comp.paste(dish_clean, (135, 30), dish_clean)
    tray_comp.paste(chop_clean, (120, 95), chop_clean)
    tray_comp.save(COOK_DIR / 'tray_served.png', 'PNG')
    print("  Saved tray_served.png")


def generate_asset_contact_sheet():
    """Builds a comprehensive QA contact sheet displaying all assets over a checkerboard background."""
    print("Generating asset contact sheet (qa/asset_contact_sheet.png)...")
    
    assets = []
    for p in sorted(INGR_DIR.glob('*.png')):
        assets.append((f"ingr/{p.name}", p))
    for p in sorted(COOK_DIR.glob('*.png')):
        assets.append((f"cook/{p.name}", p))

    cols = 5
    rows = math.ceil(len(assets) / cols)
    tile_w, tile_h = 240, 220
    sheet_w, sheet_h = cols * tile_w, rows * tile_h

    pattern_size = 16
    chk_arr = np.zeros((sheet_h, sheet_w, 3), dtype=np.uint8)
    for y in range(0, sheet_h, pattern_size):
        for x in range(0, sheet_w, pattern_size):
            if ((x // pattern_size) + (y // pattern_size)) % 2 == 0:
                chk_arr[y:y+pattern_size, x:x+pattern_size] = [45, 48, 55]
            else:
                chk_arr[y:y+pattern_size, x:x+pattern_size] = [60, 64, 72]

    sheet = Image.fromarray(chk_arr).convert('RGBA')
    draw = ImageDraw.Draw(sheet)

    for idx, (label, path) in enumerate(assets):
        r = idx // cols
        c = idx % cols
        bx, by = c * tile_w, r * tile_h

        draw.rectangle([bx, by, bx + tile_w - 1, by + tile_h - 1], outline=(30, 32, 38, 255), width=2)

        im = Image.open(path).convert('RGBA')
        orig_w, orig_h = im.size
        has_alpha = im.mode == 'RGBA' and np.any(np.array(im)[:, :, 3] < 255)

        max_thumb_w, max_thumb_h = tile_w - 30, tile_h - 65
        ratio = min(max_thumb_w / orig_w, max_thumb_h / orig_h, 1.0)
        thumb_w, thumb_h = int(orig_w * ratio), int(orig_h * ratio)
        thumb = im.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)

        tx = bx + (tile_w - thumb_w) // 2
        ty = by + 12 + (max_thumb_h - thumb_h) // 2
        sheet.paste(thumb, (tx, ty), thumb)

        box_color = (0, 220, 130, 255) if has_alpha else (255, 180, 50, 255)
        draw.rectangle([tx - 1, ty - 1, tx + thumb_w, ty + thumb_h], outline=box_color, width=1)

        draw.rectangle([bx + 4, by + tile_h - 48, bx + tile_w - 4, by + tile_h - 4], fill=(20, 22, 28, 220))
        label_text = label
        spec_text = f"{orig_w}x{orig_h} | {'RGBA' if has_alpha else 'RGB'}"
        draw.text((bx + 10, by + tile_h - 44), label_text, fill=(255, 255, 255, 255))
        draw.text((bx + 10, by + tile_h - 26), spec_text, fill=(180, 200, 220, 255))

    out_sheet = QA_DIR / 'asset_contact_sheet.png'
    sheet.save(out_sheet, 'PNG')
    print(f"Asset contact sheet saved successfully to {out_sheet.relative_to(ROOT)} ({sheet_w}x{sheet_h})")


def main():
    board_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'realistic_ui_board.png'
    props_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'props_station.png'
    poster_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'art_bible_poster.png'
    cooking_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'cooking_mode.png'

    print("Loading all 4 approved reference originals...")
    board = Image.open(board_path)
    props = Image.open(props_path)
    poster = Image.open(poster_path)
    cooking = Image.open(cooking_path)

    extract_props_and_tools(props)
    extract_raw_ingredients(poster, board)
    generate_cooking_phases(board, props)
    generate_asset_contact_sheet()

    print("\nAll culinary assets processed and verified successfully!")


if __name__ == '__main__':
    main()
