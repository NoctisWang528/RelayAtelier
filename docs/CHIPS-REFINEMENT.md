# Chips physical-detail refinement

Date: 2026-11-18

Scope: `src/scenes/chips.mjs` and this document only. No shared drawing helpers, other scenes, host layout, backend, packages, or event sources were edited. The new drawing functions are local to Chips and reused by its compact and portrait layouts.

## Evidence opened

- `research/rea/chips-active-video.png` — official demo frame at approximately 15 seconds; primary reference for the scalloped table edge, counters, card shoe, feed mouth, played card, and retained hand.
- `research/all-frames.jpg` — official-demo contact sheet, establishing changing card states and the surrounding composition.
- `evidence/scenes/chips-portrait-idle.png` — previous portrait implementation.
- `evidence/scenes/chips-wide-demo.png` — previous compact implementation with events.

The prior captures showed a straight rectangular tabletop, broad flat card tray, thin counter numerals, and relatively flat cards and shoe. These existing captures are not screenshots of this revision.

## Changes

- Replaced the rectangular tabletop with a procedural contour: the left edge bows around the cropped rotor, then curves outward into the lower hand shelf. A narrow inner highlight, warm enamel gradient, perimeter screws, and soft edge shadow give the plate thickness. The contour adapts to the compact layout; its compact left boundary moves from x=290 to x=260 to accommodate the curved edge and capillary.
- Rebuilt the visible feed chute as a pale recessed channel with shaded sides, paired highlighted guide rails, repeated fasteners, a top throat, and lower mounting tabs. Added a cylindrical ribbed outlet roller, bearing screws, and a metal lip to the dealer housing.
- Clipped the selected card to the chute during its existing initial feed phase. The card leaves that clip when its existing spring transfer to the played-card bed begins.
- Added a recessed shoe bed, side retaining rails, lower stop, layered sheet edges, warm peach/copper face shading, and a double ornamental border. The patterned base cover remains stationary trim; extra exposed layers still derive from retained-call count.
- Replaced the flat white hand panel with a shallow enamel tray, inner shelf, ruled bottom rail, corner bolts, and contact shadow. Retained cards still overlap and fan according to the existing layout.
- Added a visible stock edge beneath card faces, a subtle face gradient, stronger contact shadows, and a warm outline around the selected card. Tool indices and center titles use heavier type; status text, status marks, and coalesced counts remain visible. Long center titles scale within the card width, including during the narrower feed phase.
- Changed the main counter values and smaller event/dealer counters to the existing ComicMono family in bold. Added another fine highlight to the cast counter housing.
- Added mounting screws and a small center-line engraving around the played-card recess.

## Preserved behavior

`onEvent`, stable call identity, `eventCount`, cadence combo, selected-call handling, and the shared 120-record retention limit are unchanged. No calls, scores, or task-success values are fabricated.

The 0.28-second initial feed, analytical spring transfer, retained-hand spring positions, status-update accents, and reduced-motion branches keep their existing timing and data inputs. Geometry continues to use the existing 620–1100 logical viewport-height range and component reflow. All rendering remains procedural Canvas2D; no screenshot, video frame, or static background texture was introduced.

## Validation and limitations

- `node --check src/scenes/chips.mjs` — passed after the final edit.
- Reviewed both rendering branches and their local helper calls. No browser, unit, rendering, or integration suite was run, as requested. No screenshot or package was produced.
- Parent QA still needs to verify rasterized shadows, actual ComicMono text metrics, the curved edge at intermediate heights, card clipping during feed, and motion with overlapping calls. Syntax validation does not establish visual fidelity or runtime frame rate.
- Sponsor imagery, original numerical scoring, and the large score-calculation overlay are intentionally not reproduced; the displays continue to describe observed local events. The official frame does not establish exact original material construction or animation timing.
- Cropped-dial rendering and shared pipe behavior remain with the parent. This is an independent procedural interpretation of the visible mechanisms, not a pixel-identical reconstruction.

## Final compact spring-clearance correction

Opened `evidence/refinement/scenes/chips-wide-demo.png`, which showed the selected card overshooting beneath the navigation. Changed only the compact bed interpolation from `lerp(52+86*room,400,portrait)` to `lerp(98+40*room,400,portrait)`. The bed starts at y=98 at height 620, retains y=138 at height 800, and still reaches y=400 in portrait. Event handling, spring timing, card dimensions, and all other layout formulas are unchanged.

`node --check src/scenes/chips.mjs` passes. A one-off analytical Node calculation bounded the full spring at height 620: its largest overshoot is 1.1516385 at call age 0.492799 seconds, and all later peaks decay. Accounting conservatively for card rotation, scaling, and the outer selection-outline stroke gives a top-edge lower bound of **y=77.76**, below the navigation's approximate lower edge at y=75 in screen coordinates. Before overshoot, the bound is y=103.02; initial feed occurs farther down the chute.

The bed ends at y=373.2 and the hand tray starts at y=398, leaving **24.8 logical units** between them. Even the lower mounting screws retain **14.91 units** of clearance. This calculation bounds physical outlines, not the faint blur of cast shadows. No browser or suite was run; the parent will recapture Chips with this final correction.
