'use strict';
/**
 * Clinic Kitchen 2.0 — Real-time 3D Scene Engine (Three.js WebGL)
 * Implements continuous walkable 3D environment:
 *   Clinic Zone (X: -12 to -3) -> Prep Transition Zone (X: -3 to +3) -> Kitchen Zone (X: +3 to +13)
 * Features:
 *   - PBR Materials (MeshStandardMaterial) with directional/ambient lighting and shadows
 *   - GLTF/GLB Model loading (environment, Dr. Speed placeholder, patient)
 *   - Procedural 3D fallback generation
 *   - Third-person following camera
 *   - Furniture AABB collision detection & clear walkable corridor
 *   - Walking leg/arm kinematics and facing direction
 *   - Dynamic wok flame lighting and steam
 */

window.scene3DState = {
  initialized: false,
  usingGlb: false,
  meshCount: 0,
  playerPos: { x: -8.0, y: 0.0, z: -0.2 },
  playerVelocity: { x: 0, z: 0 },
  playerFacing: Math.PI / 2, // facing +X (towards prep/kitchen)
  isMoving: false,
  interactiveTarget: null,
  missionStage: 0,
  carryingTray: false,
  patientDishVisible: false
};

(function () {
  let scene, camera, renderer, clock;
  let envGroup, playerGroup, patientGroup, wokFlameLight;
  let leftLegMesh, rightLegMesh, leftArmMesh, rightArmMesh;
  let objectiveMarker, trayMesh, patientDishMesh;
  let canvas, container;

  const STAGE_BEACONS = [
    { x: -7.3, y: 2.0, z: -1.4 }, // 0: Consult (Patient Chair)
    { x: -9.0, y: 1.8, z: -1.8 }, // 1: Order (Desk)
    { x: 0.2, y: 2.4, z: -2.4 },  // 2: Gather (Fridge)
    { x: 5.0, y: 1.8, z: -2.2 },  // 3: Prep (Counter)
    { x: 9.0, y: 2.0, z: -2.2 },  // 4: Cook (Wok)
    { x: 9.0, y: 2.0, z: -2.2 },  // 5: Plate (Wok)
    { x: -7.3, y: 2.0, z: -1.4 }, // 6: Serve (Patient Chair)
    { x: -7.3, y: 2.0, z: -1.4 }  // 7: First bite (Patient Chair)
  ];

  // Collision Obstacles (AABB bounding boxes in 3D world coordinates)
  const obstacles = [
    // Clinic Zone
    { name: 'DoctorDesk', minX: -9.9, maxX: -8.1, minZ: -2.6, maxZ: -1.4 },
    { name: 'DoctorChair', minX: -9.4, maxX: -8.6, minZ: -3.0, maxZ: -2.4 },
    { name: 'PatientChair', minX: -7.6, maxX: -7.0, minZ: -1.7, maxZ: -1.1 },
    { name: 'MedicineCabinet', minX: -12.3, maxX: -11.0, minZ: -3.0, maxZ: -2.2 },
    { name: 'ExamBed', minX: -11.6, maxX: -9.4, minZ: 1.5, maxZ: 2.5 },
    // Prep Transition Zone
    { name: 'ScrubSink', minX: -2.6, maxX: -1.4, minZ: -3.2, maxZ: -2.4 },
    { name: 'Fridge', minX: -0.5, maxX: 0.9, minZ: -3.3, maxZ: -2.3 },
    { name: 'UtilityCart', minX: -1.3, maxX: -0.3, minZ: 1.4, maxZ: 2.2 },
    { name: 'OrderPrinter', minX: 1.7, maxX: 2.3, minZ: -3.1, maxZ: -2.5 },
    // Kitchen Zone
    { name: 'PrepCounter', minX: 3.8, maxX: 6.2, minZ: -3.1, maxZ: -2.1 },
    { name: 'SpiceRack', minX: 6.2, maxX: 7.8, minZ: -3.5, maxZ: -3.0 },
    { name: 'WokStation', minX: 8.2, maxX: 10.2, minZ: -3.1, maxZ: -2.0 },
    { name: 'RiceCooker', minX: 11.0, maxX: 12.0, minZ: -3.1, maxZ: -2.1 },
    { name: 'ServicePass', minX: 7.2, maxX: 9.8, minZ: 1.7, maxZ: 2.7 }
  ];

  // Room Walking Limits
  const ROOM_BOUNDS = { minX: -11.8, maxX: 12.3, minZ: -2.7, maxZ: 2.7 };
  const PLAYER_RADIUS = 0.32;

  function checkCollision(nx, nz) {
    if (nx - PLAYER_RADIUS < ROOM_BOUNDS.minX || nx + PLAYER_RADIUS > ROOM_BOUNDS.maxX) return false;
    if (nz - PLAYER_RADIUS < ROOM_BOUNDS.minZ || nz + PLAYER_RADIUS > ROOM_BOUNDS.maxZ) return false;

    for (const obs of obstacles) {
      if (nx + PLAYER_RADIUS > obs.minX && nx - PLAYER_RADIUS < obs.maxX &&
          nz + PLAYER_RADIUS > obs.minZ && nz - PLAYER_RADIUS < obs.maxZ) {
        return false;
      }
    }
    return true;
  }

  function getNearbyTarget(x, z) {
    const targets = [
      { name: '病人椅', prompt: 'E — 靠近病人問診', x: -7.3, z: -1.4, dist: 1.5 },
      { name: '醫師桌', prompt: 'E — 醫師桌 / EMR 病歷', x: -9.0, z: -1.8, dist: 1.5 },
      { name: '洗手台', prompt: 'E — 洗手水槽', x: -2.0, z: -2.5, dist: 1.5 },
      { name: '冰箱', prompt: 'E — 取材冰箱 (豆腐、絞肉、蒜、豆瓣醬)', x: 0.2, z: -2.4, dist: 1.6 },
      { name: '料理處方機', prompt: 'E — 開立並列印料理單', x: 2.0, z: -2.4, dist: 1.5 },
      { name: '備料檯', prompt: 'E — 備料檯 (切豆腐、蒜、蔥)', x: 5.0, z: -2.2, dist: 1.6 },
      { name: '炒鍋爐台', prompt: 'E — 炒鍋爐台 (開火 / 翻炒)', x: 9.0, z: -2.2, dist: 1.6 },
      { name: '盛盤檯', prompt: 'E — 盛盤 (麻婆豆腐上菜)', x: 8.5, z: 1.9, dist: 1.6 }
    ];
    for (const t of targets) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d <= t.dist) return t;
    }
    return null;
  }

  function createMaterials() {
    const THREE = window.THREE;
    return {
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
  }

  function createTrayMesh(mats) {
    const THREE = window.THREE;
    const trayGroup = new THREE.Group();
    trayGroup.name = 'DeliveryTray';

    // Stainless/wooden service tray
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.02, 0.35), mats.stainless);
    tray.castShadow = true;
    trayGroup.add(tray);

    // Mapo Tofu blue-pattern ceramic bowl
    const blueCeramicMat = new THREE.MeshStandardMaterial({ color: 0x245580, roughness: 0.2 });
    const bowlOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 16), mats.whiteCoat);
    bowlOuter.position.set(-0.11, 0.05, 0);
    bowlOuter.castShadow = true;
    const blueRim = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.006, 8, 16), blueCeramicMat);
    blueRim.rotation.x = Math.PI / 2;
    blueRim.position.set(-0.11, 0.09, 0);
    trayGroup.add(bowlOuter, blueRim);

    // Simmering red chili oil surface & tofu cubes
    const tofuSauceMat = new THREE.MeshStandardMaterial({ color: 0xbf2c16, roughness: 0.3, metalness: 0.1 });
    const sauceSurface = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.025, 14), tofuSauceMat);
    sauceSurface.position.set(-0.11, 0.08, 0);
    trayGroup.add(sauceSurface);

    const whiteTofuMat = new THREE.MeshStandardMaterial({ color: 0xfffae8, roughness: 0.25 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x3d8c40, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), whiteTofuMat);
      cube.position.set(-0.11 + ((i % 3) - 1) * 0.035, 0.095, (Math.floor(i / 3) - 0.5) * 0.035);
      trayGroup.add(cube);
    }
    const flake = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.01, 0.03), greenMat);
    flake.position.set(-0.10, 0.105, 0.02);
    trayGroup.add(flake);

    // Steamed White Rice Bowl
    const riceBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.07, 14), mats.whiteCoat);
    riceBowl.position.set(0.12, 0.045, -0.04);
    riceBowl.castShadow = true;
    const riceDome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.whiteCoat);
    riceDome.position.set(0.12, 0.07, -0.04);
    trayGroup.add(riceBowl, riceDome);

    // Chopsticks
    const chopstickMat = new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.5 });
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.26, 6), chopstickMat);
    c1.rotation.x = Math.PI / 2;
    c1.position.set(0.08, 0.02, 0.10);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.26, 6), chopstickMat);
    c2.rotation.x = Math.PI / 2;
    c2.position.set(0.10, 0.02, 0.10);
    trayGroup.add(c1, c2);

    trayGroup.position.set(0, 0.96, 0.40);
    return trayGroup;
  }

  function createPatientDish(mats) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.name = 'PatientServedDish';
    const sideTable = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.50), mats.darkSteel);
    sideTable.position.set(-6.6, 0.275, -1.4);
    sideTable.castShadow = true;
    group.add(sideTable);

    // Tray on side table
    const tableTray = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.02, 0.35), mats.stainless);
    tableTray.position.set(-6.6, 0.56, -1.4);
    group.add(tableTray);

    // Mapo Tofu Bowl
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 16), mats.whiteCoat);
    bowl.position.set(-6.71, 0.61, -1.4);
    bowl.castShadow = true;
    const sauceSurface = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.025, 14), new THREE.MeshStandardMaterial({ color: 0xbf2c16, roughness: 0.3 }));
    sauceSurface.position.set(-6.71, 0.64, -1.4);
    group.add(bowl, sauceSurface);

    // White Tofu cubes on dish
    const whiteTofuMat = new THREE.MeshStandardMaterial({ color: 0xfffae8, roughness: 0.25 });
    for (let i = 0; i < 6; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), whiteTofuMat);
      cube.position.set(-6.71 + ((i % 3) - 1) * 0.035, 0.655, -1.4 + (Math.floor(i / 3) - 0.5) * 0.035);
      group.add(cube);
    }

    // Rice bowl on side table
    const riceBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.07, 14), mats.whiteCoat);
    riceBowl.position.set(-6.48, 0.605, -1.44);
    const riceDome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.whiteCoat);
    riceDome.position.set(-6.48, 0.63, -1.44);
    group.add(riceBowl, riceDome);

    return group;
  }

  function createObjectiveMarker() {
    const THREE = window.THREE;
    const geo = new THREE.OctahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2c57c,
      emissive: 0xb8860b,
      roughness: 0.2,
      metalness: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'ObjectiveMarker';
    mesh.castShadow = true;
    return mesh;
  }

  function buildProceduralEnvironment(mats) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.name = 'ProceduralClinicKitchen';

    function box(w, h, d, mat, x, y, z) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }
    function cyl(rt, rb, h, seg, mat, x, y, z) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }

    // Floors
    box(9.5, 0.1, 7.0, mats.clinicFloor, -7.75, -0.05, 0);
    box(6.0, 0.1, 7.0, mats.prepFloor, 0.0, -0.05, 0);
    box(10.0, 0.1, 7.0, mats.kitchenFloor, 8.0, -0.05, 0);

    // Back Walls
    box(9.5, 3.6, 0.1, mats.clinicWall, -7.75, 1.8, -3.55);
    box(6.0, 3.6, 0.1, mats.clinicWall, 0.0, 1.8, -3.55);
    box(10.0, 3.6, 0.1, mats.stainless, 8.0, 1.8, -3.55);
    box(15.5, 0.12, 0.04, mats.chairRail, -4.75, 1.0, -3.48);

    // End Walls
    box(0.1, 3.6, 7.0, mats.clinicWall, -12.55, 1.8, 0);
    box(0.1, 3.6, 7.0, mats.stainless, 13.05, 1.8, 0);

    // Ceiling beam
    box(25.6, 0.3, 0.4, mats.darkSteel, 0.25, 3.45, 0);

    // Clinic Props
    box(1.8, 0.06, 0.9, mats.deskWood, -9.0, 0.75, -2.0); // desk
    box(0.08, 0.72, 0.8, mats.darkSteel, -9.8, 0.36, -2.0);
    box(0.08, 0.72, 0.8, mats.darkSteel, -8.2, 0.36, -2.0);
    box(0.5, 0.5, 0.75, mats.darkSteel, -8.45, 0.36, -2.0);
    box(0.65, 0.4, 0.04, mats.blackPlastic, -9.0, 1.15, -2.2); // monitor
    box(0.61, 0.36, 0.01, mats.screenBlue, -9.0, 1.15, -2.18);
    box(0.42, 0.02, 0.15, mats.blackPlastic, -9.0, 0.79, -1.8); // keyboard
    box(0.5, 0.08, 0.5, mats.paddedChair, -9.0, 0.48, -2.7); // doc chair
    box(0.46, 0.55, 0.08, mats.paddedChair, -9.0, 0.78, -2.92);
    box(0.5, 0.08, 0.5, mats.paddedChair, -7.3, 0.45, -1.4); // patient chair
    box(0.46, 0.45, 0.08, mats.paddedChair, -7.3, 0.7, -1.62);
    box(1.2, 2.1, 0.55, mats.darkSteel, -11.6, 1.05, -2.6); // cabinet
    box(1.1, 1.0, 0.02, mats.glass, -11.6, 1.5, -2.31);
    box(1.9, 0.12, 0.75, mats.paddedChair, -10.5, 0.65, 2.0); // bed

    // Prep Props
    box(1.1, 0.85, 0.65, mats.stainless, -2.0, 0.425, -2.8); // sink
    cyl(0.025, 0.025, 0.3, 8, mats.stainless, -2.0, 1.0, -3.0);
    box(1.2, 2.0, 0.8, mats.stainless, 0.2, 1.0, -2.8); // fridge
    box(0.9, 0.04, 0.6, mats.stainless, -0.8, 0.85, 1.8); // trolley
    box(0.9, 0.04, 0.6, mats.stainless, -0.8, 0.25, 1.8);
    box(0.5, 0.9, 0.5, mats.stainless, 2.0, 0.45, -2.8); // rx station
    box(0.35, 0.22, 0.35, mats.blackPlastic, 2.0, 1.01, -2.8);

    // Kitchen Props
    box(2.2, 0.08, 0.9, mats.stainless, 5.0, 0.86, -2.6); // prep counter
    box(0.65, 0.04, 0.45, mats.cuttingBoard, 4.8, 0.92, -2.5); // board
    box(1.4, 0.04, 0.3, mats.stainless, 7.0, 1.2, -3.3); // spice
    box(1.8, 0.85, 0.95, mats.stainless, 9.2, 0.425, -2.6); // wok station
    cyl(0.35, 0.35, 0.08, 16, mats.castIron, 9.0, 0.89, -2.55);
    const wokGeo = new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const wokMesh = new THREE.Mesh(wokGeo, mats.castIron);
    wokMesh.position.set(9.0, 1.05, -2.55);
    wokMesh.rotation.x = Math.PI;
    wokMesh.castShadow = true;
    group.add(wokMesh);
    box(2.2, 0.55, 1.2, mats.stainless, 9.2, 2.8, -2.6); // hood
    box(0.8, 0.75, 0.75, mats.stainless, 11.5, 0.375, -2.6); // rice
    box(2.4, 0.9, 0.8, mats.stainless, 8.5, 0.45, 2.2); // pass

    return group;
  }

  function buildProceduralDrSpeed(mats) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.name = 'Procedural_DrSpeed_Placeholder';

    // 1.78m adult proportion
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.22, 14), mats.skin);
    head.position.set(0, 1.62, 0); head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.22), mats.hair);
    hair.position.set(0, 1.71, -0.01);
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.04, 0.05), mats.blackPlastic);
    glasses.position.set(0, 1.64, 0.1);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), mats.skin);
    neck.position.set(0, 1.48, 0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.26), mats.whiteCoat);
    torso.position.set(0, 1.15, 0); torso.castShadow = true;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), mats.screenBlue);
    inner.position.set(0, 1.35, 0.125);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.01), mats.goldBrass);
    badge.position.set(-0.12, 1.32, 0.135);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.35, 0.28), mats.whiteCoat);
    skirt.position.set(0, 0.72, 0);

    // Limbs with shoulder and hip pivots
    leftArmMesh = new THREE.Group();
    leftArmMesh.name = 'LeftArm';
    leftArmMesh.position.set(-0.26, 1.40, 0);
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.55, 8), mats.whiteCoat);
    leftArm.position.set(0, -0.27, 0);
    const leftHand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 8), mats.skin);
    leftHand.position.set(0, -0.58, 0);
    leftArmMesh.add(leftArm, leftHand);

    rightArmMesh = new THREE.Group();
    rightArmMesh.name = 'RightArm';
    rightArmMesh.position.set(0.26, 1.40, 0);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.55, 8), mats.whiteCoat);
    rightArm.position.set(0, -0.27, 0);
    const rightHand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 8), mats.skin);
    rightHand.position.set(0, -0.58, 0);
    rightArmMesh.add(rightArm, rightHand);

    leftLegMesh = new THREE.Group();
    leftLegMesh.name = 'LeftLeg';
    leftLegMesh.position.set(-0.11, 0.72, 0);
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 10), mats.trousers);
    leftLeg.position.set(0, -0.32, 0);
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), mats.leather);
    leftShoe.position.set(0, -0.68, 0.04);
    leftLegMesh.add(leftLeg, leftShoe);

    rightLegMesh = new THREE.Group();
    rightLegMesh.name = 'RightLeg';
    rightLegMesh.position.set(0.11, 0.72, 0);
    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.65, 10), mats.trousers);
    rightLeg.position.set(0, -0.32, 0);
    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), mats.leather);
    rightShoe.position.set(0, -0.68, 0.04);
    rightLegMesh.add(rightLeg, rightShoe);

    group.add(head, hair, glasses, neck, torso, inner, badge, skirt,
              leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh);
    return group;
  }

  function buildProceduralPatient(mats) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.name = 'Procedural_PatientOffice_Placeholder';
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.21, 12), mats.skin);
    head.position.set(0, 1.25, 0);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), mats.hair);
    hair.position.set(0, 1.33, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 0.25), mats.suitBlue);
    torso.position.set(0, 0.88, 0);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.01), mats.screenBlue);
    tie.position.set(0, 0.95, 0.13);
    const thighs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.45), mats.trousers);
    thighs.position.set(0, 0.52, 0.18);
    const calves = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.14), mats.trousers);
    calves.position.set(0, 0.25, 0.38);

    group.add(head, hair, torso, tie, thighs, calves);
    group.position.set(-7.3, 0, -1.4);
    group.rotation.y = Math.PI; // facing doctor desk
    return group;
  }

  function init3D(containerEl) {
    if (!window.THREE) return;
    const THREE = window.THREE;

    container = containerEl || document.getElementById('world');
    if (!container) return;

    // Create Canvas inside #world
    canvas = document.createElement('canvas');
    canvas.id = 'scene3dCanvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none'; // allow pointer events to fall through to UI if needed
    container.insertBefore(canvas, container.firstChild);

    // Renderer
    const w = container.clientWidth || 1440;
    const h = container.clientHeight || 458;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f171b);
    clock = new THREE.Clock();

    // Camera: Third-person elevated perspective
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(window.scene3DState.playerPos.x, 5.2, window.scene3DState.playerPos.z + 5.8);
    camera.lookAt(window.scene3DState.playerPos.x, 1.2, window.scene3DState.playerPos.z);

    // Lighting
    const ambLight = new THREE.AmbientLight(0xdde5e8, 0.7);
    scene.add(ambLight);

    // Clinic Cool White Light
    const clinicLight = new THREE.DirectionalLight(0xffffff, 1.2);
    clinicLight.position.set(-8, 6, 4);
    clinicLight.target.position.set(-8, 0, 0);
    clinicLight.castShadow = true;
    clinicLight.shadow.mapSize.width = 1024;
    clinicLight.shadow.mapSize.height = 1024;
    scene.add(clinicLight);
    scene.add(clinicLight.target);

    // Prep Transition Light
    const prepLight = new THREE.DirectionalLight(0xe8f0ee, 0.85);
    prepLight.position.set(0, 6, 4);
    prepLight.target.position.set(0, 0, 0);
    scene.add(prepLight);
    scene.add(prepLight.target);

    // Kitchen Warm Cooking Light
    const kitchenLight = new THREE.DirectionalLight(0xffedd0, 1.3);
    kitchenLight.position.set(8, 6, 4);
    kitchenLight.target.position.set(8, 0, 0);
    kitchenLight.castShadow = true;
    scene.add(kitchenLight);
    scene.add(kitchenLight.target);

    // Wok Flame Light (Flickering)
    wokFlameLight = new THREE.PointLight(0xff7722, 0.0, 4.0);
    wokFlameLight.position.set(9.0, 1.2, -2.55);
    scene.add(wokFlameLight);

    const materials = createMaterials();

    // Objective guide marker
    objectiveMarker = createObjectiveMarker();
    scene.add(objectiveMarker);

    // Patient side-table served dish
    patientDishMesh = createPatientDish(materials);
    patientDishMesh.visible = false;
    scene.add(patientDishMesh);

    // Delivery tray mesh
    trayMesh = createTrayMesh(materials);
    trayMesh.visible = false;

    // Try loading GLTF models, fallback to procedural 3D meshes
    let glbLoadedCount = 0;
    const loader = new THREE.GLTFLoader();

    loader.load('assets/models/environment/clinic_kitchen_scene.glb', function (gltf) {
      envGroup = gltf.scene;
      scene.add(envGroup);
      glbLoadedCount++;
      window.scene3DState.usingGlb = true;
    }, undefined, function () {
      console.warn('GLB env load fallback to procedural 3D meshes');
      envGroup = buildProceduralEnvironment(materials);
      scene.add(envGroup);
    });

    loader.load('assets/models/characters/dr_speed_placeholder.glb', function (gltf) {
      playerGroup = gltf.scene;
      playerGroup.position.set(window.scene3DState.playerPos.x, 0, window.scene3DState.playerPos.z);
      playerGroup.traverse(child => {
        if (child.name === 'LeftArm') leftArmMesh = child;
        if (child.name === 'RightArm') rightArmMesh = child;
        if (child.name === 'LeftLeg') leftLegMesh = child;
        if (child.name === 'RightLeg') rightLegMesh = child;
      });
      playerGroup.add(trayMesh);
      scene.add(playerGroup);
      glbLoadedCount++;
    }, undefined, function () {
      console.warn('GLB player load fallback to procedural 3D meshes');
      playerGroup = buildProceduralDrSpeed(materials);
      playerGroup.position.set(window.scene3DState.playerPos.x, 0, window.scene3DState.playerPos.z);
      playerGroup.add(trayMesh);
      scene.add(playerGroup);
    });

    loader.load('assets/models/characters/patient_office_placeholder.glb', function (gltf) {
      patientGroup = gltf.scene;
      patientGroup.position.set(-7.3, 0, -1.4);
      patientGroup.rotation.y = Math.PI;
      scene.add(patientGroup);
      glbLoadedCount++;
    }, undefined, function () {
      console.warn('GLB patient load fallback to procedural 3D meshes');
      patientGroup = buildProceduralPatient(materials);
      scene.add(patientGroup);
    });

    window.scene3DState.initialized = true;

    // Resize Handler
    window.addEventListener('resize', onWindowResize);

    // Start 3D Render Loop
    requestAnimationFrame(renderLoop);
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  let walkCycle = 0;

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!renderer || !scene || !camera) return;

    const delta = Math.min(clock.getDelta(), 0.05);
    const state = window.scene3DState;

    // Synchronize flame point light with cooking state
    const flameEl = document.getElementById('flame');
    const isFlameOn = flameEl && flameEl.classList.contains('is-on');
    if (wokFlameLight) {
      if (isFlameOn) {
        wokFlameLight.intensity = 1.8 + Math.sin(Date.now() * 0.02) * 0.4;
      } else {
        wokFlameLight.intensity = 0.0;
      }
    }

    // Kinematic limb movement while walking
    if (state.isMoving) {
      walkCycle += delta * 12;
      const legAngle = Math.sin(walkCycle) * 0.45;
      const armAngle = -Math.sin(walkCycle) * 0.35;
      if (leftLegMesh) leftLegMesh.rotation.x = legAngle;
      if (rightLegMesh) rightLegMesh.rotation.x = -legAngle;
      if (state.carryingTray) {
        if (leftArmMesh) { leftArmMesh.rotation.x = -Math.PI / 3; leftArmMesh.rotation.z = 0.15; }
        if (rightArmMesh) { rightArmMesh.rotation.x = -Math.PI / 3; rightArmMesh.rotation.z = -0.15; }
      } else {
        if (leftArmMesh) { leftArmMesh.rotation.x = armAngle; leftArmMesh.rotation.z = 0; }
        if (rightArmMesh) { rightArmMesh.rotation.x = -armAngle; rightArmMesh.rotation.z = 0; }
      }
    } else {
      walkCycle = 0;
      if (leftLegMesh) leftLegMesh.rotation.x = 0;
      if (rightLegMesh) rightLegMesh.rotation.x = 0;
      if (state.carryingTray) {
        if (leftArmMesh) { leftArmMesh.rotation.x = -Math.PI / 3; leftArmMesh.rotation.z = 0.15; }
        if (rightArmMesh) { rightArmMesh.rotation.x = -Math.PI / 3; rightArmMesh.rotation.z = -0.15; }
      } else {
        if (leftArmMesh) { leftArmMesh.rotation.x = 0; leftArmMesh.rotation.z = 0; }
        if (rightArmMesh) { rightArmMesh.rotation.x = 0; rightArmMesh.rotation.z = 0; }
      }
    }

    // Update Player Group in 3D
    if (playerGroup) {
      playerGroup.position.x = state.playerPos.x;
      playerGroup.position.z = state.playerPos.z;
      playerGroup.rotation.y = state.playerFacing;
    }

    // Third-person smooth camera tracking
    const targetCamX = state.playerPos.x;
    const targetCamY = 5.2;
    const targetCamZ = state.playerPos.z + 5.8;
    camera.position.x += (targetCamX - camera.position.x) * 0.08;
    camera.position.y += (targetCamY - camera.position.y) * 0.08;
    camera.position.z += (targetCamZ - camera.position.z) * 0.08;
    camera.lookAt(state.playerPos.x, 1.2, state.playerPos.z);

    // Check interaction target
    state.interactiveTarget = getNearbyTarget(state.playerPos.x, state.playerPos.z);

    // Animate and position 3D objective guide marker
    if (objectiveMarker) {
      const stageIdx = state.missionStage || 0;
      const target = STAGE_BEACONS[stageIdx] || STAGE_BEACONS[0];
      objectiveMarker.position.x += (target.x - objectiveMarker.position.x) * 0.12;
      objectiveMarker.position.z += (target.z - objectiveMarker.position.z) * 0.12;
      objectiveMarker.position.y = target.y + Math.sin(Date.now() * 0.004) * 0.12;
      objectiveMarker.rotation.y += delta * 2.2;
      objectiveMarker.rotation.x += delta * 1.1;
    }

    // Sync delivery tray on player
    if (trayMesh) {
      trayMesh.visible = !!state.carryingTray;
    }

    // Sync served bowl on patient side table
    if (patientDishMesh) {
      patientDishMesh.visible = !!state.patientDishVisible;
    }

    renderer.render(scene, camera);
  }

  // Public methods exposed to main.js
  window.update3DPlayerMovement = function (dx, dz, dt, speedMultiplier) {
    const state = window.scene3DState;
    if (dx === 0 && dz === 0) {
      state.isMoving = false;
      return;
    }
    state.isMoving = true;
    const len = Math.hypot(dx, dz) || 1;
    const speed = 4.2 * speedMultiplier;
    const nx = state.playerPos.x + (dx / len) * speed * dt;
    const nz = state.playerPos.z + (dz / len) * speed * dt;

    if (checkCollision(nx, state.playerPos.z)) state.playerPos.x = nx;
    if (checkCollision(state.playerPos.x, nz)) state.playerPos.z = nz;

    // Smooth facing angle
    state.playerFacing = Math.atan2(dx, dz);
  };

  window.set3DPlayerPosition = function (x, z) {
    const state = window.scene3DState;
    state.playerPos.x = x;
    state.playerPos.z = z;
    if (playerGroup) {
      playerGroup.position.x = x;
      playerGroup.position.z = z;
    }
  };

  window.teleportTo = function (x, z) {
    window.set3DPlayerPosition(x, z);
  };

  window.setMissionStage = function (stage) {
    window.scene3DState.missionStage = stage;
  };

  window.setCarryingTray = function (val) {
    window.scene3DState.carryingTray = Boolean(val);
    if (trayMesh) trayMesh.visible = Boolean(val);
  };

  window.setPatientDishVisible = function (val) {
    window.scene3DState.patientDishVisible = Boolean(val);
    if (patientDishMesh) patientDishMesh.visible = Boolean(val);
  };

  window.get3DStatus = function () {
    return {
      initialized: window.scene3DState.initialized,
      usingGlb: window.scene3DState.usingGlb,
      playerPos: { ...window.scene3DState.playerPos },
      interactiveTarget: window.scene3DState.interactiveTarget,
      bounds: ROOM_BOUNDS,
      obstacleCount: obstacles.length,
      missionStage: window.scene3DState.missionStage,
      carryingTray: window.scene3DState.carryingTray,
      patientDishVisible: window.scene3DState.patientDishVisible
    };
  };

  window.getNearbyTarget = getNearbyTarget;
  window.initScene3D = init3D;
})();
