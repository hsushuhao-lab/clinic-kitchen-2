# Fixed 2D clinic publication — 2026-09-19

## Scope approved by the user
- One viewport: clinic including status header occupies 1/3, cooking occupies 2/3.
- Removed the duplicate workspace title and prep/wok/serve tab strip.
- Fixed Canvas2D floor plan, WASD and continuous click-to-walk between stations.
- Three selectable doctor rule profiles; craving/focus/score/streak retained.
- Existing discrete ingredient addition, timed simmer, rice portion, transactional plating and delivery retained.
- Original approved art remains unchanged. Four UI portraits and four masked utensils are derived by tools/build_flat_portraits.py; native-resolution props are not presented as newly generated high-resolution art.

## Engineering and tests
The local working source from the previous turn was only partially staged in GitHub. Recovered source files were hash-checked; missing integration and acceptance files were reconstructed from the saved single-screen update. tests/test_flat_clinic.py exercises the active Canvas2D renderer, no duplicate toolbar, seven viewports, doctor selection, WASD, continuous route movement, cancel, pause, station gates, cooking, plating, real keyboard delivery, next order and mobile station panels.

Historical Three.js sources/models and renderer-specific tests are preserved, not loaded or served by the current runtime. The old AppDeploy deployment is not the acceptance target. GitHub Pages is built solely from web-dist; original reference boards, historical bundles, test sources and credentials are excluded.

## Publication standard
A prepared Git tree is not a published build. Completion requires main ref update, regular source/rules/browser QA, successful GitHub Pages deployment, and public build-info.json matching the published SHA. Local inline tests are offline evidence only; the CI and public runs use actual HTTPS/HTTP resources.

## Known limitations
The floor plan is illustrative 2D and uses portrait markers, not new character animations. The culinary assets still include legacy cropped food imagery; this release does not claim photorealistic cooking or completed production art. Craving/Focus and the recipe are fictional game mechanics, not clinical outcomes.
