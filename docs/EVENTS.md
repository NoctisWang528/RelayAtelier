# 事件规范

本规范描述适配器写入 Hub 的对象，以及渲染端如何解释它。实现位于 [adapters.mjs](../server/adapters.mjs) 和 [state.mjs](../src/state.mjs)。新来源只需产出同一形状的事件即可接入演出层。

## 字段

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `id` | string | 标识一次状态过渡，供传输重试和重复读取时去重。 |
| `callId` | string | 同一次工具调用的关联标识，从开始到后续状态保持稳定。 |
| `source` | string | 真实来源为 `codex`、`claude`、`opencode`，内置样例用 `demo`。Replay 保留原来源。 |
| `sessionId` | string | 规范化的会话标识，用于筛选及区分不同作用域内的调用。 |
| `agentId`、`parentAgentId` | string、string 或 null | 执行者和已知父代理；没有可靠父关系时用 null。 |
| `timestamp` | ISO 时间字符串 | UTC 事件时间。适配器无法解析时间时使用 Unix epoch；不能从该值推断实际开始时刻。 |
| `tool` | string | 来源中的工具名，无法安全提取时为 `unknown`。 |
| `toolType` | 枚举 | `files`、`shell`、`search`、`web`、`agents`、`other`。DataFlow 节点和工具色使用这一分类。 |
| `status` | 枚举 | `started`、`waiting`、`completed`、`failed`、`unknown`。 |
| `target` | string 或 null | 经过筛选的文件末级名称、命令程序名或 HTTP(S) 主机名。缺少合适的值时用 null。 |

以下是合成示例。示例标识为了便于阅读而缩短，生产适配器会生成自己的标识。

```json
{
  "id": "example-read-1:started",
  "callId": "example-read-1",
  "source": "claude",
  "sessionId": "claude:example",
  "agentId": "claude:example",
  "parentAgentId": null,
  "timestamp": "2026-11-18T10:00:00.000Z",
  "tool": "Read",
  "toolType": "files",
  "status": "started",
  "target": "renderer.mjs"
}
```

若同一次调用明确失败，后续对象保留 `source`、`sessionId` 和 `callId`，更新 `id`、`timestamp`、`status`。两条过渡对应一次调用和一次失败。原始参数、提示词、文件内容、完整命令和结果正文不属于事件字段。

## 状态解释

| 状态 | 证据与显示 |
| --- | --- |
| `started` | 日志记录调用开始或工具运行。OpenCode 的 `running` 映射到该状态。 |
| `waiting` | 仍有待决工作，如 OpenCode 的 `pending` 或 Codex 返回仍在运行的进程句柄。计入活动调用。 |
| `completed` | 存在明确完成信息，如已知退出码 0，或受支持的显式成功结果。 |
| `failed` | 存在明确错误信息，如非零退出码或 Claude 工具结果标记 `is_error: true`。 |
| `unknown` | 结果记录缺少足够证据，或可识别的任务结束时调用仍未报告结局。界面还会对超过五分钟的活动调用生成带 `inferred` 标记的未知视图。 |

来源可能先报告等待，再报告运行，也可能只保留结束记录。适配器及状态层需要允许缺少开始的调用，避免迟到的开始重新激活已结束的调用。父子关系可能晚于工具记录抵达，Hub 可据此补充快照中的父标识。

## 三种计数

1. **状态过渡**以事件 ID 去重。同一份快照重读后，已处理的过渡不会重新记账。
2. **逻辑调用**按来源、会话、调用标识归并，前端状态表存储最新状态。工具名相同或目标文件相同都不足以配对。
3. **可见演出**由队列调度。队列使用的 `visualCount` 标记合并的演出数量，视图推断的 `inferred` 表示推断结果。两者均不要求上游 Agent 提供。

例如 Codex 发起命令并取得待决句柄，之后主动轮询该句柄。轮询可以更新原命令的状态；如果来源还记录了这次轮询工具调用，轮询有自己的调用标识。对应回归样例见 [适配器测试](../tests/adapters.test.mjs)。

## 添加新来源时的最小验证

构造脱敏记录，覆盖单次开始与结束、缺失结果、重复读取、相同外部调用 ID 出现在不同会话、子代理父关系以及断开恢复。以空的显式来源配置启动测试服务，避免误读测试机的真实会话。报告中分别标明格式样例、已解析真实历史、已观察新增真实调用。各来源目前支持的日志形状和读取限制见[来源说明](SOURCES.md)。
