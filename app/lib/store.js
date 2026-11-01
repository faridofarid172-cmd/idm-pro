'use strict';

const path = require('path');
const fs = require('fs');
const { debounce, rid, nowIso, ensureDir } = require('./util');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'File Name', width: 268, visible: true, align: 'left' },
  { key: 'queue', label: 'Q', width: 34, visible: true, align: 'center' },
  { key: 'size', label: 'Size', width: 86, visible: true, align: 'right' },
  { key: 'status', label: 'Status', width: 110, visible: true, align: 'left' },
  { key: 'description', label: 'Description', width: 160, visible: true, align: 'left' },
  { key: 'speed', label: 'Transfer rate', width: 100, visible: true, align: 'right' },
  { key: 'lastTry', label: 'Last Try Date', width: 130, visible: true, align: 'left' },
  { key: 'added', label: 'Date Added', width: 130, visible: true, align: 'left' },
  { key: 'done', label: '✓', width: 34, visible: true, align: 'center' },
  { key: 'timeLeft', label: 'Time left', width: 92, visible: true, align: 'left' },
  { key: 'saveTo', label: 'Save To', width: 260, visible: true, align: 'left' },
  { key: 'url', label: 'URL', width: 220, visible: false, align: 'left' },
];

const DEFAULT_SETTINGS = {
  version: '6.43',
  build: 16,
  installed: false,
  installPath: 'C:\\Program Files (x86)\\Internet Download Manager',
  createDesktopIcon: true,
  language: 'English',
  launchOnStartup: true,
  runIEMonitor: true,
  clipboardMonitor: false,
  advancedBrowserIntegration: true,
  browsers: [
    { name: 'Apple Safari', enabled: true },
    { name: 'Google Chrome', enabled: true },
    { name: 'Internet Explorer', enabled: true },
    { name: 'Microsoft Edge', enabled: true },
    { name: 'Mozilla', enabled: true },
    { name: 'Mozilla Firefox', enabled: true },
    { name: 'Opera', enabled: true },
    { name: 'Brave', enabled: false },
  ],
  fileTypes:
    '3GP 7Z AAC ACE AIF ARJ ASF AVI BIN BZ2 EXE GZ GZIP IMG ISO LZH M4A M4V MKV MOV MP3 MP4 MPA MPEG MPG MSI MSU OGG OGV PLJ PPS PPT QT R0* RAR RAM RM RMVB SEA SIT SITX TAR TIF TIFF WAV WMA WMV Z ZIP MP4 EPUB TGZ M4B',
  excludedSites:
    '*.update.microsoft.com *download.windowsupdate.com siteseal.thawte.com ecom.cimetz.com *.voice2page.com pdfp.w.uspto.gov www.battlestick2.net',
  excludedAddresses: [],
  exceptions: [],
  connectionType: 'high',
  maxConnections: 8,
  downloadLimits: false,
  limitMB: 200,
  limitHours: 5,
  warnBeforeStop: true,
  saveTo: 'Downloads',
  tempDir: 'Downloads\\Temp',
  changeCategoryFolderOnLastSelected: true,
  showStartDialog: true,
  showCompleteDialog: true,
  startImmediately: true,
  showQueuePanelLater: true,
  showQueuePanelBatch: true,
  ignoreFileModificationTime: false,
  duplicateAction: 'ask',
  userAgent:
    'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
  progressStartView: 'normal',
  showSpeedLimiterTab: true,
  showOptionsOnCompletionTab: true,
  showHideTabButtons: true,
  proxyMode: 'system',
  proxyHost: '',
  proxyPort: 8080,
  proxyUser: '',
  proxyPass: '',
  proxyExceptions: '',
  useFtpPasv: true,
  siteLogins: [],
  dialUpConnection: '',
  dialUpUser: '',
  dialUpPass: '',
  savePassword: false,
  redials: 3,
  redialInterval: 5,
  sounds: [
    { event: 'Download complete', file: '', enabled: false },
    { event: 'Download failed', file: '', enabled: false },
    { event: 'Queue complete', file: '', enabled: false },
  ],
  virusCheckEnabled: false,
  virusCheckCommand: '',
  virusCheckArgs: '"[File]"',
  speedLimitEnabled: false,
  speedLimitKBps: 0,
  toolbarStyle: 'large3d',
  toolbarButtons: [
    'addurl',
    'resume',
    'stop',
    'stopall',
    'delete',
    'deletecompleted',
    'options',
    'scheduler',
    'startqueue',
    'stopqueue',
    'grabber',
    'tellfriend',
  ],
  columns: DEFAULT_COLUMNS,
  sortKey: 'added',
  sortDir: 'desc',
  queueConcurrency: 4,
  showStatusBar: true,
  showCategories: true,
  registration: {
    name: '',
    email: '',
    serial: '',
    registered: false,
    registeredAt: null,
  },
};

const DEFAULT_CATEGORIES = [
  { id: 'cat_all', name: 'All Downloads', dir: 'Downloads', extensions: [], builtin: true },
  { id: 'cat_compressed', name: 'Compressed', dir: 'Downloads\\Compressed', extensions: ['zip', 'rar', '7z', 'gz', 'bz2', 'iso', 'tar', 'tgz'], builtin: false },
  { id: 'cat_documents', name: 'Documents', dir: 'Downloads\\Documents', extensions: ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'epub'], builtin: false },
  { id: 'cat_music', name: 'Music', dir: 'Downloads\\Music', extensions: ['mp3', 'wav', 'wma', 'aac', 'flac', 'ogg', 'm4a'], builtin: false },
  { id: 'cat_programs', name: 'Programs', dir: 'Downloads\\Programs', extensions: ['exe', 'msi', 'msu', 'bin', 'dmg', 'apk'], builtin: false },
  { id: 'cat_video', name: 'Video', dir: 'Downloads\\Video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg', 'm4v'], builtin: false },
];

function defaults() {
  return {
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    downloads: [],
    grabs: [],
    schedule: {
      enabled: false,
      oneTime: true,
      periodic: false,
      startOnStartup: false,
      startEnabled: false,
      startTime: '12:00',
      stopEnabled: false,
      stopTime: '20:30',
      days: [1, 2, 3, 4, 5],
      once: '',
      retries: 10,
      openWhenDone: '',
      hangUp: false,
      exitIdm: false,
      shutdown: false,
      forceShutdown: false,
      shutdownMode: 'Shut down',
    },
    queues: [
      { id: 'q_main', name: 'Main download queue' },
      { id: 'q_sync', name: 'Synchronization queue' },
      { id: 'q_3', name: 'Queue # 3' },
    ],
    queueRunning: false,
    queueStartedAt: null,
    runningQueues: [],
    lastInstall: null,
    updatedAt: nowIso(),
  };
}

class Store {
  constructor() {
    this.data = defaults();
    this.ready = false;
    this.listeners = new Set();
    this.persist = debounce(() => this.write(), 120);
  }

  async init() {
    await ensureDir(DATA_DIR);
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        this.data = this.migrate(raw);
      } catch (err) {
        console.error('Could not read db.json, starting fresh:', err.message);
        this.data = defaults();
      }
    } else {
      await this.write();
    }
    // Any download left "downloading" from a previous process is paused.
    for (const d of this.data.downloads) {
      if (d.status === 'downloading') {
        d.status = 'paused';
        d.statusText = 'Paused (application restarted)';
        d.speed = 0;
      }
    }
    this.ready = true;
    this.persist();
  }

  migrate(raw) {
    const base = defaults();
    const merged = {
      ...base,
      ...raw,
      settings: { ...base.settings, ...(raw.settings || {}) },
      schedule: { ...base.schedule, ...(raw.schedule || {}) },
      categories: Array.isArray(raw.categories) ? raw.categories : base.categories,
      downloads: Array.isArray(raw.downloads) ? raw.downloads : [],
      grabs: Array.isArray(raw.grabs) ? raw.grabs : [],
      queues: Array.isArray(raw.queues) && raw.queues.length ? raw.queues : base.queues,
    };
    if (!Array.isArray(merged.settings.columns) || !merged.settings.columns.length) {
      merged.settings.columns = base.settings.columns;
    }
    return merged;
  }

  async write() {
    this.data.updatedAt = nowIso();
    const tmp = DB_FILE + '.tmp';
    await ensureDir(DATA_DIR);
    await fs.promises.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.promises.rename(tmp, DB_FILE);
  }

  save() {
    this.persist();
    this.emit();
  }

  get settings() {
    return this.data.settings;
  }

  get categories() {
    return this.data.categories;
  }

  get downloads() {
    return this.data.downloads;
  }

  download(id) {
    return this.data.downloads.find((d) => d.id === id);
  }

  category(id) {
    return this.data.categories.find((c) => c.id === id);
  }

  addDownload(partial) {
    const d = {
      id: rid('dl'),
      url: '',
      filename: '',
      dir: 'Downloads',
      categoryId: null,
      description: '',
      referrer: '',
      pageUrl: '',
      username: '',
      password: '',
      size: null,
      downloaded: 0,
      segments: [],
      resumable: false,
      mime: '',
      status: 'paused',
      statusText: '',
      error: '',
      speed: 0,
      speedLimit: 0,
      addedAt: nowIso(),
      lastTryAt: null,
      completedAt: null,
      queueId: null,
      queueRank: 0,
      ...partial,
    };
    this.data.downloads.push(d);
    this.save();
    return d;
  }

  removeDownload(id) {
    const i = this.data.downloads.findIndex((d) => d.id === id);
    if (i === -1) return null;
    const [d] = this.data.downloads.splice(i, 1);
    this.save();
    return d;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error('store listener failed', err);
      }
    }
  }
}

module.exports = { Store, DB_FILE, DEFAULT_COLUMNS, DEFAULT_SETTINGS, DEFAULT_CATEGORIES };
