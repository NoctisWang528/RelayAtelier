import { constants } from 'node:fs';
import { link, lstat, mkdir, open, rename, rmdir, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { conflict } from './json.mjs';

const changed = () => conflict('配置已由其他程序修改，请刷新后重试。');
const unsafe = () => conflict('配置路径中存在链接、特殊文件或同名目录，请检查目标位置。');
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.ctimeNs === b.ctimeNs;
const missing = error => error.code === 'ENOENT';

export async function directories(anchor, folder, create = false) {
  let path = anchor;
  for (const part of ['', ...relative(anchor, folder).split(sep).filter(Boolean)]) {
    path = join(path, part);
    if (create) await mkdir(path, { recursive: true, mode: 0o700 });
    try {
      if (!(await lstat(path)).isDirectory()) throw unsafe();
    } catch (error) {
      if (!create && missing(error)) return false;
      throw error;
    }
  }
  return true;
}

export async function snapshot(path) {
  let stat;
  try { stat = await lstat(path, { bigint: true }); }
  catch (error) { if (missing(error)) return null; throw error; }
  if (!stat.isFile() || stat.nlink !== 1n) throw unsafe();
  const fd = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    if (!same(stat, await fd.stat({ bigint: true }))) throw changed();
    const bytes = await fd.readFile();
    if (!same(stat, await fd.stat({ bigint: true }))) throw changed();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw conflict('目标文件不是有效的 UTF-8 文本。'); }
    return { stat, text };
  } finally { await fd.close(); }
}

async function checkCurrent(path, expected) {
  try {
    const current = await lstat(path, { bigint: true });
    if (!expected || !same(current, expected.stat)) throw changed();
  } catch (error) {
    if (!missing(error)) throw error;
    if (expected) throw changed();
  }
}

export async function replaceFile(path, previous, text) {
  if (text === null) {
    await checkCurrent(path, previous);
    if (previous) await unlink(path);
    return;
  }
  const temp = join(dirname(path), '.relay-' + randomUUID() + '.tmp');
  const fd = await open(temp, 'wx', 0o600);
  try {
    try {
      if (process.platform === 'win32') await restrictWindowsFile(temp);
      await fd.writeFile(text);
      if (previous) await fd.chmod(Number(previous.stat.mode & 0o777n));
      await fd.sync();
    } finally { await fd.close(); }
    await checkCurrent(path, previous);
    if (previous && process.platform === 'win32') {
      // ReplaceFile retains the destination's Windows ACL. Recheck after
      // PowerShell startup so the startup interval isn't a lost-edit window.
      try {
        await windowsCommand(`
          if ((Get-FileHash -LiteralPath $env:RELAY_DEST -Algorithm SHA256).Hash -ne $env:RELAY_HASH) { exit 76 }
          [IO.File]::Replace($env:RELAY_TEMP, $env:RELAY_DEST, [System.Management.Automation.Language.NullString]::Value)
        `, { RELAY_TEMP: temp, RELAY_DEST: path, RELAY_HASH: createHash('sha256').update(previous.text).digest('hex') });
      } catch (error) { if (error.code === 76) throw changed(); throw error; }
    } else if (previous) await rename(temp, path);
    else await link(temp, path); // Atomic create-if-absent, including a racing external creator.
  } finally {
    await unlink(temp).catch(error => { if (!missing(error)) throw error; });
  }
}

// All manager instances sharing this host target take the same lock. Never
// reclaim a live or ambiguous lock by age. The UI can report a crashed owner.
export async function withLock(target, run) {
  const lock = target + '.relay-atelier.lock';
  for (let attempt = 0; ; attempt++) {
    try { await mkdir(lock, { mode: 0o700 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (attempt >= 80) throw conflict('配置正在被操作。若应用此前异常退出，请关闭其他实例，检查目标旁的 .relay-atelier.lock 目录后重试。');
      await delay(25);
    }
  }
  try { return await run(); }
  finally { await rmdir(lock); }
}

function windowsCommand(script, env) {
  return promisify(execFile)(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference = 'Stop'\n" + script],
    { windowsHide: true, env: { ...process.env, ...env } });
}

function restrictWindowsFile(file) {
  return windowsCommand(`
$user = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($user, 'FullControl', 'Allow'))
[IO.File]::SetAccessControl($env:RELAY_PRIVATE_FILE, $acl)
`, { RELAY_PRIVATE_FILE: file });
}

export async function backup(folder, id, previous) {
  const file = join(folder, id + '-' + randomUUID() + '.bak');
  const fd = await open(file, 'wx', 0o600);
  try {
    // chmod has no user-only read semantics on Windows. Restrict the ACL
    // while the fresh backup is still empty, before copying any settings.
    if (process.platform === 'win32') await restrictWindowsFile(file);
    await fd.writeFile(previous.text);
    await fd.sync();
  } finally { await fd.close(); }
}
