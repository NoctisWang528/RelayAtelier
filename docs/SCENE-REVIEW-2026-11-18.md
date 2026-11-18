# DataFlow、Factory 与 Loom 的源码修订

> 本机附件的路径相对于本文，原始图片和运行报告保存在开发机。随 Git 仓库提供的影像见[三场景回放](../examples/three-scenes.mp4)。

本报告记录 11 月 18 日晚的三场景修订。Mac 上双击 `scripts/start-source.command`，或从项目目录执行 `npm start`。两个入口都直接运行当前源码。此前的 1.1.0 安装包属于早先版本。

[播放三场景实录](../examples/three-scenes.mp4) · 查看局部对照（`../evidence/scene-review/detail-comparison.jpg`） · 查看桌面截图（`../evidence/scene-review/desktop/desktop-loom.png`）

录像长 50.48 秒，画幅 1440 × 940。Factory、Loom、DataFlow 按顺序回放相同的样例，MP4 的 1262 帧已全部解码检查。录像检查结果（`../evidence/scene-review/replay/video-check.json`）

## 对照来源

实际打开了本机安装的 CrommaCode 0.3.22，切到 Loom 和 Factory。观察时原版没有接收工具调用。Loom 的 16 块铭牌留白，各有一条颜色标线。Factory 的侧向滚道和斜向主带在机械臂下方交接。

活动状态取自官方 1120 × 974 演示。4.2–5.4 秒、10–11.4 秒和 20 秒附近的 Loom 画面能看清词尾、选中边框和左侧全名。Factory 在约 3、13、18 秒的片段能看清夹头、小件、箱体上的封带、主带上的单列队伍。原片和按时刻截取的画面只供本地对照。[官方演示](https://github.com/CrommaAI/crommacode/blob/main/assets/game-view-demo.mp4)

## DataFlow

导航、底栏和画布辅助名称统一显示 DataFlow。节点与核心共用其他场景的点阵纸、搪瓷、金属边线和工具色。六条总线的玻璃管和收发光点使用同一条中心线。等待在节点处亮琥珀色，失败以红色返回，未知用琥珀色返回。显示子代理的前提是事件提供了父代理关系。两种外观共用底栏样式。

机座、固定管线和芯片盖按实际绘制分辨率缓存。调整窗口后重新绘制零件。相同横屏 Chromium Demo 的随后三段短采样均约 60 fps。浏览器以 620、800、1100 三个逻辑高度采样了五种状态的实际信号像素，并检查了分支、消退、名称和主题。结果保存在 `evidence/scene-review/dataflow/report.json`。

## Factory

旧画面中，货物和传送带各自推进，货箱的朝向和贴签也没有跟随斜向带面。现在侧向滚道一次只把一箱送到取料位。两片夹爪在箱体两侧闭合，抬起、转移并松开。箱子放上主带后与带板共用位移，近侧护栏遮在箱体前。原片约 3 秒处的小箱和高箱有明显大小差异，因此这里按工具类别选择尺寸，并绘制顺着箱盖延伸的封带和下游端面的纸签。原片能支持这段运动和外观，工具类别与具体尺寸的对应关系是本实现的选择。

在 620 逻辑高度下采样取料、转移和放料，肘部最高点与顶部导航有约 17.5 单位间距。晚到结果更新同一箱的状态，超过可见容量后保留调用标识，避免重复发货。取料连续帧（`../evidence/scene-review/factory-study/early-grip.jpg`） · 货箱细节对照（`../evidence/scene-review/factory-study/factory-cargo-study.jpg`）

## Loom

官方活动帧里能辨认 15 个位置的完整工具名。短名如 `GIT` 和 `LSP` 直接排印，长名如 `WEBFETCH` 和 `READ` 在铭牌上显示为 `…CH` 和 `…AD`。当前织梭对应的铭牌加深边框，左侧仪表显示全名。鼠标停在有字的铭牌上，可以读取该位置所有工具的完整名称。第七个位置在片中只看清 `…NT`，本实现用它优先容纳片中未识别的工具，如 Shell。

Live 打开已有会话时，从最近实际出现的工具填入最多 16 块铭牌。此时队列和织物都从零开始。空来源保留 16 条色标。Replay 从第一条回放事件开始着色。工具、铭牌、经线分组和织物行使用同一位置，状态回报更新原针脚。按工具改变长浮线、短横和交织的间隔，等待与未知会在对应区域露出底部经线。常规一次织梭约 0.30 秒，参考了片中约 0.17–0.37 秒的选中间隔。逐帧铭牌（`../evidence/scene-review/loom-study/plaque-strips.png`） · 织纹放大对照（`../evidence/scene-review/loom-study/cloth-comparison.png`）

## 运行结果

| 检查 | 本机结果 |
| --- | --- |
| Node 与场景回归 | 59 项通过，其中 Factory 7 项、Loom 8 项。含同调用配对、跨会话重名、可见队列淘汰后晚到的结果、夹爪与纸箱接触以及铭牌位置。 |
| 完整 Chromium 程序 | 28 项通过。1000 次突发调用后保留 1021 次逻辑调用，待演动画上限 240。60 秒空闲绘制 720 帧，调用数稳定。覆盖八个场景、等待、失败、重连、缩放与减少动态效果。 |
| macOS 源码桌面窗口 | 9 项通过。读取三个本地来源，实际切换置顶、缩放、最小化，并检查 Factory、Loom 的 Demo 窗口随事件改变。 |
| Loom 缓存修正 | 机架和铭牌底座按窗口分辨率缓存，当前工具名称、经纬线、织物和织梭继续逐帧绘制。相同桌面脚本的两次活动帧率采样约为 22 和 57 fps。101 行样例中的晚到失败只改变原针脚附近 46 个像素；减少动态效果与自然停稳后的画面相同。 |
| DataFlow | 在横屏窗口对两种主题做了逐项比较。Factory 与 DataFlow 的纸底测试区平均 RGB 均为 (251, 249, 244)。三个高度、五种状态共 15 组信号像素检查通过。 |
| 三场景受控回放 | 每个场景同一份 48 次调用、96 次状态过渡。来源样例含四个 Agent，最终 41 次完成、4 次失败、3 次未知。每个场景均演出全部 96 次过渡。 |

单元测试（`../evidence/scene-review/unit-tests.tap`） · 完整浏览器结果（`../evidence/scene-review/ui/ui-report.json`） · 桌面结果（`../evidence/scene-review/desktop/desktop-report.json`） · Loom 专项结果（`../evidence/scene-review/loom-study/browser-results.json`） · DataFlow 像素结果（`../evidence/scene-review/dataflow/report.json`）

## 对齐程度与真实来源

Factory 和 Loom 的并排图使用相同的 1120 × 974 场景区域。左边是原片活动帧，右边是独立程序的可重复回放。两侧事件序列不同。箱体表面材质、工件密度、原始机械运动曲线及部分织纹仍有可见差异。DataFlow 是本程序新增的场景，对照图比较其修改前后的配色。严格画面验收仍开放，本轮交付源码。

macOS 实测加载了 Codex、Claude 和 OpenCode 的本机来源。此前已验证 Codex 的新增真实工具事件。Claude 与 OpenCode 已读到真实历史，增量更新通过格式样例测试，这一轮均未取得新的真实工具调用。Windows 源码入口沿用同一项目，运行时仍待 Windows 真机验证。

## 验证入口

- `npm test` 运行单元测试和本地来源测试。
- `node scripts/verify-dataflow.mjs` 检查主题和节点信号方向。
- `node scripts/record-scene-review.mjs` 从同一份 48 次调用的本地合成历史回放三个场景，保存横屏录像、活动截图与接近官方画幅的截图。
- `RELAY_VERIFY_DIR=evidence/scene-review/ui node scripts/verify-ui.mjs` 运行完整浏览器回归。
- `RELAY_VERIFY_DIR=evidence/scene-review/desktop node scripts/verify-desktop.mjs` 检查 macOS 源码窗口。

录像中的任务、文件名和调用结果均为可重复的样例。本轮不需要发起模型任务。既有 Codex、Claude、OpenCode 和 CrommaCode 配置沿用之前的设置。早先单独安装的 OpenCode 插件仍可用 `node scripts/disable-cromma-hook.mjs` 按哈希校验后移出插件目录。旧包比对见 `evidence/scene-review/release-check.json`。
