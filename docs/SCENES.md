# Canvas scene report — reference layout revision

The rejected dark instrument layouts have been replaced with paper-and-enamel reconstructions based on the user's Factory, Loom, and Rhythm screenshots. The official video was also inspected, including the Chips frame at 15 seconds. Each scene now uses **1200×1100** logical coordinates, warm paper `#faf9f6`, white enamel `#fdfcf9`, and fine grey `#c5c2ba` outlines directly. There is no color inversion, background clearing, network asset dependency, or duplicated screenshot texture.

Changed implementation files: `src/scenes/factory.mjs`, `chips.mjs`, `rhythm.mjs`, `loom.mjs`, and `scene-utils.mjs`. Host UI, shared host geometry, package configuration, source adapters, and tests remain outside this scene work.

## Reference compositions

| Scene | Layout and physical details | Event mechanics |
| --- | --- | --- |
| Factory | One diagonal conveyor from approximately (−100,120) to (900,1100), projected rhombus slats, long guard rails and support feet, off-white two-link arm, upper-right framed control screen, ribbed motor and bolted turbine, lower-left status plaque | One package per retained call; articulated pickup, transfer, release; queue pressure acceleration; coalesced packages carry ×N and grow modestly. The belt and turbine stop when retained transport ends. |
| Loom | Cropped giant dial at upper left; narrow control boxes and piping below it; dominant full-height thread bed at x≈450–1180; 216 pastel warp intervals, top tool labels, light sliding heddle bars, accumulated colored top band | One row per stable call; subsequent status changes recolor the same row; shuttle and heddles move only for actual scheduled passes. No fabricated cloth pattern in the empty state. |
| Rhythm | Suspended upper-corner frames; 16 long thin perspective lanes converging near (600,220); giant partial dial centered at (600,1550), radius 850; etched timing arc, small side counters, bottom instrument rail | One marker per retained call. A finish updates its status; a late finish impacts the same latch without launching another marker. Counters are explicitly event counts/cadence, never task-quality scores. |
| Chips | Huge dial cropped at x≈270; pale table plate x350–1180; chunky grey LCDs labeled 筹码/倍率; inset played-card bed x520–760, y400–720; dealer x948–1176, y133–403; deep narrow guide track down to the right shoe; shallow fan spanning the bottom | A new card feeds down the guide before springing into the played-card bed. Stable call cards retain their status marks. Accent rays begin after arrival, and settle analytically. The chips count is retained calls; the multiplier is explicitly theatrical event cadence, not task quality. |

The reference's advertising screens are replaced with actual tool/status panels in the same physical locations. This is procedural Canvas geometry based on the supplied layout, not an exact raster or original-source reconstruction. Native host navigation, dot background, responsive cover behavior, and any sponsor content are owned by the main implementation.

## Event and motion contract

Every module default-exports a class with `constructor()`, `onEvent(event,t)`, and `render(ctx,t,dt,state)`. Each scene stores at most **120 call records**, keyed by stable `callId`. Finishes update existing retained objects. Oldest records are evicted on overflow; a later update outside that retention window may re-enter as a retained visual. Host `visualCount` survives subsequent status updates and appears as `×N`.

Scheduling occurs in `onEvent`; rendering uses analytical positions and never integrates `dt`. Scenes therefore produce identical frames whether they were continuously rendered or inactive. Reduced motion settles physical transport, card arrivals, and weaving, and removes traveling markers and impact effects. Failures carry red crosses; waiting and unknown use amber and dashed marks or fabric gaps.

Factory preserves the current gesture and fits future queued transfers into at most **9.6 seconds**, with proportional outfeed acceleration. All remaining retained motion ends within **15.25 seconds** of the last arrival. Its belt phase is the bounded sum of actual retained transport plus a frozen offset for evicted work; removed calls leave no invisible future motion. Loom preserves its current pass and fits queued passes into **8 seconds**, for a maximum remaining motion window of **8.76 seconds**. Pressure multipliers are labeled.

## Verification

- All five scene modules pass `node --check`.
- Identity, `×N`, object bounds, and deadline assertions pass for 1,000-call bursts at simultaneous, 5 ms, and 200 ms arrival intervals.
- Actual Canvas2D rendering at 1200×1100 passes empty-idle stability, event response, reduced-motion stability, and settled-idle checks for all four scenes. All four light-layout captures were visually inspected against the references.
- Actual browser checks also compare continuously rendered and inactive scenes, and verify settled pixels after the 1,000-call burst. No JavaScript errors occurred.
- Existing repository tests: **33 passed, 0 failed** at this revision.

Desktop integration and final reference comparison remain with the main agent. Local browser checks are not a cross-device frame-rate guarantee.
