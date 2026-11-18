# Slots and Roulette scene reconstruction

Implemented 2026-11-18 from `research/user-reference/slots.png` and `research/user-reference/roulette.png`, both visually inspected before drawing. All machinery is procedural Canvas2D. The code imports the original light-machinery helpers from `src/porcelain.mjs`; that file was not changed. No raster backgrounds, external assets, random traffic, timers, network requests, gambling, bets, or rewards.

## Files and integration

- `src/scenes/slots.mjs`: default `Slots` class.
- `src/scenes/roulette.mjs`: default `Roulette` class.
- `src/scenes/casino-utils.mjs`: shared identity handling, tool glyphs, transparent tubing, pulleys, lamps, and neutral framed signal screens.
- `docs/CASINO-SCENES.md`: this report and runnable assertions.

Both classes expose `constructor()`, `onEvent(event, t)`, and `render(ctx, t, dt, state)`. The logical drawing surface is **1200 × 1100**, following the user's correction to the older 1200 × 700 contract. The host supplies its paper/dot-grid background and scaling; neither scene clears the canvas. Fonts use the existing local `ComicMono` and bold face through `porcelain.label`. Chinese glyphs use the host's font fallback, as ComicMono does not contain them.

Only the four files above were written in the repository. Host imports, CSS, backend, package files, other scenes, and `src/porcelain.mjs` were not edited. Registering the new scene classes belongs to the concurrent host/shell task.

## Visual reconstruction and exact deviations

**Slots:** cream chassis at `(62, 213, 672, 718)`, rounded status capsule above it, five clipped shaded reels, centre indicator, bolt rails, five clutches and lamps, framed lower screen, gauges, perforated handle, plinth and feet. The upper-right dial is centred at `(1190, -57)` with radius `492`, cropped by the canvas. Its etched rings, segment accents, escapement and belt connect visually to the compressor and pneumatic vessel at `(948, 647, 209, 319)`. The vessel has bands, rivets, glass level indicator, brackets, gauge, pipes and a moving pulley.

**Roulette:** wheel centred exactly at `(240, 550)`, radius `440`, cropped left. It has 24 slotted tool pockets, recessed channels, a graduated outer ring, 24 white bolt heads, nested enamel track rings, engraved inner divisions and a four-arm hub. A cropped dispatch ladder occupies the upper-right; the conical funnel, angled transparent return chute, pneumatic nozzle and framed control screen occupy the middle-right. The lower belt couples the wheel to the mechanical counter at `(878, 914, 301, 163)`.

Intentional differences from the screenshots:

1. External AI brand logos are replaced by six original vector tool symbols: files, shell, search, web, agents and other. Slots uses the muted original porcelain tool colours; Roulette uses engraved grey symbols. The logos' exact silhouettes are not reproduced.
2. Only the contents of the advertising screens are replaced with neutral local tool/status/target information and host active/completed counts. Their metal frames remain. There is no landscape image, external ad, currency button or purchase action.
3. The screenshot artwork is re-proportioned into 1200 × 1100, excluding the navigation bar and bottom host dashboard. Slots uses a 602-pixel status capsule, 601-pixel reel opening and 380 × 218 screen. Roulette's wheel follows the explicitly requested centre/radius rather than the source image's pixel coordinates. Small screw, tick, rib and pulley counts are reconstructed rather than pixel traced.
4. Slots' reference spin label becomes `调用`; its pressure value is the host's active-call count. The pressure glass and gauges reflect bounded active load. Roulette's counters show host total/completed/active/failed values, not wagering statistics. Counter faces have seven/four/four/one digit positions like the reference composition; overflow displays the least significant digits while host counts remain intact.
5. Motion is an event visualisation inferred from the still references. Each Slots call owns one of five reels, so concurrent calls occupy multiple reels; burst traffic can replace an older visible reel motion. Every landing is the call's actual tool category, with deterministic travel derived from its call ID. Roulette adds bounded inertial axle travel and one ball per start. Completed balls transfer to the funnel and travel down the return chute; this is a hand-off at the end of the wheel motion, not a continuous simulated flight between the wheel pocket and funnel lip. Failed balls/lamps are red; waiting/unknown are amber and do not imply success.
6. Geometry uses light ivory gradients, hairlines, warm shadows and drawn white enamel edges rather than the screenshot's original rendering engine. There is no claim of pixel-identical reproduction or recovered original physics.

## Event and scheduling guarantees

- Identity is the tuple `(source, sessionId, callId)`, not a transition ID or bare call ID. An accepted start creates one motion; duplicate starts do not relaunch it. Waiting can precede a start. Completed/failed/unknown updates mutate the existing retained call. A late start cannot reopen a terminal call.
- Terminal-first history appears on the status screen without inventing an earlier spin. Events evicted from the visual window do not reappear while their identity is in the retirement cache.
- Each scene retains at most **120 full call records** and **6000 identity-only retirement keys**. Retirement keys contain no events, targets, timestamps or animation tickets. Beyond that finite identity window, replay deduplication remains the host EventStore's responsibility.
- Slots launch delay is capped at **5 s**, with a maximum **3.06 s** spin: at most **8.06 s** to settle. Roulette launch delay is capped at **5 s**, with a maximum **3.52 s** wheel/ball motion and **1.65 s** return: at most **10.17 s** of queued animation, below 12 s. A genuinely long-running tool may remain parked until its real status arrives; that is not queued animation.
- At pressure, motions overlap and the newest eligible ticket owns its reel. Old visual records are retired rather than extending playback. Roulette's axle preserves its sampled angle when evicting a ticket.
- Motion is evaluated from host time `t`, not accumulated per render. Hidden scenes catch up on their next render, and repeating the same `t` freezes the image. `dt` does not create traffic or determine landing. Reduced motion displays settled positions without orbiting or chute travel.
- Rendering reads `state.counts` and never mutates the host's calls, counts, active list or agents. Canvas transforms, clipping, styles and save/restore depth are preserved.

## Validation performed

Inline Node assertions passed for both scenes: duplicate starts, in-place finish updates, session/source identity separation, waiting→start, terminal-first history, late starts, deterministic landing, 10,000-call bursts, bounded retirement cache, and replay of an evicted identity. The burst retained exactly 120 records. Maximum observed settle times were Slots **8.06 s** and Roulette **8.52 s**; Roulette's additional return remains below the **10.17 s** bound.

The actual modules were loaded over a temporary local static server in the project's bundled Electron runtime using Playwright. All local ComicMono faces loaded. Captured and visually inspected idle and result frames against both user references; also captured motion and parked frames. Pixel comparisons verified empty idle stability, moving frames after real test starts, stable parked long-running calls, and stable reduced-motion frames. A frozen host state rendered successfully, and instrumented Canvas calls confirmed zero save/restore imbalance plus unchanged transform, font, fill style and dash state. Both scenes completed without browser errors after fixing a negative radius in a small dispatch pulley.

Measured JavaScript draw-command submission averaged approximately **0.82 ms/frame Slots** and **0.64 ms/frame Roulette** over 60 renders in that Electron check. These are local command-submission measurements, not an end-to-end FPS guarantee. Headless Edge did not finish startup; final checks used Electron instead. Existing whole-app integration/backend tests were not rerun because those files are owned by the concurrent tasks and were not modified here.

Temporary preview files (outside the repository): `/tmp/casino-slots-{idle,moving,landed,results}.png` and `/tmp/casino-roulette-{idle,moving,landed,results}.png`. They may be removed by the OS. The browser validation harness is `/tmp/casino-check.mjs` for this session.

### Re-run the identity and queue assertions

Run from the repository root:

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import Slots from './src/scenes/slots.mjs';
import Roulette from './src/scenes/roulette.mjs';
import { keyOf, TYPES } from './src/scenes/casino-utils.mjs';

const event = (callId, status = 'started', extra = {}) => ({
  id: `${callId}-${status}`, callId, status,
  source: 'codex', sessionId: 'session', agentId: 'agent',
  toolType: 'files', tool: 'Read', target: 'scene.mjs', ...extra,
});

for (const Scene of [Slots, Roulette]) {
  const scene = new Scene(), start = event('a');
  scene.onEvent(start, 1);
  const call = scene.calls.get(keyOf(start));
  const schedule = [call.start, call.end, call.duration];
  scene.onEvent(start, 1.1);
  scene.onEvent(event('a', 'started', { id: 'duplicate-start' }), 1.2);
  assert.equal(scene.calls.size, 1);
  scene.onEvent(event('a', 'waiting'), 1.3);
  scene.onEvent(event('a', 'completed'), 2);
  assert.equal(scene.calls.get(keyOf(start)), call);
  assert.deepEqual([call.start, call.end, call.duration], schedule);
  assert.equal(call.event.status, 'completed');
  scene.onEvent(event('a', 'started', { id: 'late-start' }), 3);
  assert.equal(call.event.status, 'completed');

  scene.onEvent(event('a', 'started', { sessionId: 'different' }), 3);
  scene.onEvent(event('a', 'started', { source: 'claude' }), 3);
  assert.equal(scene.calls.size, 3);
  scene.onEvent(event('end-first', 'failed'), 3);
  const orphan = scene.calls.get(keyOf(event('end-first')));
  scene.onEvent(event('end-first'), 4);
  assert.equal(orphan.launched, false);
  scene.onEvent(event('waited', 'waiting'), 4);
  scene.onEvent(event('waited'), 5);
  assert.equal(scene.calls.get(keyOf(event('waited'))).launched, true);
  scene.onEvent(event('unknown', 'unknown'), 5);
  scene.onEvent(event('unknown'), 6);
  assert.equal(scene.calls.get(keyOf(event('unknown'))).launched, false);

  const copy = new Scene(); copy.onEvent(start, 90);
  const same = copy.calls.get(keyOf(start));
  if (Scene === Slots) {
    assert.equal(call.type, same.type);
    assert.equal(call.turns, same.turns);
  } else assert.equal(call.pocket, same.pocket);

  const burst = new Scene();
  for (let i = 0; i < 10000; i++) {
    burst.onEvent(event(`burst-${i}`, 'started', { toolType: TYPES[i % 6] }), 10);
  }
  assert.equal(burst.calls.size, 120);
  assert.equal(burst.retired.size, 6000);
  for (const ticket of burst.calls.values()) {
    assert.ok(ticket.start - 10 <= 5);
    assert.ok(ticket.end + (Scene === Roulette ? 1.65 : 0) - 10 < 12);
    if (Scene === Slots) assert.equal(TYPES[ticket.type], ticket.event.toolType);
    else assert.equal(TYPES[ticket.pocket % 6], ticket.event.toolType);
  }
  const keys = [...burst.calls.keys()];
  burst.onEvent(event('burst-9800', 'started', { id: 'evicted-replay' }), 20);
  burst.onEvent(event('burst-9800', 'completed'), 20);
  assert.deepEqual([...burst.calls.keys()], keys);
  if (Scene === Roulette) {
    assert.equal(burst.rotationAt(100), burst.rotationAt(200));
    const angle = burst.rotationAt(11);
    burst.onEvent(event('new-after-eviction'), 11);
    assert.ok(Math.abs(burst.rotationAt(11) - angle) < 1e-9);
  }
  console.log(`${Scene.name}: identity, outcomes, deterministic landing, retirement and queue bound PASS`);
}
NODE
```
