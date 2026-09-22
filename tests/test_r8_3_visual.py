"""R8.3 visual regression: desktop clinical layout and hierarchy repair.
Asserts measurable layout properties at 1536×1024 and other key viewports.
No gameplay state mutation or teleporting.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
from inline_shift_preview import inline_document

ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser()
parser.add_argument("--base-url")
parser.add_argument("--inline", action="store_true")
parser.add_argument("--browser")
parser.add_argument("--output", default="qa/current/r8-3-visual")
args = parser.parse_args()

assert args.inline or args.base_url

out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)

checks = []
errors = []
failed_requests = []


def done(name):
    checks.append({"name": name, "status": "PASS"})
    print("PASS:", name, flush=True)


def fail(name, detail):
    checks.append({"name": name, "status": "FAIL", "detail": detail})
    print("FAIL:", name, "—", detail, flush=True)
    raise AssertionError(f"{name}: {detail}")


try:
    with sync_playwright() as pw:
        launch = {"headless": True, "args": ["--no-sandbox"]}
        if args.browser:
            launch["executable_path"] = args.browser

        browser = pw.chromium.launch(**launch)

        # -------------------------------------------------------
        # PRIMARY VIEWPORT: 1536×1024
        # -------------------------------------------------------
        page = browser.new_page(viewport={"width": 1536, "height": 1024})
        page.set_default_timeout(30000)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "response",
            lambda r: failed_requests.append(r.url) if r.status >= 400 else None,
        )

        if args.inline:
            page.set_content(inline_document(ROOT), wait_until="load")
        else:
            response = page.goto(args.base_url, wait_until="networkidle")
            assert response and response.status == 200

        page.wait_for_function(
            """() =>
                window.CKClinic &&
                window.CKClinicRules &&
                window.CKService &&
                window.getSceneStatus &&
                getSceneStatus().imagesReady &&
                document.querySelectorAll('#requestIcons .rx-chip').length === 7
            """
        )

        page.screenshot(path=str(out / "initial-1536x1024.png"))

        # 1. World strip height: 116–155 px
        world_box = page.locator("#world").bounding_box()
        assert world_box, "#world not found"
        h = world_box["height"]
        if not (116 <= h <= 155):
            fail("world height 116-155 @ 1536×1024", f"height={h}")
        done("world strip height 116-155 @ 1536×1024")

        # 2. No horizontal page overflow
        overflow = page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        )
        if not overflow:
            fail("no horizontal overflow @ 1536×1024",
                 f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')} innerWidth=1536")
        done("no horizontal overflow @ 1536×1024")

        # 3. All 7 rx-chips visible
        chips = page.locator("#requestIcons .rx-chip")
        n_chips = chips.count()
        if n_chips != 7:
            fail("7 rx-chips visible", f"count={n_chips}")
        for i in range(n_chips):
            if not chips.nth(i).is_visible():
                fail("all 7 rx-chips visible", f"chip {i} not visible")
        done("all 7 rx-chips visible @ 1536×1024")

        # 4. clinicWish must contain patient complaint, NOT 'Douban '/'Garlic '/'Pepper '
        wish_text = page.locator("#clinicWish").inner_text()
        for bad in ("Douban ", "Garlic ", "Pepper ", "Scallion ", "Chili "):
            if bad in wish_text:
                fail("clinicWish shows complaint not prescription",
                     f"found '{bad}' in clinicWish: {wish_text[:80]}")
        if not wish_text.strip():
            fail("clinicWish shows complaint not prescription", "clinicWish is empty")
        done("clinicWish shows patient complaint, not prescription summary")

        # 5. rx-heading visible
        rx_heading = page.locator(".rx-heading")
        if rx_heading.count() == 0:
            fail("rx-heading present", "no .rx-heading element found")
        if not rx_heading.first.is_visible():
            fail("rx-heading visible", ".rx-heading not visible")
        done("prescription section heading (.rx-heading) visible")

        # 6. Fixed ingredient opacity >= 0.80 (no longer faded to 46%)
        for food in ("tofu", "pork"):
            opacity = page.evaluate(
                """food => {
                    const btn = document.querySelector(`button[data-food="${food}"]`);
                    if (!btn) return null;
                    return parseFloat(getComputedStyle(btn).opacity);
                }""",
                food
            )
            if opacity is None:
                fail(f"fixed ingredient {food} opacity", "button not found")
            if opacity < 0.80:
                fail(f"fixed ingredient {food} opacity >= 0.80",
                     f"opacity={opacity:.3f}")
        done("fixed ingredient (tofu/pork) opacity >= 0.80")

        # 7. Station button display opacity >= 0.90
        station_btns = page.locator("#world .map-station")
        n_stations = station_btns.count()
        assert n_stations == 4, f"expected 4 map-station, got {n_stations}"
        for i in range(n_stations):
            op = station_btns.nth(i).evaluate(
                "(el) => parseFloat(getComputedStyle(el).opacity)"
            )
            if op < 0.90:
                label = station_btns.nth(i).inner_text()
                fail(f"station button opacity >= 0.90",
                     f"station {i} ({label!r}) opacity={op:.3f}")
        done("all 4 station buttons opacity >= 0.90")

        # --------------------------------------------------
        # Move to PREP panel to check board height
        # --------------------------------------------------
        page.locator("#consultConfirmBtn").click()

        page.wait_for_function(
            """() => {
                const s = getSceneStatus();
                return s.routeLength === 0 &&
                       s.interactiveTarget &&
                       s.interactiveTarget.id === 'prep';
            }""",
            timeout=15000
        )
        page.wait_for_timeout(300)

        page.screenshot(path=str(out / "prep-1536x1024.png"))

        # 8. #panel-prep visible and fills available workspace
        prep_box = page.locator("#panel-prep").bounding_box()
        assert prep_box, "#panel-prep not found"
        if not page.locator("#panel-prep").is_visible():
            fail("#panel-prep visible in prep stage", "panel-prep not visible")
        done("#panel-prep visible @ 1536×1024 prep stage")

        # 9. #boardStage height >= 170 px
        board_box = page.locator("#boardStage").bounding_box()
        assert board_box, "#boardStage not found"
        bh = board_box["height"]
        if bh < 170:
            fail("#boardStage height >= 170 @ 1536×1024", f"height={bh}")
        done(f"#boardStage height {bh:.0f}px >= 170 @ 1536×1024")

        # 10. Ingredient card max width <= 115 px
        card_widths = page.evaluate("""
            () => Array.from(
                document.querySelectorAll('#panel-prep .ingredient-tray button')
            ).map(b => b.getBoundingClientRect().width)
        """)
        max_w = max(card_widths) if card_widths else 0
        if max_w > 115:
            fail("ingredient card width <= 115 @ 1536×1024", f"max_width={max_w:.1f}")
        done(f"ingredient card width {max_w:.1f}px <= 115 @ 1536×1024")

        # 11. No prep panel horizontal overflow
        prep_overflow = page.locator("#panel-prep").evaluate(
            "(el) => el.scrollWidth <= el.clientWidth + 1"
        )
        if not prep_overflow:
            fail("prep panel no horizontal overflow", "internal overflow detected")
        done("prep panel no internal horizontal overflow")

        # --------------------------------------------------
        # 12. Wok stage screenshot
        # --------------------------------------------------
        page.locator("#prepDoneBtn").click()
        page.wait_for_function(
            """() => {
                const s = getSceneStatus();
                return s.routeLength === 0 &&
                       s.interactiveTarget &&
                       s.interactiveTarget.id === 'wok';
            }""",
            timeout=15000
        )
        page.wait_for_timeout(200)
        page.screenshot(path=str(out / "wok-1536x1024.png"))
        done("wok stage screenshot captured")

        # Cook through to serve for serve screenshot
        page.locator("#heatBtn").click()  # off -> low
        page.locator("#heatBtn").click()  # low -> high
        for _ in range(3):
            page.locator("#stirBtn").click()
            page.wait_for_timeout(80)
        page.wait_for_function(
            "() => window.wok && window.wok.isSimmered === true",
            timeout=12000
        )
        # Turn off heat
        for _ in range(3):
            if page.evaluate("window.wok.flame === 'off'"):
                break
            page.locator("#heatBtn").click()
            page.wait_for_timeout(80)

        page.locator("#wokCookDoneBtn").click()
        page.wait_for_function(
            """() => {
                const s = getSceneStatus();
                return s.routeLength === 0 &&
                       s.interactiveTarget &&
                       s.interactiveTarget.id === 'serve';
            }""",
            timeout=15000
        )
        page.wait_for_timeout(200)
        page.screenshot(path=str(out / "serve-1536x1024.png"))
        done("serve stage screenshot captured")

        # --------------------------------------------------
        # MOBILE VIEWPORT: 390×844
        # --------------------------------------------------
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(200)
        page.screenshot(path=str(out / "mobile-390x844.png"))

        # Mobile: no horizontal overflow
        mob_overflow = page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        )
        if not mob_overflow:
            fail("no horizontal overflow @ 390×844",
                 f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')}")
        done("no horizontal overflow @ 390×844")

        # --------------------------------------------------
        # Additional viewports: no overflow check
        # --------------------------------------------------
        for w, h in [(1440, 900), (1366, 768), (1024, 768)]:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(100)
            sw = page.evaluate("document.documentElement.scrollWidth")
            if sw > w + 1:
                fail(f"no horizontal overflow @ {w}×{h}", f"scrollWidth={sw}")
        done("no horizontal overflow at 1440×900, 1366×768, 1024×768")

        assert not errors, f"JS errors: {errors}"
        assert not failed_requests, f"Failed requests: {failed_requests[:5]}"
        done("no JS errors or failed HTTP requests")

        browser.close()

except Exception as e:
    checks.append({"name": "R8.3 visual regression", "status": "FAIL", "error": str(e)})
    raise

finally:
    (out / "report.json").write_text(
        json.dumps(
            {
                "mode": "INLINE_OFFLINE" if args.inline else "HTTP_REAL_INPUT",
                "base_url": args.base_url,
                "checks": checks,
                "errors": errors,
                "failed_requests": failed_requests,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    pass_count = sum(1 for c in checks if c["status"] == "PASS")
    fail_count = sum(1 for c in checks if c["status"] == "FAIL")
    print(f"\nR8.3 Visual QA: {pass_count} PASS, {fail_count} FAIL")
