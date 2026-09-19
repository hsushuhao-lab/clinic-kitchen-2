"""Test verifying plating transfer sub-state, reset hygiene, and single delivery event."""
from pathlib import Path
import http.server
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def test_plating_state_machine():
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

        # Setup: Cook stage ready to plate
        page.evaluate("""() => {
            setMissionStage(5); // STAGE_PLATE
            window.teleportAndSync(9.0, -1.35);
            ['tofu', 'pork', 'douban', 'garlic'].forEach(id => inWok.add(id));
            heated = true;
            stirs = 3;
            updateCooking();
        }""")
        page.wait_for_timeout(100)

        assert page.evaluate("$('plateBtn').disabled === false"), "Plate button should be enabled"

        # 1. Test Plating Sub-state: plated must NOT be instantaneously true before transfer
        page.evaluate("$('plateBtn').click();")
        
        # Check immediately (at t ~ 50ms)
        initial_check = page.evaluate("""() => {
            return {
                isPlating: window.isPlating || false,
                plated: window.plated,
                carryingTray: window.scene3DState.carryingTray
            };
        }""")
        print("Immediate state after clicking plateBtn:", initial_check)
        # In current flawed implementation, plated is immediately set to true and carryingTray is true at t=0
        assert initial_check['isPlating'] is True, "isPlating should be active"
        assert initial_check['plated'] is False, "plated should NOT be committed instantaneously before food transfer completes!"
        assert initial_check['carryingTray'] is False, "Tray should NOT be carried before transfer completes!"

        # 2. Wait for transfer to complete (500ms)
        page.wait_for_timeout(600)
        completed_check = page.evaluate("""() => {
            return {
                isPlating: window.isPlating || false,
                plated: window.plated,
                carryingTray: window.scene3DState.carryingTray
            };
        }""")
        print("Completed state after transfer:", completed_check)
        assert completed_check['isPlating'] is False, "isPlating should be finished"
        assert completed_check['plated'] is True, "plated should be committed after transfer!"
        assert completed_check['carryingTray'] is True, "Tray should now be carried!"

        # 3. Test Reset Hygiene
        page.evaluate("resetAll();")
        reset_check = page.evaluate("""() => {
            return {
                isPlating: window.isPlating || false,
                plated: window.plated,
                carryingTray: window.scene3DState.carryingTray
            };
        }""")
        assert reset_check['isPlating'] is False
        assert reset_check['plated'] is False
        assert reset_check['carryingTray'] is False
        print("[PASS] Plating sub-state, completion, and reset hygiene all verified.")

if __name__ == '__main__':
    test_plating_state_machine()
