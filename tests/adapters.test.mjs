import test from 'node:test';
import assert from 'node:assert/strict';
import { agentId, normalizeCodex, normalizeClaude, normalizeOpenCode, safeTarget } from '../server/adapters.mjs';

const time = '2026-01-01T00:00:00.000Z';
const codex = payload => ({ type: 'response_item', timestamp: time, payload });
const claude = (content, extra = {}) => ({ sessionId: 'session-a', timestamp: time, message: { content }, ...extra });
const context = () => ({ sessionId: 'session-a' });
const fields = ['id', 'callId', 'sessionId', 'agentId', 'parentAgentId', 'timestamp', 'source', 'tool', 'toolType', 'status', 'target'].sort();

test('Codex pairs interleaved calls by call_id and emits only safe normalized fields', () => {
  const ctx = context();
  const a = normalizeCodex(codex({ type: 'function_call', call_id: 'a', name: 'exec_command', arguments: JSON.stringify({ cmd: '/usr/bin/node -e SECRET_PROMPT' }) }), ctx)[0];
  const b = normalizeCodex(codex({ type: 'function_call', call_id: 'b', name: 'read', arguments: '{"path":"/private/owner/report.txt"}' }), ctx)[0];
  const endB = normalizeCodex(codex({ type: 'function_call_output', call_id: 'b', output: { isError: false, output: 'SECRET_OUTPUT' } }), ctx)[0];
  const endA = normalizeCodex(codex({ type: 'function_call_output', call_id: 'a', output: [{ type: 'text', text: '{"exit_code":7,"output":"SECRET_OUTPUT"}' }] }), ctx)[0];
  assert.equal(a.target, 'node');
  assert.equal(b.target, 'report.txt');
  assert.equal(a.callId, endA.callId);
  assert.equal(b.callId, endB.callId);
  assert.equal(endA.status, 'failed');
  assert.equal(endB.status, 'completed');
  assert.notEqual(a.id, endA.id);
  for (const e of [a, b, endA, endB]) assert.deepEqual(Object.keys(e).sort(), fields);
  assert.doesNotMatch(JSON.stringify([a, b, endA, endB, [...ctx.calls.values()]]), /SECRET|private|owner/);
});

test('Codex timed inner tools reconstruct a pair and deduplicate duplicate representations', () => {
  const ctx = context();
  const record = { type: 'event_msg', timestamp: time, payload: { type: 'item_completed', started_at_ms: 1000, completed_at_ms: 1100,
    item: { type: 'CommandExecution', id: 'inner-a', command: 'rg secret /private', status: 'completed', exit_code: 1, aggregated_output: 'PRIVATE' } } };
  const events = normalizeCodex(record, ctx);
  assert.deepEqual(events.map(e => e.status), ['started', 'failed']);
  assert.equal(events[0].callId, events[1].callId);
  assert.equal(events[0].target, 'rg');
  assert.equal(events[1].timestamp, new Date(1100).toISOString());
  assert.deepEqual(normalizeCodex(record, ctx), []);
  const fresh = normalizeCodex(record, context());
  assert.deepEqual(events.map(e => e.id), fresh.map(e => e.id));
  const mcp = { ...record, payload: { ...record.payload, item: { type: 'McpToolCall', id: 'mcp-a', server: 'example', tool: 'read', status: 'completed', result: { isError: true } } } };
  normalizeCodex(codex({ type: 'function_call', call_id: 'mcp-a', name: 'read', arguments: '{}' }), ctx);
  assert.deepEqual(normalizeCodex(mcp, ctx).map(e => e.status), ['failed']);
});

test('missing result proof stays unknown; abort does not invent failure or success', () => {
  const ctx = context();
  normalizeCodex(codex({ type: 'function_call', call_id: 'a', name: 'read' }), ctx);
  assert.equal(normalizeCodex(codex({ type: 'function_call_output', call_id: 'a', output: 'arbitrary output' }), ctx)[0].status, 'unknown');
  const orphan = normalizeCodex(codex({ type: 'function_call_output', call_id: 'orphan', output: 'unknown' }), ctx)[0];
  assert.equal(orphan.status, 'unknown');
  assert.equal(orphan.tool, 'unknown');
  normalizeCodex(codex({ type: 'custom_tool_call', call_id: 'b', name: 'exec', input: 'SECRET_CODE' }), ctx);
  const abort = normalizeCodex({ type: 'event_msg', timestamp: time, payload: { type: 'turn_aborted' } }, ctx);
  assert.deepEqual(abort.map(e => e.status), ['unknown']);
  assert.equal(abort[0].target, null);
  const failed = normalizeCodex(codex({ type: 'function_call_output', call_id: 'nested', output: { isError: false, content: [{ type: 'text', text: '{"exit_code":9}' }] } }), ctx)[0];
  assert.equal(failed.status, 'failed');
});

test('Codex process handles finish the original waiting call on a later write_stdin', () => {
  const ctx = context();
  const start = normalizeCodex(codex({ type: 'function_call', name: 'exec_command', call_id: 'run', arguments: '{"cmd":"node SECRET"}' }), ctx)[0];
  assert.equal(normalizeCodex(codex({ type: 'function_call_output', call_id: 'run', output: { session_id: 42, exit_code: null } }), ctx)[0].status, 'waiting');
  normalizeCodex(codex({ type: 'function_call', name: 'write_stdin', call_id: 'poll', arguments: '{"session_id":42}' }), ctx);
  const results = normalizeCodex(codex({ type: 'function_call_output', call_id: 'poll', output: { exit_code: 0 } }), ctx);
  assert.equal(results.length, 2);
  assert.equal(results.find(e => e.callId === start.callId).status, 'completed');
});

test('Codex child parent uses metadata and never the user-facing nickname', () => {
  const ctx = {};
  normalizeCodex({ type: 'session_meta', payload: { id: 'child', agent_nickname: 'PRIVATE_NICKNAME', source: { subagent: { thread_spawn: { parent_thread_id: 'parent' } } } } }, ctx);
  const event = normalizeCodex(codex({ type: 'function_call', call_id: 'a', name: 'read' }), ctx)[0];
  assert.equal(event.agentId, 'codex:child');
  assert.equal(event.parentAgentId, 'codex:parent');
  assert.doesNotMatch(JSON.stringify(event), /PRIVATE/);
  const continued = { sessionId: 'child', parents: ctx.parents, agentStates: ctx.agentStates };
  const end = normalizeCodex(codex({ type: 'function_call_output', call_id: 'a', output: { isError: false } }), continued)[0];
  assert.equal(end.callId, event.callId);
  assert.equal(end.parentAgentId, 'codex:parent');
  assert.equal(end.tool, 'read');
});

test('Claude pairs concurrent tools, checks failure and does not use parentUuid as an agent parent', () => {
  const ctx = context();
  const starts = normalizeClaude(claude([
    { type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'python3 secret.py', description: 'PRIVATE' } },
    { type: 'tool_use', id: 'b', name: 'Edit', input: { file_path: '/private/汉字.md', new_string: 'PRIVATE' } },
  ], { parentUuid: 'message-not-agent' }), ctx);
  const endB = normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'b', is_error: false, content: 'PRIVATE' }]), ctx)[0];
  const endA = normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'PRIVATE' }]), ctx)[0];
  assert.equal(starts[0].callId, endA.callId);
  assert.equal(starts[1].callId, endB.callId);
  assert.equal(endA.status, 'failed');
  assert.equal(endB.status, 'completed');
  assert.equal(endB.target, '汉字.md');
  assert.equal(endA.parentAgentId, null);
  assert.doesNotMatch(JSON.stringify([...starts, endA, endB]), /PRIVATE|secret/);
  assert.deepEqual(normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'a', is_error: true }]), ctx), []);
});

test('Claude child IDs stay independent and returned child metadata refines nested parents', () => {
  const parents = new Map();
  const parent = { sessionId: 'session-a', childId: 'worker-a', parents };
  normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'spawn', is_error: false }], { toolUseResult: { agentId: 'worker-b' } }), parent);
  const child = { sessionId: 'session-a', parents };
  const event = normalizeClaude(claude([{ type: 'tool_use', id: 'a', name: 'Read', input: {} }], { agentId: 'worker-b', isSidechain: true }), child)[0];
  assert.equal(event.parentAgentId, agentId('claude', 'session-a', 'worker-a'));
  assert.notEqual(event.agentId, parent.agentId);
  const interrupted = normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'a', is_error: false }], { agentId: 'worker-b', toolUseResult: { interrupted: true } }), child)[0];
  assert.equal(interrupted.status, 'failed');
});

test('interleaved Claude sidechains do not leak identity or lose parent call pairing', () => {
  const ctx = context();
  const start = normalizeClaude(claude([{ type: 'tool_use', id: 'same-call-id', name: 'Read', input: { file_path: '/private/root.md' } }]), ctx)[0];
  const child = normalizeClaude(claude([{ type: 'tool_use', id: 'same-call-id', name: 'Edit', input: { file_path: '/private/child.md' } }], { agentId: 'worker', isSidechain: true }), ctx)[0];
  const endRoot = normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'same-call-id', is_error: false }]), ctx)[0];
  const endChild = normalizeClaude(claude([{ type: 'tool_result', tool_use_id: 'same-call-id', is_error: true }], { agentId: 'worker', isSidechain: true }), ctx)[0];
  assert.equal(start.callId, endRoot.callId);
  assert.equal(child.callId, endChild.callId);
  assert.notEqual(start.callId, child.callId);
  assert.equal(endRoot.sessionId, 'claude:session-a');
  assert.equal(endRoot.parentAgentId, null);
  assert.equal(endRoot.target, 'root.md');
  assert.equal(endChild.sessionId, 'claude:session-a:worker');
  assert.equal(endChild.parentAgentId, 'claude:session-a');
  assert.equal(endChild.target, 'child.md');
});

test('OpenCode legacy and v2 pair and deduplicate while exit metadata overrides completed', () => {
  const ctx = context();
  const legacy = { type: 'tool', callID: 'a', tool: 'bash', state: { status: 'completed', input: { command: 'node PRIVATE' }, time: { start: 1000, end: 2000 }, metadata: { exit: 2 }, output: 'PRIVATE' } };
  const events = normalizeOpenCode(legacy, ctx);
  assert.deepEqual(events.map(e => e.status), ['started', 'failed']);
  const modern = { type: 'tool', id: 'a', name: 'bash', time: { created: 1000, completed: 2000 }, state: { ...legacy.state, content: 'PRIVATE' } };
  assert.deepEqual(normalizeOpenCode(modern, ctx), []);
  assert.equal(events[0].callId, events[1].callId);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
});

test('OpenCode pending, running and terminal updates never leave a completed call active', () => {
  const ctx = context();
  const part = { type: 'tool', id: 'a', name: 'read', time: { created: 1000 }, state: { status: 'pending', input: {} } };
  assert.deepEqual(normalizeOpenCode(part, ctx).map(e => e.status), ['waiting']);
  part.state.status = 'running';
  assert.deepEqual(normalizeOpenCode(part, ctx).map(e => e.status), ['started']);
  part.state.status = 'completed'; part.time.completed = 2000;
  assert.deepEqual(normalizeOpenCode(part, ctx).map(e => e.status), ['completed']);
  part.state.status = 'running';
  assert.deepEqual(normalizeOpenCode(part, ctx), []);
});

test('targets never include assignments, substitutions, credentials, query strings or arguments', () => {
  assert.equal(safeTarget({ cmd: 'TOKEN=PRIVATE curl https://private' }, 'shell'), null);
  assert.equal(safeTarget({ cmd: '$(secret) PRIVATE' }, 'shell'), null);
  assert.equal(safeTarget({ cmd: '"/usr/bin/python3" -c PRIVATE' }, 'shell'), 'python3');
  assert.equal(safeTarget({ url: 'https://user:password@example.com/private?token=SECRET#fragment' }, 'web'), 'example.com');
  assert.equal(safeTarget({ path: 'C:\\private\\safe.txt' }, 'files'), 'safe.txt');
  assert.equal(safeTarget({ path: '/private/name\nSECRET' }, 'files'), null);
  assert.equal(safeTarget({ url: 'javascript:SECRET' }, 'web'), null);
});

test('missing timestamps and hostile IDs are deterministic without raw text leaks', () => {
  const r = { type: 'response_item', payload: { type: 'function_call', call_id: 'call', name: 'PRIVATE\nTOOL' } };
  const first = normalizeCodex(r, { sessionId: 'PRIVATE\nSESSION' })[0];
  const second = normalizeCodex(r, { sessionId: 'PRIVATE\nSESSION' })[0];
  assert.equal(first.id, second.id);
  assert.equal(first.timestamp, new Date(0).toISOString());
  assert.doesNotMatch(JSON.stringify(first), /PRIVATE/);
});

test('known single nested wrapper tool informs category without inventing a child call', () => {
  for (const [tool, category] of [['exec_command', 'shell'], ['apply_patch', 'files'], ['web__run', 'web'], ['spawn_agent', 'agents']]) {
    const ctx = context();
    const events = normalizeCodex(codex({ type: 'custom_tool_call', call_id: 'wrapper', name: 'exec', input: `text(await tools.${tool}({code: "PRIVATE"}));` }), ctx);
    assert.equal(events.length, 1);
    assert.equal(events[0].toolType, category);
    assert.equal(events[0].tool, 'exec');
    assert.equal(events[0].target, null);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
    const finish = normalizeCodex(codex({ type: 'custom_tool_call_output', call_id: 'wrapper', output: { exit_code: 0 } }), ctx)[0];
    assert.equal(finish.callId, events[0].callId);
    assert.equal(finish.toolType, category);
  }
  for (const input of [
    'await tools.exec_command({}); await tools.apply_patch({});',
    'text("await tools.exec_command({})");',
    '// await tools.exec_command({})\ntext(1)',
    'const pattern = /tools.exec_command()/; text(pattern);',
    'await tools.unknown_tool({});',
  ]) assert.equal(normalizeCodex(codex({ type: 'custom_tool_call', call_id: 'wrapper', name: 'exec', input }), context())[0].toolType, 'other');
});
