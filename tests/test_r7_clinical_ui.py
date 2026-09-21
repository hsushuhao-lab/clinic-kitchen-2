from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_r7_assets_are_loaded_last():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    assert 'clinical-r7.css' in html
    assert 'src/clinical-r7.js' in html
    assert html.index('clinical-r7.css') > html.index('service-polish.css')
    assert html.index('src/clinical-r7.js') > html.index('src/service-polish.js')

def test_r7_ui_contract():
    js=(ROOT/'src/clinical-r7.js').read_text(encoding='utf-8')
    css=(ROOT/'clinical-r7.css').read_text(encoding='utf-8')
    for token in ['ANXIETY','IMPULSIVITY','LANGUAGE','MEMORY','SLEEPINESS','patientSelfRating','visualPortionPicker','autoDeliver']:
        assert token in js
    assert '20dvh' in css
    assert '#clinicResult{overflow:auto' in css

def test_top_world_has_no_chibi_patient():
    scene=(ROOT/'src/scene2d.js').read_text(encoding='utf-8')
    assert "ctx.drawImage(im,frame*CW,0,CW,CH" not in scene
