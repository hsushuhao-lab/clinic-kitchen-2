"""Regression test verifying player is strictly inside the upper viewport on initial load across viewports."""
from pathlib import Path
import http.server
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def test_initial_viewport(base_url='http://127.0.0.1:8000/'):
    import urllib.request
    need_server = False
    try:
        with urllib.request.urlopen(base_url, timeout=0.5):
            pass
    except Exception:
        need_server = True

    if need_server:
        class H(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(ROOT), **kwargs)
            def log_message(self, *a): pass

        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        base_url = f'http://127.0.0.1:{port}/'

    with sync_playwright() as p:
        gl_args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--in-process-gpu']
        browser = None
        for attempt in range(3):
            try:
                browser = p.chromium.launch(args=gl_args)
                break
            except Exception:
                if attempt == 2:
                    raise
                import time
                time.sleep(1)

        for width, height in [(1440, 900), (768, 1024), (390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            target_url = base_url if base_url.endswith('/') else base_url + '/'
            page.goto(target_url, wait_until='networkidle')
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
