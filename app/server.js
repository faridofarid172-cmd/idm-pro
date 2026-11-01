'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { URL } = require('url');

const { Store } = require('./lib/store');
const { DownloadEngine, ROOT } = require('./lib/engine');
const { scan: grabScan, DEFAULT_TYPES } = require('./lib/grabber');
const { parseZipCentralDirectory } = require('./lib/zip');
const {
  sendJson,
  sendError,
  readJson,
  ensureDir,
  mimeFor,
  formatBytes,
  safeRelative,
  safeFilename,
  filenameFromUrl,
  rid,
  nowIso,
} = require('./lib/util');

const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8420;
const HOST = process.env.HOST || '127.0.0.1';

const store = new Store();
const engine = new DownloadEngine(store);
const sseClients = new Set();
let lastSse = 0;

function protectedDownload(d) {
  return d;
}

function stateSnapshot() {
  return {
    settings: store.settings,
    categories: store.categories,
    downloads: store.downloads.map(protectedDownload),
    queues: store.data.queues,
    schedule: store.data.schedule,
    queueRunning: store.data.queueRunning,
    queueStartedAt: store.data.queueStartedAt,
    runningQueues: store.data.runningQueues || [],
    lastInstall: store.data.lastInstall,
    serverTime: nowIso(),
  };
}

function sseSend(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    sseClients.delete(res);
  }
}

function broadcast(event, data) {
  for (const res of sseClients) sseSend(res, event, data);
}

function broadcastState(force = false) {
  const now = Date.now();
  if (!force && now - lastSse < 400) return;
  lastSse = now;
  const payload = {
    downloads: store.downloads.map((d) => ({
      id: d.id,
      status: d.status,
      statusText: d.statusText,
      downloaded: d.downloaded,
      size: d.size,
      speed: d.speed,
      segments: d.segments,
      error: d.error,
      completedAt: d.completedAt,
      queueId: d.queueId,
      filename: d.filename,
      dir: d.dir,
      saveTo: d.saveTo,
    })),
    queueRunning: store.data.queueRunning,
    queueStartedAt: store.data.queueStartedAt,
    runningQueues: store.data.runningQueues || [],
    schedule: store.data.schedule,
    serverTime: nowIso(),
  };
  broadcast('state', payload);
}

engine.subscribe((type, payload) => {
  broadcastState(true);
  if (type === 'complete' || type === 'error') {
    broadcast('notice', { kind: type, ...payload });
  }
});

function parseRoute(url) {
  const u = new URL(url, 'http://local');
  const parts = u.pathname.split('/').filter(Boolean);
  return { pathname: u.pathname, parts, query: u.searchParams };
}

async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  rel = rel.replace(/\\/g, '/');
  if (rel.includes('..')) return sendError(res, 400, 'Bad path');
  const file = path.join(PUBLIC, rel);
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) throw new Error('dir');
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': mimeFor(file),
      'Content-Length': st.size,
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache, must-revalidate' : 'public, max-age=300',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    sendError(res, 404, 'Not found');
  }
}

async function apiInfo(query) {
  const url = query.get('url');
  if (!url) throw Object.assign(new Error('URL is required'), { status: 400 });
  const username = query.get('username') || '';
  const password = query.get('password') || '';
  const info = await engine.probe(url, { userAgent: store.settings.userAgent, username, password });
  const category = suggestCategory(info.filename, url);
  return { ...info, categoryId: category ? category.id : null, suggestedDir: category ? category.dir : store.settings.saveTo };
}

function suggestCategory(filename, url) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let byExt = store.categories.find(
    (c) => c.id !== 'cat_all' && c.extensions && c.extensions.some((e) => e.toLowerCase() === ext)
  );
  if (byExt) return byExt;
  try {
    const host = new URL(url).hostname;
    const bySite = store.categories.find((c) => c.sitePattern && host.includes(c.sitePattern.replace(/\*/g, '')));
    if (bySite) return bySite;
  } catch {
    /* ignore */
  }
  return store.categories.find((c) => c.id === 'cat_all') || null;
}

async function previewZip(url, username, password) {
  const headers = { 'User-Agent': store.settings.userAgent };
  if (username || password) {
    headers.Authorization = 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
  }
  let buf = Buffer.alloc(0);
  // Fetch the tail first: central directory lives at the end of the archive.
  const head = await fetch(url, { method: 'HEAD', headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const size = Number(head.headers.get('content-length')) || 0;
  if (size && size > 40 * 1024 * 1024) {
    throw Object.assign(new Error('The archive is too large to preview (limit 40 MB).'), { status: 413 });
  }
  const tailStart = Math.max(0, size - 128 * 1024);
  const tailRes = await fetch(url, {
    headers: { ...headers, Range: `bytes=${tailStart}-` },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!tailRes.ok && tailRes.status !== 206) {
    throw Object.assign(new Error(`Server returned ${tailRes.status}`), { status: 502 });
  }
  const tail = Buffer.from(await tailRes.arrayBuffer());
  buf = tail;
  const entries = parseZipCentralDirectory(tail);
  return {
    size,
    entries: entries.entries,
    total: entries.entries.length,
    partial: tailStart > 0,
    totalEntries: entries.total,
  };
}

const handlers = {
  'GET /api/state': async (req, res) => sendJson(res, 200, stateSnapshot()),

  'POST /api/setup': async (req, res) => {
    const body = await readJson(req);
    store.settings.installed = true;
    if (body.language) store.settings.language = body.language;
    if (body.installPath) store.settings.installPath = body.installPath;
    store.settings.createDesktopIcon = body.createDesktopIcon !== false;
    if (body.action === 'reset') {
      store.settings.installed = false;
    }
    store.data.lastInstall = nowIso();
    store.save();
    sendJson(res, 200, { ok: true, installed: store.settings.installed });
  },

  'POST /api/settings': async (req, res) => {
    const body = await readJson(req);
    const allowed = new Set(Object.keys(store.settings));
    for (const [k, v] of Object.entries(body || {})) {
      if (allowed.has(k)) store.settings[k] = v;
    }
    if (store.settings.maxConnections) {
      store.settings.maxConnections = Math.max(1, Math.min(32, Number(store.settings.maxConnections) || 8));
    }
    if (store.settings.queueConcurrency) {
      store.settings.queueConcurrency = Math.max(1, Math.min(16, Number(store.settings.queueConcurrency) || 4));
    }
    store.save();
    sendJson(res, 200, { settings: store.settings });
  },

  'POST /api/categories': async (req, res) => {
    const body = await readJson(req);
    if (!body.name) return sendError(res, 400, 'Category name is required');
    const cat = {
      id: rid('cat'),
      name: String(body.name).trim(),
      dir: body.dir || `Downloads\\${String(body.name).trim()}`,
      extensions: Array.isArray(body.extensions)
        ? body.extensions.map((e) => String(e).replace(/^\./, '').trim().toLowerCase()).filter(Boolean)
        : String(body.extensions || '')
            .split(/[\s,;]+/)
            .map((e) => e.replace(/^\./, '').trim().toLowerCase())
            .filter(Boolean),
      sitePattern: body.sitePattern || '',
      builtin: false,
    };
    store.categories.push(cat);
    store.save();
    sendJson(res, 200, { category: cat });
  },

  'GET /api/folders': async (req, res, { query }) => {
    const raw = query.get('path') || '';
    const rel = safeRelative(raw);
    const dir = path.join(ROOT, rel);
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(path.resolve(ROOT))) return sendError(res, 400, 'Invalid folder');
    await ensureDir(resolved);
    const entries = await fsp.readdir(resolved, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => a.localeCompare(b));
    const parentRel = rel.includes(path.sep) ? rel.slice(0, rel.lastIndexOf(path.sep)) : '';
    sendJson(res, 200, {
      path: rel.split(path.sep).join('\\'),
      parent: parentRel.split(path.sep).join('\\'),
      dirs,
    });
  },

  'POST /api/folders': async (req, res) => {
    const body = await readJson(req);
    const name = String(body.name || '').replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim();
    if (!name) return sendError(res, 400, 'Folder name is required');
    const base = path.join(ROOT, safeRelative(body.path || ''));
    const target = path.resolve(base, name);
    if (!target.startsWith(path.resolve(ROOT))) return sendError(res, 400, 'Invalid folder');
    await ensureDir(target);
    sendJson(res, 200, { ok: true, path: path.relative(ROOT, target).split(path.sep).join('\\') });
  },

  'GET /api/url/info': async (req, res, { query }) => sendJson(res, 200, await apiInfo(query)),

  'POST /api/url/preview': async (req, res) => {
    const body = await readJson(req);
    if (!body.url) return sendError(res, 400, 'URL is required');
    const data = await previewZip(body.url, body.username, body.password);
    sendJson(res, 200, data);
  },

  'POST /api/downloads': async (req, res) => {
    const body = await readJson(req);
    if (!body.url) return sendError(res, 400, 'URL is required');
    let info = null;
    const settings = store.settings;
    if (body.size == null || !body.filename) {
      try {
        info = await engine.probe(body.url, {
          userAgent: settings.userAgent,
          username: body.username,
          password: body.password,
        });
      } catch (err) {
        // Still allow creating a task; the error is surfaced on start.
        info = { filename: filenameFromUrl(body.url), size: null, mime: '', resumable: false };
      }
    }
    const category = body.categoryId ? store.category(body.categoryId) : null;
    const dir = body.dir || (category ? category.dir : settings.saveTo);
    const filename = safeFilename(body.filename || (info && info.filename) || filenameFromUrl(body.url));
    const targetDir = path.join(ROOT, safeRelative(dir));
    await ensureDir(targetDir);
    const uniqueName = uniqueNameFor(targetDir, filename);
    const d = store.addDownload({
      url: body.url,
      finalUrl: (info && info.finalUrl) || body.url,
      filename: uniqueName,
      dir,
      categoryId: body.categoryId || null,
      description: body.description || '',
      referrer: body.referrer || '',
      pageUrl: body.pageUrl || '',
      username: body.username || '',
      password: body.password || '',
      size: body.size != null ? Number(body.size) : info ? info.size : null,
      mime: (info && info.mime) || '',
      resumable: info ? info.resumable : false,
      segments: engine.segmentsFor(body.size != null ? Number(body.size) : info ? info.size : null, settings.maxConnections),
      status: body.start ? 'queued' : 'paused',
      queueId: body.queueId || null,
      queueRank: nextQueueRank(body.queueId),
      saveTo: `${dir}\\${uniqueName}`,
      addedAt: nowIso(),
      isGrab: !!body.isGrab,
      grabPage: body.grabPage || '',
    });
    if (body.queueId) d.status = 'queued';
    store.save();
    if (body.start) {
      engine.start(d.id).catch((err) => {
        console.error('start failed', err.message);
        broadcastState(true);
      });
    }
    sendJson(res, 200, { download: d });
  },

  'POST /api/downloads/:id/start': async (req, res, { params }) => {
    const d = store.download(params[0]);
    if (!d) return sendError(res, 404, 'Download not found');
    if (d.status === 'complete') return sendJson(res, 200, { download: d });
    const p = engine.start(d.id);
    sendJson(res, 200, { download: d });
    p.catch(() => {});
  },

  'POST /api/downloads/:id/stop': async (req, res, { params }) => {
    const d = await engine.pause(params[0]);
    sendJson(res, 200, { download: d });
  },

  'POST /api/downloads/:id/resume': async (req, res, { params }) => {
    const d = store.download(params[0]);
    if (!d) return sendError(res, 404, 'Download not found');
    const p = engine.resume(d.id);
    sendJson(res, 200, { download: d });
    p.catch(() => {});
  },

  'POST /api/downloads/:id/queue': async (req, res, { params }) => {
    const body = await readJson(req);
    const d = store.download(params[0]);
    if (!d) return sendError(res, 404, 'Download not found');
    d.queueId = body.queueId || null;
    d.queueRank = body.queueRank != null ? body.queueRank : nextQueueRank(d.queueId);
    if (d.queueId && d.status === 'paused') d.status = 'queued';
    if (!d.queueId && d.status === 'queued') d.status = 'paused';
    store.save();
    engine.tickQueue().catch(() => {});
    sendJson(res, 200, { download: d });
  },

  'POST /api/downloads/:id/properties': async (req, res, { params }) => {
    const body = await readJson(req);
    const d = store.download(params[0]);
    if (!d) return sendError(res, 404, 'Download not found');
    if (d.status === 'downloading') return sendError(res, 409, 'Stop the download before changing its properties.');
    if (body.filename) d.filename = safeFilename(body.filename);
    if (body.dir) d.dir = body.dir;
    if (body.url) d.url = body.url;
    if (body.description != null) d.description = body.description;
    if (body.username != null) d.username = body.username;
    if (body.password != null) d.password = body.password;
    if (body.categoryId !== undefined) {
      const cat = body.categoryId ? store.category(body.categoryId) : null;
      d.categoryId = cat ? cat.id : null;
      if (cat && !body.dir) d.dir = cat.dir;
    }
    d.saveTo = `${d.dir}\\${d.filename}`;
    store.save();
    sendJson(res, 200, { download: d });
  },

  'POST /api/queue/:action': async (req, res, { params }) => {
    const body = await readJson(req).catch(() => ({}));
    const queueId = body && body.queueId ? String(body.queueId) : 'all';
    if (params[0] === 'start') {
      engine.startQueue(queueId);
      return sendJson(res, 200, {
        queueRunning: !!store.data.queueRunning,
        runningQueues: store.data.runningQueues || [],
      });
    }
    if (params[0] === 'stop') {
      await engine.stopQueue(queueId);
      return sendJson(res, 200, {
        queueRunning: !!store.data.queueRunning,
        runningQueues: store.data.runningQueues || [],
      });
    }
    sendError(res, 404, 'Unknown queue action');
  },

  'POST /api/schedule': async (req, res) => {
    const body = await readJson(req);
    store.data.schedule = { ...store.data.schedule, ...(body || {}) };
    store.save();
    sendJson(res, 200, { schedule: store.data.schedule });
  },

  'POST /api/queues': async (req, res) => {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    if (!name) return sendError(res, 400, 'Queue name is required');
    const q = { id: rid('q'), name };
    store.data.queues.push(q);
    store.save();
    sendJson(res, 200, { queue: q, queues: store.data.queues });
  },

  'POST /api/queues/rename': async (req, res) => {
    const body = await readJson(req);
    const q = store.data.queues.find((x) => x.id === body.id);
    if (!q) return sendError(res, 404, 'Queue not found');
    const name = String(body.name || '').trim();
    if (!name) return sendError(res, 400, 'Queue name is required');
    q.name = name;
    store.save();
    sendJson(res, 200, { queue: q, queues: store.data.queues });
  },

  'DELETE /api/queues/:id': async (req, res, { params }) => {
    const id = params[0];
    if (id === 'q_main') return sendError(res, 400, 'The main download queue cannot be deleted.');
    store.data.queues = store.data.queues.filter((q) => q.id !== id);
    for (const d of store.downloads) {
      if (d.queueId === id) {
        d.queueId = null;
        if (d.status === 'queued') d.status = 'paused';
      }
    }
    store.save();
    sendJson(res, 200, { queues: store.data.queues });
  },

  'POST /api/downloads/actions/delete-completed': async (req, res) => {
    const body = await readJson(req);
    const done = store.downloads.filter((d) => d.status === 'complete');
    for (const d of done) await engine.remove(d.id, !!body.deleteFiles);
    sendJson(res, 200, { deleted: done.length });
  },

  'GET /api/events': async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    sseSend(res, 'state', {
      downloads: store.downloads,
      queueRunning: store.data.queueRunning,
      queueStartedAt: store.data.queueStartedAt,
      schedule: store.data.schedule,
      serverTime: nowIso(),
    });
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* closed */
      }
    }, 20000);
    req.on('close', () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
  },

  'POST /api/grabber/scan': async (req, res) => {
    const body = await readJson(req);
    if (!body.url) return sendError(res, 400, 'URL is required');
    const result = await grabScan(body.url, {
      depth: body.depth,
      types: body.types && body.types.length ? body.types : undefined,
      userAgent: store.settings.userAgent,
      skipHtml: body.skipHtml,
    });
    const grab = {
      id: rid('grab'),
      url: body.url,
      createdAt: nowIso(),
      pagesVisited: result.pagesVisited,
      fileCount: result.files.length,
    };
    store.data.grabs = store.data.grabs.slice(-19).concat(grab);
    store.save();
    sendJson(res, 200, { ...result, grabId: grab.id, defaultTypes: DEFAULT_TYPES });
  },

  'GET /api/downloads/:id/file': async (req, res, { params }) => {
    const d = store.download(params[0]);
    if (!d) return sendError(res, 404, 'Download not found');
    const file = path.join(ROOT, safeRelative(d.dir), d.filename);
    let st;
    try {
      st = await fsp.stat(file);
    } catch {
      return sendError(res, 404, 'The file is no longer on disk');
    }
    res.writeHead(200, {
      'Content-Type': d.mime || mimeFor(file),
      'Content-Length': st.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(d.filename)}"`,
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  },
};

function nextQueueRank(queueId) {
  if (!queueId) return 0;
  const ranks = store.downloads.filter((d) => d.queueId === queueId).map((d) => d.queueRank || 0);
  return ranks.length ? Math.max(...ranks) + 1 : 1;
}

function uniqueNameFor(dir, filename) {
  const name = safeFilename(filename);
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = name;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i++;
  }
  return candidate;
}

function matchRoute(method, pathname) {
  const exact = handlers[`${method} ${pathname}`];
  if (exact) return { handler: exact, params: [] };
  for (const key of Object.keys(handlers)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const pp = pattern.split('/');
    const ap = pathname.split('/');
    if (pp.length !== ap.length) continue;
    const params = [];
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) {
        if (!ap[i]) {
          ok = false;
          break;
        }
        params.push(decodeURIComponent(ap[i]));
      } else if (pp[i] !== ap[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: handlers[key], params };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const { pathname, parts, query } = parseRoute(req.url);
  try {
    if (pathname.startsWith('/api/')) {
      if (req.method === 'DELETE' && parts[2] === 'downloads' && parts[3]) {
        const body = await readJson(req).catch(() => ({}));
        const d = store.download(parts[3]);
        if (!d) return sendError(res, 404, 'Download not found');
        await engine.remove(parts[3], !!body.deleteFile);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'PUT' && parts[2] === 'categories' && parts[3]) {
        const body = await readJson(req);
        const cat = store.category(parts[3]);
        if (!cat) return sendError(res, 404, 'Category not found');
        if (cat.id === 'cat_all') return sendError(res, 400, 'The built-in category cannot be changed.');
        if (body.name != null) cat.name = String(body.name).trim() || cat.name;
        if (body.dir != null) cat.dir = body.dir;
        if (body.extensions != null) {
          cat.extensions = Array.isArray(body.extensions)
            ? body.extensions
            : String(body.extensions).split(/[\s,;]+/);
          cat.extensions = cat.extensions.map((e) => String(e).replace(/^\./, '').trim().toLowerCase()).filter(Boolean);
        }
        if (body.sitePattern != null) cat.sitePattern = body.sitePattern;
        store.save();
        return sendJson(res, 200, { category: cat });
      }
      if (req.method === 'DELETE' && parts[2] === 'categories' && parts[3]) {
        if (parts[3] === 'cat_all') return sendError(res, 400, 'The built-in category cannot be deleted.');
        store.data.categories = store.categories.filter((c) => c.id !== parts[3]);
        store.save();
        return sendJson(res, 200, { ok: true });
      }
      const route = matchRoute(req.method, pathname);
      if (!route) return sendError(res, 404, 'Unknown API endpoint');
      return await route.handler(req, res, { params: route.params, query });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed');
    return await serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`${req.method} ${pathname} failed:`, err);
    sendJson(res, status, { error: err.message || 'Internal server error' });
  }
});

(async () => {
  await store.init();
  await engine.init();
  await ensureDir(ROOT);
  if (store.data.schedule && store.data.schedule.startOnStartup) {
    engine.startQueue();
  }
  const activeSse = setInterval(() => {
    if (store.downloads.some((d) => d.status === 'downloading')) broadcastState();
  }, 800);
  activeSse.unref?.();
  server.listen(PORT, HOST, () => {
    console.log(`Internet Download Manager clone running at http://${HOST}:${PORT}`);
    console.log(`Download storage: ${ROOT}`);
  });
  const shutdown = async () => {
    console.log('\nShutting down…');
    for (const d of store.downloads) {
      if (d.status === 'downloading') {
        d.status = 'paused';
        d.statusText = 'Paused';
      }
    }
    await store.persist.flush?.();
    await store.write().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
