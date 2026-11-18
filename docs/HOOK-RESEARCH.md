# Optional CrommaCode → OpenCode hook investigation

Date: 2026-11-18, Asia/Shanghai. This was bounded research only. No hook was installed, no model task was submitted, and no agent configuration or other file outside the project was changed. The existing backend was left unchanged.

## Exact model identifier found

The successful catalog query listed:

```text
magpie/auto/deepseek-v4.1-flash
```

This is the observed identifier matching the requested DeepSeek v4.1 Flash route group. The catalog also listed `opencode/deepseek-v4.1-flash-free`; that is a **different** provider/route and should not be substituted silently.

The normal `opencode models` command, including a `--print-logs` attempt, exited with `EPERM` when opening its usual data location under an external-filesystem write prohibition. This was a local filesystem restriction, not evidence of a login or hook-approval requirement.

The following catalog-only command then succeeded in 2.81 seconds, exit code 0, with 22 stdout lines:

```sh
opencode models --standalone --print-logs
```

For that probe, `sandbox-exec` denied writes everywhere except a temporary project-local `.runtime/hook-research-probe` directory and `/dev/null`. `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME`, and `TMPDIR` pointed beneath that directory; `OPENCODE_DB=:memory:` avoided opening the real database for writes. The original HOME was not changed. The CLI could read its normal configuration, but the investigation itself extracted only relevant hook/plugin configuration fields. No credentials were copied, inspected, or printed. Captured output was reduced to model identifiers, exit/timing data, and sanitized error categories. Temporary probe files were removed afterward.

An `EPIPE` diagnostic was present despite the successful exit and catalog output. This does not establish that a later task can authenticate, complete, or be billed successfully. No provider credential or billing validation was attempted.

OpenCode documents the `models` command as a catalog query, `--standalone` as using a private server, and `--model` as selecting a model for one run without changing defaults. Catalog presence alone is not an inference test. [CLI commands](https://opencode.ai/docs/cli/commands/), [CLI server modes](https://opencode.ai/docs/cli/), [model selection](https://opencode.ai/docs/models/).

## Official installation route and approval/login boundaries

The official CrommaCode instructions say to launch OpenCode inside a CrommaCode terminal. On macOS/Linux the app detects the CLI, backs up its user settings, and installs the tool hook. Windows uses Settings → Game View for the initial connection. The website says CrommaCode requires no account; its optional sign-in is for Ranks. The documented `/hooks` trust step applies specifically to Codex, not OpenCode. No OpenCode-specific approval/login step is documented there; any actual prompt still needs to be respected. [Official CrommaCode instructions and FAQ](https://cromma.ai/code).

This investigation did not open or change the application's settings, launch OpenCode within CrommaCode, approve a hook, sign in, or invoke an installation routine. Actual installation behavior and current OpenCode 2.x hook compatibility remain unverified. The main task can decide whether this optional evidence path is useful after the visual rewrite.

## Shipped and existing local evidence

| Evidence | Safe observation | Consequence |
| --- | --- | --- |
| Installed CrommaCode bundle | Version `0.3.22`; bundle ID `ai.cromma.bees`; executable `cromma-bees` | Identifies the inspected installed build. |
| App resources | Only `AppIcon.icns`, `Dock.png`, and `opening.mp4` | No standalone hook script was exposed in Resources. |
| Native app strings | Contained `install_hook`, `cromma-bees.js`, `opencode.js`, `tool.execute.before`, and `session.created` | Confirms shipped integration-related identifiers, but string presence does not prove a fully resolved install destination or compatibility. No executable source was copied or reconstructed. |
| `~/.cromma-bees/bin/bees` | Existing symlink; `bees --help` succeeded under the write restriction | Provides a shipped helper entry point. |
| Helper help | `bees hook [--cli <id>]` is the pre-tool event hook; `bees wire` installs its manual and hooks **every coding CLI found**; `bees unwire` reverses that broad operation | `wire` is broader than an OpenCode-only install. Neither installer/remover was executed. No undocumented `wire --cli` option is assumed. |
| `~/.config/opencode/plugins/` | Filenames `package.json` and `codeisland.js` | No Cromma-named plugin file was found in this inspected directory. Existing unrelated integration was left untouched. |
| `~/.config/opencode/opencode.json` | Relevant field `plugin` is a one-element list; zero Cromma-named entries | No Cromma integration was established from that configuration field. Other configuration values were not reported. |
| `~/.config/opencode.json` | No `plugin`, `plugins`, `hook`, or `hooks` field | No integration evidence in those fields. |
| Cromma state | No relevant hook/OpenCode/plugin setting keys found in the limited key inspection | No hook state was inferred from unrelated application/session data. |

OpenCode's current documentation names `~/.config/opencode/plugins/` as the global discovery directory and permits direct `.js`/`.ts` files there. This establishes the standard directory, **not** that the Cromma installer necessarily writes `cromma-bees.js` there. Its exact destination should be confirmed from the official install operation before treating that candidate path as fact. Current OpenCode documentation also distinguishes the `plugins` configuration field from direct file discovery; the locally observed singular `plugin` field is not proof of an active V2 plugin. [Official plugin documentation](https://opencode.ai/docs/plugins/).

## Handoff to the main task

- Optional observation can use the official app's OpenCode detection path if the main task chooses to proceed. Do not use the broad `bees wire` operation merely to obtain one OpenCode animation.
- Before any later edit/install, preserve the relevant original OpenCode config and any destination plugin file, then review the resulting change. No backup was created now because no edit was performed.
- The exact requested candidate is `magpie/auto/deepseek-v4.1-flash`. Keep it explicit for any later separately authorized task; do not substitute the free route, another DeepSeek version, or the default model.
- If installation, the CLI, or the provider presents trust/approval/login, leave that control intact. This research neither demonstrated nor bypassed such a prompt.
- Existing official demo footage and screenshots remain sufficient evidence to continue the visual work. Hook compatibility and one-task animation are still optional, untested follow-ups; all six required visual modes remain part of the main task.

Only this report and the removed project-local probe scratch directory were authored for this investigation. No backend source, tests, package metadata, hook configuration, or credential storage was changed.

## Subsequent authorized install — final update

The research-only observations above describe the initial probe. Afterwards, the main task used the user's explicit authorization and the official CrommaCode terminal-detection path. The original application displayed “OpenCode 已接入”. It added exactly `~/.config/opencode/plugins/bees-hive.js`; the four existing config/plugin files listed in `.runtime/hook-backup/manifest.json` remained byte-identical. No broad `bees wire` operation was used.

One task was launched with the exact requested catalog model `magpie/auto/deepseek-v4.1-flash`, scoped to `.runtime/observation/`. It produced neither output nor tool events during approximately three minutes and was cancelled with Ctrl+C. No inference success, billing amount, model execution or new OpenCode animation is inferred from that attempt. It was not repeatedly retried or substituted with another provider/model.

Final machine-readable installation record: `evidence/hook-install-report.json`. Reversible removal helper: `node scripts/disable-cromma-hook.mjs`. It checks the installed file hash and moves only that added file to the local backup directory, refusing to touch a later modified version. Existing configs do not require restoration because they were not changed. Backups can contain private user configuration and must remain local.
