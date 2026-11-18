> 这是上一轮 1.1.0 打包交付的历史记录。之后的源码优化没有重新打包；最新验证见 `REFINEMENT-2026-11-18.md`。下文“current source”仅指打包时的源码。

# Delivery verification — Relay Atelier 1.1.0

Date: 2026-11-18, Asia/Shanghai. This report distinguishes passing runtime behavior from incomplete exact visual identity. See `design-qa.md` for actual source/capture comparisons.

## Automated and actual-runtime results

| Evidence | Result |
| --- | --- |
| `evidence/unit-tests.tap` | **41/41 passed**: normalization, pairing/deduplication, source/child identity, unknown outcomes, partial UTF-8/JSON writes, rotation/truncation, cross-file results, late parent information, bounded history, read-only SQLite, WAL, recovery, malformed HTTP and local access controls |
| `output/playwright/ui-report.json` | **28/28 passed**, zero JavaScript errors in actual Chromium |
| `evidence/desktop-report.json` | Actual Mac Electron checks: all three local sources detected, sandbox/context isolation, always-on-top readback, active scenes, resize, minimized stop-drawing, process snapshot |
| `evidence/scenes/capture-report.json` | Eight actual scenes, portrait idle, landscape idle/Demo, and three motion frames each; zero scene JavaScript errors |
| `evidence/config-integrity.json` | Four pre-existing OpenCode configuration/plugin files remain byte-identical |

The browser run covered a single start/completion counted once; three concurrent agents; failed and unknown outcomes; all eight scene animations; Demo isolation; filtering the parent session; real-format fixture Replay; a 1,000-call burst with independent call state and a visual queue ≤240; missing source and SSE disconnect/recovery; 820×650 resize; same-state scene switching; pause and reduced-motion preference; and an actual **60-second idle interval**.

During that idle interval there were **721 rendered frames** (about 12 fps), no synthetic calls, and collected JavaScript heap changed from **5,570,952 to 5,628,772 bytes**. This is one short controlled observation, not proof of indefinite constant-memory operation. A final file-driven Codex fixture displayed **waiting**, then a later process-poll completion resolved the original call; only the separate actual poll was counted as another call.

Validation found and fixed genuine issues, including source cross-file pairing, restart timing and layout clipping. The first UI harness rerun failed because adding the Codex waiting fixture changed the first session option; the script now selects the intended session by identity. The initial Chromium headless-shell build stalled; tests use the full project-local Chromium executable. Neither failed attempt is represented as a passing run.

## Real-source verification

`evidence/live-report.json` is a fresh **45-second read-only observation** without launching a model for test traffic:

- **Codex**: 46 selected real session files, 610 retained distinct calls in the per-source snapshot, **13 newly observed transitions** during the live window: six starts, four completions, three waits; four transitions with parent links.
- **Claude**: 42 real files, 1,732 retained distinct historical calls. Parser and incremental scenarios passed fixtures. **No fresh real Claude work was observed.**
- **OpenCode**: one actual SQLite database, 1,799 retained distinct historical calls. Read-only legacy/V2 parsing and fixture WAL updates passed. **No fresh real OpenCode tool work was observed.**

These snapshots intentionally omit older/backlogged bytes and cap history. Counts are retained windows, not all-time totals. Startup/history loading does not create Live animations. Exact versions, paths, schema observations and limits are in `docs/SOURCES.md`.

The optional original-app experiment installed CrommaCode's OpenCode plugin through its official UI. The exact requested `magpie/auto/deepseek-v4.1-flash` task stayed silent, generated no tools, and was cancelled after approximately three minutes. The failure cause and any provider billing are unknown. It was not retried. This cannot establish original-app live motion or fresh OpenCode integration success.

## Visual and motion evidence

- `evidence/scenes/`: full-resolution screenshots and time-separated motion frames for Westworld, Factory, Chips, Rhythm, Loom, Dataflow, Slots, Roulette.
- `evidence/overview.jpg`: all eight actual Demo views.
- `evidence/motion-sequence.jpg`: three actual time-separated frames for dial, robot arm and dataflow.
- `evidence/comparison/`: paired original and reconstructed idle captures.
- `evidence/motion-demo.webm` / `.mp4`: continuous Demo recording with mode switches; does not claim to be Live footage.
- `output/playwright/validation.webm`: longer actual automated validation run, with synthetic file fixtures.

Final standalone screenshot run reported approximately **60 / 49 / 59 / 60 / 60 / 34 / 50 / 60 fps** for dial / loom / factory / chips / rhythm / slots / roulette / dataflow respectively. These are in-app samples during capture on this Mac, not controlled hardware benchmarks or guarantees. Concurrent recording/testing produced lower values and is not used as the sole performance measure.

## Packaging and limits

Mac Apple silicon and Windows x64 portable builds are generated from version1.1.0. The packaged Mac application is exercised using its own executable; final executable path and security settings are saved in the desktop report. Windows is cross-built and its package inspected, **not executed on a Windows host**. Mac Intel, signing/notarization and other OS runtime verification are unfinished.

Strict visual identity remains unfinished: the build is a close structural reconstruction with independently drawn machinery, not CrommaCode's rendering code/art. Different tube bends, rib/fastener detail, some proportions, and exact motion timing remain. Ads and model logos are intentionally replaced with tool information. No “pixel perfect” or similarity percentage is claimed.

Backend pairing and dedupe metadata grows with distinct lifetime history. SQLite changes trigger a history scan; extremely large databases may cost more. Only 60 seconds of idle and bounded synthetic bursts were measured, not an overnight/month-long soak. JSONL missing ends and transient SQLite states are never synthesized as success. All packaging/test resources stay local; no global security setting was changed and no public deployment occurred.

## Configuration changes and rollback

The observer writes no Agent Hook/configuration and needs none. The separately authorized original-app experiment added only `~/.config/opencode/plugins/bees-hive.js`. Original manifests/backups are in `.runtime/hook-backup/`; they stay local and are excluded from app/source archives. `node scripts/disable-cromma-hook.mjs` reversibly disables that exact added file if unchanged. Existing configs do not need replacement. Restart OpenCode to unload it; launching inside CrommaCode again may reinstall its integration.

Final package inspection (`evidence/package-report.json`) confirms both Mac and Windows `app.asar` contain version **1.1.0**, match all checked current renderer/backend files byte-for-byte, and exclude `.runtime`, research media and evidence. Windows ZIP CRC and its `Relay Atelier.exe` entry passed inspection. All **seven** packaged Mac checks passed; the saved renderer URL is inside the built `.app/Contents/Resources/app.asar`.
