"""Test verifying discrete batch ingredient addition and parallel rice cooker interaction."""
from pathlib import Path
import http.server
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def test_batch_and_parallel():
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

        # 1. Test Discrete Batch Addition
        page.evaluate("""() => {
            setMissionStage(4); // STAGE_COOK
            window.teleportAndSync(9.0, -1.35);
            // Have multiple ingredients prepped
            prepped.add('pork');
            prepped.add('garlic');
            prepped.add('tofu');
            heated = true;
            selectedFood = 'pork'; // Only pork is selected
            updateCooking();
        }""")
        page.wait_for_timeout(100)

        # Click Add button
        page.locator('#addBtn').click()

        # In a genuine discrete batch system: ONLY the selected item (pork) should enter wok, tofu and garlic must remain in prepped
        status = page.evaluate("""() => {
            return {
                inWok: Array.from(inWok),
                prepped: Array.from(prepped)
            };
        }""")
        print("Wok and prepped status after adding pork:", status)
        assert 'pork' in status['inWok'], "Pork should be in wok"
        assert 'tofu' in status['prepped'], "Tofu should still be in prepped tray, not dumped all at once!"
        assert 'tofu' not in status['inWok'], "Tofu should NOT have entered wok when only pork was added!"
        print("[PASS] Discrete batch addition verified.")

        # 2. Test Parallel Rice Cooker Interaction
        # Click half rice button while at cook stage
        page.locator('#riceHalfBtn').click()
        page.wait_for_timeout(100)
        rice_status = page.evaluate("window.cookedDish.ricePortion")
        assert rice_status == '半碗飯', f"Expected ricePortion '半碗飯', got {rice_status}"
        badge_text = page.locator('#riceStatusBadge').inner_text()
        assert '半碗' in badge_text, f"Badge did not reflect rice portion: {badge_text}"
        print("[PASS] Parallel rice cooker interaction verified.")

if __name__ == '__main__':
    test_batch_and_parallel()
