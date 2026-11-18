# Relay Atelier 文档索引

## 使用和开发

| 文档 | 适合查找的内容 |
| --- | --- |
| [项目首页](../README.md) | 当前源码入口、场景清单、平台状态和可播放的样例 |
| [使用手册](USAGE.md) | 三种来源模式、键位、置顶、会话位置和故障排查 |
| [运行架构](ARCHITECTURE.md) | 数据流、IPC 与 SSE、状态和演出队列、容量及时间 |
| [事件规范](EVENTS.md) | 字段、示例、状态解释、重复事件与调用配对 |
| [来源适配说明](SOURCES.md) | 本机核验过的来源格式、文件读取策略、数据库投影和已知边界 |
| [开发与贡献指南](../CONTRIBUTING.md) | 安装测试浏览器、选择验证命令、修改场景和本地 Git 工作方式 |

## 验证与版本

[三场景修订报告](SCENE-REVIEW-2026-11-18.md)记录最近一轮 Factory、Loom 和 DataFlow 的对照。仓库包含[合成回放录像](../examples/three-scenes.mp4)。完整的研究原帧、桌面实测截图和报告只保存在开发机的 `research/`、`evidence/`、`output/`。历史记录中标明“本机附件”的文件名，以相应报告所在目录为起点定位。

| 记录 | 覆盖范围 |
| --- | --- |
| [视觉验收](../design-qa.md) | 当前复刻目标、可见差异和未通过的严格视觉门槛 |
| [八场景源码修订](REFINEMENT-2026-11-18.md) | 早于三场景修订的画面、动效、原版观察和源码验证 |
| [旧包验证](VERIFICATION.md) | 1.1.0 包在当时的验证范围，用于比较源码与旧包 |
| [进度记录](PROGRESS.md) | 依次列出源码和打包检查点 |

## 场景研究与来源

| 文档 | 内容 |
| --- | --- |
| [场景结构总览](SCENES.md) | 初次瓷白视觉重建的构图、机械件和事件映射 |
| [Factory](FACTORY-REFINEMENT.md) | 货箱、侧向滚道、夹爪、主带和横屏间隙 |
| [Loom 与 Rhythm](LOOM-RHYTHM-REFINEMENT.md) | 铭牌和织纹识别、梭程、节奏轨道展开与回落 |
| [Chips](CHIPS-REFINEMENT.md) | 发牌、卡背、桌面比例和弹性运动 |
| [Slots 与 Roulette](CASINO-SCENES.md) | 两种附加机械场景的实现记录 |
| [视觉参考](REFERENCES.md) | 公开参考来源、独立实现范围和近似之处 |
| [原版 Hook 研究](HOOK-RESEARCH.md) | 在开发机观察原版的一次独立实验、安装结果与恢复方法 |
