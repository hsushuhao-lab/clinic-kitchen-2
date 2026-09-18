"""Extracts, processes, and generates realistic culinary assets for Clinic Kitchen 2.0.
Sources:
  - assets/art_direction/approved/realistic_ui_board.png
  - assets/art_direction/approved/props_station.png
  - assets/art_direction/approved/cooking_mode.png
Outputs:
  - assets/ingredients/mapo_tofu/ (independent raw/fresh ingredient tiles)
  - assets/cooking/ (cutting board states, knife, spatula, flame, wok contents, plated dish)
"""
import os
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
INGR_DIR = ROOT / 'assets' / 'ingredients' / 'mapo_tofu'
COOK_DIR = ROOT / 'assets' / 'cooking'

INGR_DIR.mkdir(parents=True, exist_ok=True)
COOK_DIR.mkdir(parents=True, exist_ok=True)

def main():
    board_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'realistic_ui_board.png'
    props_path = ROOT / 'assets' / 'art_direction' / 'approved' / 'props_station.png'

    board = Image.open(board_path)
    props = Image.open(props_path)

    print("Generating ingredient tiles...")
    # Raw Ingredients from realistic_ui_board (excluding text banner at bottom)
    # Box format: (left, top, right, bottom)
    tiles = {
        'tofu': (23, 560, 115, 626),
        'pork': (116, 560, 208, 626),
        'scallion': (209, 560, 301, 626),
        'garlic': (302, 560, 394, 626),
        'ginger': (23, 660, 115, 726),
        'chili': (116, 660, 208, 726),
        'douban': (209, 660, 301, 726),
        'pepper': (302, 760, 394, 826),
    }

    for name, box in tiles.items():
        crop = board.crop(box).resize((128, 128), Image.Resampling.LANCZOS)
        out_file = INGR_DIR / f'{name}.png'
        crop.save(out_file, 'PNG')
        print(f"  Saved {out_file.name}")

    # Cutting Board & Knife from realistic_ui_board and props_station
    print("Generating cutting board & knife assets...")
    # Cutting board region in realistic_ui_board: (410, 560, 740, 855)
    board_crop = board.crop((410, 560, 740, 855))
    board_crop.save(COOK_DIR / 'cutting_board_full.png', 'PNG')

    # Diced Tofu Cubes on board
    tofu_cubes_crop = board.crop((430, 680, 580, 850)).resize((180, 180), Image.Resampling.LANCZOS)
    tofu_cubes_crop.save(COOK_DIR / 'tofu_cubes.png', 'PNG')

    # Minced Garlic & Scallion Rings on board
    garlic_scallion_crop = board.crop((580, 640, 680, 750)).resize((160, 160), Image.Resampling.LANCZOS)
    garlic_scallion_crop.save(COOK_DIR / 'garlic_scallion_minced.png', 'PNG')

    # Chef's knife isolated from props_station: (1060, 335, 1220, 385)
    knife_crop = props.crop((1060, 335, 1220, 385)).convert('RGBA')
    arr_k = np.array(knife_crop)
    bg_k = (arr_k[:,:,0] > 230) & (arr_k[:,:,1] > 230) & (arr_k[:,:,2] > 230)
    arr_k[bg_k, 3] = 0
    Image.fromarray(arr_k).save(COOK_DIR / 'chef_knife.png', 'PNG')

    # Metal Spatula from props_station: (1362, 150, 1435, 290)
    spatula_crop = props.crop((1362, 150, 1435, 290)).convert('RGBA')
    arr_s = np.array(spatula_crop)
    bg_s = (arr_s[:,:,0] > 230) & (arr_s[:,:,1] > 230) & (arr_s[:,:,2] > 230)
    arr_s[bg_s, 3] = 0
    Image.fromarray(arr_s).save(COOK_DIR / 'metal_spatula.png', 'PNG')

    # Intermediate cutting states
    # Tofu halves / strips
    tofu_halves = board.crop((23, 560, 115, 626)).resize((128, 128))
    # Create halved tofu
    arr_th = np.array(tofu_halves)
    arr_th[:, 60:68] = (arr_th[:, 60:68] * 0.5).astype(np.uint8) # slice line down middle
    Image.fromarray(arr_th).save(COOK_DIR / 'tofu_halves.png')

    # Tofu strips
    arr_ts = np.array(tofu_halves)
    for cx in [32, 64, 96]:
        arr_ts[:, cx:cx+4] = (arr_ts[:, cx:cx+4] * 0.45).astype(np.uint8)
    Image.fromarray(arr_ts).save(COOK_DIR / 'tofu_strips.png')

    # Scallion rings isolated
    scallion_rings = props.crop((20, 285, 115, 360)).convert('RGBA')
    arr_sr = np.array(scallion_rings)
    bg_sr = (arr_sr[:,:,0] > 235) & (arr_sr[:,:,1] > 235) & (arr_sr[:,:,2] > 235)
    arr_sr[bg_sr, 3] = 0
    Image.fromarray(arr_sr).save(COOK_DIR / 'scallion_rings.png')

    # Minced garlic isolated
    garlic_mince = props.crop((118, 285, 195, 360)).convert('RGBA')
    arr_gm = np.array(garlic_mince)
    bg_gm = (arr_gm[:,:,0] > 235) & (arr_gm[:,:,1] > 235) & (arr_gm[:,:,2] > 235)
    arr_gm[bg_gm, 3] = 0
    Image.fromarray(arr_gm).save(COOK_DIR / 'garlic_mince.png')

    # Browned minced pork for wok
    pork_browned = board.crop((116, 560, 208, 626)).resize((128, 128))
    enhancer = ImageEnhance.Color(pork_browned)
    pork_browned = enhancer.enhance(0.4) # desaturate pink
    enhancer = ImageEnhance.Brightness(pork_browned)
    pork_browned = enhancer.enhance(0.7) # brown cooking color
    pork_browned.save(COOK_DIR / 'pork_browned.png')

    # Douban Spoon (Ladle) from props_station: (1250, 150, 1335, 290)
    spoon_crop = props.crop((1250, 150, 1335, 290)).convert('RGBA')
    arr_sp = np.array(spoon_crop)
    bg_sp = (arr_sp[:,:,0] > 230) & (arr_sp[:,:,1] > 230) & (arr_sp[:,:,2] > 230)
    arr_sp[bg_sp, 3] = 0
    Image.fromarray(arr_sp).save(COOK_DIR / 'douban_spoon.png', 'PNG')

    # Empty Chopping Board from props_station: (1220, 332, 1425, 415)
    board_empty = props.crop((1220, 332, 1425, 415)).convert('RGBA')
    arr_b = np.array(board_empty)
    bg_b = (arr_b[:,:,0] > 230) & (arr_b[:,:,1] > 230) & (arr_b[:,:,2] > 230)
    arr_b[bg_b, 3] = 0
    Image.fromarray(arr_b).save(COOK_DIR / 'board_empty.png', 'PNG')

    # Empty Wok from props_station: (1045, 140, 1305, 275)
    wok_empty = props.crop((1045, 140, 1305, 275)).convert('RGBA')
    arr_w = np.array(wok_empty)
    # Remove ladle overlap in bottom-right quadrant if present
    bg_w = (arr_w[:,:,0] > 230) & (arr_w[:,:,1] > 230) & (arr_w[:,:,2] > 230)
    arr_w[bg_w, 3] = 0
    # Mask out bottom right ladle corner (y > 105 and x > 200)
    for y in range(arr_w.shape[0]):
        for x in range(arr_w.shape[1]):
            if y > 105 and x > 200:
                if arr_w[y, x, 0] > 180 and arr_w[y, x, 1] > 180 and arr_w[y, x, 2] > 180:
                    arr_w[y, x, 3] = 0
    Image.fromarray(arr_w).save(COOK_DIR / 'wok_empty.png', 'PNG')

    # Cooking Wok states
    print("Generating wok cooking states...")
    # Wok with bubbling mapo tofu from realistic_ui_board: (800, 560, 1250, 860)
    wok_simmer = board.crop((800, 560, 1250, 860))
    wok_simmer.save(COOK_DIR / 'wok_simmering.png', 'PNG')

    # Plated Dish: Blue-and-white porcelain bowl of Mapo Tofu with Steamed Rice
    # In realistic_ui_board: (1275, 575, 1525, 840)
    dish_crop = board.crop((1275, 575, 1525, 840))
    dish_crop.save(COOK_DIR / 'dish_plated.png', 'PNG')

    # Rice bowl from props_station: (30, 580, 195, 730)
    rice_crop = props.crop((30, 580, 195, 730)).convert('RGBA')
    arr_r = np.array(rice_crop)
    bg_r = (arr_r[:,:,0] > 230) & (arr_r[:,:,1] > 230) & (arr_r[:,:,2] > 230)
    arr_r[bg_r, 3] = 0
    Image.fromarray(arr_r).save(COOK_DIR / 'rice_bowl.png', 'PNG')

    print("All culinary assets generated successfully!")

if __name__ == '__main__':
    main()
