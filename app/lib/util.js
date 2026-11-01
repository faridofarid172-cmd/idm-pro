'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, status, message, extra) {
  sendJson(res, status, Object.assign({ error: message }, extra));
}

async function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function debounce(fn, ms) {
  let timer = null;
  let pending = null;
  const wrapped = (...args) => {
    pending = args;
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const a = pending;
      pending = null;
      try {
        await fn(...a);
      } catch (err) {
        console.error('debounced task failed:', err);
      }
    }, ms);
    if (wrapped.flush) wrapped.flush();
  };
  wrapped.flush = async () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    const a = pending;
    pending = null;
    if (a) await fn(...a);
  };
  return wrapped;
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(2)} ${units[i]}`;
}

// Virtual download paths. The clone never writes outside its storage root.
function safeRelative(vpath) {
  if (!vpath) return '';
  let p = String(vpath).replace(/\//g, '\\');
  p = p.replace(/^[a-zA-Z]:/, '').replace(/^\\+/, '');
  const parts = p
    .split('\\')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== '.' && s !== '..')
    .map((s) => s.replace(/[<>:"|?*\u0000-\u001f]/g, '_'));
  return parts.join(path.sep);
}

function safeFilename(name, fallback = 'download.bin') {
  let n = String(name || '').split(/[\\/]/).pop() || '';
  n = n.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/\.+$/, '');
  if (!n || n === '.' || n === '..') n = fallback;
  if (n.length > 180) {
    const ext = path.extname(n).slice(0, 12);
    n = n.slice(0, 180 - ext.length) + ext;
  }
  return n;
}

function uniqueFilename(dir, name) {
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

function filenameFromUrl(rawUrl, contentDisposition) {
  if (contentDisposition) {
    const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(contentDisposition);
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
    if (star) {
      try {
        return safeFilename(decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')));
      } catch {
        /* ignore malformed */
      }
    }
    if (plain) return safeFilename(plain[1].trim());
  }
  try {
    const u = new URL(rawUrl);
    let base = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (!base) base = u.hostname.replace(/^www\./, '') + '.html';
    return safeFilename(base);
  } catch {
    return 'download.bin';
  }
}

function parseContentRange(value) {
  const m = /bytes\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(value || '');
  if (!m) return null;
  return { start: Number(m[1]), end: Number(m[2]), total: m[3] === '*' ? null : Number(m[3]) };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function nowIso() {
  return new Date().toISOString();
}

function rid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

module.exports = {
  sendJson,
  sendError,
  readJson,
  exists,
  ensureDir,
  debounce,
  formatBytes,
  safeRelative,
  safeFilename,
  uniqueFilename,
  filenameFromUrl,
  parseContentRange,
  mimeFor,
  nowIso,
  rid,
  clamp,
  fsp,
};
