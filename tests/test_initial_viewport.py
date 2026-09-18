"""Regression test verifying player is strictly inside the upper viewport on initial load across viewports."""
from playwright.sync_api import sync_playwright

def test_initial_viewport():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(1440, 900), (768, 1024), (390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            page.goto('http://127.0.0.1:8000/', wait_until='networkidle')
            page.wait_for_timeout(120)
            world = page.locator('#world').bounding_box()
            character = page.locator('#player').bounding_box()
            assert character['x'] >= 0, f"{width}: character['x'] ({character['x']}) < 0"
            assert character['x'] + character['width'] <= width, f"{width}: character exceeds width"
            assert character['y'] >= world['y'], f"{width}: character['y'] ({character['y']}) < world['y'] ({world['y']})"
            assert character['y'] + character['height'] <= world['y'] + world['height'], f"{width}: character exceeds world height"
        browser.close()
    print("Initial viewport test PASS across 1440, 768, 390.")

if __name__ == '__main__':
    test_initial_viewport()
