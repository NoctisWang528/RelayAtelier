import { lstat, mkdir, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function getPulseFile(home = homedir()) {
  return join(home, '.relay-atelier', 'hooks', 'pulse');
}

// Called only by an explicit install. Existing content is never truncated.
export async function prepareHookSignal(home = homedir()) {
  const base = join(home, '.relay-atelier');
  for (const dir of [base, join(base, 'hooks')]) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if (!(await lstat(dir)).isDirectory()) throw new Error('Hook 信号目录需要是普通目录。');
  }
  const file = getPulseFile(home);
  try {
    const handle = await open(file, 'wx', 0o600);
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size !== 0 || stat.nlink !== 1) {
      throw new Error('本地 Hook 信号文件有冲突，请检查 ~/.relay-atelier/hooks/pulse。');
    }
  }
  return file;
}
