"""Test to verify movement direction, facing angle, and camera synchronization.

Requirement:
  W / Up: moves deeper into scene depth (-Z), character faces deeper into room (Math.PI)
  S / Down: moves towards camera (+Z), character faces towards camera (0)
  A / Left: moves left (-X), character faces left (-PI/2)
  D / Right: moves right (+X), character faces right (PI/2)
"""
import http.server
import socketserver
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, format, *args):
        pass

def main():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    port = httpd.server_address[1]
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-webgl', '--in-process-gpu'
        ])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(f'http://127.0.0.1:{port}/index.html', wait_until='networkidle')
        page.wait_for_function("window.get3DStatus && window.get3DStatus().initialized")
        page.wait_for_timeout(500)

        world = page.locator('#world')
        world.focus()

        status0 = page.evaluate("window.get3DStatus()")
        p0 = status0['playerPos']
        print(f"Spawn pos: x={p0['x']:.2f}, z={p0['z']:.2f}")

        # 1. Test W (Up / deeper into room)
        world.focus()
        page.keyboard.down('w')
        page.wait_for_timeout(350)
        page.keyboard.up('w')
        page.wait_for_timeout(100)

        status_w = page.evaluate("window.get3DStatus()")
        pw = status_w['playerPos']
        facing_w = page.evaluate("window.scene3DState.playerFacing")
        print(f"After W: x={pw['x']:.2f}, z={pw['z']:.2f}, facing={facing_w:.2f}")

        # W must decrease Z (move deeper into room, away from camera)
        assert pw['z'] < p0['z'] - 0.1, (
            f"FAIL: Pressing 'W' should move player deeper into scene (decrease Z), "
            f"but Z changed from {p0['z']:.2f} to {pw['z']:.2f} (delta = {pw['z'] - p0['z']:+.2f})"
        )
        # Facing should be towards -Z (Math.PI or -Math.PI)
        assert abs(abs(facing_w) - 3.14159) < 0.2, f"FAIL: Facing for W should be PI (facing -Z), got {facing_w}"
        print("PASS: W moves deeper into scene (-Z) and faces away from camera")

        # 2. Test S (Down / towards camera)
        world.focus()
        page.keyboard.down('s')
        page.wait_for_timeout(500)
        page.keyboard.up('s')
        page.wait_for_timeout(100)

        status_s = page.evaluate("window.get3DStatus()")
        ps = status_s['playerPos']
        facing_s = page.evaluate("window.scene3DState.playerFacing")
        print(f"After S: x={ps['x']:.2f}, z={ps['z']:.2f}, facing={facing_s:.2f}")

        # S must increase Z (move towards camera)
        assert ps['z'] > pw['z'] + 0.1, (
            f"FAIL: Pressing 'S' should move player towards camera (increase Z), "
            f"but Z changed from {pw['z']:.2f} to {ps['z']:.2f} (delta = {ps['z'] - pw['z']:+.2f})"
        )
        # Facing should be towards +Z (near 0)
        assert abs(facing_s) < 0.2, f"FAIL: Facing for S should be 0 (facing +Z), got {facing_s}"
        print("PASS: S moves towards camera (+Z) and faces camera")

        # 3. Test A (Left)
        world.focus()
        page.keyboard.down('a')
        page.wait_for_timeout(350)
        page.keyboard.up('a')
        page.wait_for_timeout(100)

        status_a = page.evaluate("window.get3DStatus()")
        pa = status_a['playerPos']
        facing_a = page.evaluate("window.scene3DState.playerFacing")
        print(f"After A: x={pa['x']:.2f}, z={pa['z']:.2f}, facing={facing_a:.2f}")

        assert pa['x'] < ps['x'] - 0.1, (
            f"FAIL: Pressing 'A' should move player left (decrease X), "
            f"but X changed from {ps['x']:.2f} to {pa['x']:.2f}"
        )
        assert abs(facing_a - (-1.5708)) < 0.2, f"FAIL: Facing for A should be -PI/2, got {facing_a}"
        print("PASS: A moves left (-X) and faces left")

        # 4. Test D (Right)
        world.focus()
        page.keyboard.down('d')
        page.wait_for_timeout(350)
        page.keyboard.up('d')
        page.wait_for_timeout(100)

        status_d = page.evaluate("window.get3DStatus()")
        pd = status_d['playerPos']
        facing_d = page.evaluate("window.scene3DState.playerFacing")
        print(f"After D: x={pd['x']:.2f}, z={pd['z']:.2f}, facing={facing_d:.2f}")

        assert pd['x'] > pa['x'] + 0.1, (
            f"FAIL: Pressing 'D' should move player right (increase X), "
            f"but X changed from {pa['x']:.2f} to {pd['x']:.2f}"
        )
        assert abs(facing_d - 1.5708) < 0.2, f"FAIL: Facing for D should be PI/2, got {facing_d}"
        print("PASS: D moves right (+X) and faces right")

        browser.close()
    print("ALL DIRECTION TESTS PASSED!")

if __name__ == '__main__':
    main()
