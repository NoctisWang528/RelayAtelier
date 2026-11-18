import { createHash } from 'node:crypto';

const terminal = new Set(['completed', 'failed', 'unknown']);
const hash = (...values) => createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 24);
const identifier = value => typeof value === 'string' && /^[\w.:-]{1,160}$/.test(value) ? value : hash(value ?? 'missing');
const name = value => typeof value === 'string' && /^[\w.:-]{1,96}$/.test(value) ? value : 'unknown';
const object = value => {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
export const timestamp = value => {
  const n = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(n) && Math.abs(n) <= 8640000000000000 ? new Date(n).toISOString() : new Date(0).toISOString();
};
export const agentId = (source, session, child) => `${source}:${identifier(session)}${child ? `:${identifier(child)}` : ''}`;

export function toolType(tool) {
  const t = tool.toLowerCase().split(/[.:]/).at(-1);
  if (/^(bash|shell|exec_command|commandexecution|write_stdin|terminal)$/.test(t)) return 'shell';
  if (/^(read|write|edit|multiedit|apply_patch|view_image|imageview|filechange)$/.test(t)) return 'files';
  if (/^(grep|glob|search|ripgrep)$/.test(t)) return 'search';
  if (/^(agent|task|spawn_agent|wait|close_agent|send_input|send_message|list_agents|taskoutput)$/.test(t)) return 'agents';
  if (/web|fetch|browser|navigate/.test(t)) return 'web';
  return 'other';
}

export function safeTarget(args, type) {
  args = object(args);
  const path = args.file_path ?? args.filePath ?? args.path ?? args.image_path ?? args.filename;
  if (typeof path === 'string' && ['files', 'search'].includes(type)) {
    const base = path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1);
    return base && /^[\p{L}\p{N}_. @()+-]{1,100}$/u.test(base) && base !== '..' ? base : null;
  }
  if (type === 'shell') {
    const command = args.command ?? args.cmd;
    // Only the first literal executable is exposed; substitutions and assignments are not parsed.
    const match = typeof command === 'string' && command.match(/^\s*(?:"([/\w.+-]+)"|'([/\w.+-]+)'|([/\w.+-]+))(?=\s|$)/);
    const executable = match && (match[1] || match[2] || match[3]).split('/').at(-1);
    return executable && /^[A-Za-z][\w.+-]{0,63}$/.test(executable) ? executable : null;
  }
  if (type === 'web' && typeof args.url === 'string') {
    try { const url = new URL(args.url); return /^https?:$/.test(url.protocol) ? url.hostname : null; } catch { /* no target */ }
  }
  return null;
}

function setup(context, source, session) {
  context.source = source;
  if (session) context.sourceSessionId = identifier(session);
  context.sourceSessionId ??= identifier(context.sessionId ?? 'unknown');
  const canonical = agentId(source, context.sourceSessionId, context.childId);
  context.agentStates ??= new Map();
  if (!context.agentStates.has(canonical)) {
    context.agentStates.set(canonical, { calls: new Map(), emitted: new Set(), handles: new Map(), followups: new Map() });
  }
  if (context.agentId !== canonical) context.parentAgentId = null;
  Object.assign(context, context.agentStates.get(canonical));
  context.sessionId = canonical;
  context.agentId = canonical;
  context.parentAgentId ??= null;
  context.parents ??= new Map();
}

function transition(context, key, status, time, tool, args, type) {
  if (!key) return [];
  key = String(key);
  const prior = context.calls.get(key);
  if ((status === 'started' || status === 'waiting') && prior && terminal.has(prior.status)) return [];
  if (prior?.status === 'failed' || (prior?.status === 'completed' && status === 'unknown')) return [];
  const callId = prior?.callId ?? `${context.source}:${hash(context.sessionId, context.agentId, key)}`;
  const id = `${callId}:${status}`;
  if (context.emitted.has(id)) return [];
  tool = tool ? name(tool) : prior?.tool ?? 'unknown';
  type ??= prior?.toolType ?? toolType(tool);
  const event = {
    id, callId, sessionId: context.sessionId, agentId: context.agentId,
    parentAgentId: context.parents.get(context.agentId) ?? context.parentAgentId,
    timestamp: timestamp(time), source: context.source, tool, toolType: type, status,
    target: args ? safeTarget(args, type) : prior?.target ?? null,
  };
  context.calls.set(key, event);
  context.emitted.add(id);
  return [event];
}

function outcome(value) {
  let v = value;
  if (typeof v === 'string') {
    const running = v.match(/^Script running with cell ID ([\w-]+)/);
    if (running) return { status: 'waiting', handle: `cell:${running[1]}` };
    try { v = JSON.parse(v); } catch { return { status: 'unknown' }; }
  }
  if (Array.isArray(v)) {
    const results = v.map(block => outcome(block?.text ?? block));
    return results.find(r => r.status === 'failed') ?? results.find(r => r.status === 'waiting') ?? results.find(r => r.status === 'completed') ?? { status: 'unknown' };
  }
  v = object(v);
  const code = v.exit_code ?? v.exitCode ?? v.exit ?? v.metadata?.exit_code ?? v.metadata?.exit;
  if (v.isError === true || v.is_error === true || v.interrupted === true || v.error || (typeof code === 'number' && code !== 0)) return { status: 'failed' };
  const nested = v.content || v.structuredContent ? outcome(v.content ?? v.structuredContent) : null;
  if (nested?.status === 'failed' || nested?.status === 'waiting') return nested;
  if (v.session_id != null && code == null) return { status: 'waiting', handle: `process:${v.session_id}` };
  if (v.cell_id != null && code == null) return { status: 'waiting', handle: `cell:${v.cell_id}` };
  if (code === 0 || v.isError === false || v.is_error === false || v.status === 'completed' || nested?.status === 'completed') return { status: 'completed' };
  return { status: 'unknown' };
}

function finishOutput(context, key, time, output) {
  const result = outcome(output);
  if (result.handle) context.handles.set(result.handle, context.followups.get(key) ?? key);
  const events = transition(context, key, result.status, time);
  const original = context.followups.get(key);
  if (original && terminal.has(result.status)) events.push(...transition(context, original, result.status, time));
  return events;
}

function wrapperType(code) {
  if (typeof code !== 'string') return undefined;
  const stripped = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
  if (stripped.includes('/')) return undefined;
  const calls = [...stripped.matchAll(/\btools\.([A-Za-z_][\w]*)\s*\(/g)];
  if (calls.length !== 1) return undefined;
  return { exec_command: 'shell', apply_patch: 'files', web__run: 'web', spawn_agent: 'agents' }[calls[0][1]];
}

export function normalizeCodex(record, context = {}) {
  if (!record || typeof record !== 'object') return [];
  const p = object(record.payload);
  setup(context, 'codex');
  if (record.type === 'session_meta') {
    setup(context, 'codex', p.id ?? p.session_id);
    const parent = p.parent_thread_id ?? p.source?.subagent?.thread_spawn?.parent_thread_id;
    if (parent) {
      context.parentAgentId = agentId('codex', parent);
      context.parents.set(context.agentId, context.parentAgentId);
    }
    return [];
  }
  const time = record.timestamp;
  if (record.type === 'response_item') {
    if (['function_call', 'custom_tool_call'].includes(p.type)) {
      const args = object(p.arguments ?? p.input);
      const handle = args.session_id != null ? `process:${args.session_id}` : args.cell_id != null ? `cell:${args.cell_id}` : null;
      if (['write_stdin', 'wait'].includes(p.name) && context.handles.has(handle)) context.followups.set(p.call_id, context.handles.get(handle));
      const inferred = /^(?:functions\.)?exec$/.test(p.name) ? wrapperType(p.input ?? args.code) : undefined;
      return transition(context, p.call_id, 'started', time, p.name, args, inferred);
    }
    if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) return finishOutput(context, p.call_id, time, p.output);
  }
  if (record.type !== 'event_msg') return [];
  if (p.type === 'turn_aborted' || p.type === 'task_complete') {
    const events = [];
    for (const [key, prior] of context.calls) {
      if (prior.status === 'started' || prior.status === 'waiting') events.push(...transition(context, key, 'unknown', time));
    }
    return events;
  }
  if (p.type !== 'item_completed') return [];
  const item = object(p.item);
  let tool, args, type, status;
  switch (item.type) {
    case 'CommandExecution':
      tool = 'exec_command'; args = { command: item.command }; type = 'shell';
      status = typeof item.exit_code === 'number' ? (item.exit_code === 0 ? 'completed' : 'failed') : 'unknown';
      break;
    case 'McpToolCall':
      tool = `${name(item.server)}.${name(item.tool)}`; args = object(item.arguments);
      status = outcome(item.result).status;
      break;
    case 'FileChange':
      tool = 'apply_patch'; type = 'files'; args = { path: Object.keys(object(item.changes))[0] };
      break;
    case 'ImageView':
      tool = 'view_image'; type = 'files'; args = { path: item.path }; status = 'completed';
      break;
    case 'CollabAgentToolCall':
      tool = item.tool; type = 'agents';
      if (item.tool === 'spawn_agent') for (const child of item.receiver_thread_ids ?? []) context.parents.set(agentId('codex', child), context.agentId);
      break;
    default: return [];
  }
  if (item.status === 'failed') status = 'failed';
  status ??= item.status === 'completed' ? 'completed' : 'unknown';
  // Newer Codex records inner tool timing only after completion; preserve the recorded start.
  const events = Number.isFinite(p.started_at_ms) ? transition(context, item.id, 'started', p.started_at_ms, tool, args, type) : [];
  events.push(...transition(context, item.id, status, p.completed_at_ms ?? time, tool, args, type));
  return events;
}

export function normalizeClaude(record, context = {}) {
  if (!record || typeof record !== 'object') return [];
  if (!Object.hasOwn(context, 'fileChildId')) context.fileChildId = context.childId ?? null;
  context.childId = record.agentId ? identifier(record.agentId) : context.fileChildId;
  setup(context, 'claude', record.sessionId);
  if (context.childId) context.parentAgentId = context.parents.get(context.agentId) ?? agentId('claude', context.sourceSessionId);
  else context.parentAgentId = null;
  const content = record.message?.content;
  if (!Array.isArray(content)) return [];
  const events = [];
  for (const block of content) {
    if (block?.type === 'tool_use') events.push(...transition(context, block.id, 'started', record.timestamp, block.name, object(block.input)));
    if (block?.type === 'tool_result') {
      const result = object(record.toolUseResult);
      if (result.agentId) context.parents.set(agentId('claude', context.sourceSessionId, result.agentId), context.agentId);
      const known = outcome(result);
      const status = block.is_error === true || known.status === 'failed' ? 'failed'
        : known.status === 'waiting' ? 'waiting'
          : block.is_error === false || known.status === 'completed' ? 'completed' : 'unknown';
      events.push(...transition(context, block.tool_use_id, status, record.timestamp));
    }
  }
  return events;
}

export function normalizeOpenCode(part, context = {}) {
  if (part?.type !== 'tool') return [];
  setup(context, 'opencode');
  const state = object(part.state);
  const times = object(part.time ?? state.time);
  const start = times.created ?? times.start;
  const end = times.completed ?? times.end;
  const key = part.callID ?? part.id ?? context.recordKey;
  const tool = part.tool ?? part.name;
  const args = object(state.input);
  const status = state.status === 'error' || outcome(state.metadata).status === 'failed' ? 'failed'
    : state.status === 'completed' ? 'completed'
      : state.status === 'pending' ? 'waiting'
        : state.status === 'running' ? 'started' : 'unknown';
  const events = state.status !== 'pending' && Number.isFinite(start) ? transition(context, key, 'started', start, tool, args) : [];
  events.push(...transition(context, key, status, end ?? start ?? context.timestamp, tool, args));
  return events;
}
