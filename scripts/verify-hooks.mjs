import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.runtime', 'playwright');
if (existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH ||= cache;
const {_electron: electron, chromium} = await import('playwright');
const runtime = path.join(root, '.runtime');
await mkdir(runtime, {recursive: true});
const temp = await mkdtemp(path.join(runtime, 'relay-hooks-ui-'));
const home = path.join(temp, process.platform === 'win32' ? 'hook home' : 'hook <b>home');
const targets = {
  codex: path.join(home, '.codex', 'hooks.json'),
  claude: path.join(home, '.claude', 'settings.json'),
  opencode: path.join(home, '.config', 'opencode', 'plugins', 'relay-atelier-pulse.js'),
};
const foreignGroup = {hooks: [{type: 'command', command: 'echo fixture'}]};
const config = {hooks: {PreToolUse: [foreignGroup]}, fixture: 'keep'};
const otherPlugin = path.join(path.dirname(targets.opencode), 'other-plugin.js');
const pluginText = '// foreign fixture\n';
const pass = name => console.log('PASS', name);
const pageErrors = [];

// Include mtimes to catch same-content rewrites when opening the dialog.
async function homeSnapshot() {
  const result = {};
  for (const file of await readdir(home, {recursive: true})) {
    const full = path.join(home, file);
    const info = await stat(full, {bigint: true});
    result[file] = info.isDirectory() ? 'directory' : [info.mtimeNs, await readFile(full, 'utf8')];
  }
  return result;
}

async function verifyWeb() {
  const {SourceHub} = await import('../server/hub.mjs');
  const {startServer} = await import('../server/web.mjs');
  const before = await homeSnapshot();
  const web = await startServer({port: 0, hub: new SourceHub({roots: {}})});
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.RELAY_BROWSER || chromium.executablePath()});
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(web.url, {waitUntil: 'domcontentloaded'});
    await page.locator('#info').click();
    const hooks = page.getByRole('region', {name: 'Agent Hooks'});
    await hooks.getByText('请在 Relay 桌面版中管理 Hook。').waitFor();
    assert.equal(await hooks.getByRole('button').count(), 0);
    assert.equal(await page.evaluate(() => typeof window.relay), 'undefined');
    const response = await page.request.post(new URL('/api/hooks/install', web.origin).href, {data: {id: 'claude'}});
    assert.equal(response.status(), 405);
    assert.deepEqual(await homeSnapshot(), before);
    pass('Web displays desktop guidance and rejects a hook write request');
  } finally {
    try { await browser?.close(); } finally { await web.close(); }
  }
}

async function verifyDesktop() {
  const before = await homeSnapshot();
  const app = await electron.launch({
    args: [root],
    env: {...process.env,
      RELAY_HOOK_TEST_HOME: home, RELAY_DATA_DIR: path.join(temp, 'electron-data')},
    timeout: 60000,
  });
  try {
    assert.equal(await app.evaluate(({app}) => app.isPackaged), false);
    const page = await app.firstWindow();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.setDefaultTimeout(10000);
    const dialog = page.getByRole('dialog', {name: '本地事件观察器'});
    const hooks = dialog.getByRole('region', {name: 'Agent Hooks'});
    const row = id => hooks.locator(`fieldset[data-hook-id="${id}"]`);
    const button = (id, name) => row(id).getByRole('button', {name, exact: true});
    async function open(trigger = '#info') {
      await page.locator(trigger).click();
      await hooks.locator('#hook-rows[aria-busy="false"]').waitFor();
      assert.equal(await hooks.getByRole('group').count(), Object.keys(targets).length);
      for (const [id, target] of Object.entries(targets)) {
        assert.equal(await row(id).locator('code').textContent(), target, 'Expected isolated target for ' + id);
      }
    }
    async function reopen() {
      await page.keyboard.press('Escape');
      await open('#connection');
    }
    async function checkState(id, state, actions) {
      await hooks.locator(`fieldset[data-hook-id="${id}"][data-state="${state}"]`).waitFor();
      assert.deepEqual(await row(id).getByRole('button').allTextContents(), actions);
    }

    await open();
    await reopen();
    for (const id of Object.keys(targets)) await checkState(id, 'absent', ['安装']);
    assert.deepEqual(await homeSnapshot(), before);
    pass('Opening and reopening inspect all three synthetic targets without changing them');

    // Observe the actual click before the IPC promise can settle.
    await hooks.evaluate(section => section.addEventListener('click', () => {
      window.hookBusyAtClick = [section.querySelector('#hook-rows').ariaBusy,
        Array.from(section.querySelectorAll('fieldset button')).every(b => b.matches(':disabled'))];
    }, {once: true}));
    for (const id of Object.keys(targets)) {
      if (id === 'codex') await button(id, '安装').press('Enter');
      else await button(id, '安装').click();
      await checkState(id, 'installed', ['移除']);
      if (id === 'codex') assert.ok(await button(id, '移除').evaluate(b => b === document.activeElement));
      if (id === 'opencode') {
        assert.ok((await readFile(targets[id], 'utf8')).trim());
      } else {
        const written = JSON.parse(await readFile(targets[id], 'utf8'));
        assert.equal(written.hooks.PreToolUse.length, 2);
        assert.ok(written.hooks.PreToolUse.some(group => group.hooks[0].command === 'echo fixture'));
      }
    }
    assert.deepEqual(await page.evaluate(() => window.hookBusyAtClick), ['true', true]);
    const installed = await homeSnapshot();
    await reopen();
    for (const id of Object.keys(targets)) await checkState(id, 'installed', ['移除']);
    assert.deepEqual(await homeSnapshot(), installed);
    pass('Install writes each selected hook, disables concurrent actions and keeps one remove button per provider');

    for (const id of ['codex', 'claude']) {
      await button(id, '移除').click();
      await checkState(id, 'absent', ['安装']);
      assert.deepEqual(JSON.parse(await readFile(targets[id], 'utf8')), config);
    }
    await rm(targets.opencode);
    await reopen();
    await checkState('opencode', 'partial', ['修复', '移除']);
    await button('opencode', '修复').click();
    await checkState('opencode', 'installed', ['移除']);
    assert.equal(await readFile(targets.opencode, 'utf8'), installed[path.relative(home, targets.opencode)][1]);
    await button('opencode', '移除').click();
    await checkState('opencode', 'absent', ['安装']);
    assert.equal(existsSync(targets.opencode), false);
    await button('opencode', '安装').click();
    await checkState('opencode', 'installed', ['移除']);
    await rm(targets.opencode);
    await reopen();
    await button('opencode', '移除').click();
    await checkState('opencode', 'absent', ['安装']);
    pass('Removal preserves both foreign command hooks and partial plugin registration can be repaired or removed');

    await writeFile(targets.opencode, pluginText, {flag: 'wx'});
    await button('opencode', '安装').click();
    await checkState('opencode', 'conflict', []);
    assert.match(await hooks.getByRole('status').textContent(), /OpenCode.*安装失败/);
    assert.equal(await readFile(targets.opencode, 'utf8'), pluginText);
    assert.equal(await readFile(otherPlugin, 'utf8'), pluginText);
    await rm(targets.opencode);
    await reopen();
    await checkState('opencode', 'absent', ['安装']);
    pass('A conflicting plugin created after inspection survives the rejected install and the dialog reports the error');

    if (process.platform !== 'win32' && process.getuid() !== 0) {
      await chmod(targets.claude, 0);
      try {
        await reopen();
        await checkState('claude', 'unavailable', []);
      } finally {
        await chmod(targets.claude, 0o600);
      }
      await reopen();
      await checkState('claude', 'absent', ['安装']);
      pass('An unreadable config reports unavailable and recovers when access returns');
    }
  } finally {
    await app.close();
  }
}

try {
  for (const target of Object.values(targets)) await mkdir(path.dirname(target), {recursive: true});
  for (const id of ['codex', 'claude']) await writeFile(targets[id], JSON.stringify(config) + '\n');
  await writeFile(otherPlugin, pluginText);
  await verifyWeb();
  await verifyDesktop();
  assert.deepEqual(pageErrors, []);
} finally {
  await rm(temp, {recursive: true, force: true});
}
