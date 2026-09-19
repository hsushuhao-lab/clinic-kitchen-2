"""Test verifying DOM node identity persistence in wokFoodLayer and boardFoodPieces."""
from pathlib import Path
import http.server
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def test_wok_dom_persistence():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)
        def log_message(self, *a): pass

    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto(f'http://127.0.0.1:{port}/index.html')
        page.wait_for_function("window.get3DStatus && window.get3DStatus().initialized")

        # 1. Test Cutting Board DOM persistence on idle frames
        page.evaluate("setMissionStage(3)") # STAGE_PREP
        page.locator('[data-food="tofu"]').click()
        page.wait_for_timeout(100)

        # Store reference in window for cutting board piece
        page.evaluate("window.__initialBoardPiece = document.getElementById('boardFoodPieces').firstElementChild;")
        
        # Wait for 30 frames (approx 500ms)
        page.wait_for_timeout(500)
        
        is_same_board_piece = page.evaluate("document.getElementById('boardFoodPieces').firstElementChild === window.__initialBoardPiece;")
        assert is_same_board_piece is True, "Cutting board piece DOM node was recreated on idle frames!"
        print("[PASS] Cutting board piece node remained persistent across idle frames.")

        # 2. Test Wok Food Layer persistence during consecutive stirs
        page.evaluate("setMissionStage(4)") # STAGE_COOK
        page.evaluate("""() => {
            window.teleportAndSync(9.0, -1.35);
            // Setup prepped items and heat
            ['pork', 'garlic', 'douban', 'tofu'].forEach(id => prepped.add(id));
            heated = true;
            selectedFood = 'pork';
            $('addBtn').disabled = false;
            $('addBtn').click();
        }""")
        page.wait_for_timeout(100)

        # Store reference to pork element in wok before any stirs
        page.evaluate("window.__initialPorkEl = document.querySelector('.wok-food-pork');")
        assert page.evaluate("window.__initialPorkEl !== null"), "Pork element not found in wok!"

        # Perform Stir 1
        page.evaluate("""() => {
            window.teleportAndSync(9.0, -1.35);
            $('stirBtn').click();
        }""")
        page.wait_for_timeout(100)

        is_same_after_stir_1 = page.evaluate("document.querySelector('.wok-food-pork') === window.__initialPorkEl;")
        assert is_same_after_stir_1 is True, "Wok pork DOM node was destroyed and recreated on Stir 1! Animation interrupted!"
        print("[PASS] Pork node remained identical across Stir 1.")

        # Perform Stir 2
        page.evaluate("$('stirBtn').click();")
        page.wait_for_timeout(100)

        is_same_after_stir_2 = page.evaluate("document.querySelector('.wok-food-pork') === window.__initialPorkEl;")
        assert is_same_after_stir_2 is True, "Wok pork DOM node was destroyed and recreated on Stir 2! Animation interrupted!"
        print("[PASS] Pork node remained identical across Stir 2.")

if __name__ == '__main__':
    test_wok_dom_persistence()
