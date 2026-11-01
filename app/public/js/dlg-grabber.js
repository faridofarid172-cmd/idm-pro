(function () {
  const Dlg = (window.Dlg = window.Dlg || {});
  const { el, toast, messageBox } = UI;

  const DEFAULT_TYPES =
    'zip rar 7z gz tar iso exe msi apk dmg bin mp3 wav flac m4a ogg mp4 mkv avi mov wmv webm pdf doc docx xls xlsx ppt pptx txt epub jpg jpeg png gif svg webp';

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

  Dlg.grabber = function () {
    const urlInput = el('input', {
      class: 'text-input',
      style: { flex: '1' },
      placeholder: 'https://example.com/downloads/',
      spellcheck: 'false',
    });
    const depth = el('select', { class: 'select-input', style: { width: '160px' } });
    [
      ['0', 'This page only'],
      ['1', 'This page and 1 level'],
      ['2', 'This page and 2 levels'],
    ].forEach(([v, l]) => depth.appendChild(el('option', { value: v, text: l })));
    const types = el('textarea', { class: 'textarea mono', style: { height: '46px' }, placeholder: 'zip exe pdf mp3' });
    types.value = DEFAULT_TYPES;
    const defaultBtn = el('button', { class: 'btn small', text: 'Default', style: { minWidth: '70px' } });
    defaultBtn.addEventListener('click', () => (types.value = DEFAULT_TYPES));

    const status = el('div', { class: 'hint', style: { minHeight: '15px' } });
    const count = el('span', { class: 'hint' });
    const list = el('div', { class: 'scroll-box', style: { height: '260px' } });
    const selectAll = el('button', { class: 'btn small', text: 'Select all', style: { minWidth: '76px' } });
    const selectNone = el('button', { class: 'btn small', text: 'Select none', style: { minWidth: '76px' } });
    const addSelected = el('button', { class: 'btn small', text: 'Add selected', style: { minWidth: '90px' }, disabled: true });
    const scanBtn = el('button', { class: 'btn small', text: 'Scan', style: { minWidth: '70px' } });

    let files = [];
    let selected = new Set();
    let scanning = false;
    let footerAdd = null;

    const content = el('div', {}, [
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Site URL:', style: { width: '58px' } }),
        urlInput,
      ]),
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Scan:', style: { width: '58px' } }),
        depth,
        el('span', { class: 'hint', text: 'Only links on the same web site are followed.' }),
      ]),
      el('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '7px', marginBottom: '8px' } }, [
        el('label', { class: 'field-label', text: 'File types:', style: { width: '58px', paddingTop: '3px' } }),
        el('div', { style: { flex: '1' } }, [
          types,
          el('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '3px' } }, [
            el('span', { class: 'hint', text: 'Separate extensions with spaces.' }),
            defaultBtn,
          ]),
        ]),
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' } }, [
        selectAll,
        selectNone,
        count,
        el('div', { style: { flex: '1' } }),
        scanBtn,
      ]),
      list,
      status,
    ]);

    function updateCount() {
      count.textContent = files.length ? `${files.length} file${files.length === 1 ? '' : 's'} found, ${selected.size} selected` : '';
      addSelected.disabled = !selected.size;
      if (footerAdd) footerAdd.disabled = !selected.size;
    }

    function renderResults() {
      list.innerHTML = '';
      if (!files.length) {
        list.appendChild(
          el('div', { class: 'hint', style: { padding: '10px', textAlign: 'center' }, text: 'Enter a site address and press Scan to look for downloadable files.' })
        );
        updateCount();
        return;
      }
      const head = el(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: '26px 1fr 58px 78px',
            gap: '6px',
            background: 'linear-gradient(to bottom,#f6f9fc,#e6edf5)',
            borderBottom: '1px solid #c3d1de',
            padding: '3px 6px',
            fontWeight: '600',
            position: 'sticky',
            top: '0',
          },
        },
        [el('span'), el('span', { text: 'File Name' }), el('span', { text: 'Type' }), el('span', { text: 'Size' })]
      );
      list.appendChild(head);
      for (const f of files) {
        const cb = el('input', { type: 'checkbox', checked: selected.has(f.url) });
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(f.url);
          else selected.delete(f.url);
          updateCount();
        });
        const row = el(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: '26px 1fr 58px 78px',
              gap: '6px',
              padding: '3px 6px',
              borderBottom: '1px solid #eef2f6',
              alignItems: 'center',
              background: selected.has(f.url) ? '#eef8ff' : '',
            },
          },
          [
            cb,
            el('span', { text: f.filename, title: f.url, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
            el('span', { text: (f.type || '').toUpperCase() }),
            el('span', { text: f.size ? Fmt.bytes(f.size) : '', style: { textAlign: 'right' } }),
          ]
        );
        row.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT') return;
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
          row.style.background = cb.checked ? '#eef8ff' : '';
        });
        row.addEventListener('dblclick', () => {
          const d = el('div', {}, [
            el('div', { text: f.filename, style: { fontWeight: '600', marginBottom: '6px' } }),
            el('div', { class: 'kv' }, [
              el('span', { class: 'k', text: 'Address:' }),
              el('span', { class: 'v', text: f.url, title: f.url }),
              el('span', { class: 'k', text: 'Type:' }),
              el('span', { class: 'v', text: Fmt.typeName(f.filename) }),
              el('span', { class: 'k', text: 'Size:' }),
              el('span', { class: 'v', text: f.size ? Fmt.bytesExact(f.size) : 'Unknown' }),
            ]),
          ]);
          UI.open({
            title: 'Grabbed file',
            width: 480,
            content: d,
            buttons: [
              { label: 'Download', primary: true, onClick: (api) => { api.close('ok'); addFiles([f]); } },
              { label: 'Close', onClick: (api) => api.close('close') },
            ],
          });
        });
        list.appendChild(row);
      }
      updateCount();
    }

    selectAll.addEventListener('click', () => {
      selected = new Set(files.map((f) => f.url));
      renderResults();
    });
    selectNone.addEventListener('click', () => {
      selected.clear();
      renderResults();
    });

    async function scan() {
      if (scanning) return;
      const url = normalizeUrl(urlInput.value);
      if (!url) {
        toast('Enter a valid web address to scan.', 'error');
        urlInput.focus();
        return;
      }
      scanning = true;
      scanBtn.disabled = true;
      status.textContent = 'Scanning the web site…';
      status.className = 'hint';
      selected.clear();
      files = [];
      renderResults();
      try {
        const res = await Api.scan({
          url,
          depth: Number(depth.value) || 0,
          types: types.value.split(/[\s,;]+/).map((s) => s.replace(/^\./, '').trim().toLowerCase()).filter(Boolean),
        });
        files = res.files || [];
        status.textContent = `Visited ${res.pagesVisited} page${res.pagesVisited === 1 ? '' : 's'}. ${
          files.length ? 'Select the files you want to download.' : 'No matching files were found on this site.'
        }${res.truncated ? ' The result list was truncated.' : ''}`;
        if (res.errors && res.errors.length) {
          status.textContent += ` ${res.errors.length} page${res.errors.length === 1 ? '' : 's'} could not be read.`;
        }
        if (files.length) selected = new Set(files.map((f) => f.url));
      } catch (err) {
        status.textContent = err.message;
        status.className = 'hint error-text';
      } finally {
        scanning = false;
        scanBtn.disabled = false;
        renderResults();
      }
    }

    scanBtn.addEventListener('click', scan);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        scan();
      }
    });

    function addFiles(items) {
      if (!items.length) return;
      const todo = items.filter((f) => !App.downloads().some((d) => d.url === f.url));
      if (!todo.length) {
        toast('The selected files are already in the download list.', 'error');
        return;
      }
      const settings = App.state.settings;
      let added = 0;
      let failed = 0;
      (async () => {
        for (const f of todo) {
          try {
            await Api.post('/api/downloads', {
              url: f.url,
              filename: f.filename,
              dir: settings.saveTo || 'Downloads',
              size: f.size || null,
              description: 'Grabbed from ' + (urlInput.value || ''),
              start: true,
              isGrab: true,
              grabPage: normalizeUrl(urlInput.value) || '',
            });
            added++;
          } catch {
            failed++;
          }
        }
        await App.refresh();
        if (added) {
          toast(`${added} grabbed file${added === 1 ? '' : 's'} added to the download list.`, 'success');
          selected.clear();
          renderResults();
        }
        if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} could not be added.`, 'error');
      })();
    }

    addSelected.addEventListener('click', () => {
      addFiles(files.filter((f) => selected.has(f.url)));
    });

    renderResults();

    const inst = UI.open({
      title: 'Site Grabber',
      width: 660,
      content,
      icon: 'grabber',
      buttons: [
        {
          label: 'Scan',
          onClick: () => scan(),
        },
        {
          label: 'Add selected',
          primary: true,
          disabled: true,
          onClick: () => addSelected.click(),
        },
        { label: 'Help', onClick: () => Dlg.help() },
        { label: 'Close', onClick: (api) => api.close('close') },
      ],
      onMount: (api) => {
        footerAdd = api.footer.querySelectorAll('.btn')[1] || null;
        if (footerAdd) footerAdd.disabled = !selected.size;
        setTimeout(() => urlInput.focus(), 30);
      },
    });
    return inst;
  };
})();
