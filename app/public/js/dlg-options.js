(function () {
  const Dlg = (window.Dlg = window.Dlg || {});
  const { el, toast, confirm, prompt, folderPicker } = UI;

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function makeTabs(container, items, initial = 0) {
    const strip = el('div', { class: 'tab-strip' });
    const panels = el('div', { class: 'tab-panels' });
    const entries = [];
    let current = initial;

    items.forEach((item, i) => {
      if (item.rowBreak) strip.appendChild(el('div', { style: { flexBasis: '100%', height: '0' } }));
      const tab = el('div', { class: 'tab', text: item.label });
      const panel = el('div', { class: 'tab-panel' });
      if (item.build) panel.appendChild(item.build());
      tab.addEventListener('click', () => activate(i));
      entries.push({ tab, panel });
      strip.appendChild(tab);
      panels.appendChild(panel);
    });
    container.appendChild(strip);
    container.appendChild(panels);

    function activate(i) {
      current = i;
      entries.forEach((e, idx) => {
        e.tab.classList.toggle('active', idx === i);
        e.panel.classList.toggle('active', idx === i);
      });
      if (items[i].onShow) items[i].onShow(entries[i].panel);
    }
    activate(initial);
    return { activate, entries, active: () => current };
  }

  Dlg.options = function (startTab = 0) {
    const draft = clone(App.state.settings);
    const root = el('div', { style: { width: '100%' } });

    const check = (parent, label, key, opts = {}) => {
      const input = el('input', { type: 'checkbox', checked: !!draft[key], disabled: !!opts.disabled });
      input.addEventListener('change', () => (draft[key] = input.checked));
      const node = el('label', { class: 'check', style: opts.style || {} }, [input, label]);
      parent.appendChild(node);
      return { node, input };
    };

    const text = (parent, label, key, opts = {}) => {
      const input = el('input', {
        class: 'text-input',
        value: draft[key] == null ? '' : draft[key],
        style: opts.style || { flex: '1' },
        type: opts.type || 'text',
        placeholder: opts.placeholder || '',
      });
      input.addEventListener('input', () => (draft[key] = input.value));
      parent.appendChild(
        el('div', { class: 'field-row', style: opts.rowStyle || {} }, [
          label ? el('label', { class: 'field-label', text: label, style: { width: opts.labelWidth || 'auto' } }) : null,
          input,
          opts.button || null,
        ])
      );
      return input;
    };

    /* ---------------------------------------------------------- General */
    function generalTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Browser/System Integration' }));
      const body = el('div', { style: { paddingLeft: '6px' } });
      check(body, 'Launch Internet Download Manager on startup', 'launchOnStartup');
      check(body, 'Run module for monitoring in IE-based browsers (AOL, MSN, Avant, etc)', 'runIEMonitor');
      check(body, 'Automatically start downloading of URLs placed to clipboard', 'clipboardMonitor');
      check(body, 'Use advanced browser integration', 'advancedBrowserIntegration');
      const browsersBox = el('div', { style: { marginLeft: '18px', marginTop: '6px' } }, [
        el('div', { text: 'Capture downloads from the following browsers:', style: { marginBottom: '4px' } }),
      ]);
      const list = el('div', { class: 'scroll-box', style: { height: '118px', padding: '4px 6px' } });
      const addBrowserBtn = el('button', { class: 'btn small', text: 'Add browser…', style: { marginTop: '5px', minWidth: '96px' } });
      function renderBrowsers() {
        list.innerHTML = '';
        for (const b of draft.browsers) {
          const cb = el('input', { type: 'checkbox', checked: b.enabled });
          cb.addEventListener('change', () => (b.enabled = cb.checked));
          list.appendChild(el('label', { class: 'check', style: { height: '17px' } }, [cb, b.name]));
        }
      }
      addBrowserBtn.addEventListener('click', async () => {
        const name = await prompt({ title: 'Add browser', label: 'Browser name:', width: 340 });
        if (!name) return;
        draft.browsers.push({ name, enabled: true });
        renderBrowsers();
      });
      renderBrowsers();
      browsersBox.appendChild(list);
      browsersBox.appendChild(addBrowserBtn);
      body.appendChild(browsersBox);
      body.appendChild(el('hr', { style: { border: 'none', borderTop: '1px solid #d8e0e8', margin: '10px 0 8px' } }));
      const rows = [
        ['Customize keys to prevent or force downloading with IDM', 'Keys…', () => Dlg.keys()],
        ['Customize IDM menu items in context menu of browsers', 'Edit…', () => Dlg.browserMenuItems()],
        ['Customize IDM Download panels in browsers', 'Edit…', () => Dlg.downloadPanel()],
      ];
      for (const [label, btnLabel, action] of rows) {
        const btn = el('button', { class: 'btn small', text: btnLabel, style: { minWidth: '56px' } });
        btn.addEventListener('click', action);
        body.appendChild(
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '5px' } }, [
            el('span', { text: label }),
            btn,
          ])
        );
      }
      wrap.appendChild(body);
      return wrap;
    }

    /* ---------------------------------------------------------- File types */
    function fileTypesTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Downloaded file types' }));
      const types = el('textarea', { class: 'textarea mono', style: { height: '92px' } });
      types.value = draft.fileTypes;
      types.addEventListener('input', () => (draft.fileTypes = types.value));
      const defBtn = el('button', { class: 'btn small', text: 'Default', style: { minWidth: '76px', alignSelf: 'flex-end' } });
      defBtn.addEventListener('click', () => {
        types.value =
          '3GP 7Z AAC ACE AIF ARJ ASF AVI BIN BZ2 EXE GZ GZIP IMG ISO LZH M4A M4V MKV MOV MP3 MP4 MPA MPEG MPG MSI MSU OGG OGV PLJ PPS PPT QT R0* RAR RAM RM RMVB SEA SIT SITX TAR TIF TIFF WAV WMA WMV Z ZIP MP4 EPUB TGZ M4B';
        draft.fileTypes = types.value;
      });
      wrap.appendChild(el('div', { text: 'Automatically start downloading the following file types:', style: { marginBottom: '4px' } }));
      wrap.appendChild(types);
      wrap.appendChild(el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '4px' } }, [defBtn]));

      wrap.appendChild(el('div', { text: "Don't start downloading automatically from the following sites:", style: { marginTop: '12px', marginBottom: '4px' } }));
      const sites = el('textarea', { class: 'textarea mono', style: { height: '64px' } });
      sites.value = draft.excludedSites;
      sites.addEventListener('input', () => (draft.excludedSites = sites.value));
      wrap.appendChild(sites);
      wrap.appendChild(el('div', { class: 'hint', text: '(separate names by spaces)' }));
      const siteDef = el('button', { class: 'btn small', text: 'Default', style: { minWidth: '76px', marginTop: '4px' } });
      siteDef.addEventListener('click', () => {
        sites.value =
          '*.update.microsoft.com *download.windowsupdate.com siteseal.thawte.com ecom.cimetz.com *.voice2page.com pdfp.w.uspto.gov www.battlestick2.net';
        draft.excludedSites = sites.value;
      });
      wrap.appendChild(el('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [siteDef]));

      wrap.appendChild(el('div', { text: "Don't start downloading automatically from the following addresses:", style: { marginTop: '12px', marginBottom: '4px' } }));
      const edit = el('button', { class: 'btn small', text: 'Edit list …', style: { minWidth: '90px' } });
      edit.addEventListener('click', () => Dlg.addressExceptions(draft));
      wrap.appendChild(el('div', { style: { display: 'flex', justifyContent: 'flex-start' } }, [edit]));
      return wrap;
    }

    /* ---------------------------------------------------------- Connection */
    function connectionTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Connection type' }));
      wrap.appendChild(el('div', { text: 'Connection Type/Speed', style: { marginBottom: '3px' } }));
      const sel = el('select', { class: 'select-input', style: { width: '100%' } });
      [
        ['high', 'High speed: Direct connection (Ethernet/Cable) / Wi-Fi / Mobile 4G / other'],
        ['medium', 'Medium speed: DSL / Cable modem'],
        ['low', 'Low speed: Dial-up / 3G modem'],
        ['other', 'Other'],
      ].forEach(([v, l]) => sel.appendChild(el('option', { value: v, text: l, selected: draft.connectionType === v })));
      sel.addEventListener('change', () => (draft.connectionType = sel.value));
      wrap.appendChild(sel);

      const group = el('div', { class: 'groupbox', style: { marginTop: '10px' } }, [
        el('div', { class: 'group-title', text: 'Max. connections number' }),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' } }, [
          el('span', { text: 'Default max. conn. number' }),
          (() => {
            const s = el('select', { class: 'select-input', style: { width: '90px' } });
            for (let i = 1; i <= 32; i++) s.appendChild(el('option', { value: i, text: i, selected: Number(draft.maxConnections) === i }));
            s.addEventListener('change', () => (draft.maxConnections = Number(s.value)));
            return s;
          })(),
        ]),
        el('div', { style: { marginTop: '8px' } }, [el('div', { text: 'Exceptions:', style: { marginBottom: '3px' } })]),
        (() => {
          const table = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 72px 62px', gap: '6px' } }, [
            (() => {
              const box = el('div', { class: 'scroll-box', style: { height: '96px' } });
              const head = el('div', {
                style: { display: 'grid', gridTemplateColumns: '1fr 52px', background: '#eef3f8', borderBottom: '1px solid #c6d4e1' },
              }, [el('span', { text: 'Server', style: { padding: '2px 5px' } }), el('span', { text: 'Number', style: { padding: '2px 5px' } })]);
              box.appendChild(head);
              const rows = el('div', {});
              function renderRows() {
                rows.innerHTML = '';
                draft.exceptions.forEach((ex, i) => {
                  const row = el('div', {
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '1fr 52px',
                      padding: '2px 5px',
                      background: ex._sel ? '#cce8ff' : '',
                    },
                  }, [el('span', { text: ex.server }), el('span', { text: ex.number })]);
                  row.addEventListener('click', () => {
                    draft.exceptions.forEach((e2) => (e2._sel = false));
                    ex._sel = true;
                    renderRows();
                  });
                  rows.appendChild(row);
                });
              }
              renderRows();
              box.appendChild(rows);
              box._render = renderRows;
              table._box = box;
              return box;
            })(),
            el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
              (() => {
                const b = el('button', { class: 'btn small', text: 'New', style: { minWidth: '62px' } });
                b.addEventListener('click', async () => {
                  const server = await prompt({ title: 'New server exception', label: 'Server address:', width: 360 });
                  if (!server) return;
                  const num = await prompt({ title: 'Connections', label: 'Max. connections:', value: '1', width: 320 });
                  draft.exceptions.push({ server, number: Number(num) || 1 });
                  table._box._render();
                });
                return b;
              })(),
              (() => {
                const b = el('button', { class: 'btn small', text: 'Delete', style: { minWidth: '62px' } });
                b.addEventListener('click', () => {
                  draft.exceptions = draft.exceptions.filter((e) => !e._sel);
                  table._box._render();
                });
                return b;
              })(),
              (() => {
                const b = el('button', { class: 'btn small', text: 'Edit', style: { minWidth: '62px' } });
                b.addEventListener('click', async () => {
                  const ex = draft.exceptions.find((e) => e._sel);
                  if (!ex) return;
                  const server = await prompt({ title: 'Edit server', label: 'Server address:', value: ex.server, width: 360 });
                  if (!server) return;
                  ex.server = server;
                  table._box._render();
                });
                return b;
              })(),
            ]),
          ]);
          return table;
        })(),
        (() => {
          const g = el('div', { class: 'groupbox', style: { marginTop: '10px' } });
          const limitInput = el('input', { class: 'text-input', value: draft.limitMB, style: { width: '62px' } });
          limitInput.addEventListener('input', () => (draft.limitMB = Number(limitInput.value) || 0));
          const hoursInput = el('input', { class: 'text-input', value: draft.limitHours, style: { width: '42px' } });
          hoursInput.addEventListener('input', () => (draft.limitHours = Number(hoursInput.value) || 0));
          const cb = el('input', { type: 'checkbox', checked: draft.downloadLimits });
          cb.addEventListener('change', () => (draft.downloadLimits = cb.checked));
          g.appendChild(el('label', { class: 'check' }, [cb, 'Download limits']));
          g.appendChild(
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', paddingLeft: '3px', fontSize: '11.5px' } }, [
              el('span', { text: 'Download no more than' }),
              limitInput,
              el('span', { text: 'MBytes every' }),
              hoursInput,
              el('span', { text: 'hours' }),
            ])
          );
          g.appendChild(el('div', { class: 'hint', text: 'The scheduler pauses downloads when the limit is reached and resumes them later.', style: { paddingLeft: '3px', marginTop: '4px' } }));
          return g;
        })(),
        (() => {
          const c = el('input', { type: 'checkbox', checked: draft.warnBeforeStop });
          c.addEventListener('change', () => (draft.warnBeforeStop = c.checked));
          return el('label', { class: 'check', style: { marginTop: '8px' } }, [c, 'Show warning before stopping downloads']);
        })(),
      ]);
      wrap.appendChild(group);
      return wrap;
    }

    /* ---------------------------------------------------------- Save to */
    function saveToTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Default download folder' }));
      const dirInput = el('input', { class: 'text-input', value: draft.saveTo, style: { flex: '1' } });
      dirInput.addEventListener('input', () => (draft.saveTo = dirInput.value));
      const browse = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '74px' } });
      browse.addEventListener('click', async () => {
        const d = await folderPicker(dirInput.value);
        if (d) {
          dirInput.value = d;
          draft.saveTo = d;
        }
      });
      wrap.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Default download folder:', style: { width: '140px' } }), dirInput, browse]));

      const table = el('div', { class: 'scroll-box', style: { height: '150px', marginTop: '6px' } });
      const head = el('div', {
        style: { display: 'grid', gridTemplateColumns: '130px 1fr 88px', background: '#eef3f8', borderBottom: '1px solid #c6d4e1', padding: '2px 5px', fontSize: '11.5px' },
      }, [el('span', { text: 'Category' }), el('span', { text: 'Folder' }), el('span', { text: '' })]);
      table.appendChild(head);
      for (const c of App.state.categories.filter((c) => c.id !== 'cat_all')) {
        const folder = el('span', { text: c.dir, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } });
        const btn = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '74px' } });
        btn.addEventListener('click', async () => {
          const d = await folderPicker(c.dir);
          if (d) {
            c.dir = d;
            folder.textContent = d;
          }
        });
        table.appendChild(el('div', {
          style: { display: 'grid', gridTemplateColumns: '130px 1fr 88px', padding: '3px 5px', gap: '6px', alignItems: 'center' },
        }, [el('span', { text: c.name }), folder, btn]));
      }
      wrap.appendChild(table);

      wrap.appendChild(el('div', { class: 'hint', text: 'Downloaded file will be saved to the default directory of an appropriate category.', style: { marginTop: '5px' } }));
      wrap.appendChild(el('hr', { style: { border: 'none', borderTop: '1px solid #d8e0e8', margin: '10px 0' } }));
      wrap.appendChild(el('div', { class: 'section-title', text: 'Temporary Directory' }));
      const temp = el('input', { class: 'text-input', value: draft.tempDir, style: { flex: '1' } });
      temp.addEventListener('input', () => (draft.tempDir = temp.value));
      const tempBrowse = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '74px' } });
      tempBrowse.addEventListener('click', async () => {
        const d = await folderPicker(temp.value);
        if (d) {
          temp.value = d;
          draft.tempDir = d;
        }
      });
      wrap.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Temporary directory:', style: { width: '140px' } }), temp, tempBrowse]));
      const cc = el('input', { type: 'checkbox', checked: draft.changeCategoryFolderOnLastSelected });
      cc.addEventListener('change', () => (draft.changeCategoryFolderOnLastSelected = cc.checked));
      wrap.appendChild(el('label', { class: 'check', style: { marginTop: '8px', display: 'flex' } }, [
        cc,
        'Change folder for the category on the last selected folder',
      ]));
      return wrap;
    }

    /* ---------------------------------------------------------- Downloads */
    function downloadsTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Default download settings' }));
      const progressBtn = el('button', { class: 'btn small', text: 'Edit…', style: { minWidth: '56px' } });
      progressBtn.addEventListener('click', () => Dlg.customizeProgress(draft));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' } }, [
          el('span', { text: 'Customize "Download progress" dialog' }),
          progressBtn,
        ])
      );
      check(wrap, 'Show start download dialog', 'showStartDialog');
      check(wrap, 'Show download complete dialog', 'showCompleteDialog');
      wrap.appendChild(el('div', { class: 'hint', text: "Note: These settings don't relate to queue processing." }));
      wrap.appendChild(el('hr', { style: { border: 'none', borderTop: '1px solid #d8e0e8', margin: '8px 0' } }));
      check(wrap, 'Start download immediately while displaying "Download File Info" dialog', 'startImmediately');
      check(wrap, 'Show queue selection panel on pressing "Download Later" button', 'showQueuePanelLater');
      check(wrap, 'Show queue selection panel on closing batch download dialogs', 'showQueuePanelBatch');
      check(wrap, 'Ignore file modification time changes when resuming a download', 'ignoreFileModificationTime');
      wrap.appendChild(el('hr', { style: { border: 'none', borderTop: '1px solid #d8e0e8', margin: '8px 0' } }));
      wrap.appendChild(el('div', { style: { marginBottom: '4px' }, text: 'If a duplicate download link is added:' }));
      const dup = el('select', { class: 'select-input', style: { width: '100%' } });
      [
        ['ask', 'Show a dialog and ask what to do.'],
        ['skip', 'Skip the duplicate download.'],
        ['rename', 'Add the duplicate download with a new name.'],
      ].forEach(([v, l]) => dup.appendChild(el('option', { value: v, text: l, selected: draft.duplicateAction === v })));
      dup.addEventListener('change', () => (draft.duplicateAction = dup.value));
      wrap.appendChild(dup);
      wrap.appendChild(el('div', { style: { marginTop: '10px', marginBottom: '3px' }, text: 'User-Agent for manually added downloads:' }));
      const ua = el('input', { class: 'text-input', value: draft.userAgent, style: { width: '100%' } });
      ua.addEventListener('input', () => (draft.userAgent = ua.value));
      wrap.appendChild(ua);
      const virus = el('button', { class: 'btn small', text: 'Edit…', style: { minWidth: '56px' } });
      virus.addEventListener('click', () => Dlg.virusSettings(draft));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' } }, [
          el('span', { text: 'Virus checking settings' }),
          virus,
        ])
      );
      return wrap;
    }

    /* ---------------------------------------------------------- Proxy */
    function proxyTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Proxy / Socks' }));
      const modes = [
        ['none', 'No proxy / socks'],
        ['system', 'Use system proxy settings'],
        ['manual', 'Use proxy / socks manually'],
      ];
      const group = el('div', { class: 'groupbox' });
      for (const [v, l] of modes) {
        const r = el('input', { type: 'radio', name: 'proxymode', checked: draft.proxyMode === v });
        r.addEventListener('change', () => (draft.proxyMode = v));
        group.appendChild(el('label', { class: 'radio', style: { display: 'flex', margin: '2px 0' } }, [r, l]));
      }
      wrap.appendChild(group);

      const manual = el('div', { style: { marginTop: '8px' } });
      const host = el('input', { class: 'text-input', value: draft.proxyHost, style: { flex: '1' } });
      host.addEventListener('input', () => (draft.proxyHost = host.value));
      const port = el('input', { class: 'text-input', value: draft.proxyPort, style: { width: '64px' } });
      port.addEventListener('input', () => (draft.proxyPort = Number(port.value) || 0));
      const user = el('input', { class: 'text-input', value: draft.proxyUser, style: { flex: '1' } });
      user.addEventListener('input', () => (draft.proxyUser = user.value));
      const pass = el('input', { class: 'text-input', type: 'password', value: draft.proxyPass, style: { flex: '1' } });
      pass.addEventListener('input', () => (draft.proxyPass = pass.value));
      manual.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Host:', style: { width: '62px' } }), host, el('span', { text: 'Port:' }), port]));
      manual.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'User name:', style: { width: '62px' } }), user]));
      manual.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Password:', style: { width: '62px' } }), pass]));
      wrap.appendChild(manual);
      wrap.appendChild(el('div', { style: { marginTop: '8px', marginBottom: '3px' }, text: "Don't use proxy for these addresses:" }));
      const ex = el('textarea', { class: 'textarea mono', style: { height: '54px' } });
      ex.value = draft.proxyExceptions;
      ex.addEventListener('input', () => (draft.proxyExceptions = ex.value));
      wrap.appendChild(ex);
      const pasv = el('input', { type: 'checkbox', checked: draft.useFtpPasv });
      pasv.addEventListener('change', () => (draft.useFtpPasv = pasv.checked));
      wrap.appendChild(el('label', { class: 'check', style: { marginTop: '8px' } }, [pasv, 'Use FTP in PASV mode']));
      return wrap;
    }

    /* ---------------------------------------------------------- Site logins */
    function loginsTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Site logins' }));
      const table = el('div', { class: 'scroll-box', style: { height: '170px' } });
      const head = el('div', {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr 130px', background: '#eef3f8', borderBottom: '1px solid #c6d4e1', padding: '2px 5px' },
      }, [el('span', { text: 'Site URL' }), el('span', { text: 'User name' }), el('span', { text: 'Password' })]);
      table.appendChild(head);
      function render() {
        Array.from(table.querySelectorAll('.login-row')).forEach((n) => n.remove());
        draft.siteLogins.forEach((l, i) => {
          const row = el('div', {
            class: 'login-row',
            style: { display: 'grid', gridTemplateColumns: '1fr 1fr 130px', padding: '3px 5px', background: l._sel ? '#cce8ff' : '' },
          }, [el('span', { text: l.url }), el('span', { text: l.user }), el('span', { text: '•'.repeat(8) })]);
          row.addEventListener('click', () => {
            draft.siteLogins.forEach((x) => (x._sel = false));
            l._sel = true;
            render();
          });
          row.addEventListener('dblclick', () => editLogin(l));
          table.appendChild(row);
        });
      }
      function editLogin(l) {
        Dlg.siteLogin(l, (updated) => {
          if (updated) {
            Object.assign(l, updated);
            render();
          }
        });
      }
      render();
      const buttons = el('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' } }, [
        (() => {
          const b = el('button', { class: 'btn small', text: 'New', style: { minWidth: '70px' } });
          b.addEventListener('click', () => {
            const entry = { url: '', user: '', pass: '' };
            Dlg.siteLogin(entry, (updated) => {
              if (updated) {
                draft.siteLogins.push(updated);
                render();
              }
            });
          });
          return b;
        })(),
        (() => {
          const b = el('button', { class: 'btn small', text: 'Delete', style: { minWidth: '70px' } });
          b.addEventListener('click', () => {
            draft.siteLogins = draft.siteLogins.filter((l) => !l._sel);
            render();
          });
          return b;
        })(),
        (() => {
          const b = el('button', { class: 'btn small', text: 'Edit', style: { minWidth: '70px' } });
          b.addEventListener('click', () => {
            const sel = draft.siteLogins.find((l) => l._sel);
            if (sel) editLogin(sel);
          });
          return b;
        })(),
      ]);
      wrap.appendChild(table);
      wrap.appendChild(buttons);
      return wrap;
    }

    /* ---------------------------------------------------------- Dial up */
    function dialUpTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Dial-Up / VPN connection' }));
      const sel = el('select', { class: 'select-input', style: { width: '100%' } });
      const options = [
        ['', '(no connection selected)'],
        ['ras', 'VPN Connection'],
        ['broadband', 'Broadband Connection'],
        ['dialup', 'Dial-up Connection'],
      ];
      options.forEach(([v, l]) => sel.appendChild(el('option', { value: v, text: l, selected: draft.dialUpConnection === v })));
      sel.addEventListener('change', () => (draft.dialUpConnection = sel.value));
      wrap.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Connection:', style: { width: '80px' } }), sel]));
      const user = el('input', { class: 'text-input', value: draft.dialUpUser, style: { flex: '1' } });
      user.addEventListener('input', () => (draft.dialUpUser = user.value));
      const pass = el('input', { class: 'text-input', type: 'password', value: draft.dialUpPass, style: { flex: '1' } });
      pass.addEventListener('input', () => (draft.dialUpPass = pass.value));
      wrap.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'User name:', style: { width: '80px' } }), user]));
      wrap.appendChild(el('div', { class: 'field-row' }, [el('label', { text: 'Password:', style: { width: '80px' } }), pass]));
      const save = el('input', { type: 'checkbox', checked: draft.savePassword });
      save.addEventListener('change', () => (draft.savePassword = save.checked));
      wrap.appendChild(el('label', { class: 'check' }, [save, 'Save password']));
      const redials = el('input', { class: 'text-input', value: draft.redials, style: { width: '52px' } });
      redials.addEventListener('input', () => (draft.redials = Number(redials.value) || 0));
      const interval = el('input', { class: 'text-input', value: draft.redialInterval, style: { width: '52px' } });
      interval.addEventListener('input', () => (draft.redialInterval = Number(interval.value) || 0));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' } }, [
          el('span', { text: 'Number of redials:' }),
          redials,
          el('span', { text: 'Redial interval (sec):' }),
          interval,
        ])
      );
      const apply = el('button', { class: 'btn small', text: 'Apply', style: { minWidth: '70px', marginTop: '10px' } });
      apply.addEventListener('click', () => toast('Dial-up settings applied.', 'success'));
      wrap.appendChild(apply);
      return wrap;
    }

    /* ---------------------------------------------------------- Sounds */
    function soundsTab() {
      const wrap = el('div', {});
      wrap.appendChild(el('div', { class: 'section-title', text: 'Sounds' }));
      const table = el('div', { class: 'scroll-box', style: { height: '200px' } });
      const head = el('div', {
        style: { display: 'grid', gridTemplateColumns: '30px 1fr 1fr', background: '#eef3f8', borderBottom: '1px solid #c6d4e1', padding: '2px 5px' },
      }, ['', el('span', { text: 'Event' }), el('span', { text: 'Sound file' })]);
      table.appendChild(head);
      for (const s of draft.sounds) {
        const cb = el('input', { type: 'checkbox', checked: s.enabled });
        cb.addEventListener('change', () => (s.enabled = cb.checked));
        const fileLabel = el('span', { text: s.file || '(None)', style: { overflow: 'hidden', textOverflow: 'ellipsis' } });
        const row = el('div', {
          style: { display: 'grid', gridTemplateColumns: '30px 1fr 1fr', padding: '3px 5px', alignItems: 'center' },
        }, [cb, el('span', { text: s.event }), fileLabel]);
        table.appendChild(row);
      }
      wrap.appendChild(table);
      const play = el('button', { class: 'btn small', text: 'Play', style: { minWidth: '62px' } });
      play.addEventListener('click', () => toast('Sound playback is handled by the operating system.', ''));
      const browse = el('button', { class: 'btn small', text: 'Browse…', style: { minWidth: '72px' } });
      browse.addEventListener('click', async () => {
        const name = await prompt({
          title: 'Sound file',
          label: 'Enter a sound file path (for example C:\\Windows\\Media\\notify.wav):',
          width: 420,
        });
        if (!name) return;
        const first = draft.sounds.find((s) => s.enabled) || draft.sounds[0];
        first.file = name;
        first.enabled = true;
        toast('Sound file assigned.', 'success');
      });
      wrap.appendChild(el('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' } }, [browse, play]));
      return wrap;
    }

    const items = [
      { label: 'General', build: generalTab },
      { label: 'File types', build: fileTypesTab },
      { label: 'Save to', build: saveToTab },
      { label: 'Downloads', build: downloadsTab },
      { label: 'Connection', build: connectionTab },
      { label: 'Proxy / Socks', build: proxyTab, rowBreak: true },
      { label: 'Sites Logins', build: loginsTab },
      { label: 'Dial Up / VPN', build: dialUpTab },
      { label: 'Sounds', build: soundsTab },
    ];

    const tabs = makeTabs(root, items, Math.min(startTab, items.length - 1));

    const inst = UI.open({
      title: 'Internet Download Manager Configuration',
      width: 560,
      content: root,
      icon: 'idmlogo',
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: async (api) => {
            try {
              await App.saveSettings(draft, true);
              // Category folders can be edited directly in the Save To tab.
              for (const cat of App.state.categories) {
                if (cat.id === 'cat_all') continue;
                await Api.put(`/api/categories/${cat.id}`, {
                  name: cat.name,
                  dir: cat.dir,
                  extensions: cat.extensions || [],
                  sitePattern: cat.sitePattern || '',
                }).catch(() => {});
              }
              api.close('ok');
              await App.refresh();
              toast('Settings saved.', 'success');
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        { label: 'Help', onClick: () => Dlg.help() },
      ],
    });
    return inst;
  };

  /* ------------------------------------------------------------- sub-dialogs */

  Dlg.customizeProgress = function (draft) {
    const sel = el('select', { class: 'select-input', style: { width: '180px' } });
    [
      ['normal', 'Show normally sized'],
      ['minimized', 'Show minimized'],
      ['none', "Don't show"],
      ['tray', 'Minimize to system tray'],
    ].forEach(([v, l]) => sel.appendChild(el('option', { value: v, text: l, selected: draft.progressStartView === v })));
    sel.addEventListener('change', () => (draft.progressStartView = sel.value));
    const mk = (label, key) => {
      const cb = el('input', { type: 'checkbox', checked: draft[key] !== false });
      cb.addEventListener('change', () => (draft[key] = cb.checked));
      return el('label', { class: 'check' }, [cb, label]);
    };
    const content = el('div', {}, [
      el('div', { text: 'Start view:', style: { marginBottom: '4px' } }),
      sel,
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '12px' } }, [
        mk('Show "Speed Limiter" tab', 'showSpeedLimiterTab'),
        mk('Show "Options on completion" tab', 'showOptionsOnCompletionTab'),
        mk('Show "Hide tab" buttons', 'showHideTabButtons'),
      ]),
    ]);
    UI.open({
      title: 'Customize download progress dialog',
      width: 430,
      content,
      buttons: [
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.virusSettings = function (draft) {
    const path = el('input', { class: 'text-input', value: draft.virusCheckCommand, style: { flex: '1' } });
    path.addEventListener('input', () => (draft.virusCheckCommand = path.value));
    const args = el('input', { class: 'text-input', value: draft.virusCheckArgs, style: { flex: '1' } });
    args.addEventListener('input', () => (draft.virusCheckArgs = args.value));
    const enabled = el('input', { type: 'checkbox', checked: draft.virusCheckEnabled });
    enabled.addEventListener('change', () => (draft.virusCheckEnabled = enabled.checked));
    UI.open({
      title: 'Virus Checking',
      width: 460,
      content: el('div', {}, [
        el('div', { class: 'field-row' }, [el('label', { text: 'Antivirus executable:', style: { width: '124px' } }), path]),
        el('div', { class: 'field-row' }, [el('label', { text: 'Command line options:', style: { width: '124px' } }), args]),
        el('label', { class: 'check' }, [enabled, 'Run virus check when a download completes']),
        el('div', { class: 'hint', text: 'Use [File] in the parameters where the downloaded file name should be inserted.' }),
      ]),
      buttons: [
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.addressExceptions = function (draft) {
    const ta = el('textarea', { class: 'textarea mono', style: { height: '160px', width: '100%' } });
    ta.value = (draft.excludedAddresses || []).join('\n');
    UI.open({
      title: 'The list of addresses exceptions',
      width: 460,
      content: el('div', {}, [
        el('div', { class: 'hint', text: 'One address per line. IDM will not take over downloads from these addresses.', style: { marginBottom: '6px' } }),
        ta,
      ]),
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: (api) => {
            draft.excludedAddresses = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            api.close('ok');
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.siteLogin = function (entry, done) {
    const url = el('input', { class: 'text-input', value: entry.url || '', style: { flex: '1' } });
    const user = el('input', { class: 'text-input', value: entry.user || '', style: { flex: '1' } });
    const pass = el('input', { class: 'text-input', type: 'password', value: entry.pass || '', style: { flex: '1' } });
    UI.open({
      title: 'Site login',
      width: 440,
      content: el('div', {}, [
        el('div', { class: 'field-row' }, [el('label', { text: 'Site URL:', style: { width: '70px' } }), url]),
        el('div', { class: 'field-row' }, [el('label', { text: 'User name:', style: { width: '70px' } }), user]),
        el('div', { class: 'field-row' }, [el('label', { text: 'Password:', style: { width: '70px' } }), pass]),
      ]),
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: (api) => {
            if (!/^https?:\/\//i.test(url.value)) {
              toast('Enter a valid site address.', 'error');
              return;
            }
            api.close('ok');
            done({ url: url.value.trim(), user: user.value, pass: pass.value });
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
      onClose: () => {},
    });
  };

  Dlg.keys = function () {
    const enable = el('input', { type: 'checkbox', checked: true });
    const force = el('select', { class: 'select-input' });
    ['Ctrl', 'Shift', 'Alt'].forEach((k) => force.appendChild(el('option', { value: k, text: k })));
    const key = el('input', { class: 'text-input', value: 'Ctrl', style: { width: '80px' } });
    const content = el('div', {}, [
      el('label', { class: 'check' }, [enable, 'Use the following key(s) to enable downloading with IDM']),
      el('div', { class: 'field-row', style: { marginTop: '8px' } }, [el('span', { text: 'Force download key:' }), force]),
      el('div', { class: 'field-row' }, [el('span', { text: 'Prevent download key:' }), key]),
      el('div', { class: 'hint', text: 'Hold the force key while clicking a link to make IDM take over the download. Hold the prevent key to let the browser download it.' }),
    ]);
    UI.open({
      title: 'Using special keys',
      width: 430,
      content,
      buttons: [
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.browserMenuItems = function () {
    const list = ['Download with IDM', 'Download all links with IDM', 'Download video with IDM', 'Download with IDM (advanced)'];
    const content = el('div', {}, [
      el('div', { class: 'hint', text: 'Select the items shown in the browser context menu:', style: { marginBottom: '6px' } }),
      el('div', { class: 'scroll-box', style: { height: '130px', padding: '5px' } },
        list.map((item, i) => el('label', { class: 'check', style: { display: 'flex', marginBottom: '4px' } }, [
          el('input', { type: 'checkbox', checked: i < 2 }),
          item,
        ]))),
    ]);
    UI.open({
      title: 'Context menu items',
      width: 400,
      content,
      buttons: [
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };

  Dlg.downloadPanel = function () {
    const content = el('div', {}, [
      el('div', { text: 'Download panel position:', style: { marginBottom: '5px' } }),
      el('select', { class: 'select-input', style: { width: '180px' } }, [
        el('option', { text: 'Automatic' }),
        el('option', { text: 'Top right' }),
        el('option', { text: 'Bottom right' }),
        el('option', { text: 'Bottom left' }),
      ]),
      el('label', { class: 'check', style: { marginTop: '10px', display: 'flex' } }, [
        el('input', { type: 'checkbox', checked: true }),
        'Show the download panel for videos on web pages',
      ]),
      el('div', { class: 'hint', text: 'Browser integration is simulated in this clone; no browser extension is installed.' }),
    ]);
    UI.open({
      title: 'Customize IDM Download panels',
      width: 420,
      content,
      buttons: [
        { label: 'OK', primary: true, onClick: (api) => api.close('ok') },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
  };
})();
