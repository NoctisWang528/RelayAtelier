# Loom and Rhythm reference refinement

> 本机附件的路径相对于本文，原始图片和运行报告保存在开发机。随 Git 仓库提供的影像见[三场景回放](../examples/three-scenes.mp4)。

## Loom plaque and textile study · 2026-11-18

The integrated renderer caches the fixed machine and plaque bases at viewport resolution. The tool readouts, plaque labels, warp, cloth and moving carriage are drawn separately. The final macOS source-window sample measured 57 fps, compared with 22 fps before this change. The targeted late-result raster check still measured a change of 46 pixels within the original stitch.

### Reference observations

The reported native idle state and the supplied idle screenshot agree on sixteen empty plaques, each with a thin stripe. Eight colors repeat across the strip. The local official demo is 1120 × 974 at 30 fps. Its active Loom has sixteen labeled plaques above the comb, approximately 34 × 24 pixels each, spaced about 39 pixels center-to-center. One gets a dark outline and heavier type. The other labels stay visible. At 20.2 s the film still shows Factory. Loom reappears during the transition around 20.4 s and is clear at 20.6 s. Scrub overview（`../evidence/scene-review/loom-study/scrub.jpg`） · Enlarged strips（`../evidence/scene-review/loom-study/plaque-strips.png`）

| Plaques, left to right | Visible text | Tool identification |
| --- | --- | --- |
| 1–4 | …TE · …CH · …IT · …EP | Write · WebSearch · Edit · Grep |
| 5–8 | …OB · …IT · …NT · …AD | Glob · NotebookEdit · unresolved · Read |
| 9–12 | …TE · LS · LSP · …CH | TodoWrite · LS · LSP · WebFetch |
| 13–16 | GIT · …SK · …NT · …ST | Git · Task · Lint · Test |

LS is directly legible. Fourteen other names can be paired with the selected outline and the cabinet readout. For example, at 10.0 s TodoWrite selects plaque 9, at 10.2 s Read selects 8, and at 10.4 s Task selects 14. The seventh plaque ends in NT, as does Lint on plaque 15. The samples do not establish its full name. Paired cabinet and plaque crops（`../evidence/scene-review/loom-study/readout-pairs.jpg`）

In the first active segment the outline moves from Glob to WebFetch at about 4.63 s, then to Lint at 4.87 s and NotebookEdit at 5.03 s. These sampled selections last roughly 0.17–0.37 s. At 4.6 s the cabinet already reads TOKEN while Glob keeps the outline. The clip shows playback under load and does not establish a universal pass duration, a cold-start allocation order, or an overflow policy.

The fabric starts around y=149. Its leading edge reaches about y=181 at 4.6 s, y=321 at 10.4 s and y=518 at 20.6 s as the cabinet advances to layers 10, 47 and 100. The exposed warp and carriage remain below the cloth. Short dashes, clusters of small picks, long horizontal floats and open vertical regions are visible. The cabinet sometimes names plain or twill drafts. The later negative space looks figurative. The film does not identify an algorithm for that image or a meaning for every cross. Early cloth（`../evidence/scene-review/loom-study/reference-4.6s.png`） · Midpoint（`../evidence/scene-review/loom-study/reference-10.4s.png`） · Late cloth（`../evidence/scene-review/loom-study/reference-20.6s.png`）

### Scene behavior

- A fresh scene accepts historical call objects via `seedTools(calls)`. It takes the newest sixteen distinct named tools by event timestamp, using later input order for ties. It reserves observed positions first. Seeding only writes names into plaques. The selection stays empty, the queue stays at zero and the warp stays bare.
- Each newly delivered call owns one row and a stable spool. Shell or the first unfamiliar tool takes the unconfirmed seventh position if free. Further unfamiliar names start at a hash of the full name and probe for free positions. At capacity the new tool shares a least-populated spool. A shared plaque shows its tool count unless selected, when it shows the selected tool's suffix. The cabinet displays that tool's full name. Rows keep their spool throughout their retained life.
- `toolNamesAt(x,y)` takes scene coordinates and returns a fresh array of full names for the enamel rectangle in the last rendered frame. The geometry includes navigation clearance. Blank plaques, gaps and positions outside the strip return an empty array.
- Each scheduled pass selects one plaque and tensions its warp group. The shuttle carries its stripe color. The nominal pass takes 0.30 s and the existing pressure scheduler compresses a backlog. The cloth begins 22 logical units below the comb. Each pass adds a four-unit row. A short viewport shows the newest rows that fit above the bottom rail.
- The tool's draft controls float length and exposed warp ends, including split three-pick segments. Warp ends retain their column colors. Completed calls close the stitch in their spool column. Failures mark that cell with a cross. Waiting and unknown leave the cell's warp exposed with two or one small amber ticks. These marks encode local event statuses. Their meaning in the native implementation remains unverified. Matched cloth crops from film and fixture（`../evidence/scene-review/loom-study/cloth-comparison.png`）
- Results update the original pick by source, session and call ID. Duplicate transitions leave the queue alone. The scene uses the shared 120-call visual retention and 6,000 retired-ID limit. A result for a remembered retired call cannot start a new pass. Reduced motion settles real queued rows immediately. Demo and Replay construct their own scene state.

### Verification

The focused suite exercises reference placement, Shell in every arrival position, bounded historical seeding, duplicate suffixes, shared spools, same call IDs across sessions, late and evicted results, burst scheduling, hit-testing after a navigation shift, and float and open-cell geometry. Run `node --test tests/loom-spools.test.mjs`. The full Node suite passed 52 tests in this checkout.

The browser check runs against an isolated in-memory history fixture. It covers seeded Live, an empty session, full-name hover, Demo scene switching, Replay restart, pause and return to Live. In a second Canvas, 100 settled rows and one active pass exercise the textile. Reduced motion matched the settled raster. A late failure changed 46 cloth pixels at the expected row and eighth spool. The test fixture is local to the evidence harness. [Browser check](../evidence/scene-review/loom-study/check-browser.mjs) · Results（`../evidence/scene-review/loom-study/browser-results.json`） · Seeded Live（`../evidence/scene-review/loom-study/host-live-seeded.png`） · Empty Live（`../evidence/scene-review/loom-study/host-live-idle.png`） · 100-row fixture（`../evidence/scene-review/loom-study/canvas-100-rows-fixture.png`）

## Earlier Loom and Rhythm geometry pass

Date: 2026-11-18

This pass changes only `src/scenes/loom.mjs`, `src/scenes/rhythm.mjs`, and this document. Shared drawing helpers, host layout, backend, packages, and other scenes were not edited. The renderer remains procedural Canvas2D; the supplied screenshots are research inputs, not application textures.

## Inspected evidence

Opened and visually inspected:

- `research/user-reference/loom.png`
- `research/user-reference/rhythm.png`
- `evidence/comparison/loom-reference-comparison.jpg`
- `evidence/comparison/rhythm-reference-comparison.jpg`
- `evidence/scenes/loom-portrait-idle.png`
- `evidence/scenes/rhythm-wide-demo.png`

The comparison images show the previous implementation, not these new changes. The main discrepancies were Loom's low header, overly dense low-contrast warp field, missing left upright and controller fittings; and Rhythm's wide fan of lanes, distant side counters, thin counter numerals, and simplified dial hardware.

## Loom changes

- Raised the thread bed from logical y=183 to y=120 and moved its left edge from x=465 to x=485. The frame, guide comb, header plaques, and carriage follow the revised proportions.
- Changed the empty warp field from 216 tightly packed intervals to 108 more distinct intervals. Paired pastel colors, thread highlights, double lacing at the comb, and lower tension anchors make individual strands readable. Woven rows still use the actual call's status/tool color.
- Replaced the 18 small labeled instrument panels with 16 double-edged enamel plaques matching the visible source layout. Their pastel strips are static material detail, not fabricated event indicators.
- Added the tall left mounting upright, longitudinal rail channels and highlights, top rail caps, larger sliding carriage blocks, fasteners, and soft contact shadows beneath the crossbars.
- Added ribbing to the controller actuator, paired sliding jaws, terminal sockets, controller-to-upright conduits, cabinet feet, a terminal housing, a small dial, and a clamped cabinet-side pipe. Widened the lower cabinet to follow the source proportions.
- Shifted the cropped wheel left/up, shortened the upper actuator position, and added the dark radial pointer linkage visible in the reference.
- The shuttle is visible during real scheduled passes and hidden when parked, preserving the reference's clear idle warp. Its body stays within the thread bed at the travel endpoints.

The queue scheduler, alternating pass direction, pressure acceleration, per-call row identity, failure markings, unknown/waiting gaps, and status recoloring are retained. No decorative cloth or synthetic calls were added. The bounded history remains 120 retained calls.

## Rhythm changes

- Narrowed the track footprint from 600 to 128 logical units in portrait, and from 760 to 190 at the compact endpoint. The source's two physical guide rails now dominate; all 16 event lanes still exist, with faint internal rulings.
- Raised the portrait vanishing point and suspended counter frames; retained their compact placement. Moved the combo and transit instruments beside the narrow track, with continuous interpolation across viewport heights.
- Used the existing ComicMono family in bold for counter numerals, closer to the source's heavy slashed-zero displays.
- Added rail highlights, a faint translucent track bed, a curved landing bar, and bolted end brackets. Traveling markers derive their width from their actual lane spacing so they fit the narrower track. The latest marker and coalesced markers retain annotations without annotating every simultaneous note.
- Replaced this scene's generic dial invocation with a local procedural timing wheel: a softly shaded outer rim, dense major/minor graduations, a secondary scale, bolted radial braces, inner bolt circle, and a concentric/radial inner grid. Removed the generic dial's arbitrary numerical engravings from this scene.
- Detailed the center pointer with a glazed inset, fine teeth, twin supports, and mounting screws; added small fasteners across the bottom instrument rail.

Lane assignment, 2.45-second analytical travel, event count, cadence combo, coalesced counts, terminal-state updates, and late-result impacts remain event-driven. Updating a call does not launch a second note. The transit count now explicitly excludes records whose birth time is in the future. Reduced motion suppresses note travel and impacts as before.

## Checks run

- `node --check src/scenes/loom.mjs` — passed.
- `node --check src/scenes/rhythm.mjs` — passed.
- An ephemeral Node assertion harness exercised Canvas command generation at logical heights **620, 740, 860, 980, and 1100**. It verified finite drawing arguments and balanced save/restore calls for idle, traveling, terminal, burst, and reduced-motion states.
- The same harness checked that rendering does not mutate retained calls, status updates preserve record identity and transport coordinates, `visualCount` survives updates, idle and settled command streams are stable, event motion changes the command stream, retention stays at 120 records, Rhythm lanes remain integers in 0–15, and Loom's queued passes remain ordered within its bounded settling deadline after 1,000 additional calls at 5 ms intervals.
- Test fixtures existed only inside the Node process. No application event source or persisted data was changed, and no test file or artifact was written.

## Limitations and parent verification

No browser suite, new screenshot capture, package build, or desktop run was performed in this pass. Command-trace assertions do not verify Canvas rasterization, pixel fidelity, actual text metrics, shadows, or frame rate. Parent-owned visual verification should inspect portrait and compact idle/demo states, a busy shuttle pass, narrowed-lane travel, and reduced motion.

The original advertising imagery is still replaced by real local tool/status displays. Typography outside the revised counters, the shared paper field, and host navigation are outside this pass. The screenshots establish visible proportions and hardware, but not exact original motion timing or construction dimensions. The wheel, materials, and responsive adaptations remain independent approximations; no claim of pixel identity is made. Earlier general scene reports describe the preceding geometry; this document records the newer Loom/Rhythm changes.


## Parent corrections after source/video comparison

Loom warp colors now follow the sixteen spool groups (rather than changing every two threads); controller height and focused-view top clearance were corrected.

The official demo at approximately one second shows Rhythm opening into a broad sixteen-lane track during activity. The parent added event-driven opening/contraction, a stable tool-to-lane map, real call-cadence bars, mechanical lane feet, tool-sector labels and taller impact streaks. The empty track retains the narrow reference composition. The portrait strike line was raised; side counters move outside the expanded track. Navigation bounds from the actual DOM avoid a focused-view overlay on the hanging instrument title. This does not invent any calls or task-quality score.

`tests/kinematics.test.mjs` covers stable lanes and late results; `scripts/verify-rhythm.mjs` uses Chromium Canvas at heights 620, 800 and 1100 to verify opening, settling, failure pairing, pause and reduced motion. It also captures a 1120×974 stage for comparison with the official video. See the current parent report for final results and exact verification scope.
