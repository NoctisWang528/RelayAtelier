# Agent Hook 安装、恢复与扩展

在桌面窗口右下角点击 **本地来源** 的信息按钮或连接状态，找到 **Agent Hooks**。每行显示宿主、配置状态和将要修改的文件。点击「安装」登记该 Agent 的回调。若宿主提示审核、信任或重新加载，按宿主提示操作。选「移除」可以撤销该项登记。浏览器版在同一位置提示桌面管理入口。

## 哪些文件会改变

| Agent | 用户级目标 | 回调和生效条件 |
| --- | --- | --- |
| Codex | 默认 `~/.codex/hooks.json`，支持 `CODEX_HOME` | 追加 `PreToolUse`、`PostToolUse` 和 `Stop`。在支持 Hooks 的客户端里通过 `/hooks` 或设置审核。配置写入后是否允许运行由 Codex 决定。[官方 Hook 说明](https://developers.openai.com/codex/hooks/) |
| Claude Code | 默认 `~/.claude/settings.json`，支持 `CLAUDE_CONFIG_DIR` | 追加上述三种事件及 `PostToolUseFailure`。现有 matcher、其他回调及权限字段保留。执行受客户端设置及组织策略约束。[官方 Hook 说明](https://code.claude.com/docs/en/hooks) |
| OpenCode | 默认 `~/.config/opencode/plugins/relay-atelier-pulse.js`，支持 `OPENCODE_CONFIG_DIR` 或 `XDG_CONFIG_HOME` | 安装独立本地插件。插件注册工具执行前后的回调，可与其他插件共存。安装或移除后可重新加载 OpenCode。[插件发现](https://opencode.ai/docs/plugins/) · [插件接口](https://opencode.ai/docs/build/plugins) |

状态为「已安装」表示 Relay 确认自己登记的配置和信号文件就位。它不能证明宿主已信任回调、已有模型任务或正在产生新事件。可以在原客户端正常工作后，通过 Live 查看最近真实事件。缺少会话日志或数据库时，面板仍会报告来源缺失。

## 本地信号和备份

- 第一次安装会准备空文件 `~/.relay-atelier/hooks/pulse`。回调只更新该文件的修改时间。多个 Agent 共用一个信号文件，接连触发时可合并为一次刷新。
- 观察器收到提醒后提前重读已支持的日志和数据库。事件仍由来源适配器标准化并按原 ID 去重。回调与记录落盘可能有先后，下一次普通轮询会继续读取。纯粹改变信号文件不能凭空产生一次调用。
- 已有 JSON 配置在实际改写前按原内容备份到 `~/.relay-atelier/hook-manager/<agent>-<随机标识>.bak`。该目录还保存按目标路径区分的安装记录。备份可能包含其他 Agent 设置或凭证，应保存在本机。常规查看状态只读取文件。
- 安装和移除只操作选定的宿主。重复安装已有完整登记无需重复追加，卸载时用安装记录辨认所拥有的项。若用户后来又加过其他 Hook，这些项继续保留。以前研究用的 CrommaCode 插件有单独的[安装与恢复记录](HOOK-RESEARCH.md)。
- 卸载后保留备份与共用信号文件，便于还原及供其他 Agent 继续使用。所有 Relay Hook 均移除后，如需清理，可自行删除该空文件及确认不再需要的备份。

## 修复与恢复

| 面板状态 | 可执行的操作 |
| --- | --- |
| 未安装 | 查看目标后选择安装。宿主尚未安装时，也可能尚无该目标配置。 |
| 已安装 | 在宿主完成审核或重载；要退出接入时点击移除。默认轮询继续工作。 |
| 安装不完整 | 若部分登记或空信号文件缺失，可以修复；也可以移除仍属 Relay 的项。 |
| 配置冲突 | 检查目标是否已有同名文件、Relay 登记是否被手工修改、JSON 或目录是否有效。解决后重新打开面板检查。 |
| 不可用 | 检查所示路径、当前用户权限和可用空间，再次打开面板。 |

需要手工恢复时，先关闭正在写入设置的宿主，比较相应的 `.bak` 和当前配置。若期间有其他修改，只恢复对应部分。只有希望将**整个配置**恢复到备份时刻，才使用备份整体替换。改完后重新打开宿主与 Relay 面板核对状态。

## 接入另一种 Agent

1. 确认该宿主的用户级配置位置、原生回调、重新加载及信任机制。若有新的会话格式，先按[事件规范](EVENTS.md)实现可独立工作的只读适配器。
2. 在 [providers.mjs](../server/hooks/providers.mjs) 为新宿主分配稳定的 `id`，声明 `label`、配置根目录、目标文件、启用提示和 `inspect`。兼容现有 JSON 分组的宿主可复用 `jsonProvider`。自定义格式要返回当前状态、拥有的结构以及安装和移除后的内容。配置适配器可以调用公共备份机制。
3. [管理器](../server/hooks.mjs)负责枚举 provider、记录所有权和执行文件更新。界面从 `list()` 的结果产生控件。渲染端仅向桌面主进程传递 provider ID。浏览器服务只提供读取接口。
4. 给新 provider 添加空配置、共存配置、重复安装、修复、卸载、用户改写及失败恢复测试。用独立目录运行宿主验证注册。最后检查一对开始和结束只形成一次逻辑调用，并记录验证使用的客户端版本。

## 本地复现

`npm test` 运行包含 Hook 文件操作、命令和来源唤醒在内的回归。安装开发用 Chromium 和 Electron 后，`node scripts/verify-hooks.mjs` 会在隔离目录中操作真实桌面窗口并检查 Web 只读边界。使用本机 OpenCode 的可选宿主测试时，给测试进程设置 `RELAY_TEST_OPENCODE_BIN` 为其可执行文件绝对路径。详细环境准备见[开发指南](../CONTRIBUTING.md)。
