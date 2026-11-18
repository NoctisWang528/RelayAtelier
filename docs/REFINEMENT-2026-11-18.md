# 2026-11-18 源码动效优化记录

11 月 18 日晚进一步修改了 DataFlow 配色、Factory 货物和 Loom 铭牌。本文保留较早的验证记录，当前对应效果见[三场景修订报告](SCENE-REVIEW-2026-11-18.md)。

本轮交付的是继续优化后的可运行源码，**没有生成新的桌面安装包**。现存 `release/` 与 `scripts/start.command` 仍是旧 1.1.0；它们不包含本文描述的改动。严格的“几乎一模一样”验收尚未通过，不把测试通过当成视觉一致性证明。

## 启动当前源码

- Mac：双击 `scripts/start-source.command`。
- 终端：在项目根目录执行 `npm start`。
- 本地浏览器备用：`npm run web`，打开它打印的完整链接。只监听 `127.0.0.1`，端口冲突会选择空闲端口。
- Windows 源码入口仍为 `npm ci`、`npm start`；本轮没有 Windows 真机验证或新打包。

保持在原终端/客户端使用 Agent。`Live` 观察真实来源，`Replay` 播放历史，`Demo` 才使用模拟数据。按 `1—8` 切场景，`Space` 暂停，`F` 放大场景并隐藏底部信息区。置顶在 Electron 窗口中可用。

## 实际完成的视觉修正

| 场景 | 本轮结果 |
| --- | --- |
| Westworld | 根据原图重新拟合主转盘和独立大半径线缆盘；重做多层釉面、刻度、灯珠、螺丝与支撑条。保留中断时位置/速度连续的阻尼定位。补足三路上方、三路下方弯管，脉冲与管道共用中心线，完成结果反向返回。补充接触线束、细碎能量射线、黄/蓝玻璃液面，修正法兰、横向刻度、管口、瓶颈、支柱、气罐分段及服务接口。 |
| Factory | 重做圆柱机械臂、偏心端盖、底座、支架、滚轮、机柜和发电机结构。逐帧演出抓取/搬运/释放，追加受事件驱动的排气和末端碎屑。对照竖屏重新校正传送带宽度、角度、位置和投影，解决传送带遮住机械臂底座的问题。 |
| Chips | 铸造桌板轮廓、送牌槽、桃色牌背、牌库、层叠手牌、凹槽和粗体仪表。修正发牌初段裁切和横屏落牌弹性过冲；牌面不再弹到导航下方。 |
| Rhythm | 根据官方视频补上空闲窄轨/活跃宽轨的展开与收拢，16 条透视轨道按实际工具稳定分配；结果更新原音符。补充调用节奏柱、轨道脚座、扇区工具名和抵达光束。计数表示事件演出，不表示任务质量。修正短窗口标签和专注视图的导航遮挡。 |
| Loom | 更精细的机架、108 根经线、16 个线轴标签、综框、梭子及控制器。经线色组与上方线轴对应；没有调用时梭子停在侧罩内，织物仍由调用逐行生成。修正专注视图线轴标签与导航的间距。 |
| 数据流 | 保留已实现的独立节点场景：核心/工具节点、发出与返回拖尾、错误红色、子代理分支。本轮重新运行和截图验证，未把它改成瓷白机械场景。 |
| Slots / Roulette | 保留额外截图对应的两种独立演出，并重新验证实际运行。仍使用工具符号；不是模型品牌展示或真实赌博功能。 |

共同背景按参考图取样修正到 RGB **252/250/246**，点阵改为缓存的高分辨率柔边纹理，避免原来二次缩放后过淡。每次工具调用仍来自共享事件状态，切换场景不生成额外调用。切回 Live 时底部计数即时恢复，避免短暂残留 Demo 数字。

## 原版研究与 REA 的真实结果

- 观察对象：本机 `/Applications/CrommaCode.app`，0.3.22，ARM64 Rust/Mach-O。
- 参考包含用户六张截图、官方 20.77 秒演示、本轮此前获得的本机窗口观察。未把广告、赞助图片或原程序画面作为运行时背景贴图。
- REA `inspect_macho`、`inspect_rust_binary` 成功；导出了结果和模块路径线索。`inspect_binary_layout` 的提供程序只支持 Linux x64；Ghidra 未配置且缺少 Java，Hopper 未安装。
- 识别了 344 个完整内嵌 SVG 的偏移、标签和哈希，**未识别/恢复出可用的完整场景素材、渲染源码或原版运动常数**。不能把模块名或 SVG 数量称为已恢复效果。
- 研究结果位于 `research/rea/inspection.json`、`research/rea/summary.json`、`research/embedded-svg-inventory.json`。
- 本轮后段再次打开原版观察时，电脑已锁屏，CUA 无法取得窗口。没有解锁或绕过限制；后续校正使用已有视频/截图。自己的 Electron 程序仍通过独立自动化验证。
- 原版二进制哈希复核未变，未读取账号凭证、修改原程序或绕过保护。

## 验证结果

| 检查 | 实测结果与证据 |
| --- | --- |
| Node 测试 | **44/44 通过**。事件标准化、配对、去重、并发、只读数据库、恢复、队列、管线几何、转盘中断连续性和固定 Rhythm 工具轨道。`evidence/refinement/unit-tests.tap` |
| 完整浏览器检查 | **28/28 通过，0 页面异常**。单次开始/结束、多 Agent、失败/未知、全部场景、Demo/Live 隔离、Replay、1000 次调用积压、断开恢复、缩放、切换、暂停和减少动态效果。`evidence/refinement/ui/ui-report.json` |
| 空闲检查 | 60 秒空闲不制造调用；720 次绘制，约 12 fps。GC 后堆 6,190,032 → 6,225,444 字节；这是短时实测，不是长期内存上限。包含在上项报告。 |
| Rhythm 新运动专项 | **3 个高度全部通过**：620/800/1100。实际 Chromium Canvas 检查从空闲展开、结果保留原调用、结束后收窄、暂停不推进、减少动态效果直接定位及实际像素变化。`evidence/refinement/rhythm-motion/report.json` |
| Electron/macOS 源码 | **7/7 通过，0 页面异常**。读取三类真实来源、置顶读回、sandbox/contextIsolation、独立窗口渲染、820×650 缩放、最小化停绘和资源快照。`evidence/refinement/desktop-final/desktop-report.json` |
| 画面与录像 | 八场景纵/横屏、空闲/Demo、逐时截图，另有官方视频相同画面尺寸的 Rhythm 对照。截图由实际运行程序产生。录像和解码信息见下文。 |

完整 UI 检查在最终 Rhythm 展开和导航间距修正之前加载了页面；这些后续改动另由专项浏览器检查、最终场景截图和录像覆盖。Electron 检查也在最后的导航间距微调之前完成。这里明确区分检查版本，不把较早报告伪称为最后每一行代码的完整回归。

高密度检查保留 **1021 次逻辑调用**，动画队列限于 **240**，折叠 **1755** 个动画过渡；折叠不改变实际调用总数。最终场景采样的帧率见 `scenes/capture-report.json`，不是最低帧率承诺。机械转盘和数据流的此次样本约 60 fps；复杂转轮场景较低。

## 截图、视频与可重复命令

- 八场景总览：`evidence/refinement/overview.jpg`
- 原版/源码并排：`evidence/refinement/comparison/`
- 重点细节：`comparison/dial-vessel-detail.jpg`、`comparison/factory-left-detail.jpg`、`comparison/rhythm-active-comparison.jpg`
- 全部截图：`evidence/refinement/scenes/`
- 最新 Demo：`evidence/refinement/motion-demo.mp4`，原始 WebM 同目录。
- 视频全程解码检查：`evidence/refinement/video-validation.json`
- 真实来源/桌面截图可能含脱敏后的本机工具标识；对外分享优先使用 `scenes/` 与 Demo 视频。

```sh
npm test
RELAY_VERIFY_DIR=evidence/refinement/ui node scripts/verify-ui.mjs
node scripts/verify-rhythm.mjs
RELAY_VERIFY_DIR=evidence/refinement/desktop-final node scripts/verify-desktop.mjs
RELAY_CAPTURE_DIR=evidence/refinement/scenes node scripts/capture-scenes.mjs
RELAY_RECORD_DIR=evidence/refinement node scripts/record-demo.mjs
RELAY_EVIDENCE_DIR=evidence/refinement python3 scripts/compare-reference.py
```

## 真实 Agent 接入与配置

- **Codex**：本机新事件已真实观察，含本任务工具调用和并发子代理；不是只有样例。
- **Claude**：读取本机真实历史，新增/完成/失败/恢复已用脱敏样例测试；新的真实模型工具流尚未验证。
- **OpenCode**：读取本机真实数据库，样例状态更新通过；新的真实模型工具流尚未验证。
- 之前按授权安装的官方 `~/.config/opencode/plugins/bees-hive.js` 仍在。指定 DeepSeek 路由组的一次任务约三分钟无输出后已取消，没有成功推理或原版动态观察的结论。本轮没有再次启动付费模型任务。
- 本轮未再改动任何 Agent 配置/Hook；四个原配置/插件与备份哈希一致。此前安装的官方 Hook 哈希也未变。证据：`evidence/refinement/config-integrity.json`。
- 撤销该额外 Hook：`node scripts/disable-cromma-hook.mjs`，按已记录哈希核对后可逆移走新增文件，不覆盖原配置。配置备份位于 `.runtime/hook-backup/`，不应分享或打包。
- 旧 Mac/Windows 包哈希未变：`evidence/refinement/releases-unchanged.json`。总保护核验：`evidence/refinement/preservation.json`。

## 尚未完成与下一步

1. **严格视觉一致性仍未通过。** 原版微观几何、折射/投影、粒子密度、转盘/机械臂/卡牌时序尚未逐帧拟合；独立重建的部分机构仍能看出差别。详见根目录 `design-qa.md`，不提供虚构的相似度百分比。
2. 原版广告和模型标识被本地工具状态替代；底部观察器控制也与原产品不同。用户授权的更大横屏空间采用重新布局，不能用横屏布局不同来宣称全画面相同。
3. 后续应先完成原版相同事件序列的运动对照和几何细化，再决定是否允许新的桌面打包；**当前没有重新打包**。
4. Claude/OpenCode 新的真实调用、Windows 真机、Mac Intel、签名/公证及长时运行仍未验证。本轮 60 秒空闲不能替代长期压力测试。后端部分配对/去重元数据随进程生命周期增长，边界见 `docs/SOURCES.md`。

当前工具没有提供 Codex 剩余额度百分比，不能确认是否达到 10%，也没有据此编造额度读数。源码、截图、测试、研究限制和后续差异都已持久保存；没有安排后台模型重试、自动发布或无限循环工作。
