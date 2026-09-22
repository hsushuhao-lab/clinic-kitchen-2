"""R8.2 acceptance: fixed camera, automatic X-only workflow,
single clinical prescription, explicit rice/soup choices, and next-patient behavior.
Real HTTP/inline UI interaction only; no gameplay state mutation or teleporting.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright, expect
from inline_shift_preview import inline_document

ROOT = Path(__file__).resolve().parents[1]

HALF_RICE = "\u534a\u7897\u98ef"
UNSELECTED_RICE = "\u672a\u76db\u98ef"

parser = argparse.ArgumentParser()
parser.add_argument("--base-url")
parser.add_argument("--inline", action="store_true")
parser.add_argument("--browser")
parser.add_argument("--output", default="qa/current/r8-2")
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

def approx(a, b, tol=0.02):
    return abs(float(a) - float(b)) <= tol

try:
    with sync_playwright() as pw:
        launch = {
            "headless": True,
            "args": ["--no-sandbox"],
        }
        if args.browser:
            launch["executable_path"] = args.browser

        browser = pw.chromium.launch(**launch)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        page.set_default_timeout(30000)

        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "response",
            lambda r: failed_requests.append(r.url)
            if r.status >= 400 else None
        )

        if args.inline:
            page.set_content(
                inline_document(ROOT),
                wait_until="load"
            )
        else:
            response = page.goto(
                args.base_url,
                wait_until="networkidle"
            )
            assert response and response.status == 200

        page.wait_for_function(
            """() =>
                window.CKClinic &&
                window.CKClinicRules &&
                window.CKService &&
                window.getSceneStatus &&
                getSceneStatus().imagesReady &&
                document.querySelectorAll('#requestIcons .rx-chip').length === 7 &&
                document.querySelectorAll('#requestIcons .rx-icon').length === 7
            """
        )

        def scene():
            return page.evaluate("getSceneStatus()")

        def cook():
            return page.evaluate("getCookingStatus()")

        def clinic():
            return page.evaluate("CKClinic.snapshot()")

        def shift():
            return page.evaluate("CKShift.snapshot()")

        def wait_station(station):
            page.wait_for_function(
                """id => {
                    const s = getSceneStatus();
                    return s.routeLength === 0 &&
                           s.interactiveTarget &&
                           s.interactiveTarget.id === id;
                }""",
                arg=station
            )

        def assert_fixed_track():
            s = scene()
            assert approx(s["playerPos"]["z"], -1.35, 0.01), s["playerPos"]

        def set_prescription_portions(rx, correct):
            for food in [
                "douban",
                "garlic",
                "pepper",
                "scallion",
                "chili",
            ]:
                target = rx["portions"][food]

                if correct:
                    actual = target
                else:
                    if target == 0:
                        actual = 1
                    elif target == 1:
                        actual = 0
                    else:
                        actual = 0

                value = (
                    "0.5"
                    if actual == 0.5
                    else str(int(actual))
                )

                selector = (
                    '.portion-pill'
                    f'[data-food="{food}"]'
                    f'[data-portion="{value}"]'
                )

                page.locator(selector).click()

                assert page.evaluate(
                    """x => window.preparedTray[x.food] === x.value""",
                    {"food": food, "value": actual}
                )

        def cook_current_order(expect_success, tag):
            start = clinic()
            rx = start["prescription"]

            page.locator("#consultConfirmBtn").click()

            wait_station("prep")
            expect(page.locator("#panel-prep")).to_be_visible()
            assert_fixed_track()

            # Regression guard: PREP must expose a real cutting-board workspace,
            # not collapse the board into a thin strip under the ingredient row.
            board_box = page.locator("#boardStage").bounding_box()
            assert board_box and board_box["height"] >= 140, board_box

            set_prescription_portions(
                rx,
                correct=expect_success
            )

            page.locator("#prepDoneBtn").click()

            wait_station("wok")
            expect(page.locator("#panel-wok")).to_be_visible()
            assert_fixed_track()

            # Regression guard: automatic PREP -> WOK transfer must synchronize
            # logical contents with the private visual inWok state.
            expected_wok = {
                food for food, portion in page.evaluate("window.preparedTray").items()
                if portion > 0
            }
            actual_wok = set(cook()["inWok"])
            assert actual_wok == expected_wok, (actual_wok, expected_wok)
            assert page.evaluate("window.wok.hasFood === true")

            # The failure-path deliberately changes which adjustable ingredients
            # are non-zero. Validate the presence of every expected visual directly;
            # do not require an exact DOM child count because decorative/stale-safe
            # renderer nodes are not part of the gameplay contract.
            visual_selectors = {
                "tofu": ".wok-food-tofu",
                "pork": ".wok-food-pork",
                "douban": ".wok-food-douban",
                "garlic": ".wok-food-garlic",
                "scallion": ".wok-food-scallion",
                "chili": ".wok-food-chili",
                "pepper": ".wok-food-pepper",
            }
            for food in expected_wok:
                page.wait_for_selector(
                    "#wokFoodLayer " + visual_selectors[food],
                    state="visible"
                )

            expect(page.locator("#heatBtn")).to_be_enabled()

            # off -> low -> high
            page.locator("#heatBtn").click()
            page.locator("#heatBtn").click()

            assert page.evaluate(
                "window.wok.flame === 'high'"
            )

            expect(page.locator("#stirBtn")).to_be_enabled()

            for _ in range(3):
                page.locator("#stirBtn").click()
                page.wait_for_timeout(100)

            page.wait_for_function(
                "() => window.wok && window.wok.isSimmered === true",
                timeout=10000
            )

            # high -> off
            for _ in range(3):
                if page.evaluate("window.wok.flame === 'off'"):
                    break
                page.locator("#heatBtn").click()
                page.wait_for_timeout(80)

            assert page.evaluate(
                "window.wok.flame === 'off'"
            )

            expect(
                page.locator("#wokCookDoneBtn")
            ).to_be_enabled()

            page.locator("#wokCookDoneBtn").click()

            wait_station("serve")
            expect(page.locator("#panel-serve")).to_be_visible()
            assert_fixed_track()

            # SERVE regression guard: prescription banner must remain a compact
            # header and may not consume the entire flexible service workspace.
            serve_panel = page.locator("#panel-serve").bounding_box()
            serve_banner = page.locator("#servePrescriptionBanner").bounding_box()
            assert serve_panel and serve_banner
            assert serve_banner["height"] < min(90, serve_panel["height"] * 0.25), (serve_panel, serve_banner)
            expect(page.locator("#riceCookerWidget")).to_be_visible()
            expect(page.locator("#misoSoupWidget")).to_be_visible()

            # Explicit side selection is mandatory.
            assert page.evaluate(
                f"window.cookedDish.ricePortion === {json.dumps(UNSELECTED_RICE)}"
            )
            assert page.evaluate(
                "window.cookedDish.misoChoice === null"
            )

            expect(
                page.locator("#clinicPlateBtn")
            ).to_be_disabled()

            rice_button = (
                "#riceHalfBtn"
                if rx["rice"] == HALF_RICE
                else "#riceFullBtn"
            )
            page.locator(rice_button).click()

            expect(
                page.locator(rice_button)
            ).to_have_attribute("aria-pressed", "true")

            # Soup still unselected => cannot send.
            expect(
                page.locator("#clinicPlateBtn")
            ).to_be_disabled()

            soup_button = (
                "#misoYesBtn"
                if rx["miso"]
                else "#misoNoBtn"
            )
            page.locator(soup_button).click()

            expect(
                page.locator(soup_button)
            ).to_have_attribute("aria-pressed", "true")

            expect(
                page.locator("#clinicPlateBtn")
            ).to_be_enabled()

            page.locator("#clinicPlateBtn").click()

            page.wait_for_function(
                "() => CKClinic.snapshot().resultOpen === true",
                timeout=15000
            )

            wait_station("consult")
            assert_fixed_track()

            result = clinic()["result"]
            status = shift()["status"]

            assert result is not None
            assert result["checks"][-2]["ok"]
            assert result["checks"][-1]["ok"]

            if expect_success:
                assert result["prescriptionFidelity"] == 100
                assert result["gateB_pass"] is True
                assert result["hardFail"] is False
                assert status == "won", status
            else:
                assert result["prescriptionFidelity"] < 70
                assert result["gateB_pass"] is False
                assert result["hardFail"] is True
                assert status == "lost", status

            page.screenshot(
                path=str(out / f"{tag}-result.png")
            )

            return start, result

        def next_patient(old):
            old_number = old["number"]
            old_id = old["patient"]["id"]

            page.locator("#clinicNextBtn").click()

            page.wait_for_function(
                """n => CKClinic.snapshot().number === n""",
                arg=old_number + 1
            )

            new = clinic()

            assert new["number"] == old_number + 1
            assert new["patient"]["id"] != old_id
            assert new["resultOpen"] is False
            assert cook()["stage"] == 0

            wait_station("consult")
            assert_fixed_track()

            assert page.evaluate(
                "window.cookedDish.misoChoice === null"
            )

            return new

        # -------------------------------------------------
        # Fixed workflow strip
        # -------------------------------------------------

        s0 = scene()

        assert [
            x["id"] for x in s0["stations"]
        ] == ["consult", "prep", "wok", "serve"]

        station_buttons = page.locator(
            "#world [data-station]"
        )

        assert station_buttons.count() == 4
        assert station_buttons.evaluate_all(
            "(xs) => xs.every(x => x.disabled)"
        )

        lefts = station_buttons.evaluate_all(
            "(xs) => xs.map(x => parseFloat(x.style.left))"
        )

        assert len(lefts) == 4
        gaps = [
            lefts[i + 1] - lefts[i]
            for i in range(3)
        ]
        assert max(gaps) - min(gaps) <= 1.0, (lefts, gaps)

        world_box = page.locator("#world").bounding_box()
        assert world_box
        assert 80 <= world_box["height"] <= 115, world_box

        dpad = page.locator("#world .scene-dpad")
        assert dpad.count() == 1
        assert dpad.evaluate(
            "(x) => getComputedStyle(x).display"
        ) == "none"

        move_buttons = page.locator("#world [data-move]")
        assert move_buttons.count() == 4
        assert all(
            not move_buttons.nth(i).is_visible()
            for i in range(move_buttons.count())
        )

        done(
            "fixed compact four-station strip; equal 25% station spacing; no D-pad"
        )

        # -------------------------------------------------
        # Manual movement must do nothing
        # -------------------------------------------------

        before = scene()
        camera_before = before["camera"]

        page.locator("#world").focus()

        page.keyboard.down("d")
        page.wait_for_timeout(350)
        page.keyboard.up("d")

        page.keyboard.down("ArrowRight")
        page.wait_for_timeout(250)
        page.keyboard.up("ArrowRight")

        page.keyboard.down("w")
        page.wait_for_timeout(250)
        page.keyboard.up("w")

        after = scene()

        assert approx(
            after["playerPos"]["x"],
            before["playerPos"]["x"],
            0.001
        )
        assert approx(
            after["playerPos"]["z"],
            before["playerPos"]["z"],
            0.001
        )

        assert approx(
            after["camera"]["x"],
            camera_before["x"]
        )
        assert approx(
            after["camera"]["y"],
            camera_before["y"]
        )

        done(
            "WASD and arrow keys cannot move doctor; overview camera remains fixed"
        )

        # -------------------------------------------------
        # One prescription source
        # -------------------------------------------------

        first = clinic()

        derived = page.evaluate(
            "CKClinicRules.buildClinicalPrescription(CKClinic.snapshot().patient)"
        )

        assert first["prescription"] == derived

        assert page.locator(
            "#requestIcons .rx-chip"
        ).count() == 7

        rx_icons = page.locator("#requestIcons .rx-icon")
        assert rx_icons.count() == 7
        page.wait_for_function(
            """() => Array.from(document.querySelectorAll('#requestIcons .rx-icon'))
                .every(img => img.complete && img.naturalWidth > 0)"""
        )
        wish = page.locator("#clinicWish").inner_text()
        assert "Douban " not in wish and "Garlic " not in wish and "Pepper " not in wish

        assert page.locator("#focusMeter").count() == 0

        assert page.locator(
            "#cravingMeter"
        ).get_attribute("max") == "4"

        done(
            "sidebar and evaluator share one R8 clinical prescription; legacy 0-100 UI absent"
        )

        # -------------------------------------------------
        # Correct order: automatic full workflow
        # -------------------------------------------------

        start_ok, result_ok = cook_current_order(
            True,
            "correct"
        )

        assert result_ok["prescriptionFidelity"] == 100

        done(
            "automatic CONSULT-PREP-WOK-SERVE-CONSULT flow completes correct prescription"
        )

        second = next_patient(start_ok)

        done(
            "next-patient action advances after a successful order"
        )

        # -------------------------------------------------
        # Wrong adjustable prescription: Gate B failure
        # -------------------------------------------------

        start_fail, result_fail = cook_current_order(
            False,
            "gate-b-fail"
        )

        assert result_fail["hardFail"]

        third = next_patient(start_fail)

        assert third["number"] == second["number"] + 1

        done(
            "Gate B failure still advances to a different next patient"
        )

        # -------------------------------------------------
        # Compact viewport
        # -------------------------------------------------

        page.set_viewport_size({
            "width": 375,
            "height": 667
        })
        page.wait_for_timeout(150)

        assert page.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 2"
        )

        dpad = page.locator("#world .scene-dpad")
        assert dpad.count() == 1
        assert dpad.evaluate(
            "(x) => getComputedStyle(x).display"
        ) == "none"

        move_buttons = page.locator("#world [data-move]")
        assert move_buttons.count() == 4
        assert all(
            not move_buttons.nth(i).is_visible()
            for i in range(move_buttons.count())
        )

        page.screenshot(
            path=str(out / "mobile-reset.png")
        )

        done(
            "mobile layout keeps manual movement controls hidden and avoids horizontal page overflow"
        )

        assert not errors, errors
        assert not failed_requests, failed_requests

        done(
            "no uncaught JavaScript errors or failed runtime requests"
        )

        browser.close()

except Exception as exc:
    checks.append({
        "name": "R8.2 acceptance",
        "status": "FAIL",
        "error": str(exc),
    })
    raise

finally:
    (out / "report.json").write_text(
        json.dumps(
            {
                "mode": (
                    "INLINE_OFFLINE"
                    if args.inline
                    else "HTTP_REAL_INPUT"
                ),
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
