# Web release review — 2026-09-18

## Decision

**TECHNICAL RUNTIME CANDIDATE VERIFIED / GAMEPLAY AND REALISTIC ART NOT ACCEPTED AS COMPLETE / PUBLIC HOST CONNECTION REQUIRED.**

This review distinguishes the agent's delivery report from evidence inspected in the repository. No existing gameplay was rewritten during this release-packaging review.

## Evidence and provenance

- Game source reviewed: `893280ce1e97151fa03cb6f1521247cea21cf6a5`.
- Existing QA run `35359368047`: success. Original screenshots were downloaded and viewed.
- Runtime-only candidate source commit: `63f783d563d3dbba490feda79a15a897f615abe2`.
- Runtime-only audit run `35362875175`: success; tested HTTP root was `web-dist/`, not the private repository root.
- Runtime artifact `10555422080` (`clinic-kitchen-web-runtime`): 251895 compressed bytes.
- Runtime ZIP SHA-256: `ba4bee58c4caf4ba1f3a00880330eafa10d156693a6ada019a9ac9d4a0497573`.
- All nine runtime file hashes were independently verified after downloading this artifact.
- The existing 24 culinary checks and 37 mission checks passed against the allowlisted runtime package in GitHub Actions. These are not visual-realism acceptance tests and are not tests of a public website.
- A separate local Chromium audit could not navigate because the review environment returned `ERR_BLOCKED_BY_ADMINISTRATOR`. That restriction was not changed. No local keyboard-only playthrough is claimed.

## Verified implementation

The runtime initializes Three.js WebGL, requests three actual binary GLB assets, constructs one continuous clinic/prep/kitchen scene, and exposes an eight-stage mission state machine. This is now a 3D prototype rather than only the previous CSS/DOM prototype.

### GLB structural inspection

| Model | Bytes | Meshes | Materials | Textures | Skins | Animation clips |
|---|---:|---:|---:|---:|---:|---:|
| Environment | 196980 | 82 | 16 | 0 | 0 | 0 |
| Dr. Speed placeholder | 45244 | 17 | 9 | 0 | 0 | 0 |
| Patient placeholder | 15652 | 7 | 6 | 0 | 0 | 0 |

The files are valid GLB containers, not finished realistic characters. The viewed CI screenshots show geometric blockout models. Generated turnaround sheets do not by themselves establish approved character quality.

## Findings that must not be hidden by green CI

### F1 — Cooking bypasses mission and station prerequisites (source-confirmed)

`src/main.js:updateCooking()` enables food/cut/heat/add controls from cooking variables alone; it does not gate them by mission stage and nearby 3D station. The cut handler promotes to COOK when all required foods are prepped and `currentStage <= STAGES.PREP`. Consequently the initial consultation/order/gather sequence is not enforced by these handlers.

Acceptance fix: before consultation/order/gather, prep and stove actions must be unavailable; prep actions must require the prep station, and stove actions the stove station. Add negative tests, not just a happy-path test. Keep a safe way to switch off heat.

### F2 — Mission test uses teleportation (source-confirmed)

`tests/test_full_mission_chain.py` calls `window.teleportAndSync` at each station. It verifies transitions and buttons, not complete keyboard-only navigation, accessibility around furniture, or collision-free delivery. Add a separate real-key-input path from the initial spawn to patient, order, fridge, prep, stove, and back, without teleportation.

### F3 — Normal GLB load does not bind the walk-animation limb references (source-confirmed)

`src/scene3d.js` assigns `leftLegMesh/rightLegMesh/leftArmMesh/rightArmMesh` only inside `buildProceduralDrSpeed()`. The successful player GLB loader callback does not assign these references. The render loop animates these references only when they exist. Thus the normal successful GLB path does not establish the advertised limb gait. There are also no stored skeletal animations in the current GLBs. Add explicit node/bone mapping and observed animation tests before claiming walk, carry, or eating animation completion.

`usingGlb` becomes true after the environment load alone; it is not proof that all three models loaded successfully. Track each load separately.

### F4 — First-bite score is a scripted constant (source-confirmed)

`src/main.js` and `index.html` contain fixed `100%` satisfaction strings. The current result is a scripted success presentation, not a cooking-quality scoring system. A report must not interpret it as achieved gameplay quality or medical benefit. Preserve the fictional-game disclaimer.

## Safe publication boundary

Run `python tools/build_web_release.py`. Only the nine explicitly reviewed runtime files plus `build-info.json` enter `web-dist/`. It excludes original art sheets, reference photos, private/history folders, tests, manifests containing source inventories, and repository metadata. The CI privacy smoke verifies six excluded paths return HTTP 404.

Do not deploy the repository root and do not make this source repository public. Do not use old `hao_hw` as a silent fallback publication target.

## Deployment status

No public playable URL was created in this review. The user-supplied report records HTTP 422 when enabling GitHub Pages under the current account plan for this private repository. GitHub's official Pages documentation confirms that private-repository Pages needs an eligible plan.

AppDeploy was offered as a separate hosting connection. Connection/authorization is still required before a deployment can be executed. The downloaded runtime ZIP is a candidate artifact, not an online game URL.

Once a host is connected: deploy only `web-dist/`, compare `build-info.json` and file hashes at the returned URL, check three GLB requests and the initial canvas, and test real keyboard navigation and task prerequisites. A successful localhost CI run must never be described as public deployment verification.
