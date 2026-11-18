# Factory mechanical refinement

> 本机附件的路径相对于本文，原始图片和运行报告保存在开发机。随 Git 仓库提供的影像见[三场景回放](../examples/three-scenes.mp4)。

## Cargo and pickup review · 2026-11-18

The 1120 × 974 recording shows at least two distinct carton sizes. At 3.00 s the small pencil-labelled carton is about 65 pixels wide and the tall carton below the head is about 132 pixels wide. Both have dark tape running down the lid in the direction of travel and a white label on the darker, downstream face. At 13.00 s and 18.30 s adjacent bundles have transverse seams, side counts and overlapping silhouettes. Most downstream labels look blank. The leading pencil and globe symbols are legible. 3.00 s（`../evidence/scene-review/factory-study/video-3.png`） · 13.00 s（`../evidence/scene-review/factory-study/video-13.png`） · 18.30 s（`../evidence/scene-review/factory-study/video-18.3.png`）

At 18.00 s the recording still shows Rhythm. Factory returns around 18.2 s. The sequences around 3.27 s and 18.57 s show a small carton on the side feeder beneath an open head. The two pads close on opposite ends, lift the carton and carry it across the far rail. The released cartons travel down-right in single file. Pickup and release sequence（`../evidence/scene-review/factory-study/early-grip.jpg`）

**Renderer changes.** The side rollers stage one waiting carton. The remaining queue is counted beside the pad. A shared belt displacement moves the slats and every released carton, including when a burst accelerates the arm. Pitch includes the carton footprint and the gap. The rear jaw, held carton and front jaw paint in depth order, and the near guard crosses in front of the outfeed. Tool family selects the carton proportions. The smooth expansion from carried size to travelling size is an interpolation between the visible poses. Group seams and the side count come from the event’s aggregate count. Reference and render comparison（`../evidence/scene-review/factory-study/factory-cargo-study.jpg`）

**Compact clearance.** At logical height 620 the shoulder mounts lower on a shorter pedestal. The upper link measures 110 units and the forearm 157. At reference height 1044 the links measure 133 and 157. A 6,060-frame geometry sweep found the highest painted elbow at y = 69.66 in the 620 layout. The navigation bottom measured y = 52.12 in the 1440 × 940 capture. Pickup（`../evidence/scene-review/factory-study/compact-pickup.png`） · Transfer（`../evidence/scene-review/factory-study/compact-transfer.png`） · Release（`../evidence/scene-review/factory-study/compact-release.png`）

**Call identity and verification.** Factory uses the shared source/session/call key and bounded retired set. Status updates retain the existing ticket and its aggregate count. Mid-cycle eviction preserves belt displacement. Seven focused tests passed, including Chromium Canvas checks for empty Live, reduced motion, carton size and projection, paint order, grip contact on either side of hand-off, belt spacing and arm reach. The full suite passed 59 tests. Active comparison captures use the built-in Demo feed. [Focused tests](../tests/factory-cargo.test.mjs) · Empty Live capture（`../evidence/scene-review/factory-study/live-empty.png`）

<details>
<summary>Earlier mechanical refinement and calibration notes</summary>

## Evidence inspected

- `research/user-reference/factory.png`, opened with `view_image`: tapered arm barrels, offset oval pin faces, rounded shoulder shell, paired conveyor rails, square supports, densely detailed generator casing and service pipes.
- `evidence/comparison/factory-reference-comparison.jpg`, opened with `view_image`: the previous implementation had uniform capsule links, simplified frame supports, and a sparse generator resembling an exposed fan.
- `research/all-frames.jpg`, inspected as the available official-video contact sheet: the assembly remains mechanical while parcels move through the conveyor and the arm changes pose. The MP4 itself was not played in this pass.

## Implemented in `src/scenes/factory.mjs`

- Replaced thick round strokes with closed, tapered cylindrical link profiles. Shoulder-to-elbow diameter tapers from 43 to 31 scene units; elbow-to-wrist from 26 to 18. Curved sleeve seams and transverse shading retain barrel volume as each link follows the existing inverse kinematics.
- Added offset, rotated elliptical joint faces with stepped retaining rings, recessed hubs, and small perimeter fasteners. Added a shaped shoulder fairing and its seam, plus stepped pedestal collars, vertical casing detail, and a bolted base flange.
- Rebuilt conveyor support depth: square-section legs with side faces, layered anchor plates and two bolts per foot are drawn behind the deck. The near apron has a lower fold and upper highlight. Guard posts have side faces and mounting shoes; both edges have paired elevated rails.
- Expanded the generator with shaded motor ribs, terminal box, bracket feet, finned shaft coupling, casing tabs, concentric recessed rings, a bolted eccentric hub, and broad swept rotor vanes. The turning vanes are clipped inside the chamber; the casing, clamps and pipework remain stationary.
- Added curved upper/lower service manifolds, retaining clamps, ribbed connectors, valve collars, a rear vertical riser, and its mounting clips. Cabinet details include squared lower access doors, hinges, side fasteners, a junction box, and base-rail bolts.
- Replaced the arm-to-cabinet angular hose with a shaded curved hose. Its arm-side endpoint now follows the pedestal's existing compact-layout translation while the cabinet remains on its own responsive translation.

All added geometry is drawn with Canvas paths and gradients. There are no screenshot backgrounds or new image assets. Only this document and `src/scenes/factory.mjs` were edited; `scene-utils.mjs`, `porcelain.mjs`, `dial.mjs`, configurations and dependencies were not edited.

## Behavior retained

The existing event map, call deduplication, burst scheduling, cycle duration, release time, wrist phase timings, inverse kinematics, parcel movement, status labels, archive indicators, and reduced-motion branch are unchanged. Portrait wrist coordinates are unchanged; compact spatial waypoints were subsequently adjusted as documented below. Rotor motion still derives from the existing event-driven conveyor travel. The scene still uses the 620–1100 logical-height responsive range.

## Verification

- `node --check src/scenes/factory.mjs` passed.
- An inline Node smoke check exercised 39 renders through an instrumented Canvas stub: idle plus a 16-call burst, heights 620/860/1100, normal/reduced motion, and times 0/0.7/1.5/2.6/4/20. All numeric drawing arguments were finite, ellipse radii were nonnegative, and canvas save/restore calls balanced.
- The same check verified that a completion update did not duplicate or reschedule its call, and rendering did not mutate the event queue. Failed and waiting updates were included in the queue.
- No browser suites, packaging, installation, or configuration changes were performed. The Canvas stub checks geometry and state handling, not pixels or browser frame time; final browser verification belongs to the parent task.

## Remaining gaps

- This is a procedural approximation, not a pixel-exact reconstruction. Final rendered lighting, silhouette alignment, rail/parcel occlusion, and tiny-detail readability need the parent's portrait and wide screenshots.
- The cabinet retains real tool/status content rather than the reference advertisement. Its roof vent and pressure gauge are still simpler than the reference.
- The gripper and transfer rollers retain their previous construction. Motion timing has not been reconstructed frame-by-frame from the MP4; discharge/exhaust timings are tied to the local event schedule as documented below.
- The denser hardware adds drawing operations. Actual browser performance has not been measured in this pass.
- Background dot density, navigation and lower dashboard are outside these two files' refinement scope.

## Compact pedestal clearance follow-up

Inspected the parent's updated `evidence/scenes/factory-wide-demo.png` with `view_image`. It showed the belt hiding nearly the whole pedestal and the far rail crossing the lower screen. The problem was the compact equipment/belt coordinates, not missing pedestal drawing.

Changes:

- Moved the compact shoulder from `(440, 284)` to `(460, 150)`, keeping its complete pedestal attached at the same local dimensions.
- Moved the compact belt origin from y=156 to y=280 and reduced its longitudinal rise from 460 to 320 over 1250 horizontal units. Added a smooth mid-height vertical offset (`320 * amount * (1 - amount)`) so the rail also clears the pedestal between compact and portrait endpoints. Portrait belt and shoulder geometry remain identical at logical height 1100.
- Repositioned the compact transfer rollers toward the belt and remapped the connecting hose to the relocated pedestal. The machinery cabinet retains its previous position and scale.
- Kept pickup/drop at the existing belt parameters 0.27/0.41 and the existing 99-unit wrist offset. Adjusted compact home/lift/transfer coordinates to `(195, 180)`, `(240, 225)`, and `(320, 265)` so the arm stays reachable and its elbow stays below the navigation area throughout the cycle. All phase times and portrait waypoints remain unchanged.

Verification after the follow-up:

- `node --check src/scenes/factory.mjs` passed.
- Evaluated the actual source layout and wrist functions at 97 logical heights (620–1100 in steps of 5) and sampled the complete 3.2-second cycle in 0.01-second increments. Maximum shoulder-to-wrist distance was 274.22 units, within the 290-unit reach. Pickup/drop alignment assertions passed. Portrait anchors and home/lift/transfer waypoints matched their previous values.
- Across logical heights 620–900, sampled the entire pedestal flange ellipse against the far rail, including 3 units of rail thickness: minimum clearance was 6.67 units. Minimum clearance below the screen frame was 16.61 units. The elbow's conservative top bound stayed at y≥62.01 throughout the sampled compact cycles.
- Ran 64 instrumented Canvas renders across heights 620/760/900/1100, normal/reduced motion, and eight cycle/archive times with a 16-call burst. Geometry was finite, save/restore balanced, and the event queue was unchanged by rendering.
- No browser suite or new screenshot was run. The parent should recapture the wide demo to confirm the resulting composition and occlusion visually; these measurements validate procedural geometry, not final browser pixels.

## Event-driven discharge and exhaust

Inspected `evidence/refinement/ui/factory-porcelain.png` with `view_image`: the parent capture confirms that the compact pedestal is visible and the screen is clear.

Added two bounded procedural effects without changing scheduling or geometry:

- Discharge starts at `cycleAt + END * duration / CYCLE`, exactly when the existing outgoing parcel disappears. Twelve small dark triangular shards rise, spin, fall, and fade over 0.7 real seconds from the parcel's last belt position (`u = 0.999`). The animation does not depend on frame rate or `dt`.
- A single sparse exhaust emission starts 35% into each scheduled arm cycle at the generator's upper riser. Three staggered soft wisps rise approximately 37 scene units and expire within 0.9 seconds. It follows the cabinet's compact translation.
- Particle variation uses a deterministic integer hash of call identity and indexed integer noise. Rendering reconstructs particles from timestamps; there is no random generator state, particle array, timer, or event mutation.
- Each frame draws at most three discharge bursts (36 shards) and two exhaust emissions (six wisps). Effects are clipped to the existing 1200-by-logical-height stage, do not alter the paper/floor, and restore canvas state. Empty queues, future scheduled calls and expired effects draw no particles. Reduced motion skips the entire effect renderer.

Verification:

- `node --check src/scenes/factory.mjs` passed.
- Inline assertions passed for idle/future/expired calls, the discharge's 0.7-second lifetime, exhaust expiry, repeatable geometry for identical timestamps/seeds, distinct geometry for different call IDs, stage clipping, alpha restoration, and balanced canvas state.
- A deliberately overlapping 120-record input produced exactly the capped 42 shapes and did not mutate records. The actual render gate was checked at heights 620/860/1100: no effect invocation with reduced motion, normal invocation otherwise, and no event-queue mutation.
- No browser suite was run. Final visual captures remain with the parent; useful capture times for a normal 3.2-second call are approximately `cycleAt + 1.4` for exhaust and `cycleAt + 5.8` for shards. For accelerated calls, derive their emission times from the formulas above rather than those example offsets.


## Parent visual calibration after integration

The parent opened the matched portrait captures and found the far rail still crossed the pedestal in the portrait branch. The portrait belt is now `[-45 + 900*u + 65*v, 190 + 980*u - 33*v]`; compact endpoints remain unchanged. This narrows and steepens the portrait belt and moves its deck below the pedestal. The belt shadow now projects to the lower left, and slats use the sampled warm `#f1ece4` tone. Pickup/release positions continue to use the same belt mapping as parcels. Final wide/portrait and motion captures were inspected; see `evidence/refinement/comparison/factory-left-detail.jpg` and `docs/REFINEMENT-2026-11-18.md`.

</details>
