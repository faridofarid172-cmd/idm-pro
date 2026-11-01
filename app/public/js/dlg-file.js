(function () {
  const Dlg = (window.Dlg = window.Dlg || {});
  const { el, toast, confirm, messageBox, prompt, folderPicker } = UI;

  const LS = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore quota */
      }
    },
  };

  function recentUrls() {
    return LS.get('idm.recentUrls', []);
  }

  function pushRecent(url) {
    const list = recentUrls().filter((u) => u !== url);
    list.unshift(url);
    LS.set('idm.recentUrls', list.slice(0, 20));
  }

  function normalizeUrl(input) {
    let value = String(input || '').trim();
    if (!value) return null;
    if (!/^[a-z]+:\/\//i.test(value)) value = `http://${value}`;
    try {
      const u = new URL(value);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------- Add URL */

  Dlg.addUrl = function (initialUrl) {
    const recent = recentUrls();
    const input = el('input', {
      class: 'text-input',
      style: { flex: '1 1 auto', height: '23px' },
      value: initialUrl || recent[0] || '',
      spellcheck: 'false',
    });
    const dropdown = el('button', { class: 'btn icon-only', title: 'Recent addresses', text: '▾' });
    const addressRow = el('div', { style: { display: 'flex', gap: '0' } }, [
      el('div', { style: { flex: '1', display: 'flex' } }, [
        input,
        dropdown,
      ]),
    ]);
    const login = el('input', { class: 'text-input', disabled: true });
    const password = el('input', { class: 'text-input', type: 'password', disabled: true });
    const authCheck = el('input', { type: 'checkbox' });
    const authGroup = el('div', { class: 'groupbox', style: { marginLeft: '58px', marginTop: '4px' } }, [
      el('div', { style: { display: 'grid', gridTemplateColumns: '40px 1fr 62px 1fr', alignItems: 'center', gap: '6px' } }, [
        el('label', { class: 'field-label', text: 'Login' }),
        login,
        el('label', { class: 'field-label', text: 'Password' }),
        password,
      ]),
    ]);
    authCheck.addEventListener('change', () => {
      login.disabled = !authCheck.checked;
      password.disabled = !authCheck.checked;
      if (authCheck.checked) login.focus();
    });

    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center', marginBottom: '4px' } }, [
        el('label', { class: 'field-label', text: 'Address', style: { width: '52px' } }),
        addressRow,
      ]),
      el('label', { class: 'check', style: { marginLeft: '61px' } }, [authCheck, 'Use authorization']),
      authGroup,
    ]);

    const inst = UI.open({
      title: 'Enter new address to download',
      width: 560,
      content,
      autoFocus: true,
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: (api) => {
            const url = normalizeUrl(input.value);
            if (!url) {
              toast('Enter a valid http:// or https:// address.', 'error');
              input.focus();
              return;
            }
            api.close('ok');
            pushRecent(url);
            Dlg.downloadFileInfo(url, {
              username: authCheck.checked ? login.value : '',
              password: authCheck.checked ? password.value : '',
            });
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
      onMount: () => {
        const sel = input.value ? null : 'input';
        setTimeout(() => input.focus(), 20);
      },
    });

    dropdown.addEventListener('click', () => {
      if (!recent.length) {
        toast('There are no recently used addresses yet.', '');
        return;
      }
      const items = recent.map((u) => ({
        label: u.length > 70 ? `${u.slice(0, 70)}…` : u,
        onClick: () => {
          input.value = u;
          input.focus();
        },
      }));
      const r = dropdown.getBoundingClientRect();
      UI.contextMenu(items, r.left - 260, r.bottom);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const ok = inst.api.footer.querySelector('.btn.default') || inst.api.footer.querySelector('.btn');
        if (ok) ok.click();
      }
    });
    return inst;
  };

  /* ------------------------------------------------------------- Download File Info */

  Dlg.downloadFileInfo = function (url, auth = {}) {
    const settings = App.state.settings;
    const cats = App.state.categories;
    let info = null;
    let pending = true;
    let error = '';

    const urlBox = el('input', { class: 'text-input', value: url, readonly: true, style: { flex: '1' } });
    const catSelect = el('select', { class: 'select-input', style: { flex: '1' } });
    for (const c of cats.filter((c) => c.id !== 'cat_all')) {
      catSelect.appendChild(el('option', { value: c.id, text: c.name }));
    }
    const addCat = el('button', { class: 'btn small icon-only', text: '+', title: 'New category' });

    const saveAs = el('input', { class: 'text-input', style: { flex: '1' } });
    const browseBtn = el('button', { class: 'btn small', text: '…', style: { minWidth: '26px' }, title: 'Browse' });
    const remember = el('input', { type: 'checkbox', checked: LS.get('idm.rememberCategory', true) });
    const rememberLabel = el('label', { class: 'check', style: { marginLeft: '70px' } }, [remember, 'Remember this path for the category']);
    const catPath = el('input', { class: 'text-input', readonly: true, style: { marginLeft: '70px', width: 'calc(100% - 70px)', background: '#f7f7f7' } });

    const iconBox = el('div', { style: { width: '38px', height: '38px', display: 'flex' } });
    const sizeLabel = el('div', { class: 'hint', style: { textAlign: 'center', marginTop: '4px' } });
    const previewBtn = el('button', { class: 'btn small', text: 'Preview', style: { minWidth: '76px' } });
    previewBtn.disabled = true;

    const desc = el('input', { class: 'text-input', placeholder: '' });
    const status = el('div', { class: 'hint', text: 'Retrieving file information…', style: { minHeight: '14px' } });

    const content = el('div', {}, [
      el('div', { style: { display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px 8px', alignItems: 'center' } }, [
        el('label', { class: 'field-label', text: 'URL' }),
        urlBox,
        el('label', { class: 'field-label', text: 'Category' }),
        el('div', { style: { display: 'flex', gap: '6px' } }, [catSelect, addCat]),
        el('label', { class: 'field-label', text: 'Save As' }),
        el('div', { style: { display: 'flex', gap: '6px' } }, [saveAs, browseBtn]),
        el('div'),
        rememberLabel,
        el('div'),
        catPath,
        el('label', { class: 'field-label', text: 'Description', style: { alignSelf: 'start', paddingTop: '3px' } }),
        desc,
      ]),
      el('div', { style: { display: 'flex', gap: '12px', marginTop: '10px' } }, [
        el('div', { style: { flex: '1' } }, [status]),
        el('div', { style: { width: '88px', textAlign: 'center' } }, [iconBox, sizeLabel, previewBtn]),
      ]),
    ]);

    let currentFilename = '';
    let currentDir = '';

    function category() {
      return cats.find((c) => c.id === catSelect.value) || null;
    }

    function updateIcon() {
      iconBox.innerHTML = Icons.fileIcon(Fmt.ext(currentFilename || 'download'));
      iconBox.querySelector('svg').style.width = '36px';
      iconBox.querySelector('svg').style.height = '36px';
    }

    function applyFilename(name, keepDir) {
      currentFilename = name;
      if (!keepDir) {
        const cat = category();
        currentDir = cat ? cat.dir : App.state.settings.saveTo;
      }
      saveAs.value = `${currentDir}\\${currentFilename}`;
      catPath.value = `${currentDir}\\`;
      sizeLabel.textContent = info && info.size ? Fmt.bytes(info.size) : '';
      updateIcon();
    }

    function fromSelect() {
      const cat = category();
      const remembered = LS.get('idm.catDirs', {});
      const useDir = cat && remembered[cat.id] ? remembered[cat.id] : cat ? cat.dir : settings.saveTo;
      currentDir = useDir;
      applyFilename(currentFilename || 'download', true);
    }

    catSelect.addEventListener('change', fromSelect);
    addCat.addEventListener('click', async () => {
      const created = await Dlg.editCategory(null);
      if (created) {
        location.reload();
      }
    });

    browseBtn.addEventListener('click', async () => {
      const dir = await folderPicker(currentDir || 'Downloads');
      if (dir) {
        currentDir = dir;
        applyFilename(currentFilename, true);
      }
    });

    saveAs.addEventListener('change', () => {
      const val = saveAs.value.trim();
      const name = val.split(/[\\/]/).pop();
      if (name) {
        currentFilename = name;
        currentDir = val.slice(0, val.length - name.length).replace(/[\\/]$/, '');
        applyFilename(name, true);
      }
    });

    previewBtn.addEventListener('click', async () => {
      previewBtn.disabled = true;
      previewBtn.textContent = 'Loading…';
      try {
        const data = await Api.preview(url, auth.username, auth.password);
        Dlg.zipPreview(url, data);
      } catch (err) {
        await messageBox({ title: 'Preview', message: 'Cannot preview this file.', detail: err.message, kind: 'error' });
      } finally {
        previewBtn.disabled = !/\.zip$/i.test(currentFilename);
        previewBtn.textContent = 'Preview';
      }
    });

    async function loadInfo() {
      try {
        info = await Api.urlInfo(url, auth.username, auth.password);
        currentFilename = info.filename;
        const suggested = cats.find((c) => c.id === info.categoryId);
        if (suggested) catSelect.value = suggested.id;
        const remembered = LS.get('idm.catDirs', {})[catSelect.value];
        currentDir = remembered || info.suggestedDir || settings.saveTo;
        applyFilename(currentFilename, true);
        const existing = App.downloads().find((d) => d.url === url);
        if (existing) {
          status.innerHTML = `<span class="error-text">This address is already in the download list (${Fmt.escapeHtml(existing.filename)}).</span>`;
          status.dataset.duplicate = '1';
        } else {
          status.textContent = info.size ? '' : 'The server did not report a file size.';
        }
        previewBtn.disabled = !/\.zip$/i.test(currentFilename);
      } catch (err) {
        error = err.message;
        status.innerHTML = `<span class="error-text">${Fmt.escapeHtml(err.message)}</span>`;
        currentFilename = info ? info.filename : url.split('/').pop().split('?')[0] || 'download.bin';
        currentDir = settings.saveTo;
        applyFilename(currentFilename, true);
        status.textContent = err.message;
      } finally {
        pending = false;
        iconBox.style.opacity = '1';
      }
    }

    const inst = UI.open({
      title: 'Download File Info',
      width: 620,
      content,
      icon: 'download',
      buttons: [
        {
          label: 'Preview',
          disabled: true,
          onClick: (api) => previewBtn.click(),
        },
        { label: 'Download Later', onClick: (api) => submit(api, false) },
        { label: 'Start Download', primary: true, onClick: (api) => submit(api, true) },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
      onMount: () => {
        iconBox.innerHTML = Icons.fileIcon('bin');
        iconBox.querySelector('svg').style.width = '36px';
        iconBox.querySelector('svg').style.height = '36px';
        catSelect.value = cats.find((c) => c.id === 'cat_all') ? cats[1]?.id || catSelect.value : catSelect.value;
        loadInfo();
      },
    });

    const footerButtons = inst.api.footer.querySelectorAll('.btn');
    footerButtons[0].style.display = 'none'; // footer Preview is represented by the in-body button
    footerButtons[0].disabled = true;

    async function submit(api, start) {
      if (!currentFilename) {
        toast('Enter a file name.', 'error');
        return;
      }
      if (pending) {
        // wait a moment for the metadata probe, but do not block the user
      }
      const existing = App.downloads().find((d) => d.url === url);
      if (existing) {
        const action = settings.duplicateAction;
        if (action === 'ask') {
          const ok = await confirm('This address is already in the download list. Add it again?', existing.filename);
          if (!ok) return;
        } else if (action === 'skip') {
          toast('The address was skipped because it is already in the list.', 'error');
          return;
        }
      }
      if (remember.checked) {
        LS.set('idm.rememberCategory', true);
        const dirs = LS.get('idm.catDirs', {});
        dirs[catSelect.value] = currentDir;
        LS.set('idm.catDirs', dirs);
      }
      try {
        const payload = {
          url,
          filename: currentFilename,
          dir: currentDir,
          categoryId: catSelect.value || null,
          description: desc.value,
          username: auth.username,
          password: auth.password,
          size: info ? info.size : null,
          start,
        };
        const res = await Api.post('/api/downloads', payload);
        api.close('ok');
        await App.refresh();
        if (start) {
          Dlg.progress(res.download);
        } else {
          toast(`"${res.download.filename}" was added to the download list.`, 'info');
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    desc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const btn = Array.from(inst.api.footer.querySelectorAll('.btn')).find((b) => b.textContent === 'Start Download');
        if (btn) btn.click();
      }
    });
    setTimeout(() => desc.focus(), 60);
  };

  /* ------------------------------------------------------------- File Properties */

  Dlg.properties = function (download) {
    const d = App.findDownload(download.id) || download;
    const busy = d.status === 'downloading' || d.status === 'queued';
    const fields = {};

    const makeField = (label, value, opts = {}) => {
      const input = el('input', {
        class: 'text-input',
        value: value || '',
        readOnly: !!opts.readOnly,
        style: { flex: '1' },
        placeholder: opts.placeholder || '',
      });
      if (opts.readOnly) input.style.background = '#fff';
      fields[opts.key || label] = input;
      return input;
    };

    const icon = el('div', { style: { width: '32px', height: '32px' } });
    icon.innerHTML = Icons.fileIcon(Fmt.ext(d.filename));
    icon.querySelector('svg').style.width = '30px';
    icon.querySelector('svg').style.height = '30px';

    const saveTo = makeField('saveTo', d.saveTo || `${d.dir}\\${d.filename}`, { readOnly: busy });
    const browse = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '68px' }, disabled: busy });
    const address = makeField('address', d.url, { readOnly: busy });
    const desc = el('input', { class: 'text-input', value: d.description || '' });
    const page = el('div', { class: 'link', text: d.pageUrl || 'http://www.internetdownloadmanager.com/' });
    const referrer = makeField('referrer', d.referrer || '', { readOnly: busy });
    const login = makeField('login', d.username || '', { readOnly: busy });
    const password = makeField('password', d.password || '', { readOnly: busy });
    password.type = 'password';

    const row = (label, control, width = '84px') =>
      el('div', { style: { display: 'grid', gridTemplateColumns: `${width} 1fr`, gap: '8px', alignItems: 'center', marginBottom: '6px' } }, [
        el('label', { class: 'field-label', text: label }),
        control,
      ]);

    const kv = (k, v) =>
      el('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', marginBottom: '4px' } }, [
        el('span', { class: 'hint', text: k }),
        el('span', { text: v }),
      ]);

    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '9px', alignItems: 'center', marginBottom: '10px' } }, [
        icon,
        el('div', { style: { fontWeight: '600' }, text: d.filename }),
      ]),
      el('hr', { style: { border: 'none', borderTop: '1px solid #d4dee8', margin: '0 0 8px' } }),
      kv('Type:', Fmt.typeName(d.filename)),
      kv('Status:', `${Fmt.status(d)}${d.size ? ` — ${Fmt.percent(d).toFixed(2)}% complete` : ''}`),
      kv('Size:', d.size ? Fmt.bytesExact(d.size) : d.downloaded ? Fmt.bytesExact(d.downloaded) : 'Unknown'),
      el('div', { style: { display: 'flex', gap: '6px', marginBottom: '6px' } }, [
        el('label', { class: 'field-label', text: 'Save To:', style: { width: '84px' } }),
        saveTo,
        browse,
      ]),
      row('Address:', address),
      row('Description:', desc),
      el('div', { style: { margin: '8px 0 5px' } }, [el('div', { text: 'The web page from which this file was obtained:' }), page]),
      row('Referrer:', referrer),
      el('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'center', marginBottom: '6px' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          el('label', { class: 'field-label', text: 'Login' }),
        ]),
        login,
      ]),
      el('div', { style: { display: 'grid', gridTemplateColumns: '84px 1fr', gap: '8px', alignItems: 'center', marginBottom: '6px' } }, [
        el('label', { class: 'field-label', text: 'Password' }),
        password,
      ]),
      el('hr', { style: { border: 'none', borderTop: '1px solid #d4dee8', margin: '8px 0' } }),
      kv('Last try date:', Fmt.date(d.lastTryAt) || ''),
      kv('Result:', d.error || (d.status === 'complete' ? 'Download complete' : Fmt.status(d))),
    ]);

    browse.addEventListener('click', async () => {
      const current = saveTo.value;
      const dir = await folderPicker(Fmt.dirname(current) || d.dir);
      if (dir) {
        const name = Fmt.basename(current);
        saveTo.value = Fmt.joinPath(dir, name);
      }
    });

    UI.open({
      title: 'File Properties',
      width: 470,
      content,
      icon: 'download',
      buttons: [
        {
          label: 'Open',
          disabled: d.status !== 'complete',
          onClick: () => App.openFile(d),
        },
        {
          label: 'OK',
          primary: true,
          onClick: async (api) => {
            if (busy) {
              api.close('ok');
              return;
            }
            const newPath = saveTo.value.trim();
            const filename = Fmt.basename(newPath);
            const dir = Fmt.dirname(newPath);
            if (!filename) return;
            const newUrl = normalizeUrl(address.value);
            if (!newUrl) {
              toast('Enter a valid address.', 'error');
              return;
            }
            try {
              await Api.post(`/api/downloads/${d.id}/properties`, {
                filename,
                dir: dir || d.dir,
                url: newUrl,
                description: desc.value,
                username: login.value,
                password: password.value,
              });
              api.close('ok');
              await App.refresh();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
      ],
    });
  };

  /* ------------------------------------------------------------- Progress */

  const progressDialogs = new Map();

  Dlg.progress = function (download) {
    const existing = progressDialogs.get(download.id);
    if (existing) {
      existing.focus();
      return existing;
    }
    let d = App.findDownload(download.id) || download;
    const title = el('div', {
      style: { fontWeight: '600', fontSize: '12.5px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      text: d.filename,
    });
    const percentText = el('span', { text: '0%' });
    const barFill = el('i', { style: { width: '0%' } });
    const bar = el('div', { class: 'progress-bar' }, [barFill]);
    const meta = el('div', { class: 'kv', style: { marginTop: '8px' } }, []);
    const chart = el('canvas', { class: 'progress-chart', width: '460', height: '54' });
    const buttons = {};
    let pauseBtn;
    let samples = [];

    const content = el('div', {}, [
      title,
      el('div', { class: 'progress-wrap' }, [bar, percentText]),
      el('div', { class: 'kv' }, [
        el('span', { class: 'k', text: 'Status:' }),
        el('span', { class: 'v', id: 'p-status' }),
        el('span', { class: 'k', text: 'Size:' }),
        el('span', { class: 'v', id: 'p-size' }),
        el('span', { class: 'k', text: 'Transferred:' }),
        el('span', { class: 'v', id: 'p-transferred' }),
        el('span', { class: 'k', text: 'Speed:' }),
        el('span', { class: 'v', id: 'p-speed' }),
        el('span', { class: 'k', text: 'Time left:' }),
        el('span', { class: 'v', id: 'p-eta' }),
      ]),
      el('div', { style: { marginTop: '8px' } }, [chart]),
    ]);

    const inst = UI.open({
      title: 'Download Progress',
      width: 520,
      content,
      icon: 'download',
      modal: false,
      buttons: [
          {
            label: 'Pause',
            onClick: (api, self) => togglePause(self),
          },
          {
            label: 'Cancel',
            onClick: async (api) => {
              const ok = await confirm('Cancel this download?', 'The partially downloaded data will be deleted.');
              if (!ok) return;
              await Api.del(`/api/downloads/${d.id}`, { deleteFile: true });
              api.close('cancel');
              progressDialogs.delete(d.id);
              await App.refresh();
            },
          },
          { label: 'Hide', onClick: (api) => { api.close('hide'); progressDialogs.delete(d.id); } },
        ],
      onClose: () => {
        progressDialogs.delete(d.id);
        clearInterval(timer);
      },
    });
    progressDialogs.set(d.id, inst);
    pauseBtn = inst.api.footer.querySelector('.btn');
    const timer = setInterval(update, 600);

    function update() {
      const latest = App.findDownload(d.id);
      if (latest) d = latest;
      const pct = Fmt.percent(d);
      barFill.style.width = `${pct}%`;
      percentText.textContent = `${pct.toFixed(1)}%`;
      const q = (sel) => content.querySelector(sel);
      const statusEl = content.querySelector('#p-status');
      statusEl.textContent = Fmt.status(d);
      statusEl.style.color = d.status === 'error' ? '#b02a1a' : '';
      content.querySelector('#p-size').textContent = d.size ? Fmt.bytes(d.size) : 'Unknown';
      content.querySelector('#p-transferred').textContent = Fmt.bytes(d.downloaded || 0);
      content.querySelector('#p-speed').textContent = d.status === 'downloading' ? Fmt.speed(d.speed) : '—';
      content.querySelector('#p-eta').textContent = d.status === 'downloading' ? Fmt.timeLeft(d) || '—' : '—';
      title.textContent = d.filename;
      if (d.status === 'downloading' || d.status === 'paused' || d.status === 'queued') {
        pauseBtn.textContent = d.status === 'downloading' || d.status === 'queued' ? 'Pause' : 'Resume';
      } else if (d.status === 'complete') {
        pauseBtn.textContent = 'Open';
      }
      samples.push({ t: Date.now(), speed: d.speed || 0 });
      if (samples.length > 60) samples.shift();
      drawChart();

      if (d.status === 'complete') {
        clearInterval(timer);
        setTimeout(() => {
          if (!inst.closed) inst.close('complete');
          progressDialogs.delete(d.id);
          if (App.state.settings.showCompleteDialog !== false) Dlg.downloadComplete(d);
        }, 400);
      }
    }

    function drawChart() {
      const ctx = chart.getContext('2d');
      const w = chart.width;
      const h = chart.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      // segment bars, IDM style
      const segs = d.segments || [];
      const segH = Math.max(3, Math.min(9, Math.floor((h - 8) / Math.max(1, segs.length))));
      segs.forEach((seg, i) => {
        const total = seg.end == null ? d.size || 1 : seg.end - seg.start + 1;
        const ratio = total ? Math.min(1, (seg.received || 0) / total) : 0;
        const y = 4 + i * (segH + 2);
        ctx.fillStyle = '#e8eef4';
        ctx.fillRect(6, y, w - 12, segH);
        ctx.fillStyle = d.status === 'complete' ? '#54b53c' : d.status === 'paused' ? '#c9a227' : '#3c9ee0';
        ctx.fillRect(6, y, Math.max(0, (w - 12) * ratio), segH);
        ctx.strokeStyle = '#cfdae4';
        ctx.strokeRect(6.5, y + 0.5, w - 13, segH - 1);
      });
      if (!segs.length) {
        ctx.fillStyle = '#9fb2c2';
        ctx.font = '11px Segoe UI';
        ctx.fillText('Waiting for the server to report the file size…', 12, h / 2 + 4);
      }
    }

    async function togglePause(self) {
      const latest = App.findDownload(d.id) || d;
      if (latest.status === 'complete') {
        App.openFile(latest);
        return;
      }
      try {
        if (latest.status === 'downloading' || latest.status === 'queued') {
          await Api.post(`/api/downloads/${d.id}/stop`);
          pauseBtn.textContent = 'Resume';
        } else {
          await Api.post(`/api/downloads/${d.id}/resume`);
          pauseBtn.textContent = 'Pause';
        }
        await App.refresh();
        update();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    update();
    return inst;
  };

  /* ------------------------------------------------------------- Complete */

  const completeDialogs = new Map();

  Dlg.downloadComplete = function (d) {
    const existing = completeDialogs.get(d.id);
    if (existing && !existing.closed) {
      existing.focus();
      return existing;
    }
    const icon = el('div', { style: { width: '32px', height: '32px' } });
    icon.innerHTML = Icons.icon('finished');
    icon.querySelector('svg').style.width = '30px';
    icon.querySelector('svg').style.height = '30px';
    let autoClose = false;
    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' } }, [
        icon,
        el('div', { style: { flex: '1' } }, [
          el('div', { style: { fontWeight: '600', marginBottom: '3px' }, text: 'Download complete' }),
          el('div', { text: d.filename, style: { wordBreak: 'break-all' } }),
          el('div', { class: 'hint', text: `${Fmt.bytes(d.size || d.downloaded)} • ${d.saveTo || `${d.dir}\\${d.filename}`}` }),
        ]),
      ]),
      el('div', { class: 'hint', text: 'The file has been downloaded to your storage folder.' }),
    ]);
    const inst = UI.open({
      title: 'Download Complete',
      width: 460,
      content,
      buttons: [
        { label: 'Open', onClick: () => App.openFile(d) },
        { label: 'Open Folder', onClick: () => toast(`Storage folder: ${d.dir}`, '') },
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
      ],
      onClose: () => completeDialogs.delete(d.id),
    });
    completeDialogs.set(d.id, inst);
    if (d.status !== 'complete') {
      // Wait for the SSE 'complete' event and re-open with final data.
      inst.close();
    }
    return inst;
  };

  /* ------------------------------------------------------------- Category editor */

  Dlg.editCategory = function (category) {
    return new Promise((resolve) => {
      const isNew = !category;
      const name = el('input', { class: 'text-input', value: category ? category.name : '', style: { flex: '1' } });
      const dir = el('input', { class: 'text-input', value: category ? category.dir : 'Downloads\\', style: { flex: '1' } });
      const exts = el('input', {
        class: 'text-input',
        value: category ? (category.extensions || []).join(' ') : '',
        placeholder: 'e.g. DOC PDF XLS TXT',
      });
      const siteCheck = el('input', { type: 'checkbox', checked: !!category?.sitePattern });
      const site = el('input', { class: 'text-input', value: category?.sitePattern || '', disabled: !category?.sitePattern, placeholder: '*.example.com' });
      siteCheck.addEventListener('change', () => (site.disabled = !siteCheck.checked));
      const browse = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '70px' } });
      const content = el('div', {}, [
        el('div', { class: 'field-row' }, [el('label', { text: 'Name:', style: { width: '52px' } }), name]),
        el('div', { class: 'field-row' }, [el('label', { text: 'Folder:', style: { width: '52px' } }), dir, browse]),
        el('div', { class: 'field-row', style: { alignItems: 'flex-start' } }, [
          el('label', { text: 'Types:', style: { width: '52px', paddingTop: '3px' } }),
          el('div', { style: { flex: '1' } }, [
            exts,
            el('div', { class: 'hint', text: 'Separate file extensions by spaces. The category is suggested automatically for these types.' }),
          ]),
        ]),
        el('div', { class: 'groupbox', style: { marginTop: '10px' } }, [
          el('label', { class: 'check' }, [siteCheck, 'Automatically put in this category the files from the following sites only']),
          el('div', { style: { marginTop: '6px' } }, [site]),
        ]),
      ]);
      browse.addEventListener('click', async () => {
        const picked = await folderPicker(dir.value || 'Downloads');
        if (picked) dir.value = picked;
      });
      const inst = UI.open({
        title: isNew ? 'New Category' : 'Edit Category',
        width: 460,
        content,
        buttons: [
          {
            label: 'OK',
            primary: true,
            onClick: async (api) => {
              const catName = name.value.trim();
              if (!catName) {
                toast('Enter a category name.', 'error');
                return;
              }
              try {
                let created = null;
                if (isNew) {
                  const res = await Api.post('/api/categories', {
                    name: catName,
                    dir: dir.value.trim(),
                    extensions: exts.value,
                    sitePattern: siteCheck.checked ? site.value.trim() : '',
                  });
                  created = res.category;
                } else {
                  const res = await Api.put(`/api/categories/${category.id}`, {
                    name: catName,
                    dir: dir.value.trim(),
                    extensions: exts.value,
                    sitePattern: siteCheck.checked ? site.value.trim() : '',
                  });
                  created = res.category;
                }
                api.close('ok');
                resolve(created);
                await App.refresh();
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          },
          { label: 'Cancel', onClick: (api) => { api.close('cancel'); resolve(null); } },
        ],
        onClose: () => resolve(null),
      });
    });
  };

  /* ------------------------------------------------------------- Columns */

  Dlg.columns = function () {
    const cols = JSON.parse(JSON.stringify(App.state.settings.columns || []));
    const list = el('div', { class: 'scroll-box', style: { height: '230px' } });
    let selected = 0;

    function render() {
      list.innerHTML = '';
      cols.forEach((c, i) => {
        const row = el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 6px',
            background: i === selected ? '#cce8ff' : '',
          },
        }, [
          (() => {
            const cb = el('input', { type: 'checkbox', checked: c.visible !== false });
            cb.addEventListener('change', () => (c.visible = cb.checked));
            return cb;
          })(),
          el('span', { text: c.label }),
        ]);
        row.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            selected = i;
            render();
          }
        });
        list.appendChild(row);
      });
    }

    const up = el('button', { class: 'btn small', text: 'Move Up', style: { minWidth: '80px' } });
    const down = el('button', { class: 'btn small', text: 'Move Down', style: { minWidth: '80px' } });
    up.addEventListener('click', () => {
      if (selected <= 0) return;
      [cols[selected - 1], cols[selected]] = [cols[selected], cols[selected - 1]];
      selected--;
      render();
    });
    down.addEventListener('click', () => {
      if (selected >= cols.length - 1) return;
      [cols[selected + 1], cols[selected]] = [cols[selected], cols[selected + 1]];
      selected++;
      render();
    });
    render();
    const content = el('div', { style: { display: 'flex', gap: '8px' } }, [
      list,
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [up, down]),
    ]);
    UI.open({
      title: 'Columns',
      width: 380,
      content,
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: async (api) => {
            api.close('ok');
            await App.saveSettings({ columns: cols }, true);
            App.renderAll();
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  /* ------------------------------------------------------------- Batch */

  Dlg.batch = function (opts = {}) {
    const urls = el('textarea', { class: 'textarea', style: { height: '150px' }, placeholder: 'https://example.com/file1.zip\nhttps://example.com/file2.pdf' });
    if (opts.urls) urls.value = opts.urls.join('\n');
    const dir = el('input', { class: 'text-input', value: App.state.settings.saveTo || 'Downloads', style: { flex: '1' } });
    const browse = el('button', { class: 'btn small', text: '…', style: { minWidth: '28px' } });
    const startNow = el('input', { type: 'checkbox', checked: true });
    const content = el('div', {}, [
      el('div', { text: 'Enter one web address per line:', style: { marginBottom: '5px' } }),
      urls,
      el('div', { class: 'field-row', style: { marginTop: '8px' } }, [
        el('label', { text: 'Save to:', style: { width: '54px' } }),
        dir,
        browse,
      ]),
      el('label', { class: 'check' }, [startNow, 'Start downloads immediately']),
    ]);
    browse.addEventListener('click', async () => {
      const picked = await folderPicker(dir.value);
      if (picked) dir.value = picked;
    });
    UI.open({
      title: 'Add Batch Download',
      width: 500,
      content,
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: async (api) => {
            const list = urls.value
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map(normalizeUrl)
              .filter(Boolean);
            if (!list.length) {
              toast('Enter at least one valid web address.', 'error');
              return;
            }
            api.close('ok');
            let added = 0;
            let failed = 0;
            const cat = App.state.categories.find((c) => list.length && c.id !== 'cat_all' && c.dir === dir.value);
            for (const url of list) {
              try {
                await Api.post('/api/downloads', {
                  url,
                  dir: dir.value,
                  categoryId: cat ? cat.id : null,
                  start: startNow.checked,
                });
                added++;
              } catch {
                failed++;
              }
            }
            await App.refresh();
            toast(`${added} download${added === 1 ? '' : 's'} added${failed ? `, ${failed} failed` : ''}.`, added ? 'success' : 'error');
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.batchFromClipboard = async function () {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast('Clipboard access was denied by the browser.', 'error');
      return;
    }
    const urls = text
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    if (!urls.length) {
      toast('No web addresses were found in the clipboard.', 'error');
      return;
    }
    Dlg.batch({ urls });
  };

  /* ------------------------------------------------------------- ZIP preview */

  Dlg.zipPreview = function (url, data) {
    const rows = data.entries.slice(0, 800).map((e) =>
      el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 92px 64px 66px',
          gap: '6px',
          padding: '2px 5px',
          borderBottom: '1px solid #eef2f6',
        },
      }, [
        el('span', { text: e.name, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        el('span', { text: e.date || '', style: { color: '#5b6a78' } }),
        el('span', { text: e.dir ? '' : Fmt.bytes(e.size), style: { textAlign: 'right' } }),
        el('span', { text: e.methodName, style: { textAlign: 'right', color: '#5b6a78' } }),
      ])
    );
    const content = el('div', {}, [
      el('div', { class: 'hint', text: `${data.total} entr${data.total === 1 ? 'y' : 'ies'} • ${Fmt.bytes(data.size || 0)} — ${url}` , style: { marginBottom: '6px' } }),
      el('div', { class: 'scroll-box', style: { height: '300px' } }, rows),
      data.total > 800 ? el('div', { class: 'hint', text: 'Only the first 800 entries are listed.' }) : null,
    ]);
    UI.open({
      title: 'ZIP Preview',
      width: 640,
      content,
      buttons: [{ label: 'Close', primary: true, onClick: (api) => api.close('close') }],
    });
  };
})();
