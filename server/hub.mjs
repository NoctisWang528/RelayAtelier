import { EventEmitter } from 'node:events';
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { agentId, normalizeClaude, normalizeCodex, normalizeOpenCode } from './adapters.mjs';

const SOURCES = ['codex', 'claude', 'opencode'];
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
            if (first?.type === 'session_meta') onRecord(first);
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
            if (record && typeof record === 'object') onRecord(record);
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

async function jsonlFiles(root) {
  const files = [];
  let directories = 0, limited = false;
  async function visit(directory) {
    if (++directories > 512) { limited = true; return; }
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      if (files.length >= 2048) { limited = true; return; }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
  }
  await visit(root);
  const dated = await Promise.all(files.map(async path => {
    try { return { path, modified: (await stat(path)).mtimeMs }; } catch (error) { if (!missing(error)) throw error; return null; }
  }));
  return { paths: dated.filter(Boolean).sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path)).slice(0, MAX_FILES).map(file => file.path), discovered: files.length, limited };
}

export class SourceHub extends EventEmitter {
  constructor({ roots, pollMs = 1200 } = {}) {
    super();
    this.roots = roots === undefined ? {
      codex: join(homedir(), '.codex', 'sessions'),
      claude: join(homedir(), '.claude', 'projects'),
      opencode: join(homedir(), '.local', 'share', 'opencode', 'opencode.db'),
    } : { ...roots };
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
    this._sources = new Map(SOURCES.map(source => [source, { source, status: 'missing', files: 0, lastEventAt: null, detail: 'Not started' }]));
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
    }
  }

  stop() {
    this._running = false;
    clearInterval(this._timer);
    this._closeDatabase();
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
      label: `${context.source === 'codex' ? 'Codex' : context.source === 'claude' ? 'Claude' : 'OpenCode'} ${opaque(id).slice(0, 6)}`,
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
    for (const source of SOURCES) {
      if (!this._running) break;
      const root = this.roots[source];
      if (!root) { this._source(source, { status: 'missing', files: 0, detail: 'Source root not configured' }); continue; }
      const live = !initial && this._sources.get(source).status === 'connected';
      try {
        if (source === 'opencode') await this._readDatabase(root, live);
        else await this._readJsonl(source, root, live);
      } catch (error) {
        if (source === 'opencode') this._closeDatabase();
        this._source(source, {
          status: missing(error) ? 'missing' : 'error', files: 0,
          detail: missing(error) ? 'Source not found; retrying' : error?.code === 'SQLITE_UNAVAILABLE'
            ? 'OpenCode blocked: node:sqlite is unavailable in this runtime; retrying'
            : 'Read failed or unsupported source schema; retrying',
        });
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

  async _readJsonl(source, root, live) {
    const info = await stat(root);
    let scan = this._scans.get(source);
    if (!scan || scan.root !== root || scan.modified !== info.mtimeMs || Date.now() >= scan.next || !live) {
      scan = { ...await jsonlFiles(root), root, modified: info.mtimeMs, next: Date.now() + 5000 };
      this._scans.set(source, scan);
      const selected = new Set(scan.paths);
      for (const path of this._tails.keys()) {
        if (this._contexts.get(path)?.source === source && !selected.has(path)) this._tails.delete(path);
      }
    }
    const { paths } = scan;
    let malformed = 0, skippedBytes = 0, budget = SOURCE_BYTES;
    for (const path of paths) {
      if (!this._running) return;
      let tail = this._tails.get(path);
      if (!tail) { tail = new JsonlTail(path); this._tails.set(path, tail); }
      let context = this._contexts.get(path);
      if (!context) {
        const filename = basename(path, '.jsonl');
        context = { sessionId: source === 'codex' ? filename.match(/[a-f\d-]{36}$/i)?.[0] ?? opaque(path) : filename, parents: this._parents, agentStates: this._agentStates };
        if (source === 'claude' && basename(dirname(path)) === 'subagents') {
          context.sessionId = basename(dirname(dirname(path)));
          context.childId = basename(path, '.jsonl').replace(/^agent-/, '');
        }
        this._contexts.set(path, context);
      }
      try {
        const before = tail.bytesRead;
        await tail.read(record => {
          const events = source === 'codex' ? normalizeCodex(record, context) : normalizeClaude(record, context);
          this._session(context);
          this._accept(events, live);
        }, { maxBytes: Math.min(FILE_BYTES, budget) });
        budget = Math.max(0, budget - (tail.bytesRead - before));
      } catch (error) { if (!missing(error)) throw error; }
      malformed += tail.malformed;
      skippedBytes += tail.skippedBytes;
    }
    this._source(source, {
      status: paths.length ? 'connected' : 'missing', files: paths.length,
      detail: paths.length ? `Read-only JSONL; watching ${paths.length}/${scan.discovered}${scan.limited ? '+' : ''} discovered files; ${skippedBytes} historical/backlog bytes skipped; ${malformed} malformed/oversized records skipped` : 'No session JSONL files; rescanning',
    });
  }

  _closeDatabase() {
    this._db?.close();
    this._db = null;
    this._dbIdentity = null;
    this._dbVersion = null;
  }

  async _readDatabase(root, live) {
    const path = root.endsWith('.db') ? root : join(root, 'opencode.db');
    const info = await stat(path);
    if (!this._db || this._dbIdentity !== fingerprint(info)) {
      this._closeDatabase();
      let DatabaseSync;
      try { ({ DatabaseSync } = await import('node:sqlite')); }
      catch { throw Object.assign(new Error('SQLite unavailable'), { code: 'SQLITE_UNAVAILABLE' }); }
      if (typeof DatabaseSync !== 'function') throw Object.assign(new Error('SQLite unavailable'), { code: 'SQLITE_UNAVAILABLE' });
      if (!this._running) return;
      this._db = new DatabaseSync(path, { readOnly: true });
      this._dbIdentity = fingerprint(info);
      this._dbTables = new Set(this._db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session', 'session_v2', 'part', 'session_message')").all().map(row => row.name));
      if (!this._dbTables.has('part') && !this._dbTables.has('session_message')) throw new Error('Unsupported schema');
    }
    const version = this._db.prepare('PRAGMA data_version').get().data_version;
    if (version === this._dbVersion) return;
    // Read a coherent snapshot, including the WAL, without opening any writable connection.
    this._db.exec('BEGIN');
    try {
      for (const table of ['session', 'session_v2']) {
        if (!this._dbTables.has(table)) continue;
        for (const row of this._db.prepare(`SELECT id, parent_id FROM ${table}`).all()) {
          const context = this._databaseContext(row.id);
          context.parentAgentId = row.parent_id ? agentId('opencode', row.parent_id) : null;
          if (context.parentAgentId) this._parents.set(context.agentId, context.parentAgentId);
          this._session(context);
        }
      }
      const consume = (row, part) => {
        const context = this._databaseContext(row.session_id);
        context.recordKey = row.id;
        context.timestamp = row.time_updated;
        this._session(context);
        this._accept(normalizeOpenCode(part, context), live);
      };
      // Project only tool records. Prompts, titles, text, reasoning and result bodies are not selected.
      if (this._dbTables.has('part')) {
        const rows = this._db.prepare(`SELECT id, session_id, time_updated,
          json_extract(data, '$.callID') AS call_id, json_extract(data, '$.tool') AS tool,
          json_extract(data, '$.state.status') AS status, json_extract(data, '$.state.input') AS input,
          json_extract(data, '$.state.time') AS time, json_extract(data, '$.state.metadata.exit') AS exit,
          json_extract(data, '$.state.metadata.exit_code') AS exit_code
          FROM part WHERE json_valid(data) AND json_extract(data, '$.type') = 'tool'`).all();
        for (const row of rows) consume(row, { type: 'tool', callID: row.call_id ?? row.id, tool: row.tool, state: {
          status: row.status, input: JSON.parse(row.input ?? '{}'), time: JSON.parse(row.time ?? '{}'), metadata: { exit: row.exit, exit_code: row.exit_code },
        } });
      }
      if (this._dbTables.has('session_message')) {
        const rows = this._db.prepare(`SELECT m.id, m.session_id, m.time_updated,
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
      this._db.exec('COMMIT');
      this._dbVersion = version;
      this._source('opencode', { status: 'connected', files: 1, detail: 'Read-only SQLite; legacy and v2 tool records; transient states between polls may be unobserved' });
    } catch (error) { this._db.exec('ROLLBACK'); throw error; }
  }

  _databaseContext(sessionId) {
    const key = `sqlite:${sessionId}`;
    if (!this._contexts.has(key)) this._contexts.set(key, { source: 'opencode', sourceSessionId: sessionId, sessionId: agentId('opencode', sessionId), agentId: agentId('opencode', sessionId), parents: this._parents, agentStates: this._agentStates });
    return this._contexts.get(key);
  }
}
