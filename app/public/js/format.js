(function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function bytes(n) {
    if (n == null || n === '' || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    if (v < 1024) return `${v} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let x = v / 1024;
    let i = 0;
    while (x >= 1024 && i < units.length - 1) {
      x /= 1024;
      i++;
    }
    return `${x.toFixed(2)} ${units[i]}`;
  }

  function bytesExact(n) {
    if (n == null || n === '') return '';
    return `${bytes(n)} (${Number(n).toLocaleString('en-US')} Bytes)`;
  }

  function speed(n) {
    if (!n) return '';
    return `${bytes(n)}/sec`;
  }

  function date(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (x) => String(x).padStart(2, '0');
    return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())} ${d.getFullYear()}`;
  }

  function shortDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function time(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function timeLeft(d) {
    if (d.status === 'complete') return '';
    if (!d.size || !d.speed || d.speed <= 0) return '';
    const remaining = Math.max(0, d.size - (d.downloaded || 0));
    let s = Math.round(remaining / d.speed);
    if (s < 60) return `${s} sec`;
    const m = Math.floor(s / 60);
    s %= 60;
    if (m < 60) return `${m} min ${s} sec`;
    const h = Math.floor(m / 60);
    return `${h} hr ${m % 60} min`;
  }

  function percent(d) {
    if (!d.size) return 0;
    return Math.max(0, Math.min(100, ((d.downloaded || 0) / d.size) * 100));
  }

  function status(d) {
    switch (d.status) {
      case 'downloading':
        return 'Downloading';
      case 'complete':
        return 'Complete';
      case 'paused':
        return d.downloaded ? 'Paused' : 'Paused';
      case 'queued':
        return 'Queued';
      case 'error':
        return 'Error';
      case 'cancelled':
        return 'Cancelled';
      default:
        return d.statusText || 'Paused';
    }
  }

  function typeName(filename) {
    const ext = (String(filename).split('.').pop() || '').toLowerCase();
    const map = {
      exe: 'Application',
      msi: 'Windows Installer Package',
      msu: 'Windows Update Package',
      zip: 'Compressed (zipped) Folder',
      rar: 'RAR Archive',
      '7z': '7z Archive',
      pdf: 'PDF Document',
      doc: 'Microsoft Word Document',
      docx: 'Microsoft Word Document',
      xls: 'Microsoft Excel Worksheet',
      xlsx: 'Microsoft Excel Worksheet',
      ppt: 'Microsoft PowerPoint Presentation',
      pptx: 'Microsoft PowerPoint Presentation',
      txt: 'Text Document',
      mp3: 'MP3 Audio File',
      wav: 'Wave Sound',
      mp4: 'MP4 Video',
      mkv: 'Matroska Video File',
      avi: 'Video Clip',
      jpg: 'JPEG Image',
      jpeg: 'JPEG Image',
      png: 'PNG Image',
      gif: 'GIF Image',
      iso: 'Disc Image File',
      apk: 'Android Package',
      html: 'HTML Document',
      json: 'JSON File',
    };
    return map[ext] || (ext ? `${ext.toUpperCase()} File` : 'File');
  }

  function ext(filename) {
    const m = /\.([a-z0-9]{1,8})$/i.exec(String(filename || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function basename(p) {
    return String(p || '').split(/[\\/]/).pop();
  }

  function dirname(p) {
    const s = String(p || '').replace(/\//g, '\\');
    const i = s.lastIndexOf('\\');
    return i === -1 ? '' : s.slice(0, i);
  }

  function joinPath(dir, name) {
    const d = String(dir || '').replace(/\//g, '\\').replace(/\\+$/, '');
    return d ? `${d}\\${name}` : name;
  }

  function relativeDate(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    return date(iso);
  }

  window.Fmt = {
    bytes,
    bytesExact,
    speed,
    date,
    shortDate,
    time,
    timeLeft,
    percent,
    status,
    typeName,
    ext,
    escapeHtml,
    basename,
    dirname,
    joinPath,
    relativeDate,
  };
})();
