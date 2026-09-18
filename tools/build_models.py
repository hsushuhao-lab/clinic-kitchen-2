"""Builds and exports production-quality 3D GLB models for Clinic Kitchen 2.0.
Generates:
  1. assets/models/environment/clinic_kitchen_scene.glb (Continuous 3D walkthrough: Clinic -> Prep -> Kitchen)
  2. assets/models/characters/dr_speed_placeholder.glb (Adult-proportion 1.78m Dr. Speed 3D placeholder)
  3. assets/models/characters/patient_office_placeholder.glb (Adult-proportion seated Office Worker patient)
"""
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

EXPORT_SCRIPT = """
() => new Promise(async (resolve, reject) => {
  try {
    if (!window.THREE) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'src/three.min.js';
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const THREE = window.THREE;
    const exporter = new THREE.GLTFExporter();

    function exportToGlb(object, name) {
      return new Promise((res, rej) => {
        exporter.parse(object, (glb) => {
          const bytes = new Uint8Array(glb);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i += 8192) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
          }
          const b64 = btoa(binary);
          res({ name, b64, size: len });
        }, rej, { binary: true });
      });
    }

    // Material library with PBR standard materials
    const mats = {
      clinicFloor: new THREE.MeshStandardMaterial({ color: 0xd7dedb, roughness: 0.35, metalness: 0.05 }),
      prepFloor: new THREE.MeshStandardMaterial({ color: 0xbcc5c3, roughness: 0.4, metalness: 0.1 }),
      kitchenFloor: new THREE.MeshStandardMaterial({ color: 0x826f63, roughness: 0.65, metalness: 0.15 }),
      clinicWall: new THREE.MeshStandardMaterial({ color: 0xe8ece9, roughness: 0.6, metalness: 0.02 }),
      chairRail: new THREE.MeshStandardMaterial({ color: 0x7a8a86, roughness: 0.4, metalness: 0.1 }),
      stainless: new THREE.MeshStandardMaterial({ color: 0xd0d6d8, roughness: 0.2, metalness: 0.85 }),
      darkSteel: new THREE.MeshStandardMaterial({ color: 0x333b3f, roughness: 0.3, metalness: 0.8 }),
      deskWood: new THREE.MeshStandardMaterial({ color: 0xaa7e52, roughness: 0.45, metalness: 0.05 }),
      blackPlastic: new THREE.MeshStandardMaterial({ color: 0x1a2124, roughness: 0.5, metalness: 0.1 }),
      screenBlue: new THREE.MeshStandardMaterial({ color: 0x2b5876, emissive: 0x1d3d52, roughness: 0.2 }),
      paddedChair: new THREE.MeshStandardMaterial({ color: 0x50616b, roughness: 0.6, metalness: 0.05 }),
      castIron: new THREE.MeshStandardMaterial({ color: 0x222628, roughness: 0.7, metalness: 0.6 }),
      cuttingBoard: new THREE.MeshStandardMaterial({ color: 0xd4a36a, roughness: 0.55, metalness: 0.02 }),
      whiteCoat: new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: 0.4, metalness: 0.02 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xd6aa8b, roughness: 0.55, metalness: 0.0 }),
      hair: new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.8, metalness: 0.05 }),
      trousers: new THREE.MeshStandardMaterial({ color: 0x2e353b, roughness: 0.6, metalness: 0.05 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.35, metalness: 0.1 }),
      suitBlue: new THREE.MeshStandardMaterial({ color: 0x253646, roughness: 0.6, metalness: 0.05 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xa9c8d4, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.65 }),
      goldBrass: new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.9 })
    };

    // Helper to create box meshes
    function box(w, h, d, mat, x, y, z, castShadow = true) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      return mesh;
    }
    function cyl(rt, rb, h, seg, mat, x, y, z) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // ==========================================
    // 1. CONTINUOUS ENVIRONMENT SCENE (-12m to +13m)
    // ==========================================
    const envScene = new THREE.Group();
    envScene.name = 'ClinicKitchenContinuousScene';

    // Floors:
    // Clinic: X = -12.5 to -3 (width 9.5m, depth 7m)
    const floorClinic = box(9.5, 0.1, 7.0, mats.clinicFloor, -7.75, -0.05, 0, false);
    floorClinic.name = 'Floor_Clinic';
    envScene.add(floorClinic);

    // Prep Transition: X = -3 to +3 (width 6m, depth 7m)
    const floorPrep = box(6.0, 0.1, 7.0, mats.prepFloor, 0.0, -0.05, 0, false);
    floorPrep.name = 'Floor_Prep';
    envScene.add(floorPrep);

    // Kitchen: X = +3 to +13 (width 10m, depth 7m)
    const floorKitchen = box(10.0, 0.1, 7.0, mats.kitchenFloor, 8.0, -0.05, 0, false);
    floorKitchen.name = 'Floor_Kitchen';
    envScene.add(floorKitchen);

    // Back Wall (Z = -3.55, height 3.6m)
    const backWallClinic = box(9.5, 3.6, 0.1, mats.clinicWall, -7.75, 1.8, -3.55);
    const backWallPrep = box(6.0, 3.6, 0.1, mats.clinicWall, 0.0, 1.8, -3.55);
    const backWallKitchen = box(10.0, 3.6, 0.1, mats.stainless, 8.0, 1.8, -3.55);
    envScene.add(backWallClinic, backWallPrep, backWallKitchen);

    // Chair rails and trims along back wall
    envScene.add(box(15.5, 0.12, 0.04, mats.chairRail, -4.75, 1.0, -3.48));

    // Left Wall (X = -12.55) & Right Wall (X = +13.05)
    envScene.add(box(0.1, 3.6, 7.0, mats.clinicWall, -12.55, 1.8, 0));
    envScene.add(box(0.1, 3.6, 7.0, mats.stainless, 13.05, 1.8, 0));

    // Ceiling beam / soffit spanning the whole room
    envScene.add(box(25.6, 0.3, 0.4, mats.darkSteel, 0.25, 3.45, 0));

    // --- CLINIC ZONE PROPS (X = -11.5 to -3) ---
    // Doctor's Desk (X = -9.0, Z = -2.0)
    const deskGroup = new THREE.Group();
    deskGroup.name = 'Prop_DoctorDesk';
    deskGroup.add(box(1.8, 0.06, 0.9, mats.deskWood, -9.0, 0.75, -2.0)); // top
    deskGroup.add(box(0.08, 0.72, 0.8, mats.darkSteel, -9.8, 0.36, -2.0)); // left leg
    deskGroup.add(box(0.08, 0.72, 0.8, mats.darkSteel, -8.2, 0.36, -2.0)); // right leg
    deskGroup.add(box(0.5, 0.5, 0.75, mats.darkSteel, -8.45, 0.36, -2.0)); // drawers
    // Monitor on desk
    deskGroup.add(box(0.1, 0.3, 0.1, mats.darkSteel, -9.0, 0.93, -2.2)); // stand
    deskGroup.add(box(0.65, 0.4, 0.04, mats.blackPlastic, -9.0, 1.15, -2.2)); // frame
    deskGroup.add(box(0.61, 0.36, 0.01, mats.screenBlue, -9.0, 1.15, -2.18)); // screen
    // Keyboard & Phone
    deskGroup.add(box(0.42, 0.02, 0.15, mats.blackPlastic, -9.0, 0.79, -1.8));
    deskGroup.add(box(0.2, 0.05, 0.2, mats.blackPlastic, -8.3, 0.81, -2.1));
    envScene.add(deskGroup);

    // Doctor's Chair (X = -9.0, Z = -2.7)
    const docChair = new THREE.Group();
    docChair.name = 'Prop_DoctorChair';
    docChair.add(box(0.5, 0.08, 0.5, mats.paddedChair, -9.0, 0.48, -2.7));
    docChair.add(box(0.46, 0.55, 0.08, mats.paddedChair, -9.0, 0.78, -2.92));
    docChair.add(cyl(0.04, 0.04, 0.44, 8, mats.darkSteel, -9.0, 0.22, -2.7));
    envScene.add(docChair);

    // Patient Chair (X = -7.3, Z = -1.4)
    const patChair = new THREE.Group();
    patChair.name = 'Prop_PatientChair';
    patChair.add(box(0.5, 0.08, 0.5, mats.paddedChair, -7.3, 0.45, -1.4));
    patChair.add(box(0.46, 0.45, 0.08, mats.paddedChair, -7.3, 0.7, -1.62));
    patChair.add(cyl(0.03, 0.03, 0.41, 8, mats.darkSteel, -7.5, 0.2, -1.2));
    patChair.add(cyl(0.03, 0.03, 0.41, 8, mats.darkSteel, -7.1, 0.2, -1.2));
    patChair.add(cyl(0.03, 0.03, 0.41, 8, mats.darkSteel, -7.5, 0.2, -1.6));
    patChair.add(cyl(0.03, 0.03, 0.41, 8, mats.darkSteel, -7.1, 0.2, -1.6));
    envScene.add(patChair);

    // Clinic Medical Cabinet (X = -11.6, Z = -2.6)
    const medCabinet = new THREE.Group();
    medCabinet.name = 'Prop_MedicineCabinet';
    medCabinet.add(box(1.2, 2.1, 0.55, mats.darkSteel, -11.6, 1.05, -2.6));
    medCabinet.add(box(1.1, 1.0, 0.02, mats.glass, -11.6, 1.5, -2.31));
    envScene.add(medCabinet);

    // Examination Bed / Couch (X = -10.5, Z = 2.0)
    const examBed = new THREE.Group();
    examBed.name = 'Prop_ExamBed';
    examBed.add(box(1.9, 0.12, 0.75, mats.paddedChair, -10.5, 0.65, 2.0));
    examBed.add(box(0.06, 0.6, 0.7, mats.stainless, -11.35, 0.3, 2.0));
    examBed.add(box(0.06, 0.6, 0.7, mats.stainless, -9.65, 0.3, 2.0));
    envScene.add(examBed);

    // --- PREP TRANSITION PROPS (X = -3 to +3) ---
    // Scrub Sink (X = -2.0, Z = -2.8)
    const sinkGroup = new THREE.Group();
    sinkGroup.name = 'Prop_ScrubSink';
    sinkGroup.add(box(1.1, 0.85, 0.65, mats.stainless, -2.0, 0.425, -2.8));
    sinkGroup.add(box(0.85, 0.2, 0.45, mats.darkSteel, -2.0, 0.75, -2.8)); // basin
    sinkGroup.add(cyl(0.025, 0.025, 0.3, 8, mats.stainless, -2.0, 1.0, -3.0)); // faucet
    envScene.add(sinkGroup);

    // Ingredient Refrigerator (X = 0.2, Z = -2.8)
    const fridgeGroup = new THREE.Group();
    fridgeGroup.name = 'Prop_Fridge';
    fridgeGroup.add(box(1.2, 2.0, 0.8, mats.stainless, 0.2, 1.0, -2.8));
    fridgeGroup.add(box(0.03, 0.9, 0.03, mats.darkSteel, 0.75, 1.2, -2.38)); // handle 1
    fridgeGroup.add(box(0.03, 0.9, 0.03, mats.darkSteel, -0.35, 1.2, -2.38)); // handle 2
    fridgeGroup.add(box(0.3, 0.1, 0.01, mats.screenBlue, 0.2, 1.7, -2.39)); // temp display
    envScene.add(fridgeGroup);

    // Utility Rolling Cart / Trolley (X = -0.8, Z = 1.8)
    const trolleyGroup = new THREE.Group();
    trolleyGroup.name = 'Prop_UtilityCart';
    trolleyGroup.add(box(0.9, 0.04, 0.6, mats.stainless, -0.8, 0.85, 1.8)); // top shelf
    trolleyGroup.add(box(0.9, 0.04, 0.6, mats.stainless, -0.8, 0.25, 1.8)); // bottom shelf
    trolleyGroup.add(cyl(0.02, 0.02, 0.85, 8, mats.stainless, -1.2, 0.45, 1.55));
    trolleyGroup.add(cyl(0.02, 0.02, 0.85, 8, mats.stainless, -0.4, 0.45, 1.55));
    trolleyGroup.add(cyl(0.02, 0.02, 0.85, 8, mats.stainless, -1.2, 0.45, 2.05));
    trolleyGroup.add(cyl(0.02, 0.02, 0.85, 8, mats.stainless, -0.4, 0.45, 2.05));
    envScene.add(trolleyGroup);

    // Kitchen Order Prescription Printer (X = 2.0, Z = -2.8)
    const rxStation = new THREE.Group();
    rxStation.name = 'Prop_OrderPrinter';
    rxStation.add(box(0.5, 0.9, 0.5, mats.stainless, 2.0, 0.45, -2.8));
    rxStation.add(box(0.35, 0.22, 0.35, mats.blackPlastic, 2.0, 1.01, -2.8));
    rxStation.add(box(0.18, 0.25, 0.01, mats.whiteCoat, 2.0, 1.15, -2.61)); // ticket
    envScene.add(rxStation);

    // --- KITCHEN ZONE PROPS (X = 3 to 13) ---
    // Stainless Prep Counter (X = 5.0, Z = -2.6)
    const prepCounter = new THREE.Group();
    prepCounter.name = 'Prop_PrepCounter';
    prepCounter.add(box(2.2, 0.08, 0.9, mats.stainless, 5.0, 0.86, -2.6));
    prepCounter.add(box(2.1, 0.04, 0.8, mats.stainless, 5.0, 0.25, -2.6));
    prepCounter.add(box(0.08, 0.82, 0.8, mats.stainless, 4.0, 0.43, -2.6));
    prepCounter.add(box(0.08, 0.82, 0.8, mats.stainless, 6.0, 0.43, -2.6));
    // Cutting Board & Chef Knife
    prepCounter.add(box(0.65, 0.04, 0.45, mats.cuttingBoard, 4.8, 0.92, -2.5));
    prepCounter.add(box(0.3, 0.01, 0.06, mats.stainless, 4.8, 0.95, -2.5));
    // Prep ramekins
    prepCounter.add(cyl(0.09, 0.07, 0.08, 12, mats.whiteCoat, 5.5, 0.94, -2.6));
    prepCounter.add(cyl(0.09, 0.07, 0.08, 12, mats.whiteCoat, 5.75, 0.94, -2.6));
    envScene.add(prepCounter);

    // Spice & Condiment Rack (X = 7.0, Z = -3.2)
    const spiceRack = new THREE.Group();
    spiceRack.name = 'Prop_SpiceRack';
    spiceRack.add(box(1.4, 0.04, 0.3, mats.stainless, 7.0, 1.2, -3.3));
    spiceRack.add(box(1.4, 0.04, 0.3, mats.stainless, 7.0, 1.5, -3.3));
    // Spice containers
    for (let i = 0; i < 5; i++) {
      spiceRack.add(cyl(0.06, 0.06, 0.16, 8, mats.glass, 6.4 + i * 0.3, 1.3, -3.3));
      spiceRack.add(cyl(0.065, 0.065, 0.04, 8, mats.goldBrass, 6.4 + i * 0.3, 1.4, -3.3));
    }
    envScene.add(spiceRack);

    // Commercial Wok Station (X = 9.2, Z = -2.6)
    const wokStation = new THREE.Group();
    wokStation.name = 'Prop_WokStation';
    wokStation.add(box(1.8, 0.85, 0.95, mats.stainless, 9.2, 0.425, -2.6));
    wokStation.add(cyl(0.35, 0.35, 0.08, 16, mats.castIron, 9.0, 0.89, -2.55)); // burner ring
    // Wok Pan (curved hemisphere-like)
    const wokGeo = new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const wokMesh = new THREE.Mesh(wokGeo, mats.castIron);
    wokMesh.position.set(9.0, 1.05, -2.55);
    wokMesh.rotation.x = Math.PI;
    wokMesh.castShadow = true;
    wokStation.add(wokMesh);
    // Wok wooden handle
    wokStation.add(cyl(0.025, 0.025, 0.28, 8, mats.deskWood, 8.6, 1.06, -2.55));
    // Water faucet
    wokStation.add(cyl(0.02, 0.02, 0.45, 8, mats.stainless, 9.8, 1.1, -2.9));
    envScene.add(wokStation);

    // Commercial Exhaust Hood (X = 9.2, Y = 2.8, Z = -2.6)
    const exhaustHood = new THREE.Group();
    exhaustHood.name = 'Prop_ExhaustHood';
    exhaustHood.add(box(2.2, 0.55, 1.2, mats.stainless, 9.2, 2.8, -2.6));
    exhaustHood.add(box(1.8, 0.05, 0.8, mats.darkSteel, 9.2, 2.55, -2.6)); // filters
    envScene.add(exhaustHood);

    // Rice Cooker Stand & Cooker (X = 11.5, Z = -2.6)
    const riceGroup = new THREE.Group();
    riceGroup.name = 'Prop_RiceCooker';
    riceGroup.add(box(0.8, 0.75, 0.75, mats.stainless, 11.5, 0.375, -2.6));
    riceGroup.add(cyl(0.28, 0.28, 0.42, 16, mats.stainless, 11.5, 0.96, -2.6)); // cooker
    riceGroup.add(cyl(0.29, 0.29, 0.08, 16, mats.darkSteel, 11.5, 1.2, -2.6)); // lid
    envScene.add(riceGroup);

    // Plating Service Pass Counter (X = 8.5, Z = 2.2)
    const passCounter = new THREE.Group();
    passCounter.name = 'Prop_ServicePass';
    passCounter.add(box(2.4, 0.9, 0.8, mats.stainless, 8.5, 0.45, 2.2));
    // Serving bowls on pass
    passCounter.add(cyl(0.14, 0.09, 0.08, 12, mats.whiteCoat, 8.0, 0.94, 2.2));
    passCounter.add(cyl(0.14, 0.09, 0.08, 12, mats.whiteCoat, 8.5, 0.94, 2.2));
    envScene.add(passCounter);

    // ==========================================
    // 2. DR. SPEED 3D PLACEHOLDER (Adult Proportion 1.78m)
    // ==========================================
    const drSpeed = new THREE.Group();
    drSpeed.name = 'Character_DrSpeed_Placeholder';

    // Total height: 1.78m
    // Head (Y = 1.62m, height 0.22m)
    const head = cyl(0.1, 0.09, 0.22, 14, mats.skin, 0, 1.62, 0);
    // Hair
    const hair = box(0.21, 0.1, 0.22, mats.hair, 0, 1.71, -0.01);
    // Glasses frame
    const glasses = box(0.19, 0.04, 0.05, mats.blackPlastic, 0, 1.64, 0.1);
    // Neck
    const neck = cyl(0.06, 0.06, 0.08, 10, mats.skin, 0, 1.48, 0);

    // Torso / White Lab Coat (Y = 1.15m, height 0.6m)
    const coatTorso = box(0.42, 0.6, 0.26, mats.whiteCoat, 0, 1.15, 0);
    const innerShirt = box(0.16, 0.22, 0.02, mats.screenBlue, 0, 1.35, 0.125);
    const idBadge = box(0.1, 0.08, 0.01, mats.goldBrass, -0.12, 1.32, 0.135);

    // Coat lower skirts (falling to knee height Y = 0.72m)
    const coatLower = box(0.44, 0.35, 0.28, mats.whiteCoat, 0, 0.72, 0);

    // Arms (left & right)
    const leftArm = cyl(0.055, 0.05, 0.55, 8, mats.whiteCoat, -0.26, 1.15, 0);
    const rightArm = cyl(0.055, 0.05, 0.55, 8, mats.whiteCoat, 0.26, 1.15, 0);
    const leftHand = cyl(0.045, 0.04, 0.12, 8, mats.skin, -0.26, 0.82, 0);
    const rightHand = cyl(0.045, 0.04, 0.12, 8, mats.skin, 0.26, 0.82, 0);

    // Legs & Pants (Y = 0.45m, height 0.65m)
    const leftLeg = cyl(0.07, 0.06, 0.65, 10, mats.trousers, -0.11, 0.42, 0);
    const rightLeg = cyl(0.07, 0.06, 0.65, 10, mats.trousers, 0.11, 0.42, 0);

    // Leather Shoes (Y = 0.05m)
    const leftShoe = box(0.12, 0.08, 0.22, mats.leather, -0.11, 0.04, 0.04);
    const rightShoe = box(0.12, 0.08, 0.22, mats.leather, 0.11, 0.04, 0.04);

    // Stethoscope around neck
    const steth = cyl(0.15, 0.15, 0.03, 12, mats.darkSteel, 0, 1.45, 0.05);

    drSpeed.add(head, hair, glasses, neck, coatTorso, innerShirt, idBadge, coatLower,
                leftArm, rightArm, leftHand, rightHand,
                leftLeg, rightLeg, leftShoe, rightShoe, steth);

    // ==========================================
    // 3. SEATED OFFICE WORKER PATIENT (焦慮上班族)
    // ==========================================
    const patient = new THREE.Group();
    patient.name = 'Character_PatientOffice_Placeholder';

    // Seated posture (pelvis at Y = 0.46m)
    const patHead = cyl(0.095, 0.085, 0.21, 12, mats.skin, 0, 1.25, 0);
    const patHair = box(0.2, 0.08, 0.2, mats.hair, 0, 1.33, 0);
    const patTorso = box(0.38, 0.45, 0.25, mats.suitBlue, 0, 0.88, 0);
    const patTie = box(0.06, 0.25, 0.01, mats.screenBlue, 0, 0.95, 0.13);
    const patThighs = box(0.36, 0.15, 0.45, mats.trousers, 0, 0.52, 0.18);
    const patCalves = box(0.36, 0.45, 0.14, mats.trousers, 0, 0.25, 0.38);
    const patShoes = box(0.36, 0.07, 0.2, mats.leather, 0, 0.04, 0.42);

    patient.add(patHead, patHair, patTorso, patTie, patThighs, patCalves, patShoes);

    // Export all 3 models to binary GLB
    const glbEnv = await exportToGlb(envScene, 'clinic_kitchen_scene.glb');
    const glbDrSpeed = await exportToGlb(drSpeed, 'dr_speed_placeholder.glb');
    const glbPatient = await exportToGlb(patient, 'patient_office_placeholder.glb');

    resolve({ glbEnv, glbDrSpeed, glbPatient });
  } catch (err) {
    reject(err.stack || err.message || String(err));
  }
})
"""

def main():
    print("Exporting 3D models using Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://127.0.0.1:8000/')
        data = page.evaluate(EXPORT_SCRIPT)
        browser.close()

    models = [
        ('assets/models/environment/clinic_kitchen_scene.glb', data['glbEnv']),
        ('assets/models/characters/dr_speed_placeholder.glb', data['glbDrSpeed']),
        ('assets/models/characters/patient_office_placeholder.glb', data['glbPatient'])
    ]

    for rel_path, glb_info in models:
        out_path = ROOT / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        raw_bytes = base64.b64decode(glb_info['b64'])
        out_path.write_bytes(raw_bytes)
        print(f"Exported: {rel_path} ({len(raw_bytes)} bytes, {glb_info['size']} expected)")

if __name__ == '__main__':
    main()
