<img src="assets/logo/relay-atelier.svg" alt="Relay Atelier 双色飞轮图标" width="96" height="96">

# Relay Atelier

Relay Atelier 是在本机观察 Coding Agent 工具调用的桌面程序。继续在原来的终端或客户端使用 Codex、Claude Code 或 OpenCode，观察器会把会话里的开始、等待、完成和失败转成机械动作。没有会话时，可以直接切到 Demo。

[![同一份样例依次驱动 Factory 的货箱、Loom 的织物和 DataFlow 的节点](examples/replay-preview.jpg)](examples/three-scenes.mp4)

[观看 50 秒运行录像](examples/three-scenes.mp4)。Factory、Loom 和 DataFlow 依次回放同一份合成样例，每次都有 48 次调用、4 个 Agent。可以直接播放这段录像，也可以按开发指南在本机重现。

## 启动当前源码

在项目根目录执行下列命令。本机验证环境为 macOS Apple silicon、Node.js 26.7.0 和 npm 11.19.0。OpenCode 适配器使用 Node.js 内置的 `node:sqlite`，依赖版本以 `package-lock.json` 为准。

```sh
npm ci
npm start
```

- **已用 npm start 初始化 Electron 的 Mac 工作目录**可直接在 Finder 双击 [源码启动器](scripts/start-source.command)。
- **Windows 源码**使用相同的两条 npm 命令。当前源码窗口已在 macOS 验证，Windows 真机运行仍待验证。
- **浏览器入口**为 `npm run web`。打开终端打印的完整本地链接。按 Ctrl+C 停止。默认端口为 4317，遇到占用自动选择空闲端口。
- `scripts/start.command` 和 `scripts/start.bat` 会优先打开本机已有的旧包。项目中如有 `release/`，其中的 1.1.0 对应较早的视觉版本。当前源码启动入口见上。

首次使用可以选 **Demo → Factory** 看取料、放料和出带，再切到 **Loom** 看同一批调用怎样织入布面。要观察自己的 Agent，切到 **Live**，在右下角“本地来源”查看连接详情和最近真实事件。历史排演用 **Replay**。[使用手册与故障排查](docs/USAGE.md)

## 场景

| 场景 | 一次工具调用在画面上的表现 |
| --- | --- |
| Westworld | 转盘带阻尼地定位到工具扇区，指示灯、管线和玻璃容器随事件响应。 |
| Loom | 16 块铭牌标识工具，织梭落下一行织物。悬停可见完整名称，结果更新原针脚。 |
| Factory | 双爪从侧向滚道取箱，转移到主带。箱体和带板共用位移，连续调用形成单列队伍。 |
| Chips | 工具卡从牌靴送出、落桌，后续状态更新原卡和筹码反馈。 |
| Rhythm | 工具标记沿各自轨道抵达判定线，触发光效。计分和连击仅描述演出。 |
| Slots | 工具转轮按调用顺序停轮，气压装置响应。 |
| Roulette | 小球入轨，转轮减速落槽并显示工具反馈。 |
| DataFlow | 核心与工具节点之间传送脉冲，等待在节点停留，失败以红色返回。实际父子关系驱动分支。 |

## 数据与验证

运行所需的界面、字体和图形都在本地。桌面端通过 IPC 收取数据，浏览器版只监听 `127.0.0.1`。适配器只读会话文件或数据库，传给画面的是经过筛选的元数据。文件名、域名、工具名和会话标识仍可能涉及项目隐私。[数据来源和读取边界](docs/SOURCES.md)

| 来源 | 当前验证范围 |
| --- | --- |
| Codex | 已在开发机上观察到新增真实工具事件与并发子代理。 |
| Claude Code | 已解析本机真实历史，新增调用、配对和恢复由脱敏样例验证。 |
| OpenCode | 已只读解析本机真实 SQLite 历史，增量状态变化由数据库样例验证。 |

最近一次三场景修订通过 59 项 Node 测试、28 项浏览器检查和 9 项 macOS 源码窗口检查。源码独立重建了 CrommaCode Game View 的机械场景，箱体材质、部分织纹和运动时序仍有差异。当前保留源码运行方式。[三场景验证记录](docs/SCENE-REVIEW-2026-11-18.md) · [视觉验收记录](design-qa.md)

## 项目文档

| 要完成的事情 | 入口 |
| --- | --- |
| 安装、选会话、处理空闲与连接问题 | [使用手册](docs/USAGE.md) |
| 理解只读来源、窗口通信、调度与渲染 | [架构说明](docs/ARCHITECTURE.md) |
| 编写适配器、判断何时可以报告成功 | [事件规范](docs/EVENTS.md) |
| 开发、运行测试、提交本地改动 | [开发与贡献指南](CONTRIBUTING.md) |
| 查找各场景的研究与历次验证 | [文档索引](docs/README.md) |

本项目源码采用 [MIT 许可证](LICENSE)。字体和参考资料的来源及许可分别列在 [第三方声明](THIRD_PARTY_NOTICES.md)。
