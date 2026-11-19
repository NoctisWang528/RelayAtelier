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
  if (/^(bash|shell|execute|execute_command|run_shell_command|commandexecution|exec_command|write_stdin|terminal)$/.test(t)) return 'shell';
  if (/^(read|write|edit|read_file|write_file|write_to_file|replace_in_file|multiedit|apply_patch|view_image|imageview|filechange)$/.test(t)) return 'files';
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

export function normalizeClaude(record, context = {}, source = 'claude') {
  if (!record || typeof record !== 'object') return [];
  if (!Object.hasOwn(context, 'fileChildId')) context.fileChildId = context.childId ?? null;
  context.childId = record.agentId ? identifier(record.agentId) : context.fileChildId;
  setup(context, source, record.sessionId);
  if (context.childId) context.parentAgentId = context.parents.get(context.agentId) ?? agentId(source, context.sourceSessionId);
  else context.parentAgentId = null;
  const content = record.message?.content;
  if (!Array.isArray(content)) return [];
  const events = [];
  for (const block of content) {
    if (block?.type === 'tool_use') events.push(...transition(context, block.id, 'started', record.timestamp, block.name, object(block.input)));
    if (block?.type === 'tool_result') {
      const result = object(record.toolUseResult);
      if (result.agentId) context.parents.set(agentId(source, context.sourceSessionId, result.agentId), context.agentId);
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
  setup(context, context.source ?? 'opencode');
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

// Workspace contents and tool output never enter an event. Pair only by the
// provider's call ID; several calls with the same tool name can run in parallel.
export function normalizeRecord(source, record, context) {
  if (!record || typeof record !== 'object') return [];
  if (source === 'codex') return normalizeCodex(record, context);
  if (['claude', 'cherry', 'droid'].includes(source) || (source === 'proma' && record.type !== 'message' && record.type !== 'session')) {
    if (source === 'droid' && record.type === 'session_start') setup(context, source, record.id);
    return normalizeClaude(record, context, source);
  }
  const msg = record.message ?? {};
  const data = record.data ?? {};
  const records = value => Array.isArray(value) ? value : [];
  const flag = error => error === true ? 'failed' : error === false ? 'completed' : 'unknown';
  const events = [];
  let time = record.timestamp ?? record.time ?? msg.timestamp;
  let session = record.sessionId;
  if (record.type === 'session') session = record.id;
  if (source === 'copilot' && record.type === 'session.start') session = data.sessionId;
  setup(context, source, session);
  function emit(id, status, tool, args, at = time) {
    if (typeof id === 'string' && id) events.push(...transition(context, id, status, at, tool, args));
  }

  switch (source) {
    case 'pi': case 'omp': case 'senpi': case 'openclaw': case 'proma':
      if (record.type !== 'message') break;
      if (msg.role === 'assistant') for (const block of records(msg.content)) {
        if (block?.type === 'toolCall') emit(block.id, 'started', block.name, block.arguments);
      }
      if (msg.role === 'toolResult') emit(msg.toolCallId, flag(msg.isError), msg.toolName);
      break;
    case 'codebuddy': case 'workbuddy':
      if (record.type === 'function_call') emit(record.callId ?? record.id, 'started', record.name, record.arguments);
      if (record.type === 'function_call_result') {
        const status = record.status === 'failed' || outcome(record.output).status === 'failed' ? 'failed'
          : record.status === 'completed' ? 'completed' : 'unknown';
        emit(record.callId, status, record.name);
      }
      break;
    case 'copilot':
      if (record.type === 'tool.execution_start') emit(data.toolCallId, 'started', data.toolName, data.arguments);
      if (record.type === 'tool.execution_complete') emit(data.toolCallId, data.error ? 'failed' : flag(typeof data.success === 'boolean' ? !data.success : undefined));
      break;
    case 'kimi': {
      const payload = msg.payload ?? {};
      if (typeof time === 'number') time *= 1000; // wire timestamps use Unix seconds
      if (msg.type === 'ToolCall') emit(payload.id, 'started', payload.function?.name, payload.function?.arguments);
      if (msg.type === 'ToolResult') emit(payload.tool_call_id, flag(payload.return_value?.is_error));
      break;
    }
    case 'dsh':
      if (record.type === 'tool/call') emit(data.callId, 'started', data.name, data.arguments);
      if (record.type === 'tool/result') for (const block of records(data.message?.content)) {
        if (block?.type === 'tool-result') emit(block.toolCallId, flag(block.isError));
      }
      break;
    case 'qwen': {
      const resultMeta = record.toolCallResult;
      const resultStatus = resultMeta?.status;
      for (const part of records(msg.parts)) {
        const call = part?.functionCall, result = part?.functionResponse;
        if (record.type === 'assistant' && call) emit(call.id, 'started', call.name, call.args);
        if (record.type === 'tool_result' && result) {
          const failed = outcome(result.response).status === 'failed' || resultStatus === 'error' || resultStatus === 'cancelled';
          emit(result.id ?? resultMeta?.callId, failed ? 'failed' : resultStatus === 'success' ? 'completed' : outcome(result.response).status, result.name);
        }
      }
      break;
    }
    case 'gemini': {
      const statuses = { success: 'completed', error: 'failed', cancelled: 'failed', executing: 'started', awaiting_approval: 'waiting', scheduled: 'waiting', validating: 'waiting' };
      for (const message of record.type === 'gemini' ? [record] : records(record.messages ?? record.$set?.messages)) {
        if (message?.type !== 'gemini') continue;
        for (const call of records(message.toolCalls)) {
          if (call?.name) emit(call.id, Object.hasOwn(statuses, call.status) ? statuses[call.status] : 'unknown', call.name, call.args, call.timestamp ?? message.timestamp);
        }
      }
      break;
    }
    case 'reasonix': {
      const kind = record.type ?? record.kind ?? record.event_type;
      const version = record.schema_version ?? record.schemaVersion;
      const messages = version === 1 && ['replace', 'append'].includes(kind) ? records(record.messages) : [record];
      for (const message of messages) {
        time = message?.timestamp ?? message?.ts ?? record.ts ?? record.timestamp ?? context.fileTime;
        if (message?.role === 'assistant') for (const call of records(message.tool_calls)) {
          if (call?.id) emit(call.id, 'started', call.function?.name ?? call.name, call.function?.arguments ?? call.arguments);
        }
        if (message?.role === 'tool') emit(message.tool_call_id, flag(message.is_error), message.name);
      }
      break;
    }
    case 'cline': case 'kilo':
      for (const message of records(record.messages ?? record)) {
        // Some extension versions only timestamp the snapshot, not each block.
        time = message?.ts ?? message?.timestamp ?? record.updated_at ?? context.fileTime;
        for (const block of records(message?.content)) {
          if (message.role === 'assistant' && block?.type === 'tool_use') emit(block.id, 'started', block.name, block.input);
          if (message.role === 'user' && block?.type === 'tool_result') emit(block.tool_use_id, flag(block.is_error));
        }
      }
      break;
  }
  return events;
}
