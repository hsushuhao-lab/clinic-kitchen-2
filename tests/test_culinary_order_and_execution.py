"""Test verifying that patient consultation preferences genuinely evaluate against actual cooked dish data."""
from pathlib import Path
import http.server
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def test_order_vs_execution():
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

        # Test Case B: Patient orders "不要蔥" (No scallions), but player ACTUALLY adds scallion into wok
        # 1. Consult: select 不要蔥
        page.evaluate("handleInteraction('病人')")
        page.locator('.pref-btn[data-val="no"]').click()
        page.locator('#dialogActionBtn').click()
        assert page.evaluate("window.currentOrder.scallion === false"), "Order should specify no scallion"

        # 2. Player adds scallion into wok anyway
        page.evaluate("""() => {
            setMissionStage(6); // STAGE_SERVE
            // Player included scallion in wok
            inWok.add('scallion');
            ['tofu', 'pork', 'douban', 'garlic'].forEach(id => inWok.add(id));
            stirs = 3;
            if (window.cookedDish) window.cookedDish.hasScallion = true;
            handleInteraction('病人');
        }""")
        page.wait_for_timeout(200)

        feedback_text = page.locator('#dialogContent').text_content()
        print("Feedback text when order asked for NO scallion but player added scallion:\n", feedback_text)

        # The feedback MUST NOT praise "完全按照要求沒有放蔥花" when scallion was in fact included!
        assert "完全按照要求沒有放蔥花" not in feedback_text, "Feedback falsely praised 'no scallions' when scallion was actually in the wok!"
        # It must point out the discrepancy
        assert any(w in feedback_text for w in ["不要蔥", "蔥花", "明明", "不符"]), "Feedback should indicate that scallion preference was violated"
        print("[PASS] Discrepancy detected and reported correctly when scallion was wrongly added.")

if __name__ == '__main__':
    test_order_vs_execution()
