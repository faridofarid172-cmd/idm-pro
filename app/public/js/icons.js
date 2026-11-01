/* Icon set: glossy SVG approximations of the icons used by IDM's Win32 UI. */
(function () {
  const cache = new Map();

  const DEFS = `
    <defs>
      <linearGradient id="gGlobe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a8ef7a"/><stop offset="0.45" stop-color="#45b23c"/>
        <stop offset="1" stop-color="#14701f"/>
      </linearGradient>
      <linearGradient id="gArrow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#e9f7e4"/>
        <stop offset="1" stop-color="#bfe2b8"/>
      </linearGradient>
      <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff8f7e"/><stop offset="0.45" stop-color="#e13b22"/>
        <stop offset="1" stop-color="#8f1206"/>
      </linearGradient>
      <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bfe9ff"/><stop offset="0.45" stop-color="#3d9fe0"/>
        <stop offset="1" stop-color="#0d4e82"/>
      </linearGradient>
      <linearGradient id="gSilver" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#dfe6ec"/>
        <stop offset="1" stop-color="#98a7b5"/>
      </linearGradient>
      <linearGradient id="gYellow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3a0"/><stop offset="0.5" stop-color="#f5c518"/>
        <stop offset="1" stop-color="#a97800"/>
      </linearGradient>
      <linearGradient id="gPaper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dde7f0"/>
      </linearGradient>
      <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c6f7a4"/><stop offset="0.5" stop-color="#45bb2a"/>
        <stop offset="1" stop-color="#1d6f10"/>
      </linearGradient>
      <linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe8a3"/><stop offset="0.5" stop-color="#f0bf4a"/>
        <stop offset="1" stop-color="#b07d12"/>
      </linearGradient>
    </defs>`;

  const ICONS = {
    idmlogo: `
      ${DEFS}
      <circle cx="16" cy="16" r="14.2" fill="url(#gGlobe)" stroke="#0b4a10" stroke-width="1"/>
      <path d="M16 4.5c-5 0-8.8 2.9-10.7 7.2M16 4.5c4.4 0 8 2.4 10.1 6.4" fill="none" stroke="#d8ffc8" stroke-opacity=".55" stroke-width="1.1"/>
      <ellipse cx="11.4" cy="9.4" rx="5.2" ry="2.6" fill="#ffffff" opacity=".25" transform="rotate(-24 11.4 9.4)"/>
      <path d="M16 7.6v11.1" stroke="url(#gArrow)" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M10.6 15.4 16 21.6l5.4-6.2z" fill="url(#gArrow)" stroke="#0b4a10" stroke-width=".7" stroke-linejoin="round"/>
      <path d="M10.6 15.4 16 21.6l5.4-6.2" fill="none" stroke="#0b4a10" stroke-width=".7" stroke-linejoin="round"/>
      <text x="16" y="27.6" font-family="Arial" font-size="5.6" font-weight="bold" text-anchor="middle" fill="#f2ffe9">IDM</text>`,

    addurl: `
      ${DEFS}
      <circle cx="14" cy="15" r="12" fill="url(#gGlobe)" stroke="#0b4a10" stroke-width="1"/>
      <ellipse cx="10" cy="9" rx="4.6" ry="2.4" fill="#ffffff" opacity=".28" transform="rotate(-24 10 9)"/>
      <path d="M14 7.5v9" stroke="url(#gArrow)" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M9.8 13.6 14 18.7l4.2-5.1z" fill="url(#gArrow)" stroke="#0b4a10" stroke-width=".6"/>
      <circle cx="24" cy="23" r="6.2" fill="url(#gBlue)" stroke="#073a63" stroke-width=".8"/>
      <path d="M21 23h6M24 20v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,

    resume: `
      ${DEFS}
      <path d="M6 3.5h13l7 7v18H6z" fill="url(#gPaper)" stroke="#7c93a7" stroke-width="1"/>
      <path d="M19 3.5v7h7" fill="#eef4f9" stroke="#7c93a7" stroke-width="1"/>
      <path d="M9 14h9M9 18h9M9 22h6" stroke="#a9bccd" stroke-width="1.4"/>
      <circle cx="21.5" cy="22" r="7" fill="url(#gGreen)" stroke="#145209" stroke-width=".9"/>
      <path d="M19 18.2 25 22l-6 3.8z" fill="#fff"/>`,

    stop: `
      ${DEFS}
      <circle cx="16" cy="16" r="13.2" fill="url(#gRed)" stroke="#6d0d03" stroke-width="1"/>
      <ellipse cx="11.6" cy="9.6" rx="5.4" ry="2.8" fill="#ffffff" opacity=".32" transform="rotate(-24 11.6 9.6)"/>
      <path d="m11 11 10 10M21 11 11 21" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`,

    stopall: `
      ${DEFS}
      <rect x="3" y="6" width="19" height="15" rx="2" fill="#c9d6e2" stroke="#6f8497"/>
      <circle cx="18" cy="18" r="11.4" fill="url(#gRed)" stroke="#6d0d03" stroke-width="1"/>
      <ellipse cx="14" cy="13" rx="4.6" ry="2.4" fill="#ffffff" opacity=".3" transform="rotate(-24 14 13)"/>
      <path d="m14 14 8 8M22 14l-8 8" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`,

    delete: `
      ${DEFS}
      <path d="M8 9h16l-1.6 19H9.6z" fill="url(#gSilver)" stroke="#5d6f7e"/>
      <path d="M6 6.4h20" stroke="#5d6f7e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M13 6.4V4.2h6v2.2" fill="none" stroke="#5d6f7e" stroke-width="2"/>
      <path d="M13 13v11M18 13v11" stroke="#8fa0ae" stroke-width="1.6"/>
      <circle cx="22" cy="22" r="7" fill="url(#gRed)" stroke="#6d0d03" stroke-width=".9"/>
      <path d="m19 19 6 6M25 19l-6 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,

    deletecompleted: `
      ${DEFS}
      <path d="M8 9h16l-1.6 19H9.6z" fill="url(#gSilver)" stroke="#5d6f7e"/>
      <path d="M6 6.4h20" stroke="#5d6f7e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M13 6.4V4.2h6v2.2" fill="none" stroke="#5d6f7e" stroke-width="2"/>
      <path d="M13 13v10M18 13v10" stroke="#8fa0ae" stroke-width="1.6"/>
      <circle cx="22" cy="22" r="7" fill="url(#gGreen)" stroke="#145209" stroke-width=".9"/>
      <path d="m18.6 22 2.4 2.6 4.6-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,

    options: `
      ${DEFS}
      <circle cx="16" cy="16" r="6.4" fill="#dff1ff" stroke="#2a6f9e" stroke-width="1.2"/>
      <g fill="url(#gSilver)" stroke="#5d7285" stroke-width=".8">
        <path d="M13.4 2.5h5.2l.6 3.6 2 .8 2.8-2.2 3.7 3.7-2.2 2.8.8 2 3.6.6v5.2l-3.6.6-.8 2 2.2 2.8-3.7 3.7-2.8-2.2-2 .8-.6 3.6h-5.2l-.6-3.6-2-.8-2.8 2.2-3.7-3.7 2.2-2.8-.8-2-3.6-.6v-5.2l3.6-.6.8-2-2.2-2.8 3.7-3.7 2.8 2.2 2-.8z" fill="url(#gBlue)"/>
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#e9f8ff" stroke="#1a5d8b" stroke-width=".8"/>`,

    scheduler: `
      ${DEFS}
      <circle cx="16" cy="17" r="11.4" fill="url(#gSilver)" stroke="#5f7284" stroke-width="1"/>
      <circle cx="16" cy="17" r="8.6" fill="#ffffff" stroke="#9aabba"/>
      <path d="M16 17V11.6M16 17l3.8 3" stroke="#2c3d4c" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M8 5.5 5 8.6M24 5.5l3 3.1" stroke="#c9a400" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="16" cy="17" r="1.2" fill="#c62828"/>`,

    startqueue: `
      ${DEFS}
      <circle cx="15" cy="16" r="12" fill="url(#gGreen)" stroke="#145209" stroke-width="1"/>
      <path d="M11.6 9.8 21 16l-9.4 6.2z" fill="#fff"/>
      <path d="M25.5 7v18" stroke="#2f6b2a" stroke-width="2" stroke-linecap="round"/>`,

    stopqueue: `
      ${DEFS}
      <circle cx="15" cy="16" r="12" fill="url(#gRed)" stroke="#6d0d03" stroke-width="1"/>
      <rect x="10.4" y="11.4" width="9.2" height="9.2" fill="#fff" rx="1"/>
      <path d="M25.5 7v18" stroke="#7a251a" stroke-width="2" stroke-linecap="round"/>`,

    grabber: `
      ${DEFS}
      <circle cx="14" cy="14" r="9.4" fill="url(#gBlue)" stroke="#0a3f68" stroke-width=".9"/>
      <path d="M14 4.8c-2.8 1.4-4.3 4.9-4.3 9.2M14 4.8c2.8 1.4 4.3 4.9 4.3 9.2M5.2 14h17.6" fill="none" stroke="#d9f4ff" stroke-width=".9" opacity=".8"/>
      <path d="M14 4.8v18.4" stroke="#d9f4ff" stroke-width=".9" opacity=".8"/>
      <path d="m17 20 7 7" stroke="#5d7285" stroke-width="3" stroke-linecap="round"/>
      <circle cx="23.5" cy="23.5" r="4.6" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="M20 16.4h7" stroke="#f0c419" stroke-width="2.6"/>`,

    tellfriend: `
      ${DEFS}
      <rect x="3.5" y="8" width="22" height="15" rx="2" fill="url(#gPaper)" stroke="#6d8193"/>
      <path d="m4 9 10.5 8L25 9" fill="none" stroke="#6d8193" stroke-width="1.4"/>
      <path d="M4 22l7.4-6.4M25 22l-7.4-6.4" stroke="#b9c9d6" stroke-width="1.2"/>
      <circle cx="23" cy="23" r="6.4" fill="url(#gRed)" stroke="#7a1105" stroke-width=".8"/>
      <path d="M23 20.2c1.5-1.9 4.6.2 0 3.5-4.6-3.3-1.5-5.4 0-3.5z" fill="#fff"/>`,

    folder: `
      ${DEFS}
      <path d="M2.5 6.5h9l2 2.4h14v16H2.5z" fill="url(#gWood)" stroke="#8a6410" stroke-width=".9"/>
      <path d="M2.5 10.6h25.4v14.3H2.5z" fill="url(#gWood)" stroke="#8a6410" stroke-width=".9"/>
      <path d="M3 11.4h24" stroke="#fff" stroke-opacity=".5"/>`,

    folderopen: `
      ${DEFS}
      <path d="M2.5 6.5h9l2 2.4h14v4H2.5z" fill="#d8a72a" stroke="#8a6410" stroke-width=".9"/>
      <path d="M2.5 12.5h27l-4 12.5H2.5z" fill="url(#gWood)" stroke="#8a6410" stroke-width=".9"/>`,

    download: `
      ${DEFS}
      <circle cx="16" cy="16" r="12.5" fill="url(#gBlue)" stroke="#0a3f68" stroke-width=".9"/>
      <path d="M16 8v11" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <path d="m10.8 14.6 5.2 5.6 5.2-5.6z" fill="#fff"/>
      <path d="M9.5 23.5h13" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,

    unfinished: `
      ${DEFS}
      <circle cx="16" cy="16" r="12" fill="#f8fbfe" stroke="#7b91a4"/>
      <path d="M16 8v9" stroke="#2a6f9e" stroke-width="3" stroke-linecap="round"/>
      <path d="m11 13 5 6 5-6z" fill="#2a6f9e"/>
      <path d="M10 24h12" stroke="#8fa6b9" stroke-width="2"/>`,

    finished: `
      ${DEFS}
      <circle cx="16" cy="16" r="12" fill="url(#gGreen)" stroke="#145209" stroke-width=".9"/>
      <path d="m10 16.5 4.4 4.6L22 11.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,

    queue: `
      ${DEFS}
      <rect x="4" y="5" width="24" height="22" rx="2.5" fill="url(#gPaper)" stroke="#7c93a7"/>
      <path d="M8 10h16M8 15h16M8 20h16" stroke="#8fb6d4" stroke-width="2"/>
      <circle cx="22" cy="22" r="5.4" fill="url(#gGreen)" stroke="#145209" stroke-width=".8"/>
      <path d="m19.8 22 1.7 1.8 3.1-3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,

    settings: `
      ${DEFS}
      <g fill="#7e93a6"><circle cx="16" cy="16" r="3.2"/></g>`,

    check: `<svg></svg>`,
  };

  const FILE_COLORS = {
    exe: ['#1d6fb8', '#0a3f68', 'EXE'],
    msi: ['#3a7d44', '#164a1f', 'MSI'],
    zip: ['#c3941c', '#7a5a05', 'ZIP'],
    rar: ['#a06a2c', '#5f3b0e', 'RAR'],
    '7z': ['#7b7b7b', '#3d3d3d', '7Z'],
    pdf: ['#c0392b', '#6d1309', 'PDF'],
    doc: ['#2b579a', '#122f5c', 'DOC'],
    docx: ['#2b579a', '#122f5c', 'DOC'],
    xls: ['#217346', '#0c3a22', 'XLS'],
    xlsx: ['#217346', '#0c3a22', 'XLS'],
    ppt: ['#b7472a', '#6b1e0d', 'PPT'],
    pptx: ['#b7472a', '#6b1e0d', 'PPT'],
    txt: ['#8b98a5', '#4b5560', 'TXT'],
    mp3: ['#7d4bb5', '#3d1f66', 'MP3'],
    wav: ['#7d4bb5', '#3d1f66', 'WAV'],
    flac: ['#7d4bb5', '#3d1f66', 'FLAC'],
    m4a: ['#7d4bb5', '#3d1f66', 'M4A'],
    mp4: ['#0f8a9e', '#034d5a', 'MP4'],
    mkv: ['#0f8a9e', '#034d5a', 'MKV'],
    avi: ['#0f8a9e', '#034d5a', 'AVI'],
    mov: ['#0f8a9e', '#034d5a', 'MOV'],
    webm: ['#0f8a9e', '#034d5a', 'WEBM'],
    jpg: ['#5b8f2e', '#2b4d12', 'IMG'],
    jpeg: ['#5b8f2e', '#2b4d12', 'IMG'],
    png: ['#5b8f2e', '#2b4d12', 'IMG'],
    gif: ['#5b8f2e', '#2b4d12', 'IMG'],
    svg: ['#5b8f2e', '#2b4d12', 'SVG'],
    iso: ['#6b6b8a', '#33334d', 'ISO'],
    apk: ['#3ddc84', '#0d6b36', 'APK'],
    dmg: ['#8f8f8f', '#3d3d3d', 'DMG'],
    bin: ['#8f8f8f', '#3d3d3d', 'BIN'],
    torrent: ['#2e7d32', '#0f3f14', 'TOR'],
    html: ['#e07b23', '#7a3a05', 'HTM'],
    json: ['#4b4b4b', '#1d1d1d', 'JSN'],
  };

  function fileIcon(extRaw) {
    const ext = String(extRaw || '').toLowerCase().replace(/^\./, '');
    const c = FILE_COLORS[ext];
    if (!c) {
      return `<svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 1.5h6.5L13 5v9.5H3z" fill="url(#gPaper)" stroke="#7c93a7" stroke-width=".8"/>
        <path d="M9.5 1.5V5H13" fill="#eef4f9" stroke="#7c93a7" stroke-width=".8"/>
        <path d="M5 8h6M5 10h6M5 12h4" stroke="#9fb2c2" stroke-width=".8"/>
      </svg>`;
    }
    const label = c[2];
    return `<svg viewBox="0 0 16 16" aria-hidden="true">
      <defs><linearGradient id="fc${label}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/>
      </linearGradient></defs>
      <path d="M2.5 1.5h7L14 6v8.5H2.5z" fill="url(#fc${label})" stroke="${c[1]}" stroke-width=".7"/>
      <path d="M9.5 1.5V6H14" fill="#ffffff" opacity=".28"/>
      <text x="8" y="11.4" font-family="Arial" font-size="${label.length > 3 ? 3.4 : 4.1}" font-weight="bold" text-anchor="middle" fill="#fff">${label}</text>
    </svg>`;
  }

  function icon(name) {
    if (cache.has(name)) return cache.get(name);
    const body = ICONS[name];
    let out;
    if (body == null) {
      out = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#cbd6e0"/></svg>`;
    } else if (body.startsWith('<svg')) {
      out = body;
    } else {
      out = `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
    }
    cache.set(name, out);
    return out;
  }

  window.Icons = { icon, fileIcon };
})();
