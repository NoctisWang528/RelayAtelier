import { isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { conflict, indexJson, insertMember, removeMember } from './json.mjs';

const toolEvents = ['PreToolUse', 'PostToolUse', 'Stop'];
const statusMessage = 'Relay Atelier · pulse';
const ownedConflict = () => conflict('发现同名或已修改的 Relay Hook，请检查目标文件后重试。');

export function commandGroup(id, pulse, platform = process.platform) {
  // Break dollar-prefixed host placeholders as well as quoting for sh.
  const quoted = "'" + pulse.replaceAll("'", "'\\''").split('$').join("$''") + "'";
  const command = 'p=' + quoted + '; d=${p%/*}; if [ ! -L "$d" ] && [ ! -L "${d%/*}" ]; then ' +
    '/usr/bin/find "$p" -prune -type f -links 1 -size 0c -exec /usr/bin/touch -c -h -m {} + 2>/dev/null || :; fi';
  const handler = { type: 'command', command, statusMessage };
  if (platform === 'win32') {
    // The absolute path is data even when the home contains shell or host placeholders.
    const pathData = Buffer.from(pulse).toString('base64');
    const script = `try { $p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${pathData}')); ` +
      '$f = Get-Item -LiteralPath $p -Force -ErrorAction Stop; ' +
      'if ($f -is [IO.FileInfo] -and !$f.LinkType -and $f.Length -eq 0 -and ' +
      '!(($f.Attributes -bor $f.Directory.Attributes -bor $f.Directory.Parent.Attributes) -band [IO.FileAttributes]::ReparsePoint)) ' +
      '{ $f.LastWriteTimeUtc = [DateTime]::UtcNow } } catch {}; exit 0';
    if (id === 'codex') {
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      handler.commandWindows = '"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -EncodedCommand ' + encoded;
    } else {
      handler.shell = 'powershell';
      handler.command = script;
    }
  }
  return { hooks: [handler] };
}

function inspectJson(text, receipt, group, events) {
  const source = text ?? '{}\n';
  const root = indexJson(source);
  const hooks = root.fields.get('hooks');
  if (hooks && !hooks.fields) throw conflict('配置中的 hooks 字段需要是对象。');
  const found = new Set();
  const allocations = [];
  if (text === null) allocations.push('file');
  if (!hooks) allocations.push('hooks');
  const handler = group.hooks[0];
  for (const event of events) {
    const list = hooks?.fields.get(event);
    if (!list) allocations.push(event);
    else if (!list.items || list.fields) throw conflict('Hook 事件配置需要是数组。');
  }
  for (const [event, list] of hooks?.fields ?? []) {
    for (const node of list.items ?? []) {
      const candidate = JSON.parse(source.slice(node.start, node.end));
      const handlers = candidate?.hooks;
      if (!Array.isArray(handlers)) {
        if (events.includes(event)) throw conflict('事件中存在无效的 Hook 分组。');
        continue;
      }
      if (!handlers.some(h => h && (h.statusMessage === statusMessage || h.command === handler.command ||
        (handler.commandWindows && h.commandWindows === handler.commandWindows)))) continue;
      if (!receipt || !events.includes(event) || found.has(event) || !isDeepStrictEqual(candidate, group)) throw ownedConflict();
      found.add(event);
    }
  }
  return {
    state: receipt ? (found.size === events.length ? 'installed' : 'partial') : 'absent',
    allocations,
    install() {
      let next = source;
      if (!hooks) return insertMember(next, root, Object.fromEntries(events.map(e => [e, [group]])), 1, 'hooks');
      for (const event of events.filter(e => !found.has(e))) {
        const parent = indexJson(next).fields.get('hooks');
        const array = parent.fields.get(event);
        next = array ? insertMember(next, array, group, 3) : insertMember(next, parent, [group], 2, event);
      }
      return next;
    },
    remove() {
      if (!found.size) return text;
      let next = source;
      for (const event of found) {
        const parent = indexJson(next).fields.get('hooks');
        const array = parent.fields.get(event);
        const node = array.items.find(n => isDeepStrictEqual(JSON.parse(next.slice(n.start, n.end)), group));
        next = array.items.length === 1 && receipt.allocations.includes(event)
          ? removeMember(next, parent, array) : removeMember(next, array, node);
      }
      const updated = indexJson(next);
      const parent = updated.fields.get('hooks');
      if (!parent.items.length && receipt.allocations.includes('hooks')) next = removeMember(next, updated, parent);
      return !indexJson(next).items.length && receipt.allocations.includes('file') ? null : next;
    },
  };
}

function pluginSource(pulse) {
  return `// Relay Atelier local activity signal
import { dirname } from 'node:path';
import { constants, openSync, fstatSync, futimesSync, closeSync, lstatSync } from 'node:fs';

const marker = ${JSON.stringify(pulse)};

function pulse() {
  try {
    const dir = dirname(marker);
    if (!lstatSync(dir).isDirectory() || !lstatSync(dirname(dir)).isDirectory()) return;
    const file = lstatSync(marker);
    if (!file.isFile() || file.size !== 0 || file.nlink !== 1) return;
    const fd = openSync(marker, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const current = fstatSync(fd);
      if (current.isFile() && current.size === 0 && current.nlink === 1 &&
          current.dev === file.dev && current.ino === file.ino) futimesSync(fd, current.atime, new Date());
    } finally { closeSync(fd); }
  } catch { /* The desktop marker may be unavailable. */ }
}

export default {
  id: 'relay-atelier.pulse',
  async setup(ctx) {
    await ctx.tool.hook('execute.before', pulse);
    await ctx.tool.hook('execute.after', pulse);
  },
  async server() {
    return { 'tool.execute.before': pulse, 'tool.execute.after': pulse };
  },
};
`;
}

function inspectPlugin(text, receipt, source) {
  if (text !== null && (!receipt || text !== source)) throw ownedConflict();
  return {
    state: receipt ? (text === null ? 'partial' : 'installed') : 'absent',
    allocations: [],
    install: () => source,
    remove: () => null,
  };
}

export function providers(home, env, pulse) {
  function jsonProvider(id, label, root, file, detail, events = toolEvents) {
    const group = commandGroup(id, pulse);
    return { id, label, root, file, detail, backupJson: true, inspect: (text, receipt) => inspectJson(text, receipt, group, events) };
  }
  const source = pluginSource(pulse);
  const registry = [
    jsonProvider('codex', 'Codex', env.CODEX_HOME || join(home, '.codex'), 'hooks.json',
      '安装后请在 Codex 的 /hooks 或设置中审核并信任这些 Hook。'),
    jsonProvider('claude', 'Claude Code', env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'settings.json',
      '使用用户级 Hook，启用状态由 Claude Code 的设置与策略决定。', [...toolEvents, 'PostToolUseFailure']),
    {
      id: 'opencode', label: 'OpenCode', file: 'plugins/relay-atelier-pulse.js',
      root: env.OPENCODE_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode'),
      detail: '使用本地工具插件，安装或移除后请重新加载 OpenCode。',
      inspect: (text, receipt) => inspectPlugin(text, receipt, source),
    },
  ];
  return registry.map(p => ({ ...p, target: join(p.root, p.file), validRoot: isAbsolute(p.root) && isAbsolute(home) }));
}
