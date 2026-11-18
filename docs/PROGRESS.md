# 双色飞轮图标与 Agent Hooks · 2026-11-18

当前源码在桌面窗口和 macOS Dock 使用双色飞轮图标，ICNS 与 ICO 资源也已更新。桌面「本地来源」可以安装、修复、移除 Codex、Claude Code 和 OpenCode 的可选 Hook。普通会话监听继续只读运行。公开源码仓库为 [RelayAtelier](https://github.com/NoctisWang528/RelayAtelier)。

本轮在 macOS 上通过 74 项自动测试（含 OpenCode 2.3.2 隔离宿主）、28 项浏览器回归、9 项源码窗口检查和 6 项 Hook 界面检查。OpenCode 的实际插件接口确认插件处于 active 状态。Codex 和 Claude Code 在独立设置文件中验证，Windows 资源和命令格式已检查，Windows 桌面与客户端执行仍待真机验证。[操作及验证入口](HOOKS.md)

## 三场景对照修订 · 2026-11-18 晚

本机原版已打开并观察了空闲 Loom 和 Factory。活动参照来自官方视频的逐帧取样。源码启动入口是 `scripts/start-source.command` 或 `npm start`。本轮的 DataFlow、Factory 和 Loom 运行结果见 [三场景报告](SCENE-REVIEW-2026-11-18.md)，证据目录为 `evidence/scene-review/`。

当前源码通过 59 项测试、三场景回放和 9 项原生窗口检查。MP4 全片 50.48 秒。机械时序、箱体材质与部分织纹仍为近似，保留源码运行方式。

# Source refinement checkpoint — 2026-11-18

User explicitly paused new desktop packaging until the visual match is much closer. The existing `release/` is an older 1.1.0 build and is NOT the current source renderer.

Current checkpoint: REA native Mach-O/Rust inspection exported to `research/rea/`; no renderer assets/source recovered, no original binary modification. Westworld geometry remeasured, six pipes and pulse centrelines aligned, glass/vessel detail and contact wiring added. Factory machinery and belt geometry revised; Chips card/table/dealer refinement and overshoot fix saved; Loom spool colors/frame aligned; Rhythm now opens into wide stable tool lanes in response to events and contracts when idle. Shared paper color/dots calibrated against screenshot pixels.

Run current source with `npm start` or `scripts/start-source.command`; use `npm run web` for local browser preview. No new configuration edits or model tasks in this refinement pass. No quota percentage is exposed by the available tools.

Validation: 44 Node tests, 28 full browser checks, three-height Rhythm motion checks and 7 source-Electron checks passed. Final captures/video are in `evidence/refinement/`; exact check scope and remaining differences are in `docs/REFINEMENT-2026-11-18.md` and `design-qa.md`. Original binary, four existing configs, authorized hook, and both old ASARs were hash-verified unchanged.

Next work: obtain synchronized original motion evidence when native observation is available, refine remaining microgeometry/shadows and timings, then reassess the strict visual gate. The final native reference observation was blocked by the locked Mac; no unlock/bypass was attempted. No new package before the visual gate is met. No background paid-model task or automatic continuation is scheduled.

---

# Previous packaged checkpoint — 2026-11-18

## Delivered
- Version **1.1.0**, independent Electron/Canvas local observer. Six required distinct modes plus Slots/Roulette from the additional screenshots.
- Warm-white reference reconstruction, large responsive landscape compositions, desktop always-on-top, mode switching, pause/focus, idle/hidden throttling.
- Read-only Codex/Claude/OpenCode adapters. Codex fresh Live observed; actual Claude/OpenCode history and fixture updates verified, fresh real activity still unverified.
- **41 unit/backend tests, 28 actual-browser checks, 7 packaged-Mac checks passed.** Zero browser exceptions in final full run/capture.
- Screenshots, three-frame sequences, paired source comparisons, and a fully decoded **39.53-second** MP4 Demo recording saved under `evidence/`.
- Mac Apple silicon app and Windows x64 ZIP rebuilt from current source. Both asars report1.1.0 and match the renderer/backend source; Windows ZIP CRC verified. Windows runtime not tested.
- Official optional OpenCode hook installed; original four config/plugin files unchanged. Requested DeepSeek task silent and cancelled; no successful animation/model run claimed. Reversible disable script included.

## Entry points
- `scripts/start.command` or `release/mac-arm64/Relay Atelier.app`
- `release/Relay Atelier-1.1.0-win.zip`
- `npm start` / `npm run web`
- `README.md`, `docs/VERIFICATION.md`, `design-qa.md`

## Remaining work, without false completion claims
- User's strict pixel/frame identity to CrommaCode is **not achieved**. Warm-white structural reconstruction is complete, but geometry/material detail, some proportions and exact motion curves remain different. Actual comparisons in `evidence/comparison/` document that; design QA does not falsely pass exact fidelity.
- New real Claude/OpenCode Live activity, Windows-host execution, Mac Intel build, signing/notarization and overnight/multi-month endurance remain unverified/unimplemented.
- Backend lifetime pairing/dedupe metadata can grow. History and visual queue limits are disclosed; missing outcomes remain unknown.

## Preservation
All source/build/test writes stay in this project except the specifically authorized official OpenCode plugin addition. `.runtime/hook-backup/` stays local and is excluded from shareable source/app archives. Existing user configs and original CrommaCode are unchanged. No global security changes or public publishing.

No further unattended work or paid model retry is scheduled. Existing implementation is saved and can be continued from this checkpoint.
