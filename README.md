# Relay Atelier

独立、仅在本机运行的 Coding Agent 动效观察器。按提供的 CrommaCode 画面重做了瓷白机械场景，保留大尺寸场景空间，新增 DataFlow 节点场景。它是独立绘制的程序，不是 CrommaCode 原程序，也不声称逐像素或逐帧完全一致。

## 当前源码优化版（2026-11-18）

Mac 双击 **`scripts/start-source.command`**，或在项目目录执行 **`npm start`**。最新一轮修改了 DataFlow 配色、Factory 货物和 Loom 工具铭牌。运行证据与复现方法见 [三场景修订报告](docs/SCENE-REVIEW-2026-11-18.md)。

`release/` 和 `scripts/start.command` 对应早先的 1.1.0 版本。上一轮的八场景对照保存在 [源码优化记录](docs/REFINEMENT-2026-11-18.md)。

## 之前的打包版本

- **本机 Mac Apple silicon**：双击 `scripts/start.command`，或直接打开 `release/mac-arm64/Relay Atelier.app`。
- **Windows x64**：解压 `release/Relay Atelier-1.1.0-win.zip`，双击 `Relay Atelier.exe`。已在 Mac 交叉打包，尚未在 Windows 真机运行验证。
- 源码启动：在本目录执行 `npm ci`，然后 `npm start`。使用支持 `node:sqlite` 的 Node 版本；本机测试版本与 Electron 内置版本见 `docs/SOURCES.md`。
- 浏览器备用版本：`npm run web`，打开终端打印的完整本地链接。默认监听 `127.0.0.1:4317`；端口占用时自动选择空闲端口。链接包含一次启动的本地访问令牌；程序没有公网服务。

Mac 包未经 Apple 签名或公证。当前机器已实际运行验证；其他机器的系统信任要求仍由系统处理。

## 使用

保持在原来的终端或客户端使用 Codex、Claude 或 OpenCode。默认 **Live** 自动只读发现本地来源；底部显示连接情况和最近真实事件时间，可以筛选会话。应用不执行模型、命令、调度或 Git 操作。

- **Live**：真实来源。启动前历史只填充状态，不伪装成刚发生的动画。日志无明确结果时标为未知；超过五分钟仍无结果的调用显示“未知·超时”。
- **Replay**：回放读到的历史事件，可重播及调节速度。长间隔压缩到最多 1.4 秒，不能作为真实耗时测量。
- **Demo**：明确标记的模拟工具调用。包含并发、等待、失败和未知结果。

顶部切换 Westworld、Loom、Factory、Chips、Rhythm、Slots、Roulette、DataFlow。键盘 **1—8** 切场景，**Space** 暂停演出，**F** 隐藏底部信息区以放大场景。右下角图钉切换桌面置顶。暂停时仍监听来源；不丢弃共享会话状态。不可见/最小化时停绘，空闲降至约 12 fps，系统减少动态效果偏好可用。

筹码、倍率、节奏轨道和附加转轮都是事件演出，不表示 Agent 质量，不涉及投注或奖励。原版广告位改成真实工具状态窗，没有账号或广告网络。

## 场景

| 场景 | 实际动画 |
| --- | --- |
| Westworld | 大幅裁切的精密转盘、阻尼定位、刻度及紧固件、能量线路往返脉冲、玻璃容器响应 |
| Factory | 侧向滚道进料，双爪抓取并转移到主带。封箱带、标签和箱体跟随带面透视，连续调用单列排队，结果更新原箱 |
| Chips | 发牌轨道、弹性落牌、卡堆、筹码和事件倍率，结果更新原卡 |
| Rhythm | 透视多轨标记、弧形判定线、到达反馈，晚到结果更新同一事件 |
| Loom | 16 块工具铭牌与经线分组对应，悬停可读全名。真实历史只填铭牌，演出中的每次调用织入一行，结果更新原针脚 |
| DataFlow | 瓷白核心与工具节点、出发/返回拖尾、错误红色、观察到子代理关系时生成分支 |
| Slots / Roulette | 按额外截图补充的两种机械演出：多列停轮与联动气罐；轨道入球与减速落槽。均使用工具符号 |

## 真实接入范围

Codex 已捕获本次开发产生的实时新事件，包含并发子代理。Claude 和 OpenCode 已解析本机真实历史会话，并通过脱敏样例验证新增、配对及恢复；**未完成新的真实 Claude/OpenCode 工具调用验证**。发现来源/读到历史不等于验证了正在工作的 Agent。

应用自身不依赖 Hook。为观察原版，按用户额外授权，通过 CrommaCode 的官方自动接入新增了 `~/.config/opencode/plugins/bees-hive.js`；原 OpenCode 配置和其他插件未修改。指定 `magpie/auto/deepseek-v4.1-flash` 的一次任务无输出、无工具事件，约三分钟后取消，没有重试。安装记录在 `evidence/hook-install-report.json`。

要撤销这次额外 Hook，执行 `node scripts/disable-cromma-hook.mjs`。脚本校验安装文件哈希后将它移至本项目 `.runtime/hook-backup/`，可逆且不覆盖原配置；文件若已被后续更新会拒绝操作。重启 OpenCode 后生效。再从 CrommaCode 内启动 OpenCode，原版可能重新安装 Hook。

## 验证及证据

- `npm test`：事件标准化、去重、并发、只读数据库、重连、本地 HTTP 边界及队列。
- `npm run test:ui`：实际浏览器动画、并发、1,000 次调用积压、来源/传输中断恢复、缩放、切场景、暂停、空闲、等待及结果配对。
- `npm run verify:desktop`：实际 Electron 桌面、置顶、最小化停绘、缩放、安全设置。
- `npm run capture:scenes`：生成八种场景的纵/横截图、运动序列与视频。截图标注 Demo；不包含私有会话内容。
- `npm run verify:live`：45 秒本机只读观察，不启动付费任务。

浏览器测试首次需要：`PLAYWRIGHT_BROWSERS_PATH="$PWD/.runtime/playwright" npx playwright install chromium`。Windows PowerShell 可先设置 `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.runtime/playwright"`。

本轮源码结果参见 `docs/REFINEMENT-2026-11-18.md`、`design-qa.md` 和 `evidence/refinement/`。`docs/VERIFICATION.md`、`evidence/scenes/`、`evidence/desktop-report.json` 保留的是较早打包版本的记录。

## 已知边界

- 视觉结构和运动按公开视频、本机观察及截图独立重建；没有原版源码和精确运动参数，不作“一模一样”的结论。广告画面、模型品牌标志、账号功能不属于本程序。
- Windows 仅完成打包，未有 Windows 真机验收；Mac Intel 未生成专用包。
- 历史窗口、监听文件数量和视觉队列有限，高密度调用会折叠演出，并显示折叠数；状态不会因切场景清空。读到的历史不是完整账本。
- JSONL 结束记录缺失、数据库轮询间的短暂状态可能无法恢复。后端长期去重/配对索引会增长；未证明数月连续运行时常量内存。具体限制见 `docs/SOURCES.md`。

## 项目数据

源码、依赖、构建、测试临时文件都留在本目录。源码运行缓存位于 `.runtime/`；Mac 包运行缓存位于应用所在目录的 `RelayAtelierData/`。测试只向项目内的独立脱敏样例写入。运行资源、字体均本地加载，没有遥测和远程请求。`.runtime/hook-backup/` 是原配置备份，请保留在本机，不随源码分享。
