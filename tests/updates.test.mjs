import assert from 'node:assert/strict';
import test from 'node:test';
import { latestRelease } from '../desktop/updates.cjs';
const response = tag_name => async () => ({ ok: true, json: async () => ({ tag_name }) });
test('compare public release components numerically and link only to the project', async () => {
  assert.deepEqual(await latestRelease('1.1.2', response('v1.10.0')), { tag: 'v1.10.0', newer: true,
    url: 'https://github.com/NoctisWang528/RelayAtelier/releases/tag/v1.10.0' });
  for (const tag of ['v1.1.2', 'v1.0.99']) assert.equal((await latestRelease('1.1.2', response(tag))).newer, false);
  for (const tag of ['v1.2.0-beta.1', 'https://example.org', null]) await assert.rejects(latestRelease('1.0.1', response(tag)));
  await assert.rejects(latestRelease('1.0.1', async () => ({ ok: false, status: 403 })));
});

test('automatic checks notify once, coalesce manual checks, and stay quiet offline', async () => {
  const { createUpdateChecker } = await import('../desktop/updates.cjs');
  let fetchCount = 0, offline = false;
  const messages = [], opened = [];
  const check = createUpdateChecker({
    current: '1.1.0', getWindow: () => ({ isDestroyed: () => false }),
    fetchRelease: async () => { fetchCount++; if (offline) throw new Error('offline'); return response('v1.2.0')(); },
    dialog: { showMessageBox: async (_win, options) => { messages.push(options); return { response: messages.length === 1 ? 1 : 0 }; } },
    shell: { openExternal: async url => opened.push(url) },
  });
  await Promise.all([check(), check(true)]);
  assert.equal(fetchCount, 1); assert.equal(messages.length, 1); assert.deepEqual(opened, []);
  await check();
  assert.equal(messages.length, 1);
  await check(true);
  assert.deepEqual(opened, ['https://github.com/NoctisWang528/RelayAtelier/releases/tag/v1.2.0']);
  offline = true;
  await check(); assert.equal(messages.length, 2);
  await check(true); assert.match(messages[2].message, /无法检查/);
});
