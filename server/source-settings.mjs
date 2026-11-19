import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sources } from './source-catalog.mjs';

function validate(id, value) {
  if (!Object.hasOwn(sources, id) || typeof value?.enabled !== 'boolean' ||
      !Array.isArray(value.directories) || value.directories.length > 64) throw new Error('来源设置无效。');
  const directories = value.directories.map(dir => {
    if (typeof dir !== 'string' || dir.length > 4096 || /[\0\r\n]/.test(dir) || !isAbsolute(dir.trim())) {
      throw new Error('请为每个目录填写完整的绝对路径。');
    }
    return normalize(dir.trim());
  });
  return { enabled: value.enabled, directories: [...new Set(directories)] };
}

export async function openSourceSettings(file, hub) {
  let saved = {};
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    saved = Object.fromEntries(Object.entries(data).filter(([id]) => Object.hasOwn(sources, id))
      .map(([id, value]) => [id, validate(id, value)]));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('无法读取来源设置。请检查 ' + file, { cause: error });
  }
  await hub.configure(saved);
  let pending = Promise.resolve();
  const list = () => Object.entries(sources).map(([id, label]) => ({
    id, label, defaults: [].concat(hub.roots[id] ?? []),
    ...(saved[id] ?? { enabled: true, directories: [] }),
  }));
  function save(id, value) {
    const update = validate(id, value);
    const task = pending.then(async () => {
      const next = { ...saved, [id]: update };
      const temp = file + '.' + randomUUID();
      await mkdir(dirname(file), { recursive: true });
      try {
        await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600, flag: 'wx' });
        await rename(temp, file);
      } finally { await rm(temp, { force: true }); }
      saved = next;
      await hub.configure(next);
      return list();
    });
    pending = task.catch(() => {});
    return task;
  }
  return { list, save };
}
