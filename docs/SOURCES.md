# Read-only local agent sources

Initially verified on 2026-11-17 and reviewed again on 2026-11-18 against local session files and the existing OpenCode database. Evidence below contains structural counts and version metadata only. The adapters do not run agents, call model APIs, install hooks, or change agent configuration. Backend probes do not open credential/config/auth files. Prompts, raw arguments, tool output, user-assigned titles, and full target paths are never returned to the renderer or printed by the probes.

## Agent session locations

同一套读取器用于 Windows 和 macOS。表中的 `~` 对应操作系统的用户主目录，`<应用数据>` 在 macOS 为 `~/Library/Application Support`，在 Windows 为 `%APPDATA%`。`<数据>` 为 `$XDG_DATA_HOME` 或 `~/.local/share`。会话均以只读方式打开。

| Agent | 默认位置 | 文件与事件 |
| --- | --- | --- |
| Codex | `~/.codex/sessions` | rollout JSONL |
| Claude Code | `~/.claude/projects` | 工具与子代理 JSONL |
| OpenCode | `<数据>/opencode/opencode.db` | SQLite 工具部件 |
| Gemini CLI | `~/.gemini/tmp` | `session-*.json` 和 `session-*.jsonl` 中的 toolCalls |
| GitHub Copilot CLI | `~/.copilot/session-state` | `events.jsonl` 中的工具开始与结果 |
| Qwen Code | `~/.qwen/projects` | 聊天 JSONL 中的 functionCall / functionResponse |
| Kimi CLI / Code | `~/.kimi/sessions`、`~/.kimi-code/sessions`、`<应用数据>/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/sessions` | `wire.jsonl` 中的 ToolCall / ToolResult |
| Pi | `~/.pi/agent/sessions` | Pi 消息 JSONL |
| Oh My Pi | `~/.omp/agent/sessions` | Pi 消息 JSONL |
| OmO Native / SenPi | `~/.senpi/agent/sessions`、`~/.omo/agent/sessions`、`~/.omo/senpi-task/children` | Pi 消息 JSONL，项目中的子会话目录也可手动添加 |
| OpenClaw | `~/.openclaw/agents` | 会话内的 toolCall / toolResult |
| Factory Droid | `~/.factory/sessions` | 会话头与包含工具块的 message 记录 |
| CodeBuddy Code | `~/.codebuddy/projects` | CLI 会话 JSONL |
| WorkBuddy | `~/.workbuddy/projects`、`~/.workbuddy-ai/projects` | function_call / function_call_result |
| DeepSeek Harness | `~/.dsh/sessions` | 普通或多帧 Zstandard 压缩的 `session.jsonl` |
| Cline | `<应用数据>/Code/User/globalStorage/saoudrizwan.claude-dev/tasks`、`~/.cline/data/{tasks,sessions}` | `api_conversation_history.json` 和 `*.messages.json` 中的原生工具块 |
| Kilo Code | `<应用数据>/Code/User/globalStorage/kilocode.kilo-code/tasks`、`<数据>/kilo/kilo.db` | 扩展的 API 历史 JSON 和 CLI 的 SQLite 工具部件 |
| MiMo Code / Desktop | `<数据>/mimocode/mimocode.db`，macOS 也查找 `<应用数据>/orca/mimocode-hooks/shared/data/mimocode.db` | 两个客户端共用的 SQLite 工具部件 |
| Reasonix | Windows 的 `<应用数据>/reasonix`、macOS 的 `~/.reasonix` 下的 `sessions` 与 `projects/*/sessions` | 带 tool_calls / tool_call_id 的原始消息及 v1 append / replace 消息记录 |
| Cherry Studio Agents | `<应用数据>/CherryStudio/Data/Agents/.claude/projects`、`<应用数据>/CherryStudio/.claude/projects` | 内置 Agent 的 Claude SDK 会话 |
| Proma | `~/.proma/sdk-config/{projects,sessions}` 和 `~/.proma-dev/sdk-config/{projects,sessions}` | Claude SDK 和 Pi 原生会话 |

应用面板显示本机解析后的默认位置。新增目录与默认目录合并，同一来源的重叠目录按文件去重。数据库来源可添加包含对应数据库的文件夹。关闭某个 Agent 会停止读取并释放文件缓冲及数据库连接，此前读到的历史在本次运行中仍可回放。

JSON 快照和压缩会话按文件变化重读，单个快照及解压内容上限为 16 MiB。Cline、Kilo 扩展或 Reasonix 消息未带时间时使用快照更新时间或文件修改时间，精度为一次保存。结果仅含正文、缺少明确成功或失败标志时，状态为未知。路径线索来自 token-monitor 的来源目录表。测试使用各格式的会话样例，另在 macOS 对 WorkBuddy、DeepSeek Harness、MiMo 和 Reasonix 做了真实历史读取。

## Interface and integration

`server/hub.mjs` exports `SourceHub extends EventEmitter`:

```js
const hub = new SourceHub({ roots, pollMs: 1200 });
hub.on('event', event => { /* animate a fresh transition */ });
hub.on('status', metadata => { /* refresh sources/sessions */ });
await hub.start();
const { events, sources, sessions, revision } = hub.snapshot();
hub.stop();
```

- `start()` is asynchronous and idempotent. `stop()` clears polling and closes SQLite; an in-flight file read may finish without emitting further events. Starting again seeds any backlog silently.
- With no `roots` argument the hub discovers the catalogued locations above. An explicit `roots` object enables **only** the named sources: `{codex: fixtureDir, claude: fixtureDir, opencode: fixtureDbOrDirectory}`. Omitted/null roots stay `missing`; tests cannot accidentally fall back to real user sources.
- `snapshot()` returns detached copies of `{events, sources, sessions, revision}`. `events` contains at most 4,000 recent transitions, sorted by ISO timestamp with stable observation order for ties. Reconstructed starts precede their finishes; equal-time pending→running and started→waiting transitions retain their actual observation order. It is replay history, not a Live stream.
- Source descriptors are `{source,status,files,lastEventAt,detail}`. Status is `connected`, `missing`, or `error`; `files` counts selected JSONL files or one database. Details disclose skipped history, malformed records, and unsupported SQLite/runtime errors without including paths or exception text.
- Session descriptors are `{id,source,agentId,parentAgentId,label,lastEventAt}`. **`session.id` exactly matches `event.sessionId`.** Session/agent identities are source-prefixed: `codex:<thread>`, `opencode:<session>`, and `claude:<session>[:<child-agent>]`. Labels are generic source names plus short hashes, not session titles. Null parent means no parent was established.
- Selecting a session filters that exact agent session, not its descendants. The regression fixture has one parent call and two children with two and three calls: expected selected counts are **1 / 2 / 3**, while All sessions shows **6** calls (12 paired transitions). Parent links remain available independently. A selected count below the global total is intentional.
- Each event has exactly `{id,callId,sessionId,agentId,parentAgentId,timestamp,source,tool,toolType,status,target}`. `timestamp` is ISO UTC; an absent/invalid timestamp becomes the Unix epoch and cannot be mistaken for a fresh event. Call IDs hash source/session/agent/raw-call identity; transition IDs add status. Re-reading the same record yields the same IDs, independently of its filename or byte offset.
- `event` emits only newly observed transitions from an already-connected source whose recorded timestamp is at/after this hub start. Initial reads, reconnect backlog, and copied older files seed history silently. A first connection to a previously missing/error source also seeds silently.
- `status` includes `{sources,sessions,revision,eventCount,sessionCount}`. Startup, polls that seed non-Live history, and late parent corrections additionally include `events`. Consumers should reconcile these events without scheduling animation, including updating parent metadata for already-seen IDs. An immediate snapshot before `start()` finishes can be empty, so the initial `status.events` or a snapshot after `await start()` is important. Reconnection snapshots are also history; only the fresh `event` channel establishes Live delivery.
- A completed Codex item may reveal both historical start and completion at once. Both timestamps are retained; the source does not provide a guaranteed real-time start notification for these items.

## Actual source evidence

These counts were captured during structural inspection; active Codex logs continued growing afterward. They are distinct from the bounded 4,000-transition runtime snapshot.

| Source | Inspected storage | Structural evidence |
| --- | --- | --- |
| Codex | 45 JSONL files; 9,177 parsed records; 181,064,866 bytes in the initial inventory | 45 session metadata records; 27 explicit parent thread IDs; 975 custom calls / 974 custom results; 66 function calls / 78 function results; 2,882 `item_completed` records |
| Claude | 42 JSONL files; 9,422 parsed records; 28,459,004 bytes | 2,184 `tool_use` blocks / 2,183 `tool_result` blocks; 11 child-agent files; 340 records with agent IDs/sidechain flags; 26 tool-result objects with returned child agent IDs |
| OpenCode | One existing SQLite database | Legacy: 48 sessions, 1,700 messages, 7,399 parts, including 1,799 tool parts. V2: 49 sessions, 1,759 session-message rows, including the same 1,799 tool IDs in assistant content. Both representations had 1,754 `completed` and 45 `error` tool states. There were 14 child sessions. |

Exact version values observed in session metadata:

- Codex: `0.169.0-alpha.11.1` (38 metadata records), `0.167.0-alpha.4.1` (5), `0.166.0-alpha.6` (1), `0.166.0-alpha.5.1` (1). The installed CLI version recorded by the project investigation is `0.169.0-alpha.11.1`.
- Claude: `2.1.160`, `2.1.161`, `2.1.165`, `2.1.170`, `2.1.187`, `2.1.202`, `2.1.209`, `2.1.215`, `2.1.217`, `2.1.229`, `2.1.260`. These are transcript metadata versions; no Claude executable was found on the inspected PATH, and no CLI was launched to infer a current version.
- OpenCode: V2 session metadata included exact version `2.0.32`; migrated sessions contained `1.17.4`, `1.18.15`, `1.18.16`, `1.18.18`, and literal `local`. The last value does not identify a release. The newer `session_part` table existed but contained zero rows, so its future record layout is not claimed as supported.

## Schema mapping and outcome honesty

### Codex

- `session_meta.payload.id` establishes the thread. `parent_thread_id`, including `source.subagent.thread_spawn.parent_thread_id`, establishes observed parentage. User-facing nicknames and instructions are ignored.
- `response_item` function/custom calls and outputs pair by `call_id`. Function arguments/custom input are inspected in memory only to derive a permitted target/category. There is no assumption that a result exists for every start, or vice versa.
- `event_msg.item_completed` provides `started_at_ms`, `completed_at_ms`, and a typed item. Observed mappings cover `CommandExecution`, `McpToolCall`, `FileChange`, `ImageView`, and `CollabAgentToolCall`. `CommandExecution` supplied explicit exit codes, including nonzero failures. MCP `isError` and structured exit codes override a superficially completed transport/item status.
- Where a response call and item share the same ID, they deduplicate. The hub shares pairing/dedupe state by canonical agent identity across files, so a later file can finish an already-observed call without losing its tool/target/parent metadata. Distinct source-emitted inner tool items retain their own actual IDs; no inner call is fabricated from JavaScript text.
- A `functions.exec`/`exec` wrapper containing exactly one recognizable `tools.exec_command`, `tools.apply_patch`, `tools.web__run`, or `tools.spawn_agent` invocation gets the corresponding category. It remains **one wrapper call**. Comments, string literals, multiple tool calls, unknown methods, and ambiguous slash/regex syntax do not cause speculative inference; no JavaScript executes.
- Structured running handles and later `write_stdin`/`wait` results can finish the original waiting call. Unmatched starts at an observed turn termination become `unknown`, not invented successes/failures. Plain text without recognized outcome evidence is `unknown`.

### Claude

- Assistant content `tool_use.id` pairs with user content `tool_result.tool_use_id`. Multiple concurrent calls and child agents remain independent, even when the same raw tool ID is reused by another child.
- `is_error`, explicit exit status, and interrupted results establish failure. An explicit false error flag establishes completion unless stronger failure evidence exists. Missing outcome evidence remains `unknown`; successful-looking text is not proof.
- `agentId` and the `subagents/agent-*.jsonl` layout establish child identities. Returned `toolUseResult.agentId` refines observed parent-child relations, including nested children. A child in a shared session has the root agent as its initial parent until more specific returned-agent evidence arrives. `parentUuid` is a message ancestry field and is never treated as an agent ID.
- Root/child records interleaved in one file use separate pairing state. A child ID on one record cannot leak onto subsequent root records. Session filter IDs match the corresponding normalized events.

### OpenCode

- Uses only `node:sqlite.DatabaseSync(path, {readOnly:true})`; no writable source connection, schema changes, migration, journaling-mode changes, or CLI fallback. SQL reads run inside a read transaction so session parents and tool states are coherent. `PRAGMA data_version` detects committed changes, including WAL updates and equal `time_updated` values.
- Legacy tool parts use `callID`, `tool`, and `state.{status,input,time,metadata}`. V2 assistant `session_message.data.content` tool entries use `id`, `name`, `time.{created,completed}`, and `state`. Shared call IDs deduplicate migration copies.
- SQL projects tool identity, timestamps, input, status, and exit metadata; it does not select prompt/text/reasoning bodies, result content, credentials, or session titles. Session parents come from `session.parent_id`/`session_v2.parent_id`.
- `running` starts, `pending` waits, `completed` finishes, and `error` fails. Nonzero exit metadata takes precedence over `completed`. Explicit persisted start/end timestamps can reconstruct a completed pair even when its running state was never polled.
- Polling can miss transient database states or deleted rows. No missing transition is invented. Changed databases trigger scans of stored tool records, so SQLite work scales with stored tool/message history; only the output snapshot is capped. The observed database was small enough for sub-second startup.
- If `node:sqlite` is unavailable or the schema is unsupported, the source reports `error` with a sanitized blocked detail and retries; it does not substitute generated activity. Electron **45.3.3**, bundled Node **24.22.3**, successfully opened the real database read-only. Standalone Node **26.7.0** also worked.

## Read bounds, reconnection, and long-run limits

- Default polling is 1,200 ms with no overlapping polls. Known files are tailed incrementally; directory inventories have a five-second cache and are rescanned on the next poll (normally within 6.2 seconds). Root-directory changes and disconnected sources trigger an earlier rescan. Missing/error sources retry automatically. Concurrent restart calls waiting on an in-flight read still install only one polling timer. User-selected longer poll intervals also delay rescan/recovery.
- Each JSONL source selects up to 64 most recently modified files from a discovery inventory bounded to 2,048 files / 512 directories. Directory traversal prefers descending names before mtime selection. If discovery is capped, “recent” applies to the discovered subset, not an exhaustive global inventory. Source details show selected/discovered counts and a `+` when the discovery limit was reached. Symlink entries are not traversed.
- Initial or oversized backlog reads take at most 4 MiB of trailing content per file and a 32 MiB content budget per source per poll. Files are processed newest first. An additional first-line metadata probe is bounded to 64 KiB per skipped file, plus small byte anchors. Older bytes are deliberately omitted and their count is shown in source detail. A leading partial line is discarded; a trailing partial line stays buffered. A call beginning outside the retained window may have an unknown tool/outcome when only its finish is present.
- Byte offsets, complete-line UTF-8 decoding, inode/device identity, and a trailing 128-byte anchor handle partial writes, multibyte splits, rename/replacement, truncation, and observed in-place truncate/regrowth. Identical-byte rewrites at the sampled anchor cannot be distinguished without rereading the full file. Invalid completed JSON/UTF-8 records are counted and skipped. Individual unfinished lines are capped at 16 MiB; oversized records are discarded through their newline.
- History and I/O windows are bounded, but **the hub is not constant-memory over an unlimited lifetime**. Shared per-agent pairing maps, transition-ID dedupe sets, process-handle links, known sessions/parents, and previously discovered file contexts persist for the lifetime of that `SourceHub`. They hold normalized metadata/IDs rather than raw arguments or complete session contents, but grow with observed distinct calls/files/agents. This preserves pairing and dedupe across rotation/reconnection. A process restart or discarding the hub releases them; `stop()`/`start()` on the same hub deliberately preserves them. A persistent bounded dedupe design would be needed for unattended multi-month histories. Only incomplete line buffers retain raw bytes, within the line limit; rescans now release tailers and their raw buffers when files leave the selected inventory, while retaining safe pairing metadata.
- There is no synthetic activity fallback and no claim that bounded snapshot history contains every historical tool or all currently active calls.

## Verification

The independent backend tests use synthetic fixtures beneath the project's `.runtime` directory and remove their own temporary directories. They cover pairing, concurrent/overlapping child IDs, failure precedence, unknown outcomes, safe targets, wrapper inference, byte-split UTF-8/JSON, malformed records, bounded file/tail history, rotation/truncation/regrowth, silent startup/reconnect history, timer polling, restart, session filtering through the renderer's `EventStore`, snapshot copies/caps (including snapshots requested synchronously inside Live event callbacks), SQLite legacy/V2 dedupe, WAL updates, equal update timestamps, database replacement, and a fixture write rejected by the read-only connection. Another test verifies database bytes and directory entries do not change when observed.

Commands:

```sh
node --test tests/adapters.test.mjs tests/hub.test.mjs
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/Electron.app/Contents/MacOS/Electron --test tests/adapters.test.mjs tests/hub.test.mjs
```

Real-source startup probe: **247 ms** under Node 26.7.0 and **456 ms** under Electron 45.3.3 / Node 24.22.3. Both connected Codex (45 selected files), Claude (42), and OpenCode (one database), retained **4,000** transitions, and emitted **zero** initial Live events. The Electron probe retained **135** distinct session options, **52** with parents, and every retained event matched a session option. The standalone probe read about **62.5 MB** of JSONL content/metadata under the configured windows and reported approximately **157 MiB** process RSS. These are one-run observations, not performance guarantees; active source files continued changing during implementation.

The parent's separate live/UI probe is outside these owned tests and files. It reported 31 fresh real Codex transitions plus actual Claude/OpenCode history. Final UI testing should restart its server/Electron process so it imports the final canonical-ID and interleaved-agent implementation.

### 2026-11-18 bounded delivery review

Concrete repairs: preserve same-timestamp pending/running observation order; prevent duplicate polling timers on concurrent restart; retain call and Codex parent metadata across files; deliver late parent corrections through non-Live status snapshots; release retired raw line buffers; reject multibyte invalid capability tokens and malformed request URLs without throwing from the web server. All changes reuse the existing maps and interface.

Final validation: **41/41 repository tests passed in Node**, including **33 backend tests**; the same **33/33 backend tests passed in Electron 45.3.3**. The parent/children filter regression still expects **1 / 2 / 3 selected calls versus 6 globally**. No visual implementation or hook files were modified by this review.

The follow-up read-only probe on Node 26.7.0, while other project work/tests were running, started in **7,082 ms**. All three sources connected: **46 Codex files**, **42 Claude files**, and **one OpenCode database**. It retained **4,000 transitions**, **136 session options**, and **53 parent links**, with **zero startup Live emissions** and matching event/session filter IDs. One subsequent poll observed **3 fresh Codex transitions** and **zero Claude/OpenCode fresh transitions**. Claude/OpenCode therefore remain verified for historical reads and synthetic live fixtures; this does not claim successful real live model activity from them.

At that probe's end: **137 MiB RSS**, **12 MiB used JS heap**, **137 file/database contexts**, **121 shared agent states**, **4,113 retained call records**, **8,247 adapter transition IDs**, **8,247 hub dedupe IDs**, **88 active tailers**, and **zero pending raw-line bytes**. These measured values are not memory limits. Safe metadata remains lifetime-retained as documented above; SQLite change scans still scale with stored history.

The main task separately reports an official OpenCode hook install and a hung/cancelled model attempt. This backend review did not inspect, edit, execute, or remove that hook and did not launch any paid/model task. Those external actions do not establish successful OpenCode live-animation verification.
