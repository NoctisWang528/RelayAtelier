import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { getPulseFile } from '../server/hook-signal.mjs';
import { createHookManager } from '../server/hooks.mjs';
import { replaceFile, snapshot } from '../server/hooks/files.mjs';
import { commandGroup } from '../server/hooks/providers.mjs';

const ids = ['codex', 'claude', 'opencode'];
const events = ['PreToolUse', 'PostToolUse', 'Stop'];
const read = path => readFile(path, 'utf8');
async function put(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
async function fixture(t, custom = false) {
  const tmp = await mkdtemp(join(tmpdir(), 'relay-hooks-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const home = join(tmp, "user ' ${CLAUDE_PROJECT_DIR} $(echo BAD) & 例");
  await mkdir(home);
  const env = custom ? {
    CODEX_HOME: join(tmp, 'codex-root'), CLAUDE_CONFIG_DIR: join(tmp, 'claude-root'),
    OPENCODE_CONFIG_DIR: join(tmp, 'custom'), XDG_CONFIG_HOME: join(tmp, 'xdg'),
  } : {};
  const manager = createHookManager({ home, env });
  const rows = await manager.list();
  return { home, env, manager, rows, pulse: getPulseFile(home),
    target: Object.fromEntries(rows.map(r => [r.id, r.target])),
    row: async id => (await manager.list()).find(r => r.id === id),
    folder: join(home, '.relay-atelier', 'hook-manager') };
}

test('list, unknown IDs and absent removal leave an empty home untouched', async t => {
  const f = await fixture(t);
  assert.deepEqual(f.rows.map(r => r.id), ids);
  for (const r of f.rows) {
    assert.deepEqual(Object.keys(r).sort(), ['detail', 'id', 'label', 'state', 'target']);
    assert.equal(r.state, 'absent');
    await f.manager.remove(r.id);
  }
  for (const id of ['__proto__', '../codex', {}, null]) {
    await assert.rejects(f.manager.install(id), /未知/);
    await assert.rejects(f.manager.remove(id), /未知/);
  }
  assert.deepEqual(await readdir(f.home), []);
  assert.equal(f.target.codex, join(f.home, '.codex/hooks.json'));
  assert.equal(f.target.claude, join(f.home, '.claude/settings.json'));
  assert.equal(f.target.opencode, join(f.home, '.config/opencode/plugins/relay-atelier-pulse.js'));
});

test('explicit roots, marker preparation, fresh creation, idempotency and removal', async t => {
  const f = await fixture(t, true);
  assert.equal(f.target.codex, join(f.env.CODEX_HOME, 'hooks.json'));
  assert.equal(f.target.claude, join(f.env.CLAUDE_CONFIG_DIR, 'settings.json'));
  assert.equal(f.target.opencode, join(f.env.OPENCODE_CONFIG_DIR, 'plugins/relay-atelier-pulse.js'));
  const xdg = await createHookManager({ home: f.home, env: { XDG_CONFIG_HOME: f.env.XDG_CONFIG_HOME } }).list();
  assert.equal(xdg[2].target, join(f.env.XDG_CONFIG_HOME, 'opencode/plugins/relay-atelier-pulse.js'));
  await put(f.pulse, 'occupied');
  for (const id of ids) {
    await assert.rejects(f.manager.install(id), /信号/);
    await assert.rejects(read(f.target[id]), { code: 'ENOENT' });
  }
  await rm(f.pulse);
  for (const id of ids) {
    await f.manager.install(id);
    assert.equal((await f.row(id)).state, 'installed');
    const before = await lstat(f.target[id], { bigint: true });
    const files = await readdir(f.folder);
    await f.manager.install(id);
    assert.equal((await lstat(f.target[id], { bigint: true })).ctimeNs, before.ctimeNs);
    assert.deepEqual(await readdir(f.folder), files);
  }
  await rm(f.pulse);
  assert.ok((await f.manager.list()).every(r => r.state === 'partial'));
  await f.manager.install('codex');
  assert.equal(await read(f.pulse), '');
  for (const id of ids) {
    await f.manager.remove(id);
    await f.manager.remove(id);
    assert.equal((await f.row(id)).state, 'absent');
    await assert.rejects(read(f.target[id]), { code: 'ENOENT' });
  }
  assert.equal(await read(f.pulse), '');
});

for (const id of ['codex', 'claude']) {
  test(id + ' merges and restores only owned groups, with private exact-byte backups', async t => {
    const f = await fixture(t);
    const file = f.target[id];
    const original = '{\r\n "unrelated":900719925474099312345, "policy":1e-07, "hooks": {"Stop" : [ ], "PreToolUse":[{"matcher":"Read","hooks":[{"type":"command","command":"existing"}]}]}, "keep":"空"\r\n}\r\n';
    await put(file, original);
    await chmod(file, 0o640);
    await f.manager.install(id);
    const installed = await read(file);
    const hooks = JSON.parse(installed).hooks;
    assert.equal(Object.hasOwn(hooks, 'PostToolUseFailure'), id === 'claude');
    assert.equal(hooks.PreToolUse[0].matcher, 'Read');
    for (const event of events) assert.equal(hooks[event].at(-1).hooks[0].type, 'command');
    assert.match(installed, /900719925474099312345/);
    const baks = (await readdir(f.folder)).filter(p => p.endsWith('.bak'));
    assert.equal(baks.length, 1);
    assert.equal(await read(join(f.folder, baks[0])), original);
    if (process.platform !== 'win32') {
      assert.equal((await lstat(join(f.folder, baks[0]))).mode & 0o777, 0o600);
      assert.equal((await lstat(f.folder)).mode & 0o777, 0o700);
      assert.equal((await lstat(file)).mode & 0o777, 0o640);
    }
    const edited = installed.replace('"keep":"空"', '"keep":"外部编辑"');
    await writeFile(file, edited);
    await f.manager.remove(id);
    assert.equal(await read(file), original.replace('"keep":"空"', '"keep":"外部编辑"'));
    const backups = await Promise.all((await readdir(f.folder)).filter(n => n.endsWith('.bak')).map(n => read(join(f.folder, n))));
    assert.ok(backups.includes(edited));
  });
}

test('repair and partial removal preserve later foreign hooks and pre-existing containers', async t => {
  const f = await fixture(t);
  const file = f.target.claude;
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'foreign' }] };
  await put(file, '{"hooks":{}}');
  await f.manager.install('claude');
  const config = JSON.parse(await read(file));
  delete config.hooks.PostToolUseFailure;
  config.hooks.Stop.unshift(other);
  const partial = JSON.stringify(config);
  await writeFile(file, partial);
  assert.equal((await f.row('claude')).state, 'partial');
  await f.manager.install('claude');
  assert.equal((await f.row('claude')).state, 'installed');
  assert.equal(JSON.parse(await read(file)).hooks.PostToolUseFailure.length, 1);
  assert.deepEqual(JSON.parse(await read(file)).hooks.Stop[0], other);
  await writeFile(file, partial);
  await f.manager.remove('claude');
  assert.deepEqual(JSON.parse(await read(file)), { hooks: { Stop: [other] } });
  await f.manager.install('opencode');
  await rm(f.target.opencode);
  assert.equal((await f.row('opencode')).state, 'partial');
  await f.manager.install('opencode');
  assert.equal((await f.row('opencode')).state, 'installed');
});

test('foreign exact matches, changed groups, duplicates, invalid JSON and foreign plugin conflict safely', async t => {
  const f = await fixture(t);
  for (const id of ids) {
    const file = f.target[id];
    await f.manager.install(id);
    const original = await read(file);
    const variants = id === 'opencode' ? [original + '// PRIVATE', 'foreign'] : [
      original.replace('Relay Atelier · pulse', 'PRIVATE'),
      original.replace('"type": "command"', '"timeout": 60, "type": "command"'),
      original.replace('"hooks": [', '"matcher": "Read", "hooks": ['),
      original.replace('"Stop":', '"PreToolUse":'),
      '{"hooks":null}', '{"hooks":{"Stop":"PRIVATE"}}', '{"broken":"PRIVATE"', '[]',
    ];
    for (const variant of variants) {
      await writeFile(file, variant);
      const row = await f.row(id);
      assert.equal(row.state, 'conflict');
      for (const action of ['install', 'remove']) await assert.rejects(f.manager[action](id), e => /[\u3400-\u9fff]/u.test(e.message) && !e.message.includes('PRIVATE'));
      assert.equal(await read(file), variant);
    }
    await writeFile(file, original);
    await f.manager.remove(id);
    await writeFile(file, original); // Looks identical but has no ownership receipt.
    assert.equal((await f.row(id)).state, 'conflict');
    await assert.rejects(f.manager.remove(id));
    assert.equal(await read(file), original);
  }
});

test('concurrent managers serialize same-target changes without duplicate groups or backups', async t => {
  const f = await fixture(t);
  const manager = () => createHookManager({ home: f.home, env: {} });
  await put(f.target.codex, '{}');
  await Promise.all(Array.from({ length: 12 }, () => manager().install('codex')));
  assert.ok(Object.values(JSON.parse(await read(f.target.codex)).hooks).every(list => list.length === 1));
  await Promise.all(Array.from({ length: 12 }, () => manager().remove('codex')));
  assert.equal(await read(f.target.codex), '{}');
  assert.equal((await readdir(f.folder)).filter(n => n.endsWith('.bak')).length, 2);
});

test('a stale snapshot cannot overwrite or delete a newer external edit', async t => {
  const f = await fixture(t);
  const file = f.target.claude;
  await put(file, '{}');
  const previous = await snapshot(file);
  await writeFile(file, '{"external":true}');
  for (const next of ['{"relay":true}', null]) {
    await assert.rejects(replaceFile(file, previous, next), /其他程序修改/);
    assert.equal(await read(file), '{"external":true}');
  }
  await assert.rejects(replaceFile(file, null, '{}'), /其他程序修改/);
  assert.deepEqual(await readdir(dirname(file)), ['settings.json']);
});

test('unsafe paths and failed backup do not mutate host config or expose contents', async t => {
  const f = await fixture(t);
  const file = f.target.claude;
  const secret = join(f.home, 'foreign');
  await put(secret, '{"private":"PRIVATE"}');
  await mkdir(dirname(file));
  await link(secret, file);
  assert.equal((await f.row('claude')).state, 'conflict');
  await assert.rejects(f.manager.install('claude'));
  await rm(file);
  if (process.platform !== 'win32') {
    await symlink(secret, file);
    assert.equal((await f.row('claude')).state, 'conflict');
    await assert.rejects(f.manager.install('claude'));
    await rm(file);
  }
  await put(file, '{}');
  await put(f.folder, 'directory collision');
  await assert.rejects(f.manager.install('claude'));
  assert.equal(await read(secret), '{"private":"PRIVATE"}');
  assert.equal(await read(file), '{}');
});

test('command hooks ignore stdin, touch only the existing empty marker and tolerate missing markers', async t => {
  const f = await fixture(t);
  const old = new Date('2000-01-01Z');
  for (const id of ['codex', 'claude']) {
    await f.manager.install(id);
    const { command, commandWindows } = JSON.parse(await read(f.target[id])).hooks.PreToolUse[0].hooks[0];
    function fire() {
      const win = process.platform === 'win32';
      const exe = win ? (commandWindows ? process.env.ComSpec : 'powershell.exe') : '/bin/sh';
      const args = win ? (commandWindows ? ['/d', '/c', commandWindows] : ['-NoProfile', '-NonInteractive', '-Command', command]) : ['-c', command];
      const r = spawnSync(exe, args, { cwd: f.home, input: '{"command":"touch RAN","tool_input":"SECRET"}', encoding: 'utf8' });
      assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', '']);
    }
    await utimes(f.pulse, old, old);
    fire();
    assert.ok((await lstat(f.pulse)).mtime > old);
    assert.equal(await read(f.pulse), '');
    await rm(f.pulse);
    const foreign = join(f.home, id + '-other');
    await put(foreign, '');
    await utimes(foreign, old, old);
    await link(foreign, f.pulse);
    fire();
    assert.equal((await lstat(foreign)).mtimeMs, +old);
    await rm(f.pulse);
    fire();
    await assert.rejects(lstat(f.pulse), { code: 'ENOENT' });
    await assert.rejects(lstat(join(f.home, 'RAN')), { code: 'ENOENT' });
  }
});

test('Windows command templates use explicit PowerShell and keep path metacharacters literal', () => {
  const pulse = "C:\\名字 '%TEMP% & $(oops)\\pulse";
  const c = commandGroup('codex', pulse, 'win32').hooks[0];
  const h = commandGroup('claude', pulse, 'win32').hooks[0];
  assert.equal(h.shell, 'powershell');
  assert.match(c.commandWindows, /-NoProfile -NonInteractive -EncodedCommand [\w+/=]+$/);
  assert.equal(Buffer.from(c.commandWindows.split(' ').at(-1), 'base64').toString('utf16le'), h.command);
  assert.equal(Buffer.from(h.command.match(/FromBase64String\('([^']+)'\)/)[1], 'base64').toString(), pulse);
});

test('generated OpenCode module registers V2 and late V1 callbacks that never inspect arguments', async t => {
  const f = await fixture(t);
  await f.manager.install('opencode');
  const source = await read(f.target.opencode);
  const { default: plugin } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const registered = new Map();
  await plugin.setup({ tool: { hook(name, cb) { registered.set(name, cb); } } });
  assert.deepEqual([...registered.keys()], ['execute.before', 'execute.after']);
  const v1 = await plugin.server();
  assert.deepEqual(Object.keys(v1), ['tool.execute.before', 'tool.execute.after']);
  const payload = new Proxy({}, { get() { assert.fail('callback accessed payload'); } });
  const old = new Date('2000-01-01Z');
  for (const cb of [...registered.values(), ...Object.values(v1)]) {
    await utimes(f.pulse, old, old);
    await cb(payload, payload);
    assert.ok((await lstat(f.pulse)).mtime > old);
    assert.equal(await read(f.pulse), '');
  }
  await rm(f.pulse);
  await v1['tool.execute.after'](payload);
  await assert.rejects(lstat(f.pulse), { code: 'ENOENT' });
});

test('local OpenCode V2 loads the generated plugin in an isolated server', {
  skip: !process.env.RELAY_TEST_OPENCODE_BIN, timeout: 30000,
}, async t => {
  const f = await fixture(t, true);
  await f.manager.install('opencode');
  // This allowlist belongs only to the disposable server subprocess. Keep
  // home-relative fallbacks (including Git) out of the actual user's profile.
  const profile = process.platform === 'win32' ? { USERPROFILE: f.home, SystemRoot: process.env.SystemRoot } : { HOME: f.home };
  const env = {
    ...f.env, ...profile, TMPDIR: f.home, TEMP: f.home, TMP: f.home, PATH: process.env.PATH,
    XDG_DATA_HOME: join(f.home, 'data'), XDG_STATE_HOME: join(f.home, 'state'), XDG_CACHE_HOME: join(f.home, 'cache'),
    OPENCODE_PASSWORD: randomUUID(), OPENCODE_DISABLE_CLAUDE_CODE: '1', OPENCODE_DISABLE_MODELS_FETCH: '1',
  };
  const child = spawn(process.env.RELAY_TEST_OPENCODE_BIN, ['serve', '--hostname', '127.0.0.1', '--port', '0'],
    { env, cwd: f.home, stdio: ['ignore', 'pipe', 'pipe'] });
  const end = once(child, 'exit');
  try {
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; });
    const auth = Buffer.from('opencode:' + env.OPENCODE_PASSWORD).toString('base64');
    for (let i = 0; i < 100; i++) {
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        const res = await fetch(url + '/api/plugin', { headers: { Authorization: 'Basic ' + auth } });
        assert.equal(res.status, 200);
        const plugins = await res.json();
        const plugin = plugins.data.find(item => item.id === 'relay-atelier.pulse');
        if (plugin) {
          assert.deepEqual(plugin.source, { type: 'local', path: f.target.opencode });
          assert.equal(plugin.features.server, true);
          assert.equal(plugin.state.status, 'active');
          return;
        }
      }
      assert.equal(child.exitCode, null);
      await delay(100);
    }
    assert.fail('OpenCode did not report the generated plugin');
  } finally { child.kill(); await end; }
});
