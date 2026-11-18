import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { getPulseFile, prepareHookSignal } from './hook-signal.mjs';
import { backup, directories, replaceFile, snapshot, withLock } from './hooks/files.mjs';
import { conflict } from './hooks/json.mjs';
import { providers } from './hooks/providers.mjs';

function uiError(error) {
  if (error.state === 'conflict') return error;
  if (['ENOTDIR', 'ELOOP', 'EEXIST', 'EISDIR'].includes(error.code)) return conflict('目标路径有冲突，请检查配置目录和文件。');
  return new Error('无法访问本地 Hook 文件，请检查目录权限、磁盘空间和文件系统。');
}

function readReceipt(previous, target) {
  if (!previous) return null;
  try {
    const record = JSON.parse(previous.text);
    if (record.version === 1 && record.target === target && Array.isArray(record.allocations) &&
      record.allocations.every(key => typeof key === 'string')) return record;
  } catch { /* Report a safe message without quoting any config bytes. */ }
  throw conflict('本地 Hook 安装记录无效，请检查 Relay 的 hook-manager 目录。');
}

export function createHookManager({ home = homedir(), env = process.env } = {}) {
  const pulse = getPulseFile(home);
  const folder = join(home, '.relay-atelier', 'hook-manager');
  const registry = new Map(providers(home, env, pulse).map(p => {
    const key = createHash('sha256').update(p.target).digest('hex').slice(0, 24);
    const tail = relative(home, p.root);
    const outside = isAbsolute(tail) || tail === '..' || tail.startsWith('..' + sep);
    return [p.id, { ...p, anchor: outside ? p.root : home, receiptFile: join(folder, p.id + '-' + key + '.json') }];
  }));

  async function inspect(p) {
    if (!p.validRoot) throw conflict('请为 Agent 配置目录指定绝对路径。');
    const targetDir = dirname(p.target);
    const current = await directories(p.anchor, targetDir) ? await snapshot(p.target) : null;
    const previous = await directories(home, folder) ? await snapshot(p.receiptFile) : null;
    const receipt = readReceipt(previous, p.target);
    return { current, previous, receipt, plan: p.inspect(current?.text ?? null, receipt) };
  }

  async function row(p) {
    const base = { id: p.id, label: p.label, target: p.target };
    try {
      const { plan } = await inspect(p);
      if (plan.state === 'installed') {
        const dir = await directories(home, dirname(pulse));
        const stat = dir && await lstat(pulse).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (!stat || !stat.isFile() || stat.size !== 0 || stat.nlink !== 1) {
          return { ...base, state: 'partial', detail: '已登记 Hook，本地空信号文件缺失或异常。' };
        }
      }
      return { ...base, state: plan.state, detail: plan.state === 'partial' ? '部分登记缺失，可修复或移除。' : p.detail };
    } catch (error) {
      const safe = uiError(error);
      return { ...base, state: safe.state ?? 'unavailable', detail: safe.message };
    }
  }

  async function change(id, install) {
    const p = registry.get(id);
    if (!p) throw new Error('未知的 Hook 提供方。');
    try {
      // An absent removal is read-only, including on a fresh home.
      if (!p.validRoot) throw conflict('请为 Agent 配置目录指定绝对路径。');
      if (!install && !await directories(p.anchor, dirname(p.target))) {
        if (!await directories(home, folder) || !await snapshot(p.receiptFile)) return;
      }
      await directories(p.anchor, dirname(p.target), true);
      await withLock(p.target, async () => {
        const { current, previous, receipt, plan } = await inspect(p);
        if (install) {
          try { await prepareHookSignal(home); }
          catch { throw conflict('无法准备本地空信号文件，请检查 ~/.relay-atelier/hooks/pulse 及其权限。'); }
          if (plan.state === 'installed') return;
        } else if (!receipt) return;

        const next = install ? plan.install() : plan.remove();
        await directories(home, folder, true);
        if (current && p.backupJson && next !== current.text) await backup(folder, id, current);

        // Record intent first. An interrupted install can then be repaired or
        // reversed without ever adopting a pre-existing identical hook.
        let intent;
        if (install) {
          const allocations = [...new Set([...(receipt?.allocations ?? []), ...plan.allocations])];
          if (!receipt || allocations.length !== receipt.allocations.length) {
            const record = { version: 1, target: p.target, allocations };
            await replaceFile(p.receiptFile, previous, JSON.stringify(record) + '\n');
            intent = await snapshot(p.receiptFile);
          }
        }
        try {
          if (next !== (current?.text ?? null)) await replaceFile(p.target, current, next);
        } catch (error) {
          // A competing writer won before our mutation. Do not claim its file.
          if (intent && (error.state === 'conflict' || error.code === 'EEXIST')) {
            await replaceFile(p.receiptFile, intent, previous?.text ?? null);
          }
          throw error;
        }
        if (!install) await replaceFile(p.receiptFile, previous, null);
      });
    } catch (error) { throw uiError(error); }
  }

  return {
    list: () => Promise.all([...registry.values()].map(row)),
    install: id => change(id, true),
    remove: id => change(id, false),
  };
}
