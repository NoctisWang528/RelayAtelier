import { EventEmitter } from 'node:events';
import { watchFile, unwatchFile } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { zstdDecompress } from 'node:zlib';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { agentId, normalizeRecord, normalizeOpenCode } from './adapters.mjs';
import { getPulseFile } from './hook-signal.mjs';

import { sources, defaultSourceRoots, databaseNames, matchesSessionFile } from './source-catalog.mjs';
export { defaultSourceRoots };
const decompress = promisify(zstdDecompress);
const MAX_LINE = 16 * 1024 * 1024;
const FILE_BYTES = 4 * 1024 * 1024;
const SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 64;
const decode = new TextDecoder('utf-8', { fatal: true });
const missing = error => error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
const fingerprint = s => `${s.dev}:${s.ino}`;
const opaque = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
// Stable timestamp ties preserve observed pending→running and started→waiting order.
const compareEvents = (a, b) => a.timestamp.localeCompare(b.timestamp);

// Byte offsets and complete-line decoding preserve split UTF-8 and incomplete writes.
export class JsonlTail {
  constructor(path) {
    this.path = path;
    this.offset = 0;
    this.pending = Buffer.alloc(0);
    this.anchor = Buffer.alloc(0);
    this.identity = null;
    this.skipping = false;
    this.malformed = 0;
    this.skippedBytes = 0;
    this.bytesRead = 0;
  }

  async read(onRecord, { maxBytes = Infinity } = {}) {
    const file = await open(this.path, 'r');
    try {
      const info = await file.stat();
      let reset = this.identity !== fingerprint(info) || info.size < this.offset;
      if (!reset && this.anchor.length) {
        const current = Buffer.alloc(this.anchor.length);
        const { bytesRead } = await file.read(current, 0, current.length, this.offset - current.length);
        reset = bytesRead !== current.length || !current.equals(this.anchor);
      }
      if (reset) {
        this.offset = 0;
        this.pending = Buffer.alloc(0);
        this.skipping = false;
      }
      this.identity = fingerprint(info);
      if (info.size - this.offset > maxBytes) {
        if (this.offset === 0) {
          const header = Buffer.alloc(Math.min(64 * 1024, info.size));
          const { bytesRead } = await file.read(header, 0, header.length, 0);
          this.bytesRead += bytesRead;
          const end = header.indexOf(10);
          if (end !== -1) {
            let first;
            try { first = JSON.parse(decode.decode(header.subarray(0, end))); } catch { /* bounded metadata probe */ }
            if (['session_meta', 'session', 'session.start', 'session_start'].includes(first?.type)) onRecord(first);
            else if (first?.sessionId) onRecord({ sessionId: first.sessionId, agentId: first.agentId });
          }
        }
        this.skippedBytes += info.size - this.offset - maxBytes;
        this.offset = info.size - maxBytes;
        this.pending = Buffer.alloc(0);
        const previous = Buffer.alloc(1);
        await file.read(previous, 0, 1, this.offset - 1);
        this.skipping = previous[0] !== 10;
      }
      const buffer = Buffer.alloc(256 * 1024);
      while (this.offset < info.size) {
        const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, info.size - this.offset), this.offset);
        if (!bytesRead) break;
        this.bytesRead += bytesRead;
        let data = Buffer.concat([this.pending, buffer.subarray(0, bytesRead)]);
        this.offset += bytesRead;
        let start = 0, newline;
        while ((newline = data.indexOf(10, start)) !== -1) {
          const line = data.subarray(start, newline);
          if (!this.skipping && line.length <= MAX_LINE && line.length) {
            let record;
            try { record = JSON.parse(decode.decode(line)); } catch { this.malformed++; }
            if (record && typeof record === 'object') onRecord(record, info.mtimeMs);
          } else if (!this.skipping && line.length > MAX_LINE) this.malformed++;
          this.skipping = false;
          start = newline + 1;
        }
        data = data.subarray(start);
        if (data.length > MAX_LINE) {
          if (!this.skipping) this.malformed++;
          this.skipping = true;
        }
        this.pending = this.skipping ? Buffer.alloc(0) : Buffer.from(data);
      }
      this.anchor = Buffer.alloc(Math.min(128, this.offset));
      if (this.anchor.length) await file.read(this.anchor, 0, this.anchor.length, this.offset - this.anchor.length);
      if (maxBytes === 0 && this.anchor.at(-1) === 10) this.skipping = false;
    } finally { await file.close(); }
  }
}

async function sessionFiles(roots, source) {
  const files = new Set();
  let directories = 0, limited = false, readErrors = 0;
  const visited = new Set();
  async function visit(directory) {
    if (visited.has(directory)) return;
    visited.add(directory);
    if (++directories > 512) { limited = true; return; }
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (!missing(error)) readErrors++; return; }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      if (source === 'reasonix' && (entry.name.startsWith('.') ||
          (roots.includes(dirname(directory)) && basename(dirname(directory)) === 'projects' && entry.name !== 'sessions'))) continue;
      if (files.size >= 2048) { limited = true; return; }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && matchesSessionFile(source, entry.name)) files.add(path);
    }
  }
  for (const root of roots) await visit(root);
  const dated = await Promise.all([...files].map(async path => {
    try { return { path, modified: (await stat(path)).mtimeMs }; } catch (error) { if (!missing(error)) readErrors++; return null; }
  }));
  return { paths: dated.filter(Boolean).sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path)).slice(0, MAX_FILES).map(file => file.path), discovered: files.size, limited, readErrors };
}

// JSON snapshots are rewritten as a whole. Parse only complete bounded reads
// and retry partial writes on the next poll. Cache identity, never the raw body.
class SnapshotFile {
  constructor(path) {
    this.path = path;
    this.bytesRead = this.malformed = this.skippedBytes = 0;
  }
  async read(consume, { maxBytes }) {
    const file = await open(this.path, 'r');
    try {
      const info = await file.stat();
      const stamp = [fingerprint(info), info.size, info.mtimeMs, info.ctimeMs].join(':');
      if (this.stamp === stamp) return;
      if (info.size > maxBytes) { this.skippedBytes = info.size; return; }
      const buffer = Buffer.alloc(info.size);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) return;
        offset += bytesRead;
      }
      this.bytesRead += offset;
      this.skippedBytes = this.malformed = 0;
      if (this.path.endsWith('.zstd')) {
        // DSH appends independent Zstandard frames. Node may stop after one.
        const chunks = [];
        let position = 0, total = 0;
        while (position < buffer.length && total < MAX_LINE) {
          try {
            const frame = await decompress(buffer.subarray(position), { info: true, maxOutputLength: MAX_LINE - total });
            if (!frame.engine.bytesWritten) break;
            chunks.push(frame.buffer);
            total += frame.buffer.length;
            position += frame.engine.bytesWritten;
          } catch { this.malformed++; break; }
        }
        if (position < buffer.length) this.skippedBytes = buffer.length - position;
        const raw = decode.decode(Buffer.concat(chunks, total));
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          let record;
          try { record = JSON.parse(line); } catch { this.malformed++; continue; }
          consume(record);
        }
      } else {
        let record;
        try { record = JSON.parse(decode.decode(buffer)); } catch { this.malformed = 1; return; }
        consume(record, info.mtimeMs);
      }
      this.stamp = stamp;
    } finally { await file.close(); }
  }
}

export class SourceHub extends EventEmitter {
  constructor({ roots, pollMs = 1200, pulseFile = roots === undefined ? getPulseFile() : null } = {}) {
    super();
    this.roots = roots === undefined ? defaultSourceRoots() : { ...roots };
    this.pulseFile = pulseFile;
    this.pollMs = Number.isFinite(pollMs) ? Math.max(10, pollMs) : 1200;
    this.revision = 0;
    this._events = [];
    this._seen = new Set();
    this._sessions = new Map();
    this._parents = new Map();
    this._agentStates = new Map();
    this._tails = new Map();
    this._contexts = new Map();
    this._scans = new Map();
    this.settings = {};
    this._databases = new Map();
    this._sources = new Map(Object.keys(sources).map(source => [source, { source, label: sources[source], status: 'missing', files: 0, lastEventAt: null, detail: 'Not started' }]));
  }

  async start() {
    if (this._running) return this._starting;
    if (this._busy) await this._busy;
    if (this._running) return this._starting;
    this._running = true;
    this._liveAfter = Date.now();
    this._starting = this._poll(true);
    await this._starting;
    if (this._running) {
      this._timer = setInterval(() => { void this._poll(); }, this.pollMs);
      this._timer.unref?.();
      if (this.pulseFile) {
        // Sampling mtime also coalesces bursts and survives deletion/re-creation.
        this._onPulse = async (current, previous) => {
          if (!current.isFile() || previous.mtimeMs === current.mtimeMs || this._refreshQueued) return;
          this._refreshQueued = true;
          try {
            await this._busy;
            await this._poll();
          } finally {
            this._refreshQueued = false;
          }
        };
        watchFile(this.pulseFile, { persistent: false, interval: 180 }, this._onPulse);
      }
    }
  }

  stop() {
    this._running = false;
    clearInterval(this._timer);
    if (this._onPulse) {
      unwatchFile(this.pulseFile, this._onPulse);
      this._onPulse = null;
    }
    for (const path of this._databases.keys()) this._closeDatabase(path);
  }

  snapshot() {
    return {
      events: this._events.slice().sort(compareEvents).slice(-4000).map(event => ({ ...event })),
      sources: [...this._sources.values()].map(source => ({ ...source })),
      sessions: [...this._sessions.values()].map(session => ({ ...session })),
      revision: this.revision,
    };
  }

  _source(source, update) {
    const previous = this._sources.get(source);
    const next = { ...previous, ...update };
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      this._sources.set(source, next);
      this.revision++;
    }
  }

  _session(context) {
    if (!context.agentId) return;
    const id = context.sessionId;
    const previous = this._sessions.get(id);
    const session = {
      id, source: context.source, agentId: context.agentId,
      parentAgentId: this._parents.get(context.agentId) ?? context.parentAgentId ?? null,
      label: `${sources[context.source]} ${opaque(id).slice(0, 6)}`,
      lastEventAt: previous?.lastEventAt ?? null,
    };
    if (JSON.stringify(previous) !== JSON.stringify(session)) { this._sessions.set(id, session); this.revision++; }
  }

  _accept(events, live) {
    if (!this._running) return;
    for (const event of events) {
      if (this._seen.has(event.id)) continue;
      this._seen.add(event.id);
      this._events.push(event);
      this.revision++;
      const source = this._sources.get(event.source);
      if (!source.lastEventAt || source.lastEventAt < event.timestamp) this._source(event.source, { lastEventAt: event.timestamp });
      const session = this._sessions.get(event.sessionId);
      if (session && (!session.lastEventAt || session.lastEventAt < event.timestamp)) session.lastEventAt = event.timestamp;
      if (live && Date.parse(event.timestamp) >= this._liveAfter) this.emit('event', { ...event });
      else this._seededHistory = true;
    }
  }

  _poll(initial = false) {
    if (!this._running) return Promise.resolve();
    if (this._busy) return this._busy;
    this._busy = this._readSources(initial).finally(() => { this._busy = null; });
    return this._busy;
  }

  async _readSources(initial) {
    const revision = this.revision;
    this._seededHistory = false;
    for (const source of Object.keys(sources)) {
      if (!this._running) break;
      const setting = this.settings[source];
      if (setting?.enabled === false) {
        this._source(source, { status: 'disabled', files: 0, detail: '已关闭监听' });
        continue;
      }
      const roots = [...new Set([].concat(this.roots[source] ?? [], setting?.directories ?? []).map(root => resolve(root)))];
      const live = !initial && this._sources.get(source).status === 'connected';
      try {
        const readers = [];
        if (databaseNames[source]) readers.push(await this._readDatabases(source, roots, live));
        if (!databaseNames[source] || source === 'kilo') readers.push(await this._readJsonl(source, roots.filter(root => !root.endsWith('.db')), live));
        const files = readers.reduce((sum, reader) => sum + reader.files, 0);
        const status = files ? 'connected' : readers.some(reader => reader.status === 'error') ? 'error' : 'missing';
        this._source(source, { files, status, detail: readers.map(reader => reader.detail).join(' · ') });
      } catch (error) {
        this._source(source, { status: missing(error) ? 'missing' : 'error', files: 0,
          detail: missing(error) ? 'Source not found; retrying' : 'Read failed or unsupported source schema; retrying' });
      }
    }
    if (!this._running) return;
    // Parent results can arrive after a concurrently running child's first records.
    for (const entry of [...this._sessions.values(), ...this._events]) {
      const parent = this._parents.get(entry.agentId);
      if (parent && parent !== entry.parentAgentId) { entry.parentAgentId = parent; this.revision++; this._seededHistory = true; }
    }
    this._events.sort(compareEvents);
    if (this._events.length > 4000) this._events.splice(0, this._events.length - 4000);
    if (this.revision !== revision || initial) {
      const snapshot = this.snapshot();
      const { events, ...metadata } = snapshot;
      this.emit('status', { ...metadata, eventCount: events.length, sessionCount: metadata.sessions.length,
        ...(initial || this._seededHistory ? { events } : {}) });
    }
  }

  async configure(settings) {
    await this._busy;
    for (const source of Object.keys(sources)) {
      if (JSON.stringify(this.settings[source]) === JSON.stringify(settings[source])) continue;
      this._scans.delete(source);
      for (const key of this._tails.keys()) if (key.startsWith(source + '\0')) this._tails.delete(key);
      for (const [key, entry] of this._databases) if (entry.source === source) this._closeDatabase(key);
      // Re-enabled or newly selected history must not animate as fresh activity.
      this._source(source, { status: 'missing' });
    }
    this.settings = settings;
    await this._poll();
  }

  async _readJsonl(source, roots, live) {
    const available = [];
    const mtimes = [];
    let errors = 0;
    for (const root of roots) {
      try {
        const info = await stat(root);
        if (!info.isDirectory()) { errors++; continue; }
        available.push(root);
        mtimes.push(root, info.mtimeMs);
      } catch (error) { if (!missing(error)) errors++; }
    }
    const stamp = JSON.stringify(mtimes);
    let scan = this._scans.get(source);
    if (!scan || scan.stamp !== stamp || Date.now() >= scan.next) {
      scan = { ...await sessionFiles(available, source), stamp, next: Date.now() + 5000 };
      this._scans.set(source, scan);
      const selected = new Set(scan.paths.map(path => source + '\0' + path));
      for (const key of this._tails.keys()) {
        if (key.startsWith(source + '\0') && !selected.has(key)) this._tails.delete(key);
      }
    }
    const { paths } = scan;
    errors += scan.readErrors;
    let readable = 0;
    let malformed = 0, skippedBytes = 0, budget = SOURCE_BYTES;
    for (const path of paths) {
      if (!this._running) return;
      const key = source + '\0' + path;
      let tail = this._tails.get(key);
      if (!tail) {
        tail = path.endsWith('.jsonl') ? new JsonlTail(path) : new SnapshotFile(path);
        this._tails.set(key, tail);
      }
      let context = this._contexts.get(key);
      if (!context) {
        const filename = basename(path, '.jsonl');
        const fallback = source === 'codex' ? filename.match(/[a-f\d-]{36}$/i)?.[0] : source === 'claude' ? filename : null;
        const identityPath = source === 'reasonix' ? path.replace(/\.events\.jsonl$/, '.jsonl') : path;
        context = { sessionId: fallback ?? opaque(identityPath), parents: this._parents, agentStates: this._agentStates };
        if (['claude', 'cherry', 'proma'].includes(source) && basename(dirname(path)) === 'subagents') {
          context.sessionId = basename(dirname(dirname(path)));
          context.childId = basename(path, '.jsonl').replace(/^agent-/, '');
        }
        this._contexts.set(key, context);
      }
      try {
        const before = tail.bytesRead;
        await tail.read((record, fileTime) => {
          context.fileTime = fileTime;
          const events = normalizeRecord(source, record, context);
          if (events.length || source === 'codex' || source === 'claude') this._session(context);
          this._accept(events, live);
        }, { maxBytes: Math.min(tail instanceof SnapshotFile ? MAX_LINE : FILE_BYTES, budget) });
        readable++;
        budget = Math.max(0, budget - (tail.bytesRead - before));
      } catch (error) { if (!missing(error)) errors++; }
      malformed += tail.malformed;
      skippedBytes += tail.skippedBytes;
    }
    return {
      status: readable ? 'connected' : errors ? 'error' : 'missing', files: readable,
      detail: paths.length ? `Read-only; watching ${paths.length}/${scan.discovered}${scan.limited ? '+' : ''} discovered files; ${skippedBytes} historical/backlog bytes skipped; ${malformed} malformed/oversized records skipped; ${errors} read errors` : errors ? 'Read failed; retrying' : 'No session files; rescanning',
    };
  }

  _closeDatabase(path) {
    this._databases.get(path)?.db.close();
    this._databases.delete(path);
  }

  async _readDatabases(source, roots, live) {
    const paths = new Set(roots.map(root => root.endsWith('.db') ? root : join(root, databaseNames[source])));
    let files = 0, errors = 0, unavailable = false;
    for (const path of paths) {
      const key = source + '\0' + path;
      try {
        await this._readDatabase(source, path, key, live);
        files++;
      } catch (error) {
        this._closeDatabase(key);
        if (!missing(error)) errors++;
        if (error.code === 'SQLITE_UNAVAILABLE') unavailable = true;
      }
    }
    return { status: files ? 'connected' : errors ? 'error' : 'missing', files,
      detail: unavailable ? `${sources[source]} blocked: node:sqlite is unavailable in this runtime; retrying`
        : files ? `Read-only SQLite; ${files} databases; ${errors} read errors`
          : errors ? 'Read failed or unsupported source schema; retrying' : 'Source not found; retrying' };
  }

  async _readDatabase(source, path, key, live) {
    const info = await stat(path);
    let entry = this._databases.get(key);
    if (!entry || entry.identity !== fingerprint(info)) {
      this._closeDatabase(key);
      let DatabaseSync;
      try { ({ DatabaseSync } = await import('node:sqlite')); }
      catch { throw Object.assign(new Error('SQLite unavailable'), { code: 'SQLITE_UNAVAILABLE' }); }
      if (!this._running) return;
      const db = new DatabaseSync(path, { readOnly: true });
      entry = { source, db, identity: fingerprint(info) };
      this._databases.set(key, entry);
      entry.tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session', 'session_v2', 'part', 'session_message')").all().map(row => row.name));
      if (!entry.tables.has('part') && !entry.tables.has('session_message')) throw new Error('Unsupported schema');
      live = false;
    }
    const { db, tables } = entry;
    const version = db.prepare('PRAGMA data_version').get().data_version;
    if (version === entry.version) return;
    // Read a coherent snapshot, including the WAL, without opening any writable connection.
    db.exec('BEGIN');
    try {
      for (const table of ['session', 'session_v2']) {
        if (!tables.has(table)) continue;
        for (const row of db.prepare(`SELECT id, parent_id FROM ${table}`).all()) {
          const context = this._databaseContext(source, row.id);
          context.parentAgentId = row.parent_id ? agentId(source, row.parent_id) : null;
          if (context.parentAgentId) this._parents.set(context.agentId, context.parentAgentId);
          this._session(context);
        }
      }
      const consume = (row, part) => {
        const context = this._databaseContext(source, row.session_id);
        context.recordKey = row.id;
        context.timestamp = row.time_updated;
        this._session(context);
        this._accept(normalizeOpenCode(part, context), live);
      };
      // Project only tool records. Prompts, titles, text, reasoning and result bodies are not selected.
      if (tables.has('part')) {
        const rows = db.prepare(`SELECT id, session_id, time_updated,
          json_extract(data, '$.callID') AS call_id, json_extract(data, '$.tool') AS tool,
          json_extract(data, '$.state.status') AS status, json_extract(data, '$.state.input') AS input,
          json_extract(data, '$.state.time') AS time, json_extract(data, '$.state.metadata.exit') AS exit,
          json_extract(data, '$.state.metadata.exit_code') AS exit_code
          FROM part WHERE json_valid(data) AND json_extract(data, '$.type') = 'tool'`).all();
        for (const row of rows) consume(row, { type: 'tool', callID: row.call_id ?? row.id, tool: row.tool, state: {
          status: row.status, input: JSON.parse(row.input ?? '{}'), time: JSON.parse(row.time ?? '{}'), metadata: { exit: row.exit, exit_code: row.exit_code },
        } });
      }
      if (tables.has('session_message')) {
        const rows = db.prepare(`SELECT m.id, m.session_id, m.time_updated,
          json_extract(p.value, '$.id') AS call_id, json_extract(p.value, '$.name') AS tool,
          json_extract(p.value, '$.state.status') AS status, json_extract(p.value, '$.state.input') AS input,
          json_extract(p.value, '$.time') AS time, json_extract(p.value, '$.state.metadata.exit') AS exit,
          json_extract(p.value, '$.state.metadata.exit_code') AS exit_code
          FROM session_message m, json_each(CASE WHEN json_valid(m.data) THEN m.data ELSE '{}' END, '$.content') p
          WHERE m.type = 'assistant' AND json_extract(p.value, '$.type') = 'tool'`).all();
        for (const row of rows) consume(row, { type: 'tool', id: row.call_id, name: row.tool, time: JSON.parse(row.time ?? '{}'), state: {
          status: row.status, input: JSON.parse(row.input ?? '{}'), metadata: { exit: row.exit, exit_code: row.exit_code },
        } });
      }
      db.exec('COMMIT');
      entry.version = version;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  _databaseContext(source, sessionId) {
    const key = `sqlite:${source}:${sessionId}`;
    if (!this._contexts.has(key)) this._contexts.set(key, { source, sourceSessionId: sessionId, sessionId: agentId(source, sessionId), agentId: agentId(source, sessionId), parents: this._parents, agentStates: this._agentStates });
    return this._contexts.get(key);
  }
}
