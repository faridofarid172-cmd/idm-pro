(function () {
  const { el, $, toast, contextMenu, confirm, messageBox, prompt, folderPicker } = UI;

  const App = {
    state: {
      settings: null,
      categories: [],
      downloads: [],
      queues: [],
      schedule: null,
      queueRunning: false,
      selection: new Set(),
      anchor: null,
      tree: { type: 'all', categoryId: null, queueId: null },
      sortKey: null,
      sortDir: 'asc',
      expanded: new Set(['categories']),
      connection: false,
      speedSamples: [],
    },
    dialogs: {},
  };

  const TOOLBAR = {
    addurl: { label: 'Add URL', icon: 'addurl' },
    resume: { label: 'Resume', icon: 'resume' },
    stop: { label: 'Stop', icon: 'stop' },
    stopall: { label: 'Stop All', icon: 'stopall' },
    delete: { label: 'Delete', icon: 'delete' },
    deletecompleted: { label: 'Delete Co…', icon: 'deletecompleted', title: 'Delete Completed' },
    options: { label: 'Options', icon: 'options' },
    scheduler: { label: 'Scheduler', icon: 'scheduler' },
    startqueue: { label: 'Start Queue', icon: 'startqueue', caret: true },
    stopqueue: { label: 'Stop Queue', icon: 'stopqueue', caret: true },
    grabber: { label: 'Grabber', icon: 'grabber' },
    tellfriend: { label: 'Tell A Friend', icon: 'tellfriend' },
  };

  const SEPARATORS = new Set(['addurl', 'delete', 'deletecompleted', 'scheduler']);

  function settings() {
    return App.state.settings || {};
  }

  function downloads() {
    return App.state.downloads;
  }

  function findDownload(id) {
    return downloads().find((d) => d.id === id);
  }

  async function refreshState() {
    const data = await Api.get('/api/state');
    applyFullState(data);
  }

  function applyFullState(data) {
    if (data.settings) App.state.settings = data.settings;
    if (data.categories) App.state.categories = data.categories;
    if (data.downloads) App.state.downloads = data.downloads;
    if (data.queues) App.state.queues = data.queues;
    if (data.schedule) App.state.schedule = data.schedule;
    App.state.queueRunning = !!data.queueRunning;
    if (App.state.sortKey == null && data.settings) {
      App.state.sortKey = data.settings.sortKey || 'added';
      App.state.sortDir = data.settings.sortDir || 'desc';
    }
    renderAll();
  }

  function applySnapshot(snap) {
    if (!App.state.settings) return;
    if (snap.downloads) {
      const byId = new Map(App.state.downloads.map((d) => [d.id, d]));
      for (const incoming of snap.downloads) {
        const existing = byId.get(incoming.id);
        if (existing) Object.assign(existing, incoming);
        else App.state.downloads.push(incoming);
      }
      // remove rows deleted elsewhere
      const ids = new Set(snap.downloads.map((d) => d.id));
      App.state.downloads = App.state.downloads.filter((d) => ids.has(d.id));
    }
    if (snap.queueRunning != null) App.state.queueRunning = !!snap.queueRunning;
    if (snap.schedule) App.state.schedule = snap.schedule;
    renderToolbar();
    renderTree();
    renderList();
    renderStatus();
  }

  /* ---------------------------------------------------------------- toolbar */

  function renderToolbar() {
    const bar = $('#toolbar');
    const style = settings().toolbarStyle || 'large3d';
    bar.className = `toolbar${style.startsWith('small') ? ' small' : ''}${style.includes('neon') ? ' neon' : ''}`;
    bar.innerHTML = '';
    const buttons = settings().toolbarButtons || Object.keys(TOOLBAR);
    for (const key of buttons) {
      const def = TOOLBAR[key];
      if (!def) continue;
      if (SEPARATORS.has(key) && bar.children.length) bar.appendChild(el('div', { class: 'tb-sep' }));
      const btn = el(
        'button',
        {
          class: 'tb',
          title: def.title || def.label,
          'data-cmd': key,
        },
        [
          el('span', { class: 'tb-icon', html: Icons.icon(def.icon) }),
          el('span', { class: 'tb-label', text: def.label }),
          def.caret ? el('span', { class: 'tb-caret' }) : null,
        ]
      );
      if (key === 'startqueue' || key === 'stopqueue') {
        btn.addEventListener('click', (e) => {
          const r = btn.getBoundingClientRect();
          queueMenu(key, r.left, r.bottom);
        });
      } else {
        btn.addEventListener('click', () => cmd(key));
      }
      bar.appendChild(btn);
    }
    bar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toolbarMenu(e.clientX, e.clientY);
    });
    updateToolbarState();
  }

  function updateToolbarState() {
    const list = downloads();
    const sel = selectedDownloads();
    const set = (key, enabled) => {
      const b = document.querySelector(`.tb[data-cmd="${key}"]`);
      if (b) b.classList.toggle('disabled', !enabled);
    };
    const hasSel = sel.length > 0;
    set('resume', sel.some((d) => d.status === 'paused' || d.status === 'error' || d.status === 'cancelled'));
    set('stop', sel.some((d) => d.status === 'downloading' || d.status === 'queued'));
    set('stopall', list.some((d) => d.status === 'downloading' || d.status === 'queued'));
    set('delete', hasSel);
    set('deletecompleted', list.some((d) => d.status === 'complete'));
    set('startqueue', true);
    set('stopqueue', App.state.queueRunning);
  }

  /* ---------------------------------------------------------------- menus */

  const MENUS = [
    {
      label: 'Tasks',
      items: () => [
        { label: 'Add batch download…', onClick: () => Dlg.batch() },
        { label: 'Add batch download from clipboard', onClick: () => Dlg.batchFromClipboard() },
        { label: 'Import downloads from file…', onClick: importDownloads },
        { label: 'Export downloads list…', onClick: exportDownloads },
        'sep',
        { label: 'Run Site Grabber…', onClick: () => Dlg.grabber() },
        { label: 'Import from IDM server…', disabled: true },
        'sep',
        { label: 'Scheduler…', onClick: () => Dlg.scheduler() },
      ],
    },
    {
      label: 'File',
      items: () => [
        { label: 'Add URL…', shortcut: 'Ctrl+N', onClick: () => Dlg.addUrl() },
        { label: 'Add batch download…', onClick: () => Dlg.batch() },
        'sep',
        { label: 'Import downloads from file…', onClick: importDownloads },
        { label: 'Export downloads list…', onClick: exportDownloads },
        'sep',
        { label: 'Show main window', disabled: true },
        { label: 'Exit', shortcut: 'Alt+F4', onClick: exitApp },
      ],
    },
    {
      label: 'Downloads',
      items: () => {
        const sel = selectedDownloads();
        const has = sel.length > 0;
        const active = sel.some((d) => d.status === 'downloading' || d.status === 'queued');
        const done = sel.filter((d) => d.status === 'complete');
        return [
          { label: 'Start / Resume', shortcut: 'Ctrl+R', disabled: !has || !sel.some((d) => d.status !== 'complete' && d.status !== 'downloading'), onClick: () => cmd('resume') },
          { label: 'Stop', disabled: !active, onClick: () => cmd('stop') },
          { label: 'Stop All', disabled: !downloads().some((d) => d.status === 'downloading'), onClick: () => cmd('stopall') },
          'sep',
          { label: 'Add to queue', disabled: !has || !App.state.queues.length, onClick: () => addToQueue(sel) },
          { label: 'Delete from queue', disabled: !sel.some((d) => d.queueId), onClick: () => removeFromQueue(sel) },
          { label: 'Start queue', onClick: () => cmd('startqueue') },
          { label: 'Stop queue', disabled: !App.state.queueRunning, onClick: () => cmd('stopqueue') },
          'sep',
          { label: 'Delete', shortcut: 'Del', disabled: !has, onClick: () => cmd('delete') },
          { label: 'Delete completed', disabled: !done.length, onClick: () => cmd('deletecompleted') },
          'sep',
          { label: 'Properties…', disabled: sel.length !== 1, onClick: () => Dlg.properties(sel[0]) },
          'sep',
          { label: 'Options…', onClick: () => Dlg.options() },
          { label: 'Scheduler…', onClick: () => Dlg.scheduler() },
        ];
      },
    },
    {
      label: 'View',
      items: () => [
        { label: 'Categories', checked: settings().showCategories, onClick: toggleCategories },
        { label: 'Toolbar', checked: true, onClick: toggleToolbar },
        { label: 'Status bar', checked: settings().showStatusBar !== false, onClick: toggleStatusBar },
        'sep',
        { label: 'Columns…', onClick: () => Dlg.columns() },
        { label: 'Customize toolbar…', onClick: () => Dlg.toolbarCustomize() },
        { label: 'Toolbar style', onClick: () => toolbarMenu(undefined, undefined) },
        'sep',
        { label: 'Refresh', shortcut: 'F5', onClick: refreshState },
      ],
    },
    {
      label: 'Help',
      items: () => [
        { label: 'Contents', shortcut: 'F1', onClick: () => Dlg.help() },
        { label: 'Check for updates…', onClick: () => Dlg.checkUpdates() },
        'sep',
        { label: 'About IDM…', onClick: () => Dlg.about() },
      ],
    },
    {
      label: 'Registration',
      items: () => [
        { label: 'Registration…', onClick: () => Dlg.registration() },
        { label: 'Purchase…', onClick: () => Dlg.purchase() },
        'sep',
        { label: 'Registration status…', onClick: () => Dlg.about() },
      ],
    },
  ];

  function renderMenus() {
    const bar = $('#menubar');
    bar.innerHTML = '';
    let openMenu = null;
    let openRoot = null;

    const close = () => {
      if (openMenu) openMenu.remove();
      if (openRoot) openRoot.classList.remove('open');
      openMenu = null;
      openRoot = null;
    };
    const showMenu = (root, menu) => {
      close();
      openRoot = root;
      root.classList.add('open');
      const r = root.getBoundingClientRect();
      const popup = el('div', { class: 'menu-popup', style: { left: `${r.left}px`, top: `${r.bottom}px` } });
      for (const item of menu.items()) {
        if (item === 'sep') {
          popup.appendChild(el('div', { class: 'menu-sep' }));
          continue;
        }
        const node = el('div', { class: `menu-item${item.disabled ? ' disabled' : ''}` }, [
          el('span', { class: 'chk', text: item.checked ? '✓' : '' }),
          el('span', { text: item.label }),
          item.shortcut ? el('span', { class: 'shortcut', text: item.shortcut }) : null,
        ]);
        if (!item.disabled && item.onClick) {
          node.addEventListener('click', () => {
            close();
            item.onClick();
          });
        }
        popup.appendChild(node);
      }
      document.body.appendChild(popup);
      const rect = popup.getBoundingClientRect();
      if (rect.right > window.innerWidth - 4) popup.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
      if (rect.bottom > window.innerHeight - 4) popup.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
      openMenu = popup;
      setTimeout(() => {
        document.addEventListener('pointerdown', (e) => {
          if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.menu-root')) close();
        }, { once: true });
      }, 0);
    };

    for (const menu of MENUS) {
      const root = el('div', { class: 'menu-root', text: menu.label });
      root.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openRoot === root) close();
        else showMenu(root, menu);
      });
      root.addEventListener('mouseenter', () => {
        if (openRoot && openRoot !== root) showMenu(root, menu);
      });
      bar.appendChild(root);
    }
    document.addEventListener('pointerdown', (e) => {
      if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.menu-root')) close();
    });
  }

  function queueMenu(which, x, y) {
    const r = x != null ? { left: x, top: y } : document.querySelector(`.tb[data-cmd="${which}"]`).getBoundingClientRect();
    const items = [];
    if (which === 'startqueue') {
      items.push({ label: 'Start main download queue', onClick: () => startQueue('q_main') });
      for (const q of App.state.queues.filter((q) => q.id !== 'q_main')) {
        items.push({ label: `Start "${q.name}"`, onClick: () => startQueue(q.id) });
      }
      items.push('sep', { label: 'Start all queues', onClick: () => startQueue('all') });
    } else {
      items.push({ label: 'Stop main download queue', onClick: () => stopQueue('q_main') });
      items.push('sep');
      items.push({ label: 'Stop all queues', onClick: () => stopQueue('all') });
      items.push({ label: 'Stop all downloads', onClick: () => cmd('stopall') });
    }
    items.push('sep', { label: 'Scheduler…', onClick: () => Dlg.scheduler() });
    contextMenu(items, r.left, r.bottom + 2);
  }

  function toolbarMenu(x, y) {
    const styles = [
      ['large3d', 'Large 3D buttons'],
      ['small3d', 'Small 3D buttons'],
      ['largeneon', 'Large Neon buttons'],
      ['smallneon', 'Small Neon buttons'],
    ];
    const items = styles.map(([key, label]) => ({
      label,
      checked: (settings().toolbarStyle || 'large3d') === key,
      onClick: async () => {
        await saveSettings({ toolbarStyle: key });
      },
    }));
    items.push('sep', { label: 'Customize…', onClick: () => Dlg.toolbarCustomize() });
    items.push({ label: 'Look for new toolbars', onClick: () => toast('Toolbar gallery is not available in this clone.', '') });
    if (x == null) {
      const b = document.querySelector('.tb[data-cmd="addurl"]');
      const r = b.getBoundingClientRect();
      contextMenu(items, r.left, r.bottom + 2);
    } else {
      contextMenu(items, x, y);
    }
  }

  /* ---------------------------------------------------------------- tree */

  function renderTree() {
    const tree = $('#tree');
    const panel = $('#tree-panel');
    panel.style.display = settings().showCategories === false ? 'none' : '';
    $('#splitter').style.display = settings().showCategories === false ? 'none' : '';
    tree.innerHTML = '';
    const counts = categoryCounts();

    const addTop = (key, label, icon, count, opts = {}) => {
      const row = el('div', {
        class: `tree-row${isTreeActive(key) ? ' selected' : ''}`,
        'data-tree': key,
      }, [
        el('span', { class: 'twisty', text: opts.expandable ? (App.state.expanded.has(key) ? '▾' : '▸') : '' }),
        el('span', { class: 'tree-icon', html: Icons.icon(icon) }),
        el('span', { class: 'label', text: label }),
        count != null ? el('span', { class: 'count', text: String(count) }) : null,
      ]);
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('twisty') && opts.expandable) {
          if (App.state.expanded.has(key)) App.state.expanded.delete(key);
          else App.state.expanded.add(key);
          renderTree();
          return;
        }
        selectTree({ type: key });
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (key === 'categories') categoriesMenu(e, null);
        if (key === 'queues') queueRootMenu(e);
      });
      tree.appendChild(row);
      return row;
    };

    addTop('all', 'All Downloads', 'download', counts.all);

    // categories group
    const catRow = addTop('categories', 'Categories', 'folderopen', null, { expandable: true });
    catRow.style.paddingLeft = '2px';
    const catWrap = el('div', { class: `tree-children${App.state.expanded.has('categories') ? '' : ' collapsed'}` });
    for (const c of App.state.categories.filter((c) => c.id !== 'cat_all')) {
      const row = el('div', {
        class: `tree-row${isTreeActive('category', c.id) ? ' selected' : ''}`,
      }, [
        el('span', { class: 'twisty', text: '' }),
        el('span', { class: 'tree-icon', html: Icons.icon('folder') }),
        el('span', { class: 'label', text: c.name }),
        el('span', { class: 'count', text: String(counts.byCat[c.id] || 0) }),
      ]);
      row.addEventListener('click', () => selectTree({ type: 'category', categoryId: c.id }));
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        categoriesMenu(e, c);
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-target');
        const id = e.dataTransfer.getData('text/idm-download');
        if (id) moveToCategory([id], c.id);
      });
      catWrap.appendChild(row);
    }
    tree.appendChild(catWrap);

    addTop('unfinished', 'Unfinished', 'unfinished', counts.unfinished);
    addTop('finished', 'Finished', 'finished', counts.finished);
    addTop('grabber', 'Grabber files', 'grabber', counts.grabber);

    const qRow = addTop('queues', 'Queues', 'folderopen', null, { expandable: true });
    qRow.style.paddingLeft = '2px';
    const qWrap = el('div', { class: `tree-children${App.state.expanded.has('queues') ? '' : ' collapsed'}` });
    for (const q of App.state.queues) {
      const row = el('div', {
        class: `tree-row${isTreeActive('queue', null, q.id) ? ' selected' : ''}`,
      }, [
        el('span', { class: 'twisty' }),
        el('span', { class: 'tree-icon', html: Icons.icon('queue') }),
        el('span', { class: 'label', text: q.name }),
        el('span', { class: 'count', text: String(counts.byQueue[q.id] || 0) }),
      ]);
      row.addEventListener('click', () => selectTree({ type: 'queue', queueId: q.id }));
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        queueMenuFor(q, e);
      });
      qWrap.appendChild(row);
    }
    tree.appendChild(qWrap);
  }

  function isTreeActive(type, categoryId, queueId) {
    const t = App.state.tree;
    if (type === 'category') return t.type === 'category' && t.categoryId === categoryId;
    if (type === 'queue') return t.type === 'queue' && t.queueId === queueId;
    return t.type === type;
  }

  function selectTree(sel) {
    App.state.tree = { type: sel.type, categoryId: sel.categoryId || null, queueId: sel.queueId || null };
    App.state.selection.clear();
    renderTree();
    renderList();
    renderStatus();
    updateToolbarState();
  }

  function categoryCounts() {
    const counts = { all: downloads().length, unfinished: 0, finished: 0, grabber: 0, byCat: {}, byQueue: {} };
    for (const d of downloads()) {
      if (d.status === 'complete') counts.finished++;
      else counts.unfinished++;
      if (d.isGrab) counts.grabber++;
      if (d.categoryId) counts.byCat[d.categoryId] = (counts.byCat[d.categoryId] || 0) + 1;
      if (d.queueId) counts.byQueue[d.queueId] = (counts.byQueue[d.queueId] || 0) + 1;
    }
    return counts;
  }

  function categoriesMenu(e, cat) {
    const items = [
      { label: 'Add category…', onClick: () => Dlg.editCategory(null) },
    ];
    if (cat) {
      items.push(
        { label: 'Edit category…', onClick: () => Dlg.editCategory(cat) },
        { label: 'Delete category', onClick: () => deleteCategory(cat) },
        'sep',
        { label: 'Open download folder', onClick: () => toast(`Default folder: ${cat.dir}`, '') }
      );
    }
    contextMenu(items, e.clientX, e.clientY);
  }

  function queueRootMenu(e) {
    contextMenu(
      [
        { label: 'New queue…', onClick: newQueue },
        { label: 'Start all queues', onClick: () => startQueue('all') },
        { label: 'Stop all queues', onClick: () => stopQueue('all') },
        'sep',
        { label: 'Scheduler…', onClick: () => Dlg.scheduler() },
      ],
      e.clientX,
      e.clientY
    );
  }

  function queueMenuFor(q, e) {
    contextMenu(
      [
        { label: `Start "${q.name}"`, onClick: () => startQueue(q.id) },
        { label: `Stop "${q.name}"`, onClick: () => stopQueue(q.id) },
        'sep',
        { label: 'Open queue in scheduler', onClick: () => Dlg.scheduler(q.id) },
        { label: 'Rename queue…', onClick: () => renameQueue(q) },
        { label: 'Delete queue', disabled: q.id === 'q_main', onClick: () => deleteQueue(q) },
      ],
      e.clientX,
      e.clientY
    );
  }

  /* ---------------------------------------------------------------- list */

  function currentRows() {
    const t = App.state.tree;
    let rows = downloads();
    if (t.type === 'category') rows = rows.filter((d) => d.categoryId === t.categoryId);
    else if (t.type === 'unfinished') rows = rows.filter((d) => d.status !== 'complete');
    else if (t.type === 'finished') rows = rows.filter((d) => d.status === 'complete');
    else if (t.type === 'grabber') rows = rows.filter((d) => d.isGrab);
    else if (t.type === 'queue') rows = rows.filter((d) => d.queueId === t.queueId);
    const key = App.state.sortKey;
    const dir = App.state.sortDir === 'asc' ? 1 : -1;
    if (key) {
      rows = rows.slice().sort((a, b) => {
        const av = sortValue(a, key);
        const bv = sortValue(b, key);
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }
    return rows;
  }

  function sortValue(d, key) {
    switch (key) {
      case 'name':
        return d.filename;
      case 'size':
        return d.size || 0;
      case 'status':
        return Fmt.status(d);
      case 'description':
        return d.description || '';
      case 'speed':
        return d.speed || 0;
      case 'lastTry':
        return d.lastTryAt || '';
      case 'added':
        return d.addedAt || '';
      case 'done':
        return d.status === 'complete' ? 1 : 0;
      case 'timeLeft':
        return d.size && d.speed ? (d.size - d.downloaded) / d.speed : 0;
      case 'saveTo':
        return d.saveTo || `${d.dir}\\${d.filename}`;
      case 'queue':
        return d.queueId ? 1 : 0;
      case 'url':
        return d.url;
      default:
        return '';
    }
  }

  function visibleColumns() {
    const cols = settings().columns || [];
    return cols.filter((c) => c.visible !== false);
  }

  function colWidth(c) {
    return Math.max(34, Number(c.width) || 80);
  }

  function renderList() {
    const head = $('#list-head');
    const body = $('#list-body');
    const cols = visibleColumns();
    head.innerHTML = '';
    let totalWidth = 0;
    for (const c of cols) {
      totalWidth += colWidth(c);
      const cell = el('div', {
        class: `col sortable ${c.align || ''}`,
        style: { width: `${colWidth(c)}px` },
      }, [
        el('span', { text: c.label }),
        App.state.sortKey === c.key ? el('span', { class: 'sort-arrow', text: App.state.sortDir === 'asc' ? '▲' : '▼' }) : null,
        el('span', { class: 'resizer', 'data-col': c.key }),
      ]);
      cell.addEventListener('click', (e) => {
        if (e.target.classList.contains('resizer')) return;
        if (App.state.sortKey === c.key) App.state.sortDir = App.state.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          App.state.sortKey = c.key;
          App.state.sortDir = 'asc';
        }
        saveSettings({ sortKey: App.state.sortKey, sortDir: App.state.sortDir }, true);
        renderList();
      });
      head.appendChild(cell);
    }
    head.style.minWidth = `${totalWidth}px`;

    const rows = currentRows();
    body.innerHTML = '';
    const frag = document.createDocumentFragment();
    const wrap = el('div', { style: { minWidth: `${totalWidth}px` } });

    rows.forEach((d) => {
      const row = el('div', {
        class: `row${App.state.selection.has(d.id) ? ' selected' : ''}${App.state.focusId === d.id ? ' focused' : ''}`,
        draggable: 'true',
        'data-id': d.id,
      });
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/idm-download', d.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      for (const c of cols) {
        const cell = el('div', { class: `cell ${c.key} ${c.align || ''}`, style: { width: `${colWidth(c)}px` } });
        renderCell(cell, c.key, d);
        row.appendChild(cell);
      }
      frag.appendChild(row);
    });
    wrap.appendChild(frag);
    body.appendChild(wrap);

    if (!rows.length) {
      const empty = el('div', { class: 'empty-state' });
      empty.innerHTML = `${Icons.icon('download')}<div>${emptyText()}</div>`;
      wrap.style.minHeight = '200px';
      wrap.appendChild(empty);
    }

    const resizer = head.querySelectorAll('.resizer');
    for (const r of resizer) r.addEventListener('pointerdown', (e) => startColumnResize(e, r.dataset.col));

    updateToolbarState();
    renderStatus();
  }

  function emptyText() {
    const t = App.state.tree.type;
    if (t === 'finished') return 'There are no completed downloads.';
    if (t === 'unfinished') return 'There are no unfinished downloads.';
    if (t === 'grabber') return 'There are no grabbed files yet.';
    if (t === 'queue') return 'This queue is empty.';
    if (t === 'category') return 'There are no downloads in this category.';
    return 'No downloads yet. Press "Add URL" to start one.';
  }

  function renderCell(cell, key, d) {
    switch (key) {
      case 'name': {
        cell.appendChild(el('span', { class: 'name-icon', html: Icons.fileIcon(Fmt.ext(d.filename)) }));
        cell.appendChild(el('span', { class: 'name-text', text: d.filename, title: d.filename }));
        break;
      }
      case 'queue':
        cell.textContent = d.queueId ? 'Q' : '';
        cell.classList.add('center');
        break;
      case 'size':
        cell.textContent = d.size ? Fmt.bytes(d.size) : d.downloaded ? Fmt.bytes(d.downloaded) : '';
        break;
      case 'status': {
        const wrap = el('span', { class: 'status-cell' });
        const pct = Fmt.percent(d);
        if (d.status === 'downloading' || (d.status === 'paused' && d.downloaded > 0)) {
          const bar = el('span', { class: 'mini-progress' }, [el('i', { style: { width: `${pct}%` } })]);
          wrap.appendChild(bar);
        }
        const label = Fmt.status(d) + (d.status === 'downloading' ? ` ${pct.toFixed(0)}%` : '');
        wrap.appendChild(
          el('span', {
            class: `status-text${d.status === 'error' ? ' error-text' : ''}`,
            text: label,
            title: d.error || '',
          })
        );
        cell.appendChild(wrap);
        break;
      }
      case 'speed':
        cell.textContent = d.status === 'downloading' ? Fmt.speed(d.speed) : '';
        break;
      case 'timeLeft':
        cell.textContent = d.status === 'downloading' ? Fmt.timeLeft(d) : '';
        break;
      case 'lastTry':
        cell.textContent = Fmt.date(d.lastTryAt);
        break;
      case 'added':
        cell.textContent = Fmt.date(d.addedAt);
        break;
      case 'done':
        cell.innerHTML = `<span class="done-mark ${d.status === 'complete' ? '' : 'pending'}">${d.status === 'complete' ? '✔' : ''}</span>`;
        cell.classList.add('center');
        break;
      case 'saveTo':
        cell.textContent = d.saveTo || `${d.dir}\\${d.filename}`;
        cell.title = cell.textContent;
        break;
      case 'url':
        cell.textContent = d.url;
        cell.classList.add('url-text');
        cell.title = d.url;
        break;
      case 'description':
        cell.textContent = d.description || '';
        cell.title = d.description || '';
        break;
      default:
        cell.textContent = '';
    }
  }

  function startColumnResize(e, key) {
    e.preventDefault();
    const col = settings().columns.find((c) => c.key === key);
    if (!col) return;
    const startX = e.clientX;
    const startW = colWidth(col);
    const target = e.target;
    target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      col.width = Math.max(34, startW + ev.clientX - startX);
      document.querySelectorAll(`#list-head .col`).forEach((c) => {
        if (c.querySelector(`.resizer[data-col="${key}"]`)) c.style.width = `${col.width}px`;
      });
      document.querySelectorAll(`#list-body .cell.${key}`).forEach((c) => (c.style.width = `${col.width}px`));
    };
    const up = async () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      await saveSettings({ columns: settings().columns }, true);
      renderList();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  }

  /* ---------------------------------------------------------------- selection */

  function selectedDownloads() {
    return downloads().filter((d) => App.state.selection.has(d.id));
  }

  function attachRowEvents() {
    const body = $('#list-body');
    body.addEventListener('click', (e) => {
      const row = e.target.closest('.row');
      if (!row) {
        if (!e.ctrlKey) {
          App.state.selection.clear();
          renderList();
        }
        return;
      }
      const id = row.dataset.id;
      const rows = currentRows();
      const idx = rows.findIndex((d) => d.id === id);
      if (e.shiftKey && App.state.anchor != null) {
        const a = rows.findIndex((d) => d.id === App.state.anchor);
        if (a >= 0) {
          const [s, t] = a < idx ? [a, idx] : [idx, a];
          for (let i = s; i <= t; i++) App.state.selection.add(rows[i].id);
        }
      } else if (e.ctrlKey) {
        if (App.state.selection.has(id)) App.state.selection.delete(id);
        else App.state.selection.add(id);
        App.state.anchor = id;
      } else {
        App.state.selection.clear();
        App.state.selection.add(id);
        App.state.anchor = id;
      }
      App.state.focusId = id;
      renderList();
    });
    body.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      const d = findDownload(row.dataset.id);
      if (!d) return;
      if (d.status === 'complete') openFile(d);
      else Dlg.properties(d);
    });
    body.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = e.target.closest('.row');
      if (row) {
        if (!App.state.selection.has(row.dataset.id)) {
          App.state.selection.clear();
          App.state.selection.add(row.dataset.id);
          renderList();
        }
        downloadMenu(e, selectedDownloads());
      } else {
        emptyListMenu(e);
      }
    });
  }

  function downloadMenu(e, sel) {
    const one = sel.length === 1 ? sel[0] : null;
    const hasPaused = sel.some((d) => d.status === 'paused' || d.status === 'error' || d.status === 'cancelled');
    const hasActive = sel.some((d) => d.status === 'downloading' || d.status === 'queued');
    const items = [
      { label: 'Start / Resume', disabled: !hasPaused, onClick: () => resumeSelected() },
      { label: 'Stop', disabled: !hasActive, onClick: () => stopSelected() },
      'sep',
      { label: 'Open file', disabled: sel.length !== 1 || !one || one.status !== 'complete', onClick: () => openFile(one) },
      { label: 'Open folder', disabled: !one, onClick: () => toast(`Files are stored in: ${one ? one.dir : ''}`, '') },
      { label: 'Properties…', disabled: !one, onClick: () => Dlg.properties(one) },
      'sep',
      { label: 'Delete', onClick: () => deleteSelected() },
      { label: 'Copy URL', disabled: !one, onClick: () => copyText(one.url) },
      'sep',
      { label: 'Add to queue', disabled: !App.state.queues.length, onClick: () => addToQueue(sel) },
      { label: 'Delete from queue', disabled: !sel.some((d) => d.queueId), onClick: () => removeFromQueue(sel) },
    ];
    contextMenu(items, e.clientX, e.clientY);
  }

  function emptyListMenu(e) {
    contextMenu(
      [
        { label: 'Add URL…', onClick: () => Dlg.addUrl() },
        { label: 'Add batch download…', onClick: () => Dlg.batch() },
        'sep',
        { label: 'Refresh', onClick: refreshState },
        { label: 'Columns…', onClick: () => Dlg.columns() },
      ],
      e.clientX,
      e.clientY
    );
  }

  /* ---------------------------------------------------------------- status */

  function renderStatus() {
    const bar = $('#statusbar');
    bar.style.display = settings().showStatusBar === false ? 'none' : '';
    const rows = currentRows();
    const sel = selectedDownloads();
    const active = downloads().filter((d) => d.status === 'downloading');
    const totalSpeed = active.reduce((a, d) => a + (d.speed || 0), 0);
    let main;
    if (active.length) main = `Downloading ${active.length} file${active.length === 1 ? '' : 's'}…`;
    else if (App.state.queueRunning) main = 'Queue is running.';
    else main = `${rows.length} item${rows.length === 1 ? '' : 's'}`;
    $('#status-main').textContent = main;
    $('#status-selected').textContent = `${sel.length} selected`;
    $('#status-speed').textContent = totalSpeed ? Fmt.speed(totalSpeed) : '';
    $('#status-queue').textContent = App.state.queueRunning ? 'Queue: running' : 'Queue: stopped';
    const conn = $('#status-conn');
    conn.textContent = App.state.connection ? 'Connected' : 'Offline';
    conn.style.color = App.state.connection ? '#1d5c1d' : '#a33';
    drawGraph(totalSpeed);
  }

  function drawGraph(speed) {
    const canvas = $('#mini-graph');
    if (!canvas || !canvas.width) return;
    const ctx = canvas.getContext('2d');
    App.state.speedSamples.push(speed);
    if (App.state.speedSamples.length > 72) App.state.speedSamples.shift();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const max = Math.max(1024, ...App.state.speedSamples);
    ctx.strokeStyle = '#3f9b2f';
    ctx.fillStyle = 'rgba(90, 200, 80, .35)';
    ctx.beginPath();
    const n = App.state.speedSamples.length;
    const step = w / Math.max(1, n - 1);
    ctx.moveTo(0, h);
    App.state.speedSamples.forEach((s, i) => {
      const y = h - (s / max) * (h - 2) - 1;
      ctx.lineTo(i * step, y);
    });
    ctx.lineTo((n - 1) * step, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /* ---------------------------------------------------------------- commands */

  async function cmd(name) {
    switch (name) {
      case 'addurl':
        Dlg.addUrl();
        break;
      case 'resume':
        resumeSelected();
        break;
      case 'stop':
        stopSelected();
        break;
      case 'stopall':
        await stopAll();
        break;
      case 'delete':
        deleteSelected();
        break;
      case 'deletecompleted':
        Dlg.deleteCompleted();
        break;
      case 'options':
        Dlg.options();
        break;
      case 'scheduler':
        Dlg.scheduler();
        break;
      case 'startqueue':
        startQueue();
        break;
      case 'stopqueue':
        stopQueue();
        break;
      case 'grabber':
        Dlg.grabber();
        break;
      case 'tellfriend':
        Dlg.tellFriend();
        break;
      default:
        break;
    }
  }

  async function resumeSelected() {
    const sel = selectedDownloads().filter((d) => d.status !== 'complete' && d.status !== 'downloading');
    if (!sel.length) return;
    for (const d of sel) {
      try {
        await Api.post(`/api/downloads/${d.id}/resume`);
      } catch (err) {
        toast(err.message, 'error', d.filename);
      }
    }
    await refreshState();
  }

  async function stopSelected() {
    const sel = selectedDownloads().filter((d) => d.status === 'downloading' || d.status === 'queued');
    for (const d of sel) {
      try {
        await Api.post(`/api/downloads/${d.id}/stop`);
      } catch (err) {
        toast(err.message, 'error', d.filename);
      }
    }
    await refreshState();
  }

  async function stopAll() {
    const active = downloads().filter((d) => d.status === 'downloading' || d.status === 'queued');
    if (!active.length) return;
    for (const d of active) await Api.post(`/api/downloads/${d.id}/stop`).catch(() => {});
    await refreshState();
  }

  async function deleteSelected() {
    const sel = selectedDownloads();
    if (!sel.length) return;
    const unfinished = sel.filter((d) => d.status !== 'complete');
    let deleteFiles = true;
    if (unfinished.length) {
      const ok = await confirm(
        'The selected download is not complete. Do you want to delete it from the list?',
        'The partially downloaded data will be removed from the storage folder.',
        { yes: 'Yes', no: 'No' }
      );
      if (!ok) return;
    }
    for (const d of sel) {
      await Api.del(`/api/downloads/${d.id}`, { deleteFile: deleteFiles }).catch((err) => toast(err.message, 'error'));
    }
    App.state.selection.clear();
    await refreshState();
  }

  async function addToQueue(sel) {
    const choice = await chooseQueue();
    if (!choice) return;
    for (const d of sel) {
      await Api.post(`/api/downloads/${d.id}/queue`, { queueId: choice }).catch((err) => toast(err.message, 'error'));
    }
    await refreshState();
    toast(`Added ${sel.length} file${sel.length === 1 ? '' : 's'} to the queue.`, 'success');
  }

  async function removeFromQueue(sel) {
    for (const d of sel) {
      if (!d.queueId) continue;
      await Api.post(`/api/downloads/${d.id}/queue`, { queueId: null }).catch(() => {});
    }
    await refreshState();
  }

  function chooseQueue() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const select = el('select', { class: 'select-input', style: { width: '100%' } });
      for (const q of App.state.queues) select.appendChild(el('option', { value: q.id, text: q.name }));
      const content = el('div', {}, [
        el('div', { text: 'Select the queue for the selected downloads:', style: { marginBottom: '6px' } }),
        select,
      ]);
      const inst = UI.open({
        title: 'Add to Queue',
        width: 380,
        content,
        buttons: [
          { label: 'OK', primary: true, onClick: (api) => { finish(select.value); api.close('ok'); } },
          { label: 'Cancel', onClick: (api) => { finish(null); api.close('cancel'); } },
        ],
        onClose: () => finish(null),
      });
      return inst;
    });
  }

  async function startQueue(queueId) {
    const id = queueId || 'q_main';
    await Api.post('/api/queue/start', { queueId: id });
    await refreshState();
    const q = App.state.queues.find((x) => x.id === id);
    toast(id === 'all' ? 'All download queues started.' : `"${q ? q.name : 'Download queue'}" started.`, 'info');
  }

  async function stopQueue(queueId) {
    const id = queueId || 'all';
    await Api.post('/api/queue/stop', { queueId: id });
    await refreshState();
    const q = App.state.queues.find((x) => x.id === id);
    toast(id === 'all' ? 'All download queues stopped.' : `"${q ? q.name : 'Download queue'}" stopped.`, 'info');
  }

  function openFile(d) {
    if (!d) return;
    const a = document.createElement('a');
    a.href = `/api/downloads/${d.id}/file`;
    a.download = d.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard.', 'success');
    } catch {
      toast('Clipboard access is not available.', 'error');
    }
  }

  /* ---------------------------------------------------------------- settings */

  async function saveSettings(patch, silent) {
    try {
      const data = await Api.post('/api/settings', patch);
      App.state.settings = data.settings;
      renderToolbar();
      renderTree();
      renderList();
      renderStatus();
      if (!silent) toast('Settings saved.', 'success');
      return data.settings;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleCategories() {
    await saveSettings({ showCategories: settings().showCategories === false }, true);
    renderTree();
  }

  function toggleToolbar() {
    const bar = $('#toolbar');
    bar.style.display = bar.style.display === 'none' ? '' : 'none';
  }

  async function toggleStatusBar() {
    await saveSettings({ showStatusBar: settings().showStatusBar === false }, true);
    renderStatus();
  }

  async function newQueue() {
    const name = await prompt({ title: 'New download queue', label: 'Queue name:', hint: 'Queues group downloads and start together from the scheduler.' });
    if (!name) return;
    try {
      await Api.post('/api/queues', { name });
      await refreshState();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function renameQueue(q) {
    const name = await prompt({ title: 'Rename queue', label: 'Queue name:', value: q.name });
    if (!name) return;
    // renaming uses the queues endpoint by recreating the list on the server
    try {
      await Api.post('/api/queues/rename', { id: q.id, name });
      await refreshState();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteQueue(q) {
    const ok = await confirm(`Delete the queue "${q.name}"?`, 'Downloads assigned to this queue will remain in the list.');
    if (!ok) return;
    try {
      await Api.del(`/api/queues/${q.id}`);
      await refreshState();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteCategory(cat) {
    const ok = await confirm(`Delete the category "${cat.name}"?`, 'Files already downloaded are not deleted.');
    if (!ok) return;
    try {
      await Api.del(`/api/categories/${cat.id}`);
      await refreshState();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function moveToCategory(ids, categoryId) {
    const cat = App.state.categories.find((c) => c.id === categoryId);
    for (const id of ids) {
      const d = findDownload(id);
      if (!d || !cat) continue;
      await Api.post(`/api/downloads/${id}/properties`, {
        dir: cat.dir,
        filename: d.filename,
      }).catch((err) => toast(err.message, 'error'));
    }
    await refreshState();
  }

  function importDownloads() {
    const input = el('input', { type: 'file', accept: '.txt,.json,.lst', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.remove();
      if (!file) return;
      const text = await file.text();
      let urls = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) urls = parsed.map((x) => (typeof x === 'string' ? x : x.url)).filter(Boolean);
        } catch {
          toast('The selected file is not a valid JSON downloads list.', 'error');
          return;
        }
      } else {
        urls = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
      }
      if (!urls.length) {
        toast('No downloadable addresses were found in the file.', 'error');
        return;
      }
      Dlg.batch({ urls });
    });
    input.click();
  }

  function exportDownloads() {
    const rows = downloads().map((d) => ({
      url: d.url,
      filename: d.filename,
      size: d.size,
      status: d.status,
      description: d.description,
      saveTo: d.saveTo,
    }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'idm-downloads.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Downloads list exported.', 'success');
  }

  function exitApp() {
    confirm('Do you want to exit Internet Download Manager?', 'Active downloads will be paused and can be resumed next time.')
      .then((ok) => {
        if (!ok) return;
        document.body.innerHTML = '';
        const wrap = el('div', {
          style: {
            position: 'fixed',
            inset: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'radial-gradient(1000px 600px at 50% 20%, #4a86b4, #173b56)',
            color: '#fff',
            fontFamily: 'Segoe UI, sans-serif',
          },
        }, [
          el('div', { html: Icons.icon('idmlogo'), style: { width: '48px', height: '48px' } }),
          el('div', { text: 'Internet Download Manager has been closed.', style: { fontSize: '15px' } }),
          el('button', {
            class: 'btn',
            text: 'Start again',
            style: { marginTop: '8px' },
            onClick: () => location.reload(),
          }),
        ]);
        document.body.appendChild(wrap);
      });
  }

  /* ---------------------------------------------------------------- window chrome */

  function initChrome() {
    $('#title-icon').innerHTML = Icons.icon('idmlogo');
    const win = $('#app');
    $('#btn-maximize').addEventListener('click', () => {
      win.classList.toggle('maximized');
    });
    $('#btn-minimize').addEventListener('click', () => {
      win.style.transition = 'transform .18s ease, opacity .18s';
      win.style.transform = 'translateY(28px) scale(.65)';
      win.style.opacity = '0';
      setTimeout(() => {
        win.style.display = 'none';
        const restore = el('div', {
          style: {
            position: 'fixed',
            left: '12px',
            bottom: '12px',
            zIndex: '9000',
            background: 'linear-gradient(to bottom, #f6fbff, #d6e9f8)',
            border: '1px solid #6f9cc0',
            borderRadius: '4px',
            padding: '6px 12px 6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            boxShadow: '0 4px 14px rgba(0,0,0,.4)',
            cursor: 'default',
            fontSize: '12px',
          },
        }, [
          el('span', { html: Icons.icon('idmlogo'), style: { width: '16px', height: '16px', display: 'flex' } }),
          el('span', { text: 'Internet Download Manager' }),
        ]);
        restore.addEventListener('click', () => {
          restore.remove();
          win.style.display = '';
          win.style.transform = '';
          win.style.opacity = '';
        });
        document.body.appendChild(restore);
      }, 180);
    });
    $('#btn-close').addEventListener('click', exitApp);
    $('#hide-categories').addEventListener('click', () => saveSettings({ showCategories: false }, true).then(renderTree));

    // splitter
    const splitter = $('#splitter');
    const panel = $('#tree-panel');
    splitter.addEventListener('pointerdown', (e) => {
      splitter.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      const move = (ev) => {
        const w = Math.min(460, Math.max(140, startW + ev.clientX - startX));
        panel.style.flexBasis = `${w}px`;
        panel.style.width = `${w}px`;
      };
      const up = () => {
        splitter.removeEventListener('pointermove', move);
        splitter.removeEventListener('pointerup', up);
      };
      splitter.addEventListener('pointermove', move);
      splitter.addEventListener('pointerup', up);
    });

    // drag & drop URLs onto the window
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('text/uri-list')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (uri && /^https?:\/\//i.test(uri.trim())) {
        e.preventDefault();
        Dlg.addUrl(uri.trim().split(/\r?\n/)[0]);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (UI.stack.length) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        Dlg.addUrl();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resumeSelected();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        App.state.selection = new Set(currentRows().map((d) => d.id));
        renderList();
      } else if (e.key === 'Delete') {
        deleteSelected();
      } else if (e.key === 'F5') {
        e.preventDefault();
        refreshState();
      } else if (e.key === 'F1') {
        e.preventDefault();
        Dlg.help();
      }
    });

    window.addEventListener('beforeunload', () => {
      /* engine keeps running server-side */
    });
  }

  /* ---------------------------------------------------------------- boot */

  function renderAll() {
    renderToolbar();
    renderMenus();
    renderTree();
    renderList();
    renderStatus();
  }

  function setConnection(ok) {
    App.state.connection = ok;
    renderStatus();
  }

  function showMain() {
    $('#app').classList.remove('hidden');
    const s = settings();
    $('#title-text').textContent = `Internet Download Manager ${s.version || '6.43'}`;
  }

  App.init = async function (preset) {
    initChrome();
    attachRowEvents();
    const data = preset || (await Api.get('/api/state'));
    applyFullState(data);
    const live = new LiveConnection(
      (snap) => applySnapshot(snap),
      (notice) => {
        if (notice.kind === 'complete') {
          const d = findDownload(notice.id);
          if (d && settings().showCompleteDialog !== false) Dlg.downloadComplete(d);
          else toast(`${notice.filename || 'Download'} completed.`, 'success');
        } else if (notice.kind === 'error') {
          const d = findDownload(notice.id);
          toast(notice.message, 'error', d ? d.filename : 'Download error');
        }
      },
      (ok) => setConnection(ok)
    );
    App.live = live;
    setConnection(true);
    return data;
  };

  App.showMain = showMain;
  App.refresh = refreshState;
  App.saveSettings = saveSettings;
  App.findDownload = findDownload;
  App.downloads = downloads;
  App.selectedDownloads = selectedDownloads;
  App.renderAll = renderAll;
  App.setConnection = setConnection;
  App.cmd = cmd;
  App.openFile = openFile;
  App.copyText = copyText;
  App.currentRows = currentRows;
  App.startQueue = startQueue;
  App.stopQueue = stopQueue;
  App.stateRef = App.state;

  window.App = App;
})();
