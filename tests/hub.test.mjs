import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, readFile, rename, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import { SourceHub, JsonlTail } from '../server/hub.mjs';
import { startServer } from '../server/web.mjs';
import { EventStore } from '../src/state.mjs';

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* exercised as blocked on older runtimes */ }
const line = value => `${JSON.stringify(value)}\n`;
const at = () => new Date(Date.now() + 100).toISOString();
const use = (id, timestamp = at(), extra = {}) => ({ type: 'assistant', sessionId: 'session-a', timestamp, message: { content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: '/private/汉字.md', prompt: 'PRIVATE_PROMPT' } }] }, ...extra });
const result = (id, timestamp = at()) => ({ type: 'user', sessionId: 'session-a', timestamp, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: false, content: 'PRIVATE_OUTPUT' }] } });

async function fixture(t, roots = {}) {
  const runtime = join(import.meta.dirname, '..', '.runtime');
  await mkdir(runtime, { recursive: true });
  const dir = await mkdtemp(join(runtime, 'source-test-'));
  const hub = new SourceHub({ roots, pollMs: 100000 });
  t.after(async () => { hub.stop(); await hub._busy; await rm(dir, { recursive: true, force: true }); });
  return { dir, hub };
}

async function eventually(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('polling did not observe fixture transition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('SourceHub seeds history silently, emits only new transitions and exposes detached snapshots', async t => {
  const { dir, hub } = await fixture(t);
  hub.roots.claude = dir;
  const path = join(dir, 'session-a.jsonl');
  await writeFile(path, line(use('old', '2020-01-01T00:00:00Z')) + line(result('old', '2020-01-01T00:00:01Z')));
  const events = [], statuses = [];
  hub.on('event', event => events.push(event)); hub.on('status', state => statuses.push(state));
  assert.ok(hub instanceof EventEmitter);
  await hub.start();
  assert.equal(events.length, 0);
  assert.deepEqual(hub.snapshot().events.map(e => e.status), ['started', 'completed']);
  assert.equal(hub.snapshot().sources.find(s => s.source === 'claude').status, 'connected');
  assert.equal(statuses[0].events.length, 2);
  assert.equal(statuses[0].eventCount, 2);
  assert.equal(statuses[0].sessionCount, 1);
  assert.ok(hub.snapshot().events.every(e => hub.snapshot().sessions.some(s => s.id === e.sessionId)));
  await appendFile(path, line(use('new')) + line(result('new')));
  await hub._poll();
  assert.deepEqual(events.map(e => e.status), ['started', 'completed']);
  assert.equal(events[0].callId, events[1].callId);
  assert.equal(hub.snapshot().sessions.length, 1);
  assert.ok(hub.snapshot().sessions[0].lastEventAt);
  const snap = hub.snapshot(); snap.events[0].tool = 'mutated'; snap.sources[0].status = 'mutated'; snap.sessions[0].label = 'mutated';
  assert.doesNotMatch(JSON.stringify(hub.snapshot()), /mutated|PRIVATE|private/);
  const revision = hub.revision;
  await hub._poll();
  assert.equal(hub.revision, revision);
  assert.equal(events.length, 2);
});

test('byte tail retains incomplete UTF-8 and JSON, skips malformed lines and only emits complete records', async t => {
  const { dir } = await fixture(t);
  const path = join(dir, 'utf8.jsonl');
  const bytes = Buffer.from(line({ name: '汉字', value: 1 }));
  const split = bytes.indexOf(Buffer.from('汉')) + 1;
  await writeFile(path, bytes.subarray(0, split));
  const tail = new JsonlTail(path), records = [];
  await tail.read(record => records.push(record));
  assert.deepEqual(records, []);
  await appendFile(path, bytes.subarray(split, bytes.length - 1));
  await tail.read(record => records.push(record));
  assert.deepEqual(records, []);
  await appendFile(path, '\n{bad json}\n' + line({ name: 'second' }));
  await tail.read(record => records.push(record));
  assert.deepEqual(records, [{ name: '汉字', value: 1 }, { name: 'second' }]);
  assert.equal(tail.malformed, 1);
  const offset = tail.offset;
  await tail.read(record => records.push(record));
  assert.equal(tail.offset, offset);
  assert.equal(records.length, 2);
});

test('bounded tail seeds metadata, discards partial leading lines and retains future appends', async t => {
  const { dir } = await fixture(t); const path = join(dir, 'bounded.jsonl');
  const metadata = { type: 'session_meta', payload: { id: 'known', parent_thread_id: 'parent' } };
  const recent = line({ value: 'recent' });
  await writeFile(path, line(metadata) + line({ content: 'x'.repeat(10000) }) + recent);
  const tail = new JsonlTail(path), records = [];
  await tail.read(record => records.push(record), { maxBytes: recent.length + 20 });
  assert.deepEqual(records, [metadata, { value: 'recent' }]);
  assert.ok(tail.skippedBytes > 9000);
  await appendFile(path, line({ value: 'fresh' }));
  await tail.read(record => records.push(record));
  assert.equal(records.at(-1).value, 'fresh');
  assert.equal(tail.malformed, 0);
});

test('file selection is bounded and reports omitted history without claiming it was loaded', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  for (let i = 0; i < 70; i++) await writeFile(join(dir, `session-${i}.jsonl`), line(use(`call-${i}`, '2020-01-01', { sessionId: `session-${i}` })));
  await hub.start();
  const snapshot = hub.snapshot();
  assert.equal(snapshot.sources.find(s => s.source === 'claude').files, 64);
  assert.match(snapshot.sources.find(s => s.source === 'claude').detail, /64\/70/);
  assert.equal(snapshot.sessions.length, 64);
  assert.ok(snapshot.events.every(e => snapshot.sessions.some(s => s.id === e.sessionId)));
});

test('rescanning releases retired raw line buffers while retaining safe pairing state', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  const path = join(dir, 'session-a.jsonl');
  await writeFile(path, line(use('paired', '2020-01-01')) + '{"unfinished":"PRIVATE');
  await hub.start();
  assert.ok(hub._tails.get(path).pending.length > 0);
  await rename(path, `${path}.old`); await hub._poll();
  assert.equal(hub._tails.has(path), false);
  assert.ok(hub._contexts.has(path));
  await writeFile(path, line(result('paired'))); await hub._poll();
  const events = hub.snapshot().events;
  assert.deepEqual(events.map(e => e.status), ['started', 'completed']);
  assert.equal(events[0].callId, events[1].callId);
  assert.equal(events[1].tool, 'Read');
  assert.doesNotMatch(JSON.stringify(hub.snapshot()), /PRIVATE/);
});

test('rotation, truncation and in-place regrowth reset byte offsets without replaying deduped calls', async t => {
  const { dir, hub } = await fixture(t);
  hub.roots.claude = dir;
  const path = join(dir, 'session-a.jsonl');
  await writeFile(path, line(use('first', '2020-01-01')));
  const events = []; hub.on('event', e => events.push(e));
  await hub.start();
  await rename(path, `${path}.old`);
  await writeFile(path, line(use('first', '2020-01-01')) + line(use('second')));
  await hub._poll();
  assert.equal(events.length, 1);
  await writeFile(path, line(use('third')));
  await hub._poll();
  assert.equal(events.length, 2);
  // Truncate and regrow beyond the old offset between polls, preserving the inode.
  await writeFile(path, line(use('fourth', at(), { padding: 'x'.repeat(2000) })) + line(use('fifth')));
  await hub._poll();
  assert.equal(events.length, 4);
  assert.equal(new Set(hub.snapshot().events.map(e => e.id)).size, 5);
});

test('a result in a new file preserves the original agent call metadata and deduplicates copies', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  const first = join(dir, 'first.jsonl'), second = join(dir, 'second.jsonl');
  await writeFile(first, line(use('continued', '2020-01-01'))); await hub.start();
  const live = []; hub.on('event', event => live.push(event));
  await writeFile(second, line(result('continued'))); await hub._poll();
  assert.equal(live.length, 1);
  const [start, finish] = hub.snapshot().events;
  assert.equal(start.callId, finish.callId);
  assert.equal(finish.tool, 'Read');
  assert.equal(finish.toolType, 'files');
  assert.equal(finish.target, '汉字.md');
  assert.equal(finish.status, 'completed');
  await writeFile(join(dir, 'copy.jsonl'), await readFile(first)); await hub._poll();
  assert.equal(hub.snapshot().events.length, 2);
  assert.equal(live.length, 1);
});

test('rescan discovers concurrent child sessions and copied historical logs never become Live', async t => {
  const { dir, hub } = await fixture(t);
  hub.roots.claude = dir;
  await writeFile(join(dir, 'session-a.jsonl'), line(use('parent', '2020-01-01')));
  await hub.start();
  const events = []; hub.on('event', e => events.push(e));
  const children = join(dir, 'session-a', 'subagents'); await mkdir(children, { recursive: true });
  await writeFile(join(children, 'agent-child-a.jsonl'), line(use('child-call-a', at(), { agentId: 'child-a', isSidechain: true })));
  await writeFile(join(children, 'agent-child-b.jsonl'), line(use('child-call-b', at(), { agentId: 'child-b', isSidechain: true })));
  await writeFile(join(dir, 'history.jsonl'), line(use('old-copy', '2020-01-01')));
  await hub._poll();
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map(e => e.agentId)).size, 2);
  assert.ok(events.every(e => e.parentAgentId === 'claude:session-a'));
  assert.equal(hub.snapshot().sessions.length, 3);
  assert.equal(hub.snapshot().sources.find(s => s.source === 'claude').files, 4);
});

test('session filters select parent/child subsets of 1, 2 and 3 calls, not the global total of 6', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  const path = join(dir, 'session-a.jsonl');
  const agents = [
    { id: 'claude:session-a', count: 1, extra: {} },
    { id: 'claude:session-a:worker-a', count: 2, extra: { agentId: 'worker-a', isSidechain: true } },
    { id: 'claude:session-a:worker-b', count: 3, extra: { agentId: 'worker-b', isSidechain: true } },
  ];
  const records = [];
  for (let i = 0; i < 3; i++) for (const agent of agents) {
    if (i < agent.count) records.push(use(`shared-${i}`, '2020-01-01', agent.extra));
  }
  for (let i = 0; i < 3; i++) for (const agent of [...agents].reverse()) {
    if (i < agent.count) records.push({ ...result(`shared-${i}`, '2020-01-02'), ...agent.extra });
  }
  await writeFile(path, records.map(line).join(''));
  await hub.start(); const snapshot = hub.snapshot();
  const store = new EventStore();
  for (const event of snapshot.events) store.apply(event);
  assert.equal(snapshot.sessions.length, 3);
  assert.equal(snapshot.events.length, 12);
  assert.equal(store.view('all').counts.total, 6);
  assert.equal(store.view('all').agents.length, 3);
  const selectedCalls = new Set();
  for (const agent of agents) {
    const session = snapshot.sessions.find(session => session.id === agent.id);
    assert.ok(session);
    const filtered = store.view(session.id);
    assert.equal(filtered.counts.total, agent.count);
    assert.equal(filtered.counts.completed, agent.count);
    assert.equal(filtered.counts.active, 0);
    assert.equal(snapshot.events.filter(event => event.sessionId === session.id).length, agent.count * 2);
    assert.deepEqual(filtered.agents, [{ id: session.agentId, parentId: agent.extra.agentId ? agents[0].id : null }]);
    for (const call of filtered.calls) selectedCalls.add(call.callId);
  }
  assert.equal(selectedCalls.size, 6);
});

test('late Claude child results refine existing snapshot parents without duplicating child transitions', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  const path = join(dir, 'session-a.jsonl');
  await writeFile(path, line(use('spawn', '2020-01-01', { agentId: 'worker-a' })) + line(use('child', '2020-01-01', { agentId: 'worker-b' })));
  await hub.start();
  const store = new EventStore(); for (const event of hub.snapshot().events) store.apply(event);
  const before = hub.snapshot().events.find(e => e.agentId === 'claude:session-a:worker-b');
  assert.equal(before.parentAgentId, 'claude:session-a');
  const live = [], statuses = []; hub.on('event', e => live.push(e)); hub.on('status', s => statuses.push(s));
  await appendFile(path, line({ ...result('spawn'), agentId: 'worker-a', toolUseResult: { agentId: 'worker-b' } }));
  await hub._poll();
  const snapshot = hub.snapshot(), child = snapshot.events.filter(e => e.agentId === 'claude:session-a:worker-b');
  assert.equal(child.length, 1);
  assert.equal(child[0].id, before.id);
  assert.equal(child[0].parentAgentId, 'claude:session-a:worker-a');
  assert.equal(statuses.at(-1).sessions.find(s => s.agentId === child[0].agentId).parentAgentId, child[0].parentAgentId);
  assert.ok(statuses.at(-1).events);
  for (const event of statuses.at(-1).events) store.apply(event);
  assert.equal(store.view('claude:session-a:worker-b').agents[0].parentId, child[0].parentAgentId);
  assert.equal(store.view('claude:session-a:worker-b').counts.total, 1);
  assert.equal(live.length, 1);
  assert.equal(live[0].agentId, 'claude:session-a:worker-a');
});

test('missing source reconnect and restart seed backlog without replaying it', async t => {
  const { dir, hub } = await fixture(t);
  const root = join(dir, 'sessions'); hub.roots.claude = root;
  const events = []; hub.on('event', e => events.push(e));
  await hub.start();
  assert.equal(hub.snapshot().sources.find(s => s.source === 'claude').status, 'missing');
  await mkdir(root);
  const path = join(root, 'session-a.jsonl');
  await writeFile(path, line(use('connected-backlog')));
  await hub._poll();
  assert.equal(events.length, 0);
  await appendFile(path, line(use('live'))); await hub._poll();
  assert.equal(events.length, 1);
  await rename(root, `${root}-away`); await hub._poll();
  assert.equal(hub.snapshot().sources.find(s => s.source === 'claude').status, 'missing');
  await appendFile(join(`${root}-away`, 'session-a.jsonl'), line(use('disconnected-backlog')));
  await rename(`${root}-away`, root); await hub._poll();
  assert.equal(events.length, 1);
  hub.stop();
  await appendFile(path, line(use('stopped-backlog')));
  await hub.start();
  assert.equal(events.length, 1);
  await appendFile(path, line(use('live-again'))); await hub._poll();
  assert.equal(events.length, 2);
  assert.equal(hub.snapshot().events.length, 5);
});

test('real timer polls and start is idempotent; stop prevents subsequent emissions', async t => {
  const { dir, hub } = await fixture(t);
  hub.roots.claude = dir; hub.pollMs = 15;
  const path = join(dir, 'session-a.jsonl'); await writeFile(path, '');
  const events = []; hub.on('event', e => events.push(e));
  await Promise.all([hub.start(), hub.start()]);
  const timer = hub._timer;
  await hub.start(); assert.equal(hub._timer, timer);
  await appendFile(path, line(use('timer')));
  await eventually(() => events.length === 1);
  hub.stop(); await hub._busy;
  await appendFile(path, line(use('after-stop')));
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(events.length, 1);
});

test('concurrent restart during an in-flight read installs exactly one timer', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  await writeFile(join(dir, 'session-a.jsonl'), '');
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const originalRead = hub._readJsonl.bind(hub);
  t.mock.method(hub, '_readJsonl', async (...args) => { enter(); await gate; return originalRead(...args); });
  const timers = [], originalSetInterval = globalThis.setInterval;
  t.mock.method(globalThis, 'setInterval', (...args) => { const timer = originalSetInterval(...args); timers.push(timer); return timer; });
  t.after(() => timers.forEach(clearInterval));
  const first = hub.start(); await entered; hub.stop();
  const restarted = [hub.start(), hub.start()]; release();
  await Promise.all([first, ...restarted]);
  assert.equal(timers.length, 1);
  assert.equal(hub.snapshot().sources.find(s => s.source === 'claude').status, 'connected');
});

test('snapshot caps history at 4000 and preserves start-before-finish for identical timestamps', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  const records = [];
  for (let i = 0; i < 2100; i++) records.push(use(`a${i}`, '2020-01-01'), result(`a${i}`, '2020-01-01'));
  await writeFile(join(dir, 'session-a.jsonl'), records.map(line).join(''));
  await hub.start();
  const events = hub.snapshot().events;
  assert.equal(events.length, 4000);
  const latest = new Map();
  for (const e of events) latest.set(e.callId, e.status);
  assert.ok([...latest.values()].every(status => status === 'completed'));
  const liveSnapshots = [];
  hub.on('event', () => liveSnapshots.push(hub.snapshot()));
  await appendFile(join(dir, 'session-a.jsonl'), line(use('fresh')) + line(result('fresh')));
  await hub._poll();
  assert.deepEqual(liveSnapshots.map(snapshot => snapshot.events.length), [4000, 4000]);
  assert.deepEqual(liveSnapshots.map(snapshot => snapshot.events.at(-1).status), ['started', 'completed']);
});

test('malformed records are counted without leaking their contents or preventing later events', async t => {
  const { dir, hub } = await fixture(t); hub.roots.claude = dir;
  await writeFile(join(dir, 'session-a.jsonl'), 'PRIVATE_PROMPT bad json\n' + line(use('good', '2020-01-01')));
  await hub.start();
  assert.equal(hub.snapshot().events.length, 1);
  assert.match(hub.snapshot().sources.find(s => s.source === 'claude').detail, /1 malformed/);
  assert.doesNotMatch(JSON.stringify(hub.snapshot()), /PRIVATE/);
});

function createDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT);
    CREATE TABLE session_v2 (id TEXT PRIMARY KEY, parent_id TEXT);
    CREATE TABLE part (id TEXT PRIMARY KEY, session_id TEXT, time_updated INTEGER, data TEXT);
    CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, time_updated INTEGER, data TEXT);`);
  db.prepare('INSERT INTO session VALUES (?, ?)').run('parent', null);
  db.prepare('INSERT INTO session_v2 VALUES (?, ?)').run('child', 'parent');
  return db;
}

test('SQLite pending→running replay retains observed order when source timestamps are identical', { skip: !DatabaseSync }, async t => {
  const { dir, hub } = await fixture(t); const path = join(dir, 'opencode.db'); hub.roots.opencode = path;
  const db = createDatabase(path); t.after(() => db.close());
  const tool = { type: 'tool', id: 'same-time', name: 'read', time: { created: Date.now() + 100 }, state: { status: 'pending', input: {} } };
  db.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?)').run('message', 'child', 'assistant', 1, JSON.stringify({ content: [tool] }));
  await hub.start();
  tool.state.status = 'running';
  db.prepare('UPDATE session_message SET data = ? WHERE id = ?').run(JSON.stringify({ content: [tool] }), 'message');
  await hub._poll();
  const snapshot = hub.snapshot(), store = new EventStore();
  assert.deepEqual(snapshot.events.map(event => event.status), ['waiting', 'started']);
  assert.equal(snapshot.events[0].timestamp, snapshot.events[1].timestamp);
  for (const event of snapshot.events) store.apply(event);
  assert.equal(store.view('opencode:child').calls[0].status, 'started');
  assert.ok(snapshot.events.every(event => event.parentAgentId === 'opencode:parent'));
});

test('SQLite legacy/v2 dedup, read-only open, parent identity and live WAL updates', { skip: !DatabaseSync }, async t => {
  const { dir, hub } = await fixture(t); const path = join(dir, 'opencode.db'); hub.roots.opencode = path;
  const db = createDatabase(path); t.after(() => db.close());
  db.exec('PRAGMA journal_mode=WAL');
  const part = { type: 'tool', callID: 'a', tool: 'bash', state: { status: 'completed', input: { command: 'node PRIVATE_ARGUMENTS' }, time: { start: 1000, end: 2000 }, metadata: { exit: 0 }, output: 'PRIVATE_OUTPUT' } };
  db.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run('part-a', 'child', 2000, JSON.stringify(part));
  const modern = { content: [{ type: 'tool', id: 'a', name: 'bash', time: { created: 1000, completed: 2000 }, state: part.state }], text: 'PRIVATE_PROMPT' };
  db.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?)').run('message-a', 'child', 'assistant', 2000, JSON.stringify(modern));
  const events = []; hub.on('event', e => events.push(e));
  await hub.start();
  assert.equal(hub.snapshot().sources.find(s => s.source === 'opencode').status, 'connected');
  assert.deepEqual(hub.snapshot().events.map(e => e.status), ['started', 'completed']);
  assert.ok(hub.snapshot().events.every(e => e.parentAgentId === 'opencode:parent'));
  assert.equal(events.length, 0);
  assert.throws(() => hub._db.exec("INSERT INTO session VALUES ('forbidden', NULL)"), /readonly|read.only/i);
  const now = Date.now() + 100;
  modern.content.push({ type: 'tool', id: 'b', name: 'read', time: { created: now }, state: { status: 'running', input: { filePath: '/private/safe.md' } } });
  const update = db.prepare('UPDATE session_message SET data = ?, time_updated = ? WHERE id = ?');
  update.run(JSON.stringify(modern), now, 'message-a'); await hub._poll();
  assert.deepEqual(events.map(e => e.status), ['started']);
  modern.content[1].state.status = 'error'; modern.content[1].time.completed = now + 10;
  // Equal time_updated still gets observed: data_version drives reads, not a strict timestamp cursor.
  update.run(JSON.stringify(modern), now, 'message-a'); await hub._poll();
  assert.deepEqual(events.map(e => e.status), ['started', 'failed']);
  assert.equal(events[0].callId, events[1].callId);
  assert.doesNotMatch(JSON.stringify(hub.snapshot()), /PRIVATE|private/);
});

test('SQLite observer leaves database bytes and directory files unchanged', { skip: !DatabaseSync }, async t => {
  const { dir, hub } = await fixture(t); const path = join(dir, 'opencode.db'); hub.roots.opencode = dir;
  createDatabase(path).close();
  const before = await readFile(path), files = await readdir(dir);
  await hub.start(); await hub._poll(); hub.stop();
  assert.deepEqual(await readFile(path), before);
  assert.deepEqual(await readdir(dir), files);
});

test('invalid SQLite reports a sanitized error and reconnects after atomic replacement', { skip: !DatabaseSync }, async t => {
  const { dir, hub } = await fixture(t); const path = join(dir, 'opencode.db'); hub.roots.opencode = path;
  await writeFile(path, 'PRIVATE invalid SQLite');
  await hub.start();
  assert.equal(hub.snapshot().sources.find(s => s.source === 'opencode').status, 'error');
  const replacement = join(dir, 'replacement.db'); createDatabase(replacement).close(); await rename(replacement, path);
  await hub._poll();
  assert.equal(hub.snapshot().sources.find(s => s.source === 'opencode').status, 'connected');
  assert.doesNotMatch(JSON.stringify(hub.snapshot()), /PRIVATE/);
});

test('web fallback rejects multibyte tokens and malformed request targets without crashing', async t => {
  const { hub } = await fixture(t);
  const app = await startServer({ port: 0, hub }); t.after(() => app.close());
  const invalid = new URL(app.url); invalid.searchParams.set('token', 'é'.repeat(64));
  assert.equal((await fetch(invalid)).status, 401);
  const origin = new URL(app.origin);
  const status = await new Promise((resolve, reject) => {
    const req = request({ hostname: origin.hostname, port: origin.port, path: 'http://[', headers: { Host: origin.host } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 400);
  assert.equal((await fetch(app.url, { redirect: 'manual' })).status, 303);
});
