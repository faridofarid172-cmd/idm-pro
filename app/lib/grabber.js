'use strict';

/**
 * Site Grabber scanner: fetches an HTML page and extracts downloadable links.
 * Bounded in depth, page count and result count.
 */

const DEFAULT_TYPES = [
  'zip', 'rar', '7z', 'gz', 'tar', 'iso',
  'exe', 'msi', 'apk', 'dmg', 'bin',
  'mp3', 'wav', 'flac', 'm4a', 'ogg',
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'epub',
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
];

const MAX_PAGES = 12;
const MAX_RESULTS = 500;

function absolute(href, base) {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(h)) return null;
  try {
    return new URL(h, base).toString();
  } catch {
    return null;
  }
}

function extensionOf(url) {
  try {
    const u = new URL(url);
    const m = /\.([a-z0-9]{1,8})$/i.exec(u.pathname);
    return m ? m[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

function cleanFilename(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return last || u.hostname;
  } catch {
    return url;
  }
}

function extractLinks(html, baseUrl) {
  const links = [];
  const anchorRe = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    const href = m[2] || m[3] || m[4] || '';
    const label = m[5].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const url = absolute(href, baseUrl);
    if (url) links.push({ url, text: label });
  }
  const resRe = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  while ((m = resRe.exec(html))) {
    const url = absolute(m[2] || m[3] || m[4] || '', baseUrl);
    if (url) links.push({ url, text: '' });
  }
  return links;
}

async function scan(startUrl, opts = {}) {
  const maxDepth = Math.max(0, Math.min(3, Number(opts.depth) || 0));
  const types = new Set((opts.types && opts.types.length ? opts.types : DEFAULT_TYPES).map((t) => String(t).toLowerCase()));
  const userAgent = opts.userAgent || 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) CloneSiteGrabber/1.0';
  const skipHtml = opts.skipHtml !== false;

  const start = absolute(startUrl, startUrl);
  if (!start) throw Object.assign(new Error('Enter a valid web address to grab files from.'), { status: 400 });
  const origin = new URL(start).origin;

  const visited = new Set();
  const pages = [{ url: start, depth: 0 }];
  const found = new Map();
  const errors = [];

  while (pages.length && visited.size < MAX_PAGES && found.size < MAX_RESULTS) {
    const page = pages.shift();
    if (visited.has(page.url)) continue;
    visited.add(page.url);
    let html = '';
    let contentType = '';
    try {
      const res = await fetch(page.url, {
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        errors.push({ url: page.url, message: `${res.status} ${res.statusText}` });
        continue;
      }
      if (contentType.includes('text/html')) html = await res.text();
      else {
        // The start address itself is a file.
        const ext = extensionOf(res.url || page.url);
        if (ext && types.has(ext)) {
          found.set(res.url || page.url, {
            url: res.url || page.url,
            filename: cleanFilename(res.url || page.url),
            size: Number(res.headers.get('content-length')) || null,
            type: ext,
          });
        }
        continue;
      }
    } catch (err) {
      errors.push({ url: page.url, message: err.message });
      continue;
    }
    const links = extractLinks(html, page.url);
    for (const link of links) {
      const ext = extensionOf(link.url);
      if (ext && types.has(ext)) {
        if (!found.has(link.url)) {
          found.set(link.url, {
            url: link.url,
            filename: cleanFilename(link.url),
            size: null,
            type: ext,
          });
        }
        if (found.size >= MAX_RESULTS) break;
      } else if (!ext && page.depth < maxDepth) {
        try {
          const u = new URL(link.url);
          const sameSite = u.origin === origin;
          if (sameSite && !visited.has(link.url) && !/\.(css|js|png|jpe?g|gif|svg|ico|woff2?)$/i.test(u.pathname)) {
            pages.push({ url: link.url, depth: page.depth + 1 });
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  return {
    startUrl: start,
    pagesVisited: visited.size,
    files: Array.from(found.values()),
    errors,
    truncated: found.size >= MAX_RESULTS,
    types: Array.from(types),
    skipHtml,
  };
}

module.exports = { scan, DEFAULT_TYPES, extractLinks, extensionOf, cleanFilename };
