import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, rm } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { tmpdir } from 'node:os';
import { zstdCompressSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { sources, defaultSourceRoots } from '../server/source-catalog.mjs';
import { SourceHub } from '../server/hub.mjs';
import { openSourceSettings } from '../server/source-settings.mjs';
import { startServer } from '../server/web.mjs';

const lines = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const ts = '2026-01-01T00:00:00.000Z';
const msg = (role, content) => ({ role, content });
const start = { type: 'tool_use', id: 'a', name: 'Read', input: { file_path: '/PRIVATE/doc.md' } };
const end = { type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'PRIVATE' };
const anthropic = [msg('assistant', [start]), msg('user', [end])];
const pi = [{ type: 'session', id: 's' },
  { type: 'message', timestamp: ts, message: msg('assistant', [{ type: 'toolCall', id: 'a', name: 'Read' }]) },
  { type: 'message', timestamp: ts, message: { role: 'toolResult', toolCallId: 'a', isError: true, content: 'PRIVATE' } }];
const buddy = [{ type: 'function_call', sessionId: 's', timestamp: ts, callId: 'a', id: 'request', name: 'Read' },
  { type: 'function_call_result', sessionId: 's', timestamp: ts, callId: 'a', id: 'response', status: 'failed' }];
const dsh = [{ type: 'session', id: 's' }, { type: 'tool/call', time: Date.parse(ts), data: { callId: 'a', name: 'Read' } },
  { type: 'tool/result', time: Date.parse(ts), data: { message: { content: [{ type: 'tool-result', toolCallId: 'a', isError: true }] } } }];
const gMessage = status => ({ type: 'gemini', timestamp: ts, toolCalls: [{ id: 'a', name: 'Read', status, timestamp: ts }] });
const fixtures = {
  gemini: ['session-example.json', JSON.stringify({ sessionId: 's', messages: [gMessage('executing'), gMessage('error')] })],
  copilot: ['events.jsonl', lines([{ type: 'session.start', data: { sessionId: 's' } },
    { type: 'tool.execution_start', timestamp: ts, data: { toolCallId: 'a', toolName: 'Read' } },
    { type: 'tool.execution_complete', timestamp: ts, data: { toolCallId: 'a', success: false } }])],
  qwen: ['s.jsonl', lines([{ type: 'assistant', sessionId: 's', timestamp: ts, message: { parts: [{ functionCall: { id: 'a', name: 'Read' } }] } },
    { type: 'tool_result', sessionId: 's', timestamp: ts, message: { parts: [{ functionResponse: { id: 'a', name: 'Read' } }] }, toolCallResult: { status: 'error' } }])],
  kimi: ['wire.jsonl', lines([{ type: 'ToolCall', payload: { id: 'a', function: { name: 'Read' } } },
    { type: 'ToolResult', payload: { tool_call_id: 'a', return_value: { is_error: true, output: 'PRIVATE' } } }]
    .map(message => ({ message, timestamp: Date.parse(ts) / 1000 })))],
  reasonix: ['s.jsonl', lines([{ role: 'assistant', ts, tool_calls: [{ id: 'a', name: 'Read', arguments: '{}' }] },
    { role: 'tool', ts, tool_call_id: 'a', name: 'Read', is_error: true }])],
  workbuddy: ['s.jsonl', lines(buddy)], codebuddy: ['s.jsonl', lines(buddy)],
  dsh: ['session.jsonl.zstd', Buffer.concat(dsh.map(record => zstdCompressSync(lines([record]))))],
  cline: ['s.messages.json', JSON.stringify({ sessionId: 's', updated_at: ts, messages: anthropic })],
  kilo: ['api_conversation_history.json', JSON.stringify(anthropic.map(message => ({ ...message, ts: Date.parse(ts) })))],
  droid: ['s.jsonl', lines([{ type: 'session_start', id: 's' }, ...anthropic.map(message => ({ type: 'message', timestamp: ts, message }))])],
  cherry: ['s.jsonl', lines(anthropic.map(message => ({ type: message.role, sessionId: 's', timestamp: ts, message })))],
};
for (const id of ['pi', 'omp', 'senpi', 'openclaw', 'proma']) fixtures[id] = ['s.jsonl', lines(pi)];

async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'relay-agents-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
for (const [source, [filename, bytes]] of Object.entries(fixtures)) {
  test(sources[source] + ' reads its native transcript and pairs tool events', async t => {
    const dir = await temporary(t);
    await writeFile(join(dir, filename), bytes);
    const hub = new SourceHub({ roots: { [source]: dir } });
    t.after(() => hub.stop());
    await hub.start();
    await hub._poll();
    const { events, sessions } = hub.snapshot();
    assert.deepEqual(events.map(e => e.status), ['started', 'failed']);
    assert.ok(events.every(e => e.source === source && e.timestamp === ts && e.tool === 'Read' && e.sessionId === sessions[0].id));
    assert.equal(events[0].callId, events[1].callId);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
  });
}

test('Windows and macOS derive native paths for every source and honor overrides', () => {
  const windows = defaultSourceRoots('C:\\Users\\me', { APPDATA: 'D:\\Roaming', XDG_DATA_HOME: 'D:\\Data' }, 'win32');
  const mac = defaultSourceRoots('/Users/me', { GEMINI_CLI_HOME: '/data/gemini' }, 'darwin');
  for (const id of Object.keys(sources)) {
    assert.ok([].concat(windows[id]).every(p => win32.isAbsolute(p) && !p.includes('/')));
    assert.ok([].concat(mac[id]).every(p => p.startsWith('/')));
  }
  assert.ok(windows.cline.includes('D:\\Roaming\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\tasks'));
  assert.equal(windows.opencode, 'D:\\Data\\opencode\\opencode.db');
  assert.equal(mac.gemini, '/data/gemini/tmp');
  assert.ok(mac.cherry.includes('/Users/me/Library/Application Support/CherryStudio/Data/Agents/.claude/projects'));
});

test('settings persist concurrent edits, keep default and custom folders, and stop/reseed the reader', async t => {
  const dir = await temporary(t), defaults = join(dir, 'default'), custom = join(dir, 'extra');
  await mkdir(defaults); await mkdir(custom);
  const log = join(custom, 's.jsonl');
  await writeFile(log, lines(pi));
  await writeFile(join(defaults, 'other.jsonl'), lines([{ ...pi[0], id: 'other' }, pi[1]]));
  const hub = new SourceHub({ roots: { pi: defaults }, pollMs: 60000 });
  t.after(() => hub.stop());
  const file = join(dir, 'settings.json'), settings = await openSourceSettings(file, hub);
  await hub.start();
  const live = [];
  hub.on('event', e => live.push(e));
  await Promise.all([settings.save('pi', { enabled: true, directories: [custom, custom, defaults] }),
    settings.save('omp', { enabled: false, directories: [] })]);
  assert.equal(hub.snapshot().events.length, 3);
  await settings.save('pi', { enabled: false, directories: [custom] });
  const when = new Date(Date.now() + 100).toISOString();
  const fresh = id => lines([{ ...pi[1], timestamp: when, message: msg('assistant', [{ type: 'toolCall', id, name: 'Read' }]) }]);
  await appendFile(log, fresh('disabled'));
  await hub._poll();
  assert.equal(hub.snapshot().events.length, 3);
  assert.equal(hub.snapshot().sources.find(s => s.source === 'pi').status, 'disabled');
  assert.deepEqual([...hub._tails.keys()], []);
  await settings.save('pi', { enabled: true, directories: [custom] });
  assert.equal(live.length, 0);
  await appendFile(log, fresh('enabled'));
  await hub._poll();
  assert.equal(live.length, 1);

  const another = await openSourceSettings(file, new SourceHub({ roots: {} }));
  assert.deepEqual(another.list().find(s => s.id === 'pi').directories, [custom]);
  assert.equal(another.list().find(s => s.id === 'omp').enabled, false);
  assert.throws(() => settings.save('__proto__', {}));
  assert.throws(() => settings.save('pi', { enabled: true, directories: ['relative'] }));
  await settings.save('pi', { enabled: true, directories: [] });
  await appendFile(log, fresh('removed'));
  await hub._poll();
  assert.equal(live.length, 1);
});

test('database directories stay independent across roots and providers', async t => {
  const dir = await temporary(t);
  const hub = new SourceHub({ roots: {} });
  t.after(() => hub.stop());
  for (const [source, filename] of Object.entries({ opencode: 'opencode.db', kilo: 'kilo.db', mimo: 'mimocode.db' })) {
    const roots = [];
    for (const id of ['first', 'second']) {
      const root = join(dir, source, id); roots.push(root); await mkdir(root, { recursive: true });
      const db = new DatabaseSync(join(root, filename));
      db.exec('CREATE TABLE part(id TEXT,session_id TEXT,time_updated INTEGER,data TEXT)');
      db.prepare('INSERT INTO part VALUES(?,?,?,?)').run('p', id, Date.parse(ts),
        JSON.stringify({ type: 'tool', callID: 'a', tool: 'Read', state: { status: 'completed', time: { start: Date.parse(ts), end: Date.parse(ts) } } }));
      db.close();
    }
    hub.roots[source] = roots;
  }
  await hub.start();
  const result = hub.snapshot();
  for (const source of ['opencode', 'kilo', 'mimo']) {
    assert.equal(result.sources.find(s => s.source === source).files, 2);
    assert.equal(result.events.filter(e => e.source === source).length, 4);
  }
});

test('web settings accept local authenticated JSON and reject cross-origin mutations', async t => {
  const dir = await temporary(t);
  const web = await startServer({ port: 0, hub: new SourceHub({ roots: {} }), settingsFile: join(dir, 'web.json') });
  t.after(() => web.close());
  const login = await fetch(web.url, { redirect: 'manual' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const url = web.origin + '/api/sources';
  const submit = origin => fetch(url, { method: 'POST', headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'copilot', enabled: false, directories: [dir] }) });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await submit('https://example.org')).status, 403);
  const saved = await submit(web.origin);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).find(s => s.id === 'copilot').enabled, false);
});
