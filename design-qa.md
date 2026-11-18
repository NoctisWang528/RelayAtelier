# Visual comparison — source refinement, 2026-11-18

**final result: blocked**

The source remains under the strict “几乎一模一样” packaging gate. In the evening review the installed native application was accessible. Its idle Loom and Factory were observed directly. Active comparisons use the official video and the observer's fixture Replay. The different event sequences do not establish frame-synchronized timing. See [the three-scene review](docs/SCENE-REVIEW-2026-11-18.md).

The latest renderer shares the porcelain theme across all eight scenes. Factory parcel projection, movement and layering, and Loom's tool plaques and weaving were revised after the earlier comparisons below.

## Current findings

| Priority | Location | Observed evidence and impact | Concrete remaining work |
| --- | --- | --- | --- |
| P2, strict fidelity | Westworld vessels and cable assembly | `evidence/refinement/comparison/dial-vessel-detail.jpg`: six paths and fittings now exist, but the lower feed bends are shallower, the cable bundle lighter, the flask side more linear and some support proportions differ. The source uses more irregular embossed surfaces. | Trace the remaining control points/branch joins at matching viewport, tune flange/neck proportions and local edge/shadow weights. Keep pulse sampling on the same route geometry. |
| P2, strict fidelity | Factory arm, conveyor and generator | `factory-left-detail.jpg`: the pedestal is visible again and the belt now follows the correct diagonal family. The original arm/link shading, pin orientation, belt edge thickness, machine contour and cast-metal contrast still differ. | Fit the arm's side projection and link shading against the source frame; refine the near apron, seams and cabinet cast contours. |
| P2, strict fidelity | Original motion timing and density | `rhythm-active-comparison.jpg`, `research/all-frames.jpg`, current motion frames/video: track expansion is now present, but streams are different and original timings are not recovered. Dial impulses, pickup timing, card spring and particle density have not been synchronized to the same input sequence. | Obtain a controlled original sequence when native observation is available; measure durations and trajectories before changing constants. Do not infer exact timing from one screenshot or call a Demo match a Live verification. |
| P2, strict fidelity | Other scene microgeometry | Loom border/harness and cropped ring details, Chips card ornament/layout and Slots/Roulette mechanical details remain independent reconstructions. Full composition pairs show remaining differences, even though each has real separate animation. | Continue focused component comparisons at the same state; use original observed structure rather than substitute a generic card or circle. |
| Intentional | Sponsor screens, branding and information tray | Original sponsor images/model marks become local tool/status displays. The source/connection controls and six-tool vocabulary are specific to this standalone observer. | Keep these exclusions explicit; do not count them as reproduced original artwork. |
| P3 | Small engraved labels and fallback type | Navigation/instrument figures use bundled Comic Mono; some internal labels use system monospace and Chinese fallback. Small engravings have different optical weight at reduced sizes. | Tune actual glyph metrics where useful; keep essential connection/mode/status text available. |

## Evidence and normalization

The source images and current rendered images were opened together in the comparison boards. These are screenshots of working Canvas scenes, not rendered mockups or screenshot backgrounds.

- Source truth: `research/user-reference/` — Westworld 1740×2062, Loom 1752×2062, Factory 1744×2044, Rhythm 1734×2052, Slots 1756×2036, Roulette 1732×2042.
- Implementation: `evidence/refinement/scenes/*-portrait-idle.png`, **1440×1706 CSS/pixels, DPR 1**. Empty Live fixtures make the idle state explicit. No original source calls were invented to populate these comparisons.
- Full pairs: `evidence/refinement/comparison/*-reference-comparison.jpg`. Each input is uniformly fitted to a 720×880 review area. Different original image aspect ratios and the different lower control tray remain visible. This is not a per-pixel difference metric.
- Focused pairs: `dial-calibration.jpg`, `dial-vessel-detail.jpg`, `factory-left-detail.jpg` in the same directory. Source is uniformly width-normalized to 1440; common pixel-region crops are then placed side by side. Residual canvas-height/content differences are not hidden by stretching.
- Motion source: `research/game-view-demo.mp4`, 1120×974, 623 frames at 30 fps; `research/rea/rhythm-active-video.png` is approximately one second into it.
- Matched motion composition: `evidence/refinement/rhythm-motion/reference-aspect-active.png`, **1120×974 stage pixels**, captured from a 1134×1009 viewport with focus mode, DPR 1. `rhythm-active-comparison.jpg` puts it beside the original frame. Both are active, but event load and animation phase differ; this pair supports shape/layout comparison, not exact timing or particle-count claims.
- Landscape: `evidence/refinement/scenes/*-wide-{idle,demo}.png`, **1440×940, DPR 1**, plus three successive motion captures per scene. Larger landscape reflow is user-authorized and distinct from identity of the portrait composition.
- Current overview and motion sequences: `evidence/refinement/overview.jpg`, `evidence/refinement/motion-sequence.jpg`.
- Actual recording: `evidence/refinement/motion-demo.mp4`, **39.40 seconds, 1440×940, 985 decoded frames**. `video-validation.json` records successful full-file decoding. All events in it are explicitly Demo.

## Iterations and observed corrections

1. The previous rejected generic dark visuals had already been replaced by the original's warm paper, enamel and mechanical language. This pass retained that direction at that earlier checkpoint. The subsequent DataFlow revision also uses porcelain.
2. Westworld's original ring and cable-circle locations were measured again. The cable bundle is now a separate larger-radius circle; the instrument annulus, precision ticks, supports and tool bays were revised. Final evidence: `dial-reference-comparison.jpg` and `dial-calibration.jpg`.
3. Focused vessel comparison exposed angular/missing pipes, simplified clamps and misplaced graduations. Added the third upper route, rounded bends, curved path/pulse sharing, port collars, transverse flange fittings, flask side graduations and revised barrel ports. All six ports animate on actual events. The final focused pair shows the improvement and the remaining differences without concealing them.
4. Background sampling exposed washed-out dots: the earlier solid area was RGB250/249/246, while the selected reference area is252/250/246. The current background matches that base color and uses a cached supersampled soft dot. `paper-calibration.json` records the crop measurements; a base-color match is not a whole-image similarity measure.
5. Factory received cylindrical/tapered links, eccentric joint faces, pedestal, feet, motor casing and turbine detail. The first integrated portrait still hid the pedestal behind the belt. The parent corrected belt slope/width/origin and lower-left shadow; the post-fix pair visibly exposes the base. Event-driven exhaust and discharge shards were also captured.
6. Chips received a scalloped cast table, dealer chute and physical card shoe/hand tray. A captured compact card overshoot crossed beneath navigation. The bed's lower endpoint was moved and analytically bounded; current motion/active captures show the selected card clear of the top controls.
7. Loom's original color groups align with sixteen spool plaques. The earlier reconstruction changed color every two warps; it now groups108 warps by the sixteen plaques. Frame/carriage detail and controller position were corrected, and the idle shuttle parks behind the side cover. Final pair: `loom-reference-comparison.jpg`.
8. Official active Rhythm evidence showed a broad16-lane track, while the idle screenshot showed a narrow track. The earlier renderer stayed narrow. It now opens and settles with event activity, preserves each tool's lane, uses real call-cadence bars and updates results on their original notes. Side counters move outside the track; the strike ring and sector text were calibrated. Final composition pair: `rhythm-active-comparison.jpg`.
9. The matched-aspect focus capture exposed navigation covering a hanging instrument title. The renderer now passes actual navigation bounds; Rhythm and Loom use them to keep instrument/spool tops clear. The subsequent focus capture was inspected and the overlap is resolved.

Earlier QA is preserved at `evidence/refinement/design-qa-before.md`. Known pre-fix Factory/Loom/Rhythm captures are retained with `before-` names. The current boards were regenerated after the last source changes.

## Required fidelity surfaces

| Surface | Review result |
| --- | --- |
| Fonts/typography | Comic Mono mode rail and heavy counters closely follow the reference's character. Other fonts/fallbacks and some optical sizes differ; no assertion of exact glyph identity. No essential control is hidden by the examined navigation layouts. |
| Spacing/layout rhythm | Large cropped rings, side mechanisms, diagonal belt, tall loom, physical card table and narrow-to-wide rhythm choreography are present. Portrait pairs and focused crops still show the P2 differences above. Landscape reflow deliberately makes more space available. |
| Colors/tokens | Paper base was measured and corrected. Fine warm-grey lines, white enamel, pastel tool colors and amber/blue energy are used. Some original cast shadows and material contrast remain stronger. Error red and unknown/waiting amber remain distinct. |
| Image/asset quality | Runtime machinery is procedural so it can respond to independent events, as required by the user. No video loop or screenshot texture substitutes for mechanisms. Original ad imagery/marks are excluded. Unrecovered source geometry/material is a disclosed fidelity gap, not an invisible asset claim. |
| Copy/content | Demo/Replay/Live, connection/source state and recent real-event time remain explicit. Counts, multipliers and cadence describe the animation/observed events, not task quality. Tools and targets are sanitized. This content intentionally differs from the original product and ads. |

## Functional verification and limits

44 Node tests,28 full Chromium UI checks, the three-height Rhythm Canvas checks, and7 source-Electron checks passed. Final all-mode capture reports zero page errors. Exact test timing/scope is recorded in `docs/REFINEMENT-2026-11-18.md`; the final small nav/layout changes are covered by targeted checks and final captures rather than falsely attributed to an earlier full-suite load.

The original app was observed earlier; the final re-observation attempt was blocked by the locked Mac. REA identified native format and module metadata but did not recover rendering source/art or original motion constants. Ghidra/Hopper providers were unavailable. This is evidence of an investigation, not proof that no such assets exist.

## Continuation checklist

- Keep current source runnable with `scripts/start-source.command`; do not treat `release/` as this revision.
- Prioritize remaining Westworld and Factory geometry/material deltas in the focused boards.
- Acquire synchronized original motion evidence and calibrate timing without inventing a successful model run.
- Revisit the strict visual gate before any new desktop packaging.

**final result: blocked**
