"""Generates multi-angle 3D character turnaround renders (Front, Back, Left, Right, 3/4)
for DR. SPEED and Patient Office Worker, rendering directly from the 3D models.
"""
import base64
from pathlib import Path
from PIL import Image
import io
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

RENDER_SCRIPT = """
() => new Promise(async (resolve, reject) => {
  try {
    const THREE = window.THREE;
    const loader = new THREE.GLTFLoader();

    function loadModel(url) {
      return new Promise((res, rej) => {
        loader.load(url, (gltf) => res(gltf.scene), undefined, rej);
      });
    }

    const speedModel = await loadModel('assets/models/characters/dr_speed_placeholder.glb');
    const patientModel = await loadModel('assets/models/characters/patient_office_placeholder.glb');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e272c);

    // Studio lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xaac4d0, 0.8);
    fillLight.position.set(-2, 2, -2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    const w = 512, h = 640;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 20);

    const angles = [
      { name: 'front', pos: [0, 1.05, 2.7], target: [0, 0.95, 0] },
      { name: 'back', pos: [0, 1.05, -2.7], target: [0, 0.95, 0] },
      { name: 'side_left', pos: [-2.7, 1.05, 0], target: [0, 0.95, 0] },
      { name: 'side_right', pos: [2.7, 1.05, 0], target: [0, 0.95, 0] },
      { name: 'three_quarter', pos: [1.9, 1.2, 1.9], target: [0, 0.95, 0] }
    ];

    const results = { drSpeed: {}, patient: {} };

    // Render Dr. Speed
    scene.add(speedModel);
    for (const a of angles) {
      camera.position.set(...a.pos);
      camera.lookAt(...a.target);
      renderer.render(scene, camera);
      results.drSpeed[a.name] = canvas.toDataURL('image/png').split(',')[1];
    }
    scene.remove(speedModel);

    // Render Patient
    scene.add(patientModel);
    patientModel.position.set(0, 0, 0);
    for (const a of angles) {
      camera.position.set(a.pos[0] * 0.9, 0.85, a.pos[2] * 0.9);
      camera.lookAt(0, 0.65, 0);
      renderer.render(scene, camera);
      results.patient[a.name] = canvas.toDataURL('image/png').split(',')[1];
    }
    scene.remove(patientModel);

    resolve(results);
  } catch (err) {
    reject(err.stack || err.message || String(err));
  }
})
"""

def main():
    print("Rendering 3D character turnaround multi-angle views...")
    gl_args = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--in-process-gpu']
    with sync_playwright() as p:
        browser = p.chromium.launch(args=gl_args)
        page = browser.new_page()
        page.goto('http://127.0.0.1:8000/')
        data = page.evaluate(RENDER_SCRIPT)
        browser.close()

    # Save Dr. Speed Turnaround images
    speed_dir = ROOT / 'assets/characters/dr_speed'
    speed_dir.mkdir(parents=True, exist_ok=True)

    speed_imgs = []
    for angle in ['front', 'back', 'side_left', 'side_right', 'three_quarter']:
        raw = base64.b64decode(data['drSpeed'][angle])
        img_path = speed_dir / f'dr_speed_{angle}.png'
        img_path.write_bytes(raw)
        speed_imgs.append(Image.open(io.BytesIO(raw)))
        print(f"Saved: {img_path.relative_to(ROOT)} ({len(raw)} bytes)")

    # Composite Dr. Speed Turnaround Sheet (5 panels horizontal)
    pw, ph = speed_imgs[0].size
    sheet = Image.new('RGB', (pw * 5, ph), (23, 33, 38))
    for i, im in enumerate(speed_imgs):
        sheet.paste(im, (i * pw, 0))
    sheet_path = speed_dir / 'dr_speed_turnaround_sheet.png'
    sheet.save(sheet_path)
    print(f"Composited: {sheet_path.relative_to(ROOT)} ({sheet.size})")

    # Save Patient Office Worker Turnaround images
    pat_dir = ROOT / 'assets/characters/patient_office'
    pat_dir.mkdir(parents=True, exist_ok=True)

    pat_imgs = []
    for angle in ['front', 'back', 'side_left', 'side_right', 'three_quarter']:
        raw = base64.b64decode(data['patient'][angle])
        img_path = pat_dir / f'patient_office_{angle}.png'
        img_path.write_bytes(raw)
        pat_imgs.append(Image.open(io.BytesIO(raw)))
        print(f"Saved: {img_path.relative_to(ROOT)} ({len(raw)} bytes)")

    # Composite Patient Turnaround Sheet
    sheet_pat = Image.new('RGB', (pw * 5, ph), (23, 33, 38))
    for i, im in enumerate(pat_imgs):
        sheet_pat.paste(im, (i * pw, 0))
    sheet_pat_path = pat_dir / 'patient_office_turnaround_sheet.png'
    sheet_pat.save(sheet_pat_path)
    print(f"Composited: {sheet_pat_path.relative_to(ROOT)} ({sheet_pat.size})")

if __name__ == '__main__':
    main()
