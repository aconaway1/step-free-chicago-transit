// RunLog: a SQLite-backed Durable Object holding one row per request to Metra's feed (scheduled and page-visit),
// for /status and for the evidence we send Metra about their WAF blocking Cloudflare. One instance ('metra'), so
// every write goes through a single object: no lost updates (the KV list it replaced dropped runs when a cron run
// and a page visit wrote at the same time, Oct 13). Keeps 8 days.
import { DurableObject } from 'cloudflare:workers';

const KEEP_MS = 8 * 24 * 3600 * 1000;
const RECENT = 40;
const REPORT_TTL_MS = 10 * 60 * 1000;   // a write clears it sooner
const COLS = ['at', 'source', 'run', 'attempt', 'status', 'ok', 'ms', 'colo', 'server', 'gateway', 'ratelimit', 'error', 'approx'];

export class RunLog extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS tries (id INTEGER PRIMARY KEY, at TEXT, source TEXT, run TEXT,
      attempt INTEGER, status INTEGER, ok INTEGER, ms INTEGER, colo TEXT, server TEXT, gateway INTEGER, error TEXT,
      approx INTEGER DEFAULT 0)`);
    // Added Oct 13 after the first deploy: Metra's x-ratelimit-limit/remaining/reset as one string.
    if (!this.sql.exec('PRAGMA table_info(tries)').toArray().some(c => c.name === 'ratelimit'))
      this.sql.exec('ALTER TABLE tries ADD COLUMN ratelimit TEXT');
    this.sql.exec('CREATE INDEX IF NOT EXISTS tries_at ON tries(at)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
  }

  insert(t) {
    this.sql.exec(`INSERT INTO tries (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`,
      t.at, t.source, t.run, t.attempt, t.status, t.ok ? 1 : 0, t.ms ?? null, t.colo || '', t.server || '',
      t.gateway ? 1 : 0, t.ratelimit || '', t.error || '', t.approx ? 1 : 0);
  }

  // One-time import of the history kept in KV before this log existed (Oct 12 8:30 PM CT onward). Those entries
  // only had each run's start time, so per-request times are reconstructed (start + 45 s per retry) and flagged
  // approx; runs that KV lost are missing.
  async importLegacy() {
    if (this.sql.exec("SELECT 1 FROM meta WHERE k = 'legacy'").toArray().length) return;
    const runs = (this.env.CACHE && await this.env.CACHE.get('metra-runs', 'json')) || [];
    for (const r of runs) {
      const n = r.attempts || 1;
      for (let i = 1; i <= n; i++) {
        const ok = r.ok && i === n;
        const status = ok ? 200 : Number((/(\d{3})/.exec(r.errors?.[i - 1] || '') || [])[1]) || 0;
        this.insert({ at: new Date(Date.parse(r.at) + (i - 1) * 45000).toISOString(), source: r.source || 'cron',
          run: `${r.source || 'cron'} ${r.at}`, attempt: i, status, ok, error: ok ? '' : r.errors?.[i - 1] || '', approx: true });
      }
    }
    this.sql.exec("INSERT INTO meta (k, v) VALUES ('legacy', ?)", String(runs.length));
  }

  async record(tries) {
    await this.importLegacy();
    for (const t of tries) this.insert(t);
    this.sql.exec('DELETE FROM tries WHERE at < ?', new Date(Date.now() - KEEP_MS).toISOString());
    this.cached = null;
  }

  // One table scan, aggregated here, and kept until the next write. The first version ran seven GROUP BY queries,
  // each a full scan, on every /api/status call; with /status open (it reloads every minute) that used up the free
  // plan's 5 million rows_read a day (Oct 19), and every Durable Object read failed until 00:00 UTC.
  async report() {
    await this.importLegacy();
    if (this.cached && Date.now() - this.cached.at < REPORT_TTL_MS) return this.cached.report;
    const rows = this.sql.exec(`SELECT id, ${COLS.join(',')} FROM tries`).toArray()
      .sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id);
    const group = (list, key, extra) => {
      const m = new Map();
      for (const r of list) {
        const k = key(r);
        let g = m.get(k);
        if (!g) m.set(k, g = { ...extra(r), tries: 0, ok: 0, blocked: 0, gateway: 0, runs: new Set() });
        g.tries++; g.ok += r.ok; g.blocked += r.status === 403; g.gateway += r.gateway; g.runs.add(r.run);
        g.first ??= r.at; g.last = r.at; g.approx = Math.max(g.approx ?? 0, r.approx);
      }
      return [...m.values()].map(g => ({ ...g, runs: g.runs.size }));
    };
    const exact = rows.filter(r => !r.approx);
    const statuses = new Map();
    for (const r of rows) { const k = `${r.source} ${r.status}`; statuses.set(k, statuses.get(k) || { source: r.source, status: r.status, n: 0 }).get(k).n++; }
    const bySourceThen = k => (a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : b[k] - a[k];
    const report = {
      since: rows[0]?.at || null,
      exactSince: exact[0]?.at || null,
      totals: group(rows, r => r.source, r => ({ source: r.source })).map(({ first, last, approx, ...t }) => t),
      statuses: [...statuses.values()].sort(bySourceThen('n')),
      colos: group(exact, r => `${r.source} ${r.colo}`, r => ({ source: r.source, colo: r.colo }))
        .map(({ approx, ...c }) => c).sort(bySourceThen('tries')),
      hourly: group(rows, r => `${r.at.slice(0, 13)} ${r.source}`, r => ({ hour: `${r.at.slice(0, 13)}:00:00Z`, source: r.source }))
        .map(({ first, last, ...h }) => h).sort((a, b) => a.hour < b.hour ? 1 : a.hour > b.hour ? -1 : 0),
      recent: rows.slice(-RECENT).reverse().map(({ id, ...r }) => r),
    };
    this.cached = { at: Date.now(), report };
    return report;
  }

  async csv() {
    await this.importLegacy();
    const cell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
    const rows = this.sql.exec(`SELECT ${COLS.join(',')} FROM tries ORDER BY at, id`).toArray();
    return [COLS.join(','), ...rows.map(r => COLS.map(c => cell(r[c])).join(','))].join('\n') + '\n';
  }
}
