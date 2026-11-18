# Relay Atelier 回放样例

[三场景录像](three-scenes.mp4)以 Factory、Loom、DataFlow 的顺序展示同一份生成的历史。视频为 1440 × 940 的 H.264 MP4，时长 50.48 秒。[画面预览](replay-preview.jpg)

每个场景回放 48 次调用、96 个过渡和 4 个 Agent。样例最终包含 41 次完成、4 次失败、3 次未知，文件名和目标均为测试数据。这使得可以观察同一项工作如何呈现为一只箱、一行织物或一束返回信号。

在项目根目录运行 `node scripts/record-scene-review.mjs` 可重新生成一轮 WebM 录像和对照截图。实际捕获时长及帧序列随设备和窗口调度而变化。依赖安装与输出位置见[开发指南](../CONTRIBUTING.md)。
