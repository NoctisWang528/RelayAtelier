# 本地构建与公开版本

Relay Atelier 保留两套编号。下载和升级时看 GitHub Release 的版本号；复现问题时同时记录应用版本、平台和源码提交。

| 用途 | 规则 | 首发示例 |
| --- | --- | --- |
| 本地构建 | 应用版本取自 `package.json` 的 `version`。用「应用版本 + Git 提交」定位一次构建。 | `1.1.1`，提交 `58cdcbf` |
| 公开发行 | 从 `v1.0.0` 起独立维护 `v主版本.次版本.修订号`，用于 Git 标签、GitHub Release 标题和公开压缩包文件名。 | `v1.0.0` |

## 怎样递增

- 本地打包验证时可独立递增应用版本，至少增加修订号，并同步更新锁文件中的项目版本。在同一应用版本内开发的不同提交用 Git SHA 区分。带未提交改动的试验构建标为 `dirty`，公开发行从干净的已提交源码取包。
- 公开版有破坏兼容性的变更（例如移除已支持的 Hook 配置格式）时增加主版本。增加兼容的新功能（例如支持一个新的 Agent）时增加次版本。只修复现有行为时增加修订号。增加较高位时，其后的各位归零。
- 例如，自首发以来只修复绘制问题，下一个公开版本为 `v1.0.1`。期间可以验证多个本地构建。已公开的编号、标签和二进制保持对应；需替换下载包时发布新版本。

## 发布与核对

1. 打正式发行包前，将 `package.json` 的 `publicReleaseVersion` 设为本次公开标签的版本号（省略 v）。桌面更新检查用它与 GitHub 正式发行标签比较。本地试用包沿用上次公开发行的基准，确保正式版发布时能收到提醒。记录通过验证的应用版本、完整提交 SHA、平台和架构。将公开标签打在生成该包的提交上。可以在后续文档提交中补充发布记录。
2. 将验收过的 ZIP 按公开编号命名，例如 `RelayAtelier-v1.0.0-Windows-x64.zip`。仅重命名时，逐个核对 ZIP 的 SHA-256 与本地验收记录一致，然后用公开文件名生成 `SHA256SUMS.txt`。
3. 在中英双语 Release Notes 中写明可见改动、支持的平台、实际验证环境、签名状态，以及公开版本、本地构建与源码提交的对应关系。
4. 在双语说明中列出各平台压缩包的 SHA-256。在 GitHub 核对标签指向及附件上传状态，将附件大小、摘要与本地记录逐项核对后发布。

## 已发布版本

| 公开版本 | 本地构建 | 源码提交 | 发布说明 |
| --- | --- | --- | --- |
| [v1.0.1](https://github.com/NoctisWang528/RelayAtelier/releases/tag/v1.0.1) | 1.1.2 | [da8807c](https://github.com/NoctisWang528/RelayAtelier/commit/da8807c126d1c95ed03db8c16a526465dfa7ae8e) | [中文 / English](releases/v1.0.1.md) |
| [v1.0.0](https://github.com/NoctisWang528/RelayAtelier/releases/tag/v1.0.0) | 1.1.1 | [58cdcbf](https://github.com/NoctisWang528/RelayAtelier/commit/58cdcbf15eda16cdd224a28e6947b855f0533fcb) | [中文 / English](releases/v1.0.0.md) |
