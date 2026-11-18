# Relay Atelier 开发与贡献指南

## 运行开发环境

项目使用原生 ES 模块、Canvas 2D 和 Electron。渲染层直接加载源码，日常开发无需编译前端或制作安装包。使用与开发机一致的 Node.js 26.7.0 可复现下面的检查。先执行 `npm ci` 安装锁文件列出的依赖。

浏览器测试会启动完整 Chromium，`npm test` 中的 Factory 几何测试也需要它。下面的命令将浏览器安装在当前项目的忽略目录。应在同一个终端安装和运行测试。

**macOS / POSIX shell**

```sh
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.runtime/playwright"
npx playwright install chromium
npm test
```

**Windows PowerShell**

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD ".runtime/playwright"
npx playwright install chromium
npm test
```

启动窗口用 `npm start`。修改渲染代码后可在窗口的 View 菜单中重新加载。修改主进程或来源适配器后，退出并重新启动进程。浏览器开发可用 `npm run web`；修改服务端代码后重启服务并使用新链接。

## 按改动选择验证

| 命令 | 数据与输出 | 检查内容 |
| --- | --- | --- |
| `npm test` | 测试内构造的记录、临时日志或数据库；结果在终端 | 标准化、并发会话、队列、轮转与重连、Web 边界、运动学、Loom 与 Factory 回归。 |
| `npm run test:ui` | 独立的来源样例；默认写入 `output/playwright/` | 运行真实浏览器，检查八种动画、积压、断开恢复、缩放、暂停、减少动态效果和 60 秒空闲。 |
| `npm run verify:desktop` | **实际本机来源**和 Demo；默认写入 `evidence/` | 启动 Electron，检查置顶、沙箱、最小化与恢复、窗口缩放和活动场景。当前脚本按开发机预期断言三个来源已连接。 |
| `npm run verify:live` | **实际本机来源**；`evidence/live-report.json` | 进行 45 秒只读观察。报告里的实时过渡数量取决于这段时间实际发生的调用。 |
| `npm run capture:scenes` | 空来源和明确标记的 Demo；默认写入 `evidence/scenes/` | 生成横屏与竖屏截图及分时运动帧。 |
| `node scripts/record-scene-review.mjs` | 相同的 48 次合成调用；默认写入 `evidence/scene-review/replay/` | 通过正常 Replay 界面录制三个场景，保存 WebM、截图和结果 JSON。 |
| `node scripts/verify-dataflow.mjs` | 独立样例 | 检查名称、主题、方向、颜色和三个高度下的真实像素。 |
| `node evidence/scene-review/loom-study/check-browser.mjs` | 内存样例，输出在脚本所在目录 | 检查历史铭牌、悬停、重播、暂停、减少动态效果及晚到结果的针脚位置。 |

完整浏览器及桌面脚本读取 `RELAY_VERIFY_DIR`，通用截图脚本读取 `RELAY_CAPTURE_DIR`、`RELAY_SCENES`，三场景录像脚本读取 `RELAY_RECORD_DIR`。需要保留上一轮结果时，将输出指向新的项目内目录。例子：

```sh
RELAY_SCENES=loom,factory RELAY_CAPTURE_DIR=output/loom-factory npm run capture:scenes
```

### 首次建库的复现记录

2026-11-18 在 macOS Apple silicon 上，从源码提交 `917862d` 用 `git archive` 导出干净目录，以 Node.js 26.7.0、npm 11.19.0 执行 `npm ci`，安装了 299 个包。按上面的 Chromium 安装步骤准备测试浏览器后，`npm test` 通过 59 项，零跳过。npm 提示两个打包及视频工具依赖的安装脚本未经批准，此次源码运行和测试均正常完成。

在同一副本运行 `npm run verify:desktop`，9 项检查通过，页面错误为零。检查包括读取三个本机来源、窗口置顶、缩放、最小化时停止绘制，以及 Factory 和 Loom 接收 Demo 事件后画面发生变化。各来源新增真实事件的验证范围见[项目首页](README.md)。此前八种场景的 28 项浏览器检查见[三场景修订报告](docs/SCENE-REVIEW-2026-11-18.md)。

## 怎样改一处功能

- **来源与适配器**。从一对脱敏的原始记录开始，在 `tests/adapters.test.mjs` 中复现预期的 ID、状态与目标。文件或 SQLite 读取时序在 `tests/hub.test.mjs` 验证。保留结束证据、迟到父关系和重读去重的语义。[事件规范](docs/EVENTS.md)
- **动画场景**。从 `src/scenes/` 下对应模块入手，给同一个逻辑调用保存稳定的演出记录。先检查空闲，再覆盖开始、结果、连续调用和小窗口。比较画面时写明模式、画布尺寸和事件序列。不同输入的原片与回放可以比较构图及运动规律，不能证明逐帧同步。
- **共享界面**。场景名称、导航、键位和来源模式在 `src/app.mjs`，样式在 `src/style.css`。变更场景名称时同时检查按钮、状态栏、读屏名称以及已保存的场景标识。
- **桌面与浏览器两种入口**。前端新增数据需求须兼顾 preload 和本地 Web 服务。真实来源只经后端标准化后进入窗口。[运行架构](docs/ARCHITECTURE.md)

## 本地 Git 工作方式

主分支为 `main`。仓库注册在原项目目录，产品显示名称为 **Relay Atelier**，npm 包标识为 `relay-atelier`。新改动可以在独立分支完成。下面以一次 Loom 色块修正为例，按实际文件和测试结果调整。

```sh
git switch -c fix/loom-plaque
git status --short
git diff
git add -- src/scenes/loom.mjs tests/loom-spools.test.mjs
git diff --cached --check
git diff --cached
git commit -m "fix: keep loom tool labels aligned"
```

首次建立仓库时使用了一次性项目署名。若 Git 在后续提交时提示缺少作者信息，可以在本仓库设置自己的提交名与邮箱；不带 `--global` 的设置仅作用于此仓库。

| 纳入版本历史 | 留在对应机器 |
| --- | --- |
| 源码、依赖锁、启动器、验证脚本和测试、许可证、历史文字记录、经过选择的合成回放 | `node_modules/`、`.runtime/`（含 Hook 备份）、`release/`、`output/`、运行配置、会话日志与数据库、研究原片、原始证据目录 |
| `evidence/scene-review/loom-study/check-browser.mjs` 和 `research/CrommaCode-LICENSE.txt` 是两个明确的例外 | 在同一目录重新生成的截屏、录像和报告仍按忽略规则处理 |

可用 `git check-ignore -v 路径` 确认某个本地文件命中了哪条规则，用 `git remote -v` 查看仓库是否配置远端。开发、提交与历史查阅都可完全在本地进行。报告问题时优先使用可复现的合成事件。[许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md)
