import argparse
from pathlib import Path
import hashlib
import json
import re
import shutil
import http.server
import threading
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url')
    parser.add_argument('--inline', action='store_true')
    parser.add_argument('--output', default=str(ROOT / 'qa/current'))
    args = parser.parse_args()
    if not args.inline and not args.base_url:
        parser.error('Use --base-url http://... or --inline for offline rendering.')

    if args.base_url:
        need_server = False
        try:
            with urllib.request.urlopen(args.base_url, timeout=0.5):
                pass
        except Exception:
            need_server = True
        if need_server:
            class H(http.server.SimpleHTTPRequestHandler):
                def __init__(self, *a, **kw):
                    super().__init__(*a, directory=str(ROOT), **kw)
                def log_message(self, *a): pass
            httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
            port = httpd.server_address[1]
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            args.base_url = f'http://127.0.0.1:{port}/'

    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    results = []
    errors = []
    failures = []
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    if args.inline:
        html = re.sub(r'<link rel="stylesheet" href="([^"?]+)[^"]*"\s*/?>',
                      lambda m: '<style>' + (ROOT / m[1]).read_text(encoding='utf-8') + '</style>', html)
        html = re.sub(r'<script src="([^"?]+)[^"]*"></script>',
                      lambda m: '<script>' + (ROOT / m[1]).read_text(encoding='utf-8') + '</script>', html)
    with sync_playwright() as pw:
        gl_args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-webgl',
            '--in-process-gpu'
        ]
        browser = pw.chromium.launch(headless=True, args=gl_args)
        page = browser.new_page(viewport={'width':1440, 'height':900})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('requestfailed', lambda r: failures.append(r.url))
        page.on('response', lambda r: failures.append(f'{r.status} {r.url}') if r.status >= 400 else None)
        def load(width, height):
            nonlocal page
            page.close()
            page = browser.new_page(viewport={'width':width, 'height':height})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('requestfailed', lambda r: failures.append(r.url))
            page.on('response', lambda r: failures.append(f'{r.status} {r.url}') if r.status >= 400 else None)
            if args.inline: page.set_content(html, wait_until='load')
            else: page.goto(args.base_url, wait_until='networkidle')
            page.wait_for_timeout(120)
        def check(name, test):
            assert test, name
            results.append({'test': name, 'status':'PASS'})
        def prepare(ids):
            page.evaluate('window.setMissionStage && window.setMissionStage(3)')
            page.evaluate('window.teleportAndSync && window.teleportAndSync(5.0, -1.5)')
            for food in ids:
                page.locator(f'[data-food="{food}"]').click()
                cuts = 3 if food == 'tofu' else 1
                for _ in range(cuts):
                    page.locator('#cutBtn').click()
        def wok_station():
            page.evaluate('window.setMissionStage && window.setMissionStage(4)')
            page.evaluate('window.teleportAndSync && window.teleportAndSync(9.0, -1.4)')
        def reset(): page.keyboard.press('r'); page.wait_for_timeout(80)
        try:
            for width,height in [(1440,900),(768,1024),(390,844)]:
                load(width,height)
                deck=page.locator('#cookingDeck').bounding_box()
                world=page.locator('#world').bounding_box()
                character=page.locator('#player').bounding_box()
                check(f'{width}: upper movement and lower cooking visible',
                      world['height'] >= 220 and world['y']+world['height'] <= deck['y']+2
                      and deck['y'] < height-120 and deck['y']+deck['height'] <= height+2)
                check(f'{width}: player inside upper viewport',
                      character['x'] >= 0 and character['x']+character['width'] <= width
                      and character['y'] >= world['y'] and character['y']+character['height'] <= world['y']+world['height'])
                check(f'{width}: no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                page.screenshot(path=str(out/f'layout-{width}.png'),full_page=True)
            load(1440,900)
            before=page.locator('#player').evaluate('(el)=>parseFloat(el.style.left)')
            page.keyboard.down('d');page.wait_for_timeout(600);page.keyboard.up('d')
            after=page.locator('#player').evaluate('(el)=>parseFloat(el.style.left)')
            check('keyboard moves character',after > before+35)
            reset()
            page.keyboard.down('ArrowDown');page.wait_for_timeout(300);page.keyboard.up('ArrowDown')
            check('arrows do not scroll page',page.evaluate('scrollY') == 0)
            reset()
            prepare(['pork','douban','garlic','pepper'])
            wok_station()
            page.locator('#heatBtn').click()
            while page.evaluate("prepped.size > 0"):
                page.locator('#addBtn').click()
                page.wait_for_timeout(40)
            for _ in range(3): page.locator('#stirBtn').click()
            check('cannot plate without tofu',page.locator('#plateBtn').is_disabled())
            reset()
            check('R clears wok',page.locator('#wokContents').inner_text() == '空鍋')
            check('R clears selection and prepared food',page.locator('.is-selected,.is-prepped').count() == 0)
            check('R extinguishes flame',page.locator('#flame.is-on').count() == 0)
            prepare(['tofu','pork','douban','garlic'])
            wok_station()
            page.locator('#heatBtn').click()
            while page.evaluate("prepped.size > 0"):
                page.locator('#addBtn').click()
                page.wait_for_timeout(40)
            check('cannot plate before three stirs',page.locator('#plateBtn').is_disabled())
            page.locator('#stirBtn').click();page.locator('#stirBtn').click()
            check('two stirs insufficient',page.locator('#plateBtn').is_disabled())
            page.locator('#heatBtn').click()
            check('cold wok cannot stir or plate',page.locator('#stirBtn').is_disabled() and page.locator('#plateBtn').is_disabled())
            page.locator('#heatBtn').click();page.locator('#stirBtn').click()
            page.wait_for_function("window.getMissionStage() === 5 || (window.cookedDish && window.cookedDish.isSimmered)", timeout=8000)
            check('valid recipe can plate',page.locator('#plateBtn').is_enabled())
            prepare(['scallion'])
            wok_station()
            page.locator('#addBtn').click()
            check('new ingredients require stirring again',page.locator('#plateBtn').is_disabled())
            for _ in range(3):page.locator('#stirBtn').click()
            page.wait_for_function("window.getMissionStage() === 5 || (window.cookedDish && window.cookedDish.isSimmered)", timeout=8000)
            page.locator('#plateBtn').click()
            page.wait_for_function("window.plated === true", timeout=3000)
            expect(page.locator('#wokContents')).to_have_text('麻婆豆腐完成')
            check('completed recipe locks cookware',page.locator('#addBtn').is_disabled() and page.locator('#stirBtn').is_disabled())
            page.screenshot(path=str(out/'cooked-desktop.png'))
            reset()
            prepare(['tofu'])
            check('second session can prepare food',page.locator('[data-food="tofu"].is-prepped').count() == 1)
            check('no browser JavaScript errors',not errors)
            check('no failing browser requests',not failures)
        finally:
            report={'transport':'inline local source (not HTTP)' if args.inline else args.base_url,
                    'browser':browser.version,'tests':results,'errors':errors,'failed_requests':failures,
                    'source_sha256':{x:hashlib.sha256((ROOT/x).read_bytes()).hexdigest() for x in ['index.html','styles.css','r2-fixes.css','src/main.js']},
                    'scope':'2D prototype behavior only. Not 3D art approval, not remote deployment proof.'}
            (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            browser.close()
    print(f'Browser QA PASS: {len(results)} checks; transport={report["transport"]}')

if __name__ == '__main__': main()
