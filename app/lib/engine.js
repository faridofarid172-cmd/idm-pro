'use strict';

/**
 * Download engine.
 *
 * Performs real HTTP(S) downloads into the clone's storage folder, using
 * segmented Range requests when the server advertises byte ranges. Progress,
 * pause/resume, cancellation, queueing and scheduling are backed by this
 * engine; the UI only reflects engine state.
 */

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pipeline } = require('stream/promises');
const {
  safeRelative,
  safeFilename,
  uniqueFilename,
  filenameFromUrl,
  parseContentRange,
  nowIso,
  ensureDir,
  formatBytes,
} = require('./util');

const ROOT = path.join(__dirname, '..', 'storage', 'downloads');
const PARTS = path.join(__dirname, '..', 'storage', '.parts');

function normalizeTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return null;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return { h, min };
}

function httpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw Object.assign(new Error('The URL you entered is not valid.'), { status: 400 });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw Object.assign(new Error('Only http:// and https:// addresses can be downloaded.'), { status: 400 });
  }
  return u;
}

class DownloadEngine {
  constructor(store) {
    this.store = store;
    this.active = new Map();
    this.completions = [];
    this.queueTimer = null;
    this.scheduleTimer = null;
    this.lastScheduleMinute = '';
    this.lastProgressEmit = 0;
  }

  async init() {
    await ensureDir(ROOT);
    await ensureDir(PARTS);
    this.queueTimer = setInterval(() => this.tickQueue().catch((e) => console.error('queue tick', e)), 1000);
    this.scheduleTimer = setInterval(() => this.tickSchedule().catch((e) => console.error('schedule tick', e)), 15000);
    this.queueTimer.unref?.();
    this.scheduleTimer.unref?.();
  }

  dirFor(d, filename) {
    return path.join(ROOT, safeRelative(d.dir || 'Downloads'));
  }

  fileFor(d) {
    return path.join(this.dirFor(d), d.filename);
  }

  partDir(id) {
    return path.join(PARTS, id);
  }

  async probe(rawUrl, opts = {}) {
    const u = httpUrl(rawUrl);
    const headers = {};
    if (opts.userAgent) headers['User-Agent'] = opts.userAgent;
    if (opts.username || opts.password) {
      headers.Authorization =
        'Basic ' + Buffer.from(`${opts.username || ''}:${opts.password || ''}`).toString('base64');
    }
    const result = {
      url: u.toString(),
      finalUrl: u.toString(),
      filename: filenameFromUrl(u.toString()),
      size: null,
      mime: '',
      resumable: false,
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      let res;
      try {
        res = await fetch(u, { method: 'HEAD', headers, redirect: 'follow', signal: ctrl.signal });
      } catch {
        res = null;
      }
      if (!res || !res.ok) {
        // Some servers reject HEAD; probe a single byte instead.
        res = await fetch(u, {
          method: 'GET',
          headers: { ...headers, Range: 'bytes=0-0' },
          redirect: 'follow',
          signal: ctrl.signal,
        });
        const cr = parseContentRange(res.headers.get('content-range'));
        if (cr && cr.total != null) {
          result.size = cr.total;
          result.resumable = true;
        }
        if (!res.ok && res.status !== 416) {
          throw Object.assign(new Error(`Server returned ${res.status} ${res.statusText || ''}`.trim()), {
            status: 502,
          });
        }
      } else {
        const len = res.headers.get('content-length');
        if (len != null && /^\d+$/.test(len)) result.size = Number(len);
        const ranges = (res.headers.get('accept-ranges') || '').toLowerCase();
        if (ranges.includes('bytes')) result.resumable = true;
      }
      result.finalUrl = res.url || result.url;
      result.mime = (res.headers.get('content-type') || '').split(';')[0] || '';
      result.filename = filenameFromUrl(result.finalUrl, res.headers.get('content-disposition'));
      if (result.size === 0) result.resumable = false;
      this.releaseBody(res);
      return result;
    } finally {
      clearTimeout(timer);
      try {
        ctrl.abort();
      } catch {
        /* ignore */
      }
    }
  }

  releaseBody(res) {
    try {
      if (res && res.body) res.body.cancel().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  segmentsFor(size, requested) {
    const n = Math.max(1, Math.min(Number(requested) || 1, 16));
    if (!size || size <= 0) return [{ index: 0, start: 0, end: null, received: 0 }];
    const minChunk = 512 * 1024;
    let count = Math.min(n, Math.max(1, Math.floor(size / minChunk)));
    if (size < 1024 * 1024) count = 1;
    const per = Math.ceil(size / count);
    const segs = [];
    for (let i = 0; i < count; i++) {
      const start = i * per;
      const end = Math.min(size - 1, start + per - 1);
      if (start > end) break;
      segs.push({ index: i, start, end, received: 0 });
    }
    return segs;
  }

  async start(id, options = {}) {
    const d = this.store.download(id);
    if (!d) throw Object.assign(new Error('Download not found'), { status: 404 });
    if (this.active.has(id)) return d;
    if (d.status === 'complete') return d;

    const settings = this.store.settings;
    const state = {
      id,
      abort: false,
      controllers: new Set(),
      readers: new Set(),
      startedAt: Date.now(),
      window: [],
      lastBytes: 0,
      lastEmit: 0,
      lastDiskSave: 0,
    };
    this.active.set(id, state);

    // Pausing during the probe/first-byte phase must win over the start that is
    // still in flight. These checkpoints make the pause effective immediately.
    const stopIfAborted = () => {
      if (!state.abort) return false;
      if (d.status !== 'complete') {
        d.status = 'paused';
        d.statusText = 'Paused';
        d.speed = 0;
        d.lastTryAt = nowIso();
      }
      this.active.delete(id);
      this.store.save();
      this.broadcast('update', { id });
      return true;
    };

    // Probe on first start.
    if (!d.size || !d.filename || d.mime === '') {
      try {
        const info = await this.probe(d.url, {
          userAgent: settings.userAgent,
          username: d.username,
          password: d.password,
        });
        d.finalUrl = info.finalUrl;
        d.mime = info.mime;
        d.size = info.size;
        d.resumable = info.resumable;
        if (!d.filename) d.filename = info.filename;
        d.segments = this.segmentsFor(d.size, settings.maxConnections);
      } catch (err) {
        d.status = 'error';
        d.error = err.message || 'Could not connect to the server';
        d.statusText = 'Error';
        d.lastTryAt = nowIso();
        d.speed = 0;
        this.active.delete(id);
        this.store.save();
        this.broadcast('error', { id, message: d.error });
        throw err;
      }
    }

    if (stopIfAborted()) return d;

    if (!d.segments || !d.segments.length) {
      d.segments = this.segmentsFor(d.size, settings.maxConnections);
    }
    // Re-sync part lengths after a restart / pause.
    const pdir = this.partDir(id);
    await ensureDir(pdir);
    for (const seg of d.segments) {
      const f = path.join(pdir, `part${seg.index}`);
      try {
        const st = await fsp.stat(f);
        seg.received = Math.min(st.size, seg.end == null ? st.size : seg.end - seg.start + 1);
      } catch {
        seg.received = seg.received || 0;
      }
    }

    // A server without byte-range support cannot continue a partial stream.
    // Restart those downloads from the beginning instead of appending a second copy.
    if (!d.resumable) {
      const partial = d.segments.some((s) => (s.received || 0) > 0);
      if (partial) {
        await fsp.rm(pdir, { recursive: true, force: true }).catch(() => {});
        await ensureDir(pdir);
        for (const seg of d.segments) seg.received = 0;
        d.downloaded = 0;
      }
    }

    if (stopIfAborted()) return d;

    // A brand new single-part resume: if the final file already exists, avoid clobbering.
    d.status = 'downloading';
    d.error = '';
    d.statusText = '';
    d.lastTryAt = nowIso();
    d.completedAt = null;
    this.store.save();
    this.broadcast('update', { id });

    const resumed = d.segments.reduce((a, s) => a + (s.received || 0), 0);
    d.downloaded = resumed;

    const jobs = d.segments
      .filter((s) => (s.end == null ? true : s.received < s.end - s.start + 1))
      .map((seg) => this.runSegment(d, seg, state).catch((err) => this.failSegment(d, seg, err, state)));

    if (!jobs.length) {
      this.active.delete(id);
      await this.finalize(d);
      return d;
    }

    Promise.allSettled(jobs).then(async () => {
      if (!this.active.has(id)) return;
      const a = this.active.get(id);
      if (a.abort) return;
      const complete = d.segments.every((s) => s.end == null || s.received >= s.end - s.start + 1);
      if (complete) {
        this.active.delete(id);
        await this.finalize(d);
      } else if (!a.abort) {
        d.status = 'error';
        d.error = d.error || 'Download interrupted';
        d.statusText = 'Error';
        d.speed = 0;
        this.active.delete(id);
        this.store.save();
        this.broadcast('error', { id, message: d.error });
      }
    });
    return d;
  }

  async runSegment(d, seg, state) {
    const settings = this.store.settings;
    const total = seg.end == null ? null : seg.end - seg.start + 1;
    let received = seg.received || 0;
    if (total != null && received >= total) return;

    const startAt = seg.start + received;
    const endAt = seg.end == null ? '' : seg.end;
    const ctrl = new AbortController();
    state.controllers.add(ctrl);
    const headers = {};
    if (settings.userAgent) headers['User-Agent'] = settings.userAgent;
    if (d.username || d.password) {
      headers.Authorization = 'Basic ' + Buffer.from(`${d.username || ''}:${d.password || ''}`).toString('base64');
    }
    if (d.referrer) headers.Referer = d.referrer;
    if (seg.end != null) headers.Range = `bytes=${startAt}-${endAt}`;

    const res = await fetch(d.url, { headers, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok || (seg.end != null && res.status !== 206 && res.status !== 200)) {
      throw new Error(`Server returned ${res.status} ${res.statusText || ''}`.trim());
    }

    // Server ignored the range: restart this download from zero with one stream.
    if (seg.end != null && res.status === 200) {
      const len = Number(res.headers.get('content-length'));
      if (!Number.isNaN(len) && len > 0 && (d.size == null || len !== d.size)) d.size = len;
      for (const s of d.segments) {
        if (s.index !== 0) s.received = 0;
      }
      seg.start = 0;
      seg.received = 0;
      received = 0;
      seg.end = d.size ? d.size - 1 : null;
      await fsp.rm(this.partDir(d.id), { recursive: true, force: true }).catch(() => {});
      await ensureDir(this.partDir(d.id));
    }

    const partPath = path.join(this.partDir(d.id), `part${seg.index}`);
    const fh = await fsp.open(partPath, 'a');
    let limitBytes = 0;
    let limitStart = Date.now();
    try {
      for await (const chunk of res.body) {
        if (state.abort) throw Object.assign(new Error('aborted'), { aborted: true });
        const buf = Buffer.from(chunk);
        await fh.write(buf);
        received += buf.length;
        seg.received = received;
        const now = Date.now();
        state.window.push({ t: now, n: buf.length });
        while (state.window.length && now - state.window[0].t > 2500) state.window.shift();

        // Speed limiter (settings-level, shared per download).
        const limitKB = Number(settings.speedLimitKBps) || 0;
        if (settings.speedLimitEnabled && limitKB > 0) {
          limitBytes += buf.length;
          const elapsed = (now - limitStart) / 1000;
          const allowed = (limitKB * 1024 * elapsed) / Math.max(1, this.active.size);
          if (limitBytes > allowed) {
            const wait = Math.min(1000, ((limitBytes - allowed) / (limitKB * 1024)) * 1000);
            if (wait > 5) await new Promise((r) => setTimeout(r, wait));
          }
          if (elapsed > 5) {
            limitBytes = 0;
            limitStart = Date.now();
          }
        }
        this.tickProgress(d, state);
      }
      seg.received = received;
      this.tickProgress(d, state, true);
    } finally {
      await fh.close().catch(() => {});
      state.controllers.delete(ctrl);
    }
  }

  tickProgress(d, state, force = false) {
    if (this.active.get(d.id) !== state) return;
    const now = Date.now();
    d.downloaded = d.segments.reduce((a, s) => a + (s.received || 0), 0);
    if (now - state.lastEmit > 200 || force) {
      const bytes = state.window.reduce((a, x) => a + x.n, 0);
      const span = state.window.length ? Math.max(1, (now - state.window[0].t) / 1000) : 1;
      d.speed = Math.round(bytes / span);
      d.status = 'downloading';
      d.statusText = '';
      state.lastEmit = now;
      if (now - state.lastDiskSave > 4000) {
        state.lastDiskSave = now;
        this.store.persist();
      }
      this.store.emit();
    }
  }

  failSegment(d, seg, err, state) {
    if (err && err.aborted) return;
    if (this.active.get(d.id) !== state) return;
    // Other segments may still be running; only record the first error.
    if (!d.error) {
      d.error = err && err.message ? err.message : 'Unknown network error';
      d.failedSegment = seg.index;
    }
  }

  async finalize(d) {
    try {
      const dir = this.dirFor(d);
      await ensureDir(dir);
      const finalPath = path.join(dir, safeFilename(d.filename));
      const pdir = this.partDir(d.id);
      const parts = [];
      for (const seg of d.segments) {
        const p = path.join(pdir, `part${seg.index}`);
        if (fs.existsSync(p)) parts.push(p);
      }
      if (parts.length === 0) throw new Error('No downloaded data was found');
      if (parts.length === 1) {
        await fsp.copyFile(parts[0], finalPath);
      } else {
        const tmp = finalPath + '.idmtmp';
        const out = fs.createWriteStream(tmp);
        for (const p of parts) {
          await pipeline(fs.createReadStream(p), out, { end: false });
        }
        await new Promise((resolve, reject) => {
          out.end((err) => (err ? reject(err) : resolve()));
        });
        await fsp.rename(tmp, finalPath);
      }
      await fsp.rm(pdir, { recursive: true, force: true }).catch(() => {});
      d.downloaded = d.size != null ? d.size : d.downloaded;
      d.status = 'complete';
      d.statusText = 'Complete';
      d.speed = 0;
      d.completedAt = nowIso();
      d.fileExists = true;
      d.absoluteSaveTo = finalPath;
      d.saveTo = path.relative(ROOT, finalPath).split(path.sep).join('\\');
      this.store.save();
      this.broadcast('complete', { id: d.id, filename: d.filename, size: d.size });
      // Give the client a moment, then let the queue advance.
      setTimeout(() => this.tickQueue().catch(() => {}), 100);
    } catch (err) {
      console.error('finalize failed', err);
      d.status = 'error';
      d.error = `Could not finish the download: ${err.message}`;
      d.statusText = 'Error';
      d.speed = 0;
      this.store.save();
      this.broadcast('error', { id: d.id, message: d.error });
    }
  }

  async pause(id) {
    const d = this.store.download(id);
    if (!d) throw Object.assign(new Error('Download not found'), { status: 404 });
    const a = this.active.get(id);
    if (a) {
      a.abort = true;
      for (const c of a.controllers) c.abort();
      this.active.delete(id);
    }
    if (d.status === 'downloading' || d.status === 'queued') {
      d.status = 'paused';
      d.statusText = 'Paused';
      d.speed = 0;
      this.store.persist();
      this.store.emit();
    }
    return d;
  }

  async resume(id) {
    const d = this.store.download(id);
    if (!d) throw Object.assign(new Error('Download not found'), { status: 404 });
    if (d.status === 'complete') return d;
    d.status = 'paused';
    d.error = '';
    this.store.save();
    return this.start(id);
  }

  async remove(id, deleteFile) {
    const d = this.store.download(id);
    if (!d) return false;
    const a = this.active.get(id);
    if (a) {
      a.abort = true;
      for (const c of a.controllers) c.abort();
      this.active.delete(id);
    }
    await fsp.rm(this.partDir(id), { recursive: true, force: true }).catch(() => {});
    if (deleteFile) {
      const f = this.fileFor(d);
      await fsp.rm(f, { force: true }).catch(() => {});
    }
    this.store.removeDownload(id);
    this.broadcast('removed', { id });
    return true;
  }

  runningQueueIds() {
    const store = this.store;
    if (!Array.isArray(store.data.runningQueues)) store.data.runningQueues = [];
    // Keep the list in sync with deleted queues and with the legacy flag.
    const known = new Set(store.data.queues.map((q) => q.id));
    const ids = store.data.runningQueues.filter((id) => known.has(id));
    if (ids.length !== store.data.runningQueues.length) store.data.runningQueues = ids;
    return ids;
  }

  async tickQueue() {
    const store = this.store;
    const runningQueues = new Set(this.runningQueueIds());
    store.data.queueRunning = runningQueues.size > 0;
    if (!runningQueues.size) return;
    const concurrency = Math.max(1, Number(store.settings.queueConcurrency) || 1);
    const queued = store.downloads
      .filter((d) => d.queueId && runningQueues.has(d.queueId) && (d.status === 'queued' || d.status === 'paused'))
      .sort((a, b) => (a.queueRank || 0) - (b.queueRank || 0));
    const running = store.downloads.filter(
      (d) => d.status === 'downloading' && d.queueId && runningQueues.has(d.queueId)
    ).length;
    let slots = concurrency - running;
    if (slots <= 0) return;
    for (const d of queued) {
      if (slots <= 0) break;
      if (d.status === 'downloading' || this.active.has(d.id)) continue;
      slots--;
      try {
        await this.start(d.id);
      } catch {
        /* error already recorded */
      }
    }
  }

  startQueue(queueId) {
    const store = this.store;
    const ids = this.runningQueueIds();
    const targets =
      !queueId || queueId === 'all'
        ? store.data.queues.map((q) => q.id)
        : store.data.queues.filter((q) => q.id === queueId).map((q) => q.id);
    for (const id of targets) if (!ids.includes(id)) ids.push(id);
    store.data.runningQueues = ids;
    store.data.queueRunning = ids.length > 0;
    store.data.queueStartedAt = store.data.queueRunning ? nowIso() : null;
    const targetSet = new Set(targets);
    // Any paused download that belongs to a started queue is eligible.
    for (const d of store.downloads) {
      if (d.queueId && targetSet.has(d.queueId) && d.status === 'paused') d.status = 'queued';
    }
    store.save();
    this.tickQueue().catch(() => {});
  }

  stopQueue(queueId) {
    const store = this.store;
    const targets =
      !queueId || queueId === 'all'
        ? store.data.queues.map((q) => q.id)
        : store.data.queues.filter((q) => q.id === queueId).map((q) => q.id);
    const targetSet = new Set(targets);
    store.data.runningQueues = this.runningQueueIds().filter((id) => !targetSet.has(id));
    store.data.queueRunning = store.data.runningQueues.length > 0;
    store.data.queueStartedAt = store.data.queueRunning ? store.data.queueStartedAt : null;
    for (const d of store.downloads) {
      if (d.queueId && targetSet.has(d.queueId) && d.status === 'queued') d.status = 'paused';
    }
    const ids = store.downloads
      .filter((d) => d.status === 'downloading' && d.queueId && targetSet.has(d.queueId))
      .map((d) => d.id);
    store.save();
    return Promise.all(ids.map((id) => this.pause(id)));
  }

  async tickSchedule() {
    const s = this.store.data.schedule;
    if (!s.enabled) return;
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (key === this.lastScheduleMinute) return;
    const start = normalizeTime(s.startTime);
    const stop = normalizeTime(s.stopTime);
    const dayOk = !s.days || !s.days.length || s.days.includes(now.getDay());
    if (s.startEnabled && start && start.h === now.getHours() && start.min === now.getMinutes() && dayOk) {
      this.lastScheduleMinute = key;
      this.startQueue();
    }
    if (s.stopEnabled && stop && stop.h === now.getHours() && stop.min === now.getMinutes() && dayOk) {
      this.lastScheduleMinute = key;
      this.stopQueue();
    }
  }

  subscribe(fn) {
    this.subscribers = this.subscribers || new Set();
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  broadcast(type, payload) {
    if (!this.subscribers) return;
    for (const fn of this.subscribers) {
      try {
        fn(type, payload);
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = { DownloadEngine, ROOT, normalizeTime };
