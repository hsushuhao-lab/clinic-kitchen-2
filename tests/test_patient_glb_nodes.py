"""Test verification for patient GLB character model hierarchy and node binding."""
from pathlib import Path
import json
import struct
import http.server
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def parse_glb_nodes(glb_path):
    raw = glb_path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2
    offset = 12
    document = None
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if kind == 0x4e4f534a:
            document = json.loads(raw[offset:offset + size].decode('utf-8').rstrip(' \0'))
            break
        offset += size
    assert document is not None, "Failed to parse GLB JSON chunk"
    node_names = [n.get('name') for n in document.get('nodes', [])]
    return node_names

def test_patient_glb_structure():
    glb_path = ROOT / 'assets/models/characters/patient_office_placeholder.glb'
    assert glb_path.is_file(), f"Missing GLB file: {glb_path}"
    
    node_names = parse_glb_nodes(glb_path)
    print(f"GLB Node names found: {node_names}")
    
    assert 'PatientRightArm' in node_names, "Missing 'PatientRightArm' in patient_office_placeholder.glb nodes!"
    assert 'PatientHead' in node_names, "Missing 'PatientHead' in patient_office_placeholder.glb nodes!"
    print("[PASS] GLB file contains required PatientRightArm and PatientHead nodes.")

def test_patient_runtime_binding():
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
        page.wait_for_timeout(500)

        status_3d = page.evaluate("window.get3DStatus()")
        assert status_3d['usingGlb'] is True, "Expected 3D scene to use GLB models, but usingGlb was False (fell back to procedural)!"

        # Verify patient nodes exist in the loaded Three.js hierarchy
        nodes_info = page.evaluate("""() => {
            const group = window.scene3DPatientGroup;
            if (!group) {
                // Try searching scene
                const found = window.scene3DScene ? window.scene3DScene.getObjectByName('Character_PatientOffice_Placeholder') || window.scene3DScene.getObjectByName('Procedural_PatientOffice_Placeholder') : null;
                if (!found) return { found: false };
                return {
                    found: true,
                    name: found.name,
                    hasRightArm: !!found.getObjectByName('PatientRightArm'),
                    hasHead: !!found.getObjectByName('PatientHead')
                };
            }
            return {
                found: true,
                name: group.name,
                hasRightArm: !!group.getObjectByName('PatientRightArm'),
                hasHead: !!group.getObjectByName('PatientHead')
            };
        }""")
        print("Runtime patient node check:", nodes_info)
        assert nodes_info.get('hasRightArm') is True, "Runtime GLB does not have PatientRightArm!"
        assert nodes_info.get('hasHead') is True, "Runtime GLB does not have PatientHead!"
        print("[PASS] Runtime GLB loaded with PatientRightArm and PatientHead successfully.")

if __name__ == '__main__':
    test_patient_glb_structure()
    test_patient_runtime_binding()
