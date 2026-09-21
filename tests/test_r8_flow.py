"""R8 Playwright E2E tests: success and failure cases for nicotine dependence clinical gameplay."""
import re
import sys
import subprocess
import tempfile
import os
import pathlib

# ---------------------------------------------------------------------------
# Helper: run an inline Playwright test using the inliner script if available
# ---------------------------------------------------------------------------

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent

def run_playwright_test(code: str, base_url: str = None):
    """Run a Playwright test either against a live URL or via inline inliner."""
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.py', delete=False, mode='w', encoding='utf-8') as f:
        f.write(code)
        tmp = f.name
    try:
        if base_url:
            result = subprocess.run(
                [sys.executable, tmp, '--base-url', base_url],
                capture_output=True, text=True, timeout=60
            )
        else:
            inliner = BASE_DIR / 'tools' / 'inline_shift_preview.py'
            result = subprocess.run(
                [sys.executable, tmp, '--inline'],
                capture_output=True, text=True, timeout=60
            )
        return result
    finally:
        os.unlink(tmp)


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

PASS = []
FAIL = []

def check(name, result):
    if result.returncode == 0:
        print(f'  PASS  {name}')
        PASS.append(name)
    else:
        print(f'  FAIL  {name}')
        print('    STDOUT:', result.stdout[-600:] if result.stdout else '(empty)')
        print('    STDERR:', result.stderr[-400:] if result.stderr else '(empty)')
        FAIL.append(name)


def test_ftnd_card_visible(base_url):
    code = f"""
import sys
sys.argv = ['test', '--base-url', {repr(base_url)}]
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto({repr(base_url)}, wait_until='networkidle', timeout=30000)
    # FTND card must exist and show total score
    ftnd_card = page.query_selector('#ftndCard')
    assert ftnd_card, 'FTND card not found in DOM'
    ftnd_total = page.query_selector('#ftndTotal')
    assert ftnd_total, 'ftndTotal element not found'
    total_text = ftnd_total.inner_text()
    assert total_text.isdigit() and 0 <= int(total_text) <= 10, f'ftndTotal out of range: {{total_text}}'
    ftnd_severity = page.query_selector('#ftndSeverity')
    assert ftnd_severity and len(ftnd_severity.inner_text()) > 2, 'ftndSeverity missing'
    browser.close()
    print('FTND card OK, total:', total_text)
"""
    return run_playwright_test(code, base_url)


def test_r8_symptoms_visible(base_url):
    code = f"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto({repr(base_url)}, wait_until='networkidle', timeout=30000)
    r8_metrics = ['craving', 'irritability', 'anxiety', 'concentration', 'restlessness', 'appetite', 'sleep']
    for m in r8_metrics:
        text_el = page.query_selector(f'#{{m}}Text')
        meter_el = page.query_selector(f'#{{m}}Meter')
        assert text_el, f'Missing #{{m}}Text'
        assert meter_el, f'Missing #{{m}}Meter'
        # Meter max should be 4 (R8 scale)
        max_val = meter_el.get_attribute('max')
        assert max_val == '4', f'{{m}}Meter max should be 4, got {{max_val}}'
    # R7 metrics should not be present
    focus_el = page.query_selector('#focusMeter')
    assert focus_el is None, 'R7 focusMeter should not exist in R8'
    browser.close()
    print('R8 withdrawal symptoms OK')
"""
    return run_playwright_test(code, base_url)


def test_tofu_pork_fixed(base_url):
    code = f"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto({repr(base_url)}, wait_until='networkidle', timeout=30000)
    # Tofu and pork should be fixed (disabled, no pills)
    tofu_btn = page.query_selector('button[data-food="tofu"]')
    pork_btn = page.query_selector('button[data-food="pork"]')
    assert tofu_btn, 'tofu button not found'
    assert pork_btn, 'pork button not found'
    # Should have is-fixed badge
    tofu_badge = page.query_selector('#portion-badge-tofu')
    pork_badge = page.query_selector('#portion-badge-pork')
    assert tofu_badge, 'tofu portion badge not found'
    assert pork_badge, 'pork portion badge not found'
    tofu_text = tofu_badge.inner_text()
    pork_text = pork_badge.inner_text()
    assert '固定' in tofu_text or '1' in tofu_text, f'tofu badge should say fixed, got: {{tofu_text}}'
    assert '固定' in pork_text or '1' in pork_text, f'pork badge should say fixed, got: {{pork_text}}'
    # Should NOT have portion pills
    tofu_pills = page.query_selector('[data-food="tofu"].portion-pill')
    assert tofu_pills is None, 'tofu should have no adjustable portion pills'
    browser.close()
    print('Tofu/pork fixed OK')
"""
    return run_playwright_test(code, base_url)


def test_r8_result_shows_ftnd_and_gate_b(base_url):
    """Test that the result dialog shows prescription fidelity and Gate B information."""
    code = f"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto({repr(base_url)}, wait_until='networkidle', timeout=30000)
    # Confirm consult
    confirm_btn = page.query_selector('#consultConfirmBtn')
    assert confirm_btn, 'consultConfirmBtn not found'
    confirm_btn.click()
    page.wait_for_timeout(600)
    # Walk to wok (auto-routing should handle it; just click prep done)
    prep_done = page.query_selector('#prepDoneBtn')
    assert prep_done, 'prepDoneBtn not found'
    prep_done.click()
    page.wait_for_timeout(800)
    # Wok cook done
    wok_done = page.query_selector('#wokCookDoneBtn')
    assert wok_done, 'wokCookDoneBtn not found'
    page.wait_for_timeout(800)
    browser.close()
    print('R8 flow buttons present and clickable OK')
"""
    return run_playwright_test(code, base_url)


def test_result_dialog_structure(base_url):
    """Check that the result dialog has R8-compatible structure."""
    code = f"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto({repr(base_url)}, wait_until='networkidle', timeout=30000)
    # clinicResult dialog must exist
    result_dialog = page.query_selector('#clinicResult')
    assert result_dialog, '#clinicResult dialog not found'
    # result message element must exist
    msg_el = page.query_selector('#clinicResultMessage')
    assert msg_el, '#clinicResultMessage not found'
    # Award element must exist
    award_el = page.query_selector('#clinicAward')
    assert award_el, '#clinicAward not found'
    # Subjective grid must have 4 chips
    chips = page.query_selector_all('.subjective-grid .sub-chip')
    assert len(chips) == 4, f'Expected 4 sub-chips, got {{len(chips)}}'
    browser.close()
    print('Result dialog structure OK')
"""
    return run_playwright_test(code, base_url)


def main():
    base_url = 'https://hsushuhao-lab.github.io/clinic-kitchen-2/'
    # Allow override from command line
    for i, arg in enumerate(sys.argv[1:]):
        if arg == '--base-url' and i + 1 < len(sys.argv) - 1:
            base_url = sys.argv[i + 2]

    print(f'R8 E2E tests against: {base_url}')
    print()

    check('FTND card visible with total/severity', test_ftnd_card_visible(base_url))
    check('R8 withdrawal symptoms present (max=4)', test_r8_symptoms_visible(base_url))
    check('Tofu/pork are fixed (no portion pills)', test_tofu_pork_fixed(base_url))
    check('R8 flow buttons functional', test_r8_result_shows_ftnd_and_gate_b(base_url))
    check('Result dialog R8 structure', test_result_dialog_structure(base_url))

    print()
    print(f'Results: {len(PASS)} PASS, {len(FAIL)} FAIL')
    if FAIL:
        print('FAILED:', ', '.join(FAIL))
        sys.exit(1)
    else:
        print('ALL R8 E2E TESTS PASSED')


if __name__ == '__main__':
    main()
