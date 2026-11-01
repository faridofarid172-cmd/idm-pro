(function () {
  const Dlg = (window.Dlg = window.Dlg || {});
  const { el, toast, confirm, messageBox, prompt } = UI;

  const TOOLBAR_LABELS = {
    addurl: ['Add URL', 'addurl'],
    resume: ['Resume', 'resume'],
    stop: ['Stop', 'stop'],
    stopall: ['Stop All', 'stopall'],
    delete: ['Delete', 'delete'],
    deletecompleted: ['Delete Completed', 'deletecompleted'],
    options: ['Options', 'options'],
    scheduler: ['Scheduler', 'scheduler'],
    startqueue: ['Start Queue', 'startqueue'],
    stopqueue: ['Stop Queue', 'stopqueue'],
    grabber: ['Grabber', 'grabber'],
    tellfriend: ['Tell A Friend', 'tellfriend'],
  };

  function registration() {
    const r = App.state.settings.registration || {};
    return {
      name: r.name || '',
      email: r.email || '',
      serial: r.serial || '',
      registered: !!r.registered,
      registeredAt: r.registeredAt || null,
    };
  }

  function maskedSerial(serial) {
    const s = String(serial || '');
    if (!s) return 'XXXXX-XX................';
    return `${s.slice(0, 5)}-XX${'.'.repeat(Math.max(6, s.length - 7))}`;
  }

  function link(label, href) {
    const a = el('a', { class: 'link', href, target: '_blank', rel: 'noreferrer noopener', text: label });
    a.style.color = '#0a4f9c';
    a.style.textDecoration = 'underline';
    return a;
  }

  /* ------------------------------------------------------------- About */

  Dlg.about = function () {
    const reg = registration();
    const version = App.state.settings.version || '6.43';
    const build = App.state.settings.build || 16;
    const logo = el('div', { style: { width: '48px', height: '48px', flex: '0 0 48px' }, html: Icons.icon('idmlogo') });
    const checkBtn = el('button', { class: 'btn', text: 'Check for Update', style: { minWidth: '126px', marginTop: '5px' } });
    checkBtn.addEventListener('click', () => Dlg.checkUpdates());

    const licenseBox = el(
      'div',
      {
        class: 'groupbox',
        style: { margin: '10px 0 0', padding: '9px 10px', background: '#fff' },
      },
      [
        el('div', { text: 'This product is licensed to:', style: { marginBottom: '7px' } }),
        el('div', { text: reg.registered && reg.name ? reg.name : 'Unregistered evaluation copy', style: { marginLeft: '14px', marginBottom: '7px', fontWeight: reg.registered ? '600' : '400' } }),
        el('div', { style: { display: 'flex', gap: '12px' } }, [
          el('span', { text: 'Your serial number starts with:' }),
          el('span', { text: reg.registered ? maskedSerial(reg.serial) : 'XXXXX-XX................' }),
        ]),
      ]
    );

    const purchase = el('button', { class: 'btn', text: 'Purchase', style: { minWidth: '92px' } });
    purchase.addEventListener('click', () => Dlg.purchase());
    const register = el('button', { class: 'btn', text: 'Registration', style: { minWidth: '92px' }, disabled: reg.registered });
    register.addEventListener('click', () => Dlg.registration());

    const warning = el(
      'div',
      {
        class: 'groupbox',
        style: { marginTop: '12px', padding: '8px 10px', background: '#fff', fontSize: '11.5px', lineHeight: '1.45' },
      },
      [
        'Warning: This computer program is protected by copyright laws and international treaties. ',
        'Unauthorized reproduction or distribution of this program, or any portion of it, may result in severe civil and criminal penalties, ',
        'and will be prosecuted to the maximum extent possible under law.',
      ]
    );

    const content = el('div', { style: { padding: '0 2px' } }, [
      el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
        logo,
        el('div', { style: { flex: '1' } }, [
          el('div', { text: 'Internet Download Manager', style: { fontSize: '17px', fontWeight: '600', letterSpacing: '.1px' } }),
          el('div', { text: `Version: ${version} Build ${build} — reconstructed clone`, style: { fontSize: '12px', marginTop: '2px' } }),
          checkBtn,
        ]),
      ]),
      licenseBox,
      el('div', { style: { display: 'flex', justifyContent: 'center', gap: '200px', marginTop: '10px' } }, [purchase, register]),
      warning,
      el('div', { style: { marginTop: '12px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 8px', alignItems: 'center' } }, [
        el('span', { text: 'Home Site:' }),
        link('www.internetdownloadmanager.com', 'https://www.internetdownloadmanager.com/'),
        el('span', { text: 'Support Team:' }),
        link('www.internetdownloadmanager.com/support', 'https://www.internetdownloadmanager.com/support/'),
      ]),
      el('div', { class: 'hint', style: { marginTop: '10px', lineHeight: '1.4' }, text: 'This program is an independent UI and behaviour reconstruction for evaluation. It is not published by or affiliated with Tonec Inc.' }),
    ]);

    const inst = UI.open({
      title: 'About Internet Download Manager',
      width: 500,
      content,
      icon: 'idmlogo',
      buttons: [{ label: 'Close', primary: true, onClick: (api) => api.close('close') }],
    });
    return inst;
  };

  /* ------------------------------------------------------------- Registration */

  Dlg.registration = function () {
    const reg = registration();
    const first = el('input', { class: 'text-input', value: reg.name.split(/\s+/)[0] || '', style: { flex: '1' } });
    const last = el('input', { class: 'text-input', value: reg.name.split(/\s+/).slice(1).join(' ') || '', style: { flex: '1' } });
    const email = el('input', { class: 'text-input', value: reg.email || '', style: { flex: '1' } });
    const serial = el('input', { class: 'text-input', value: reg.serial || '', style: { flex: '1', letterSpacing: '.6px' }, placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX' });
    const error = el('div', { class: 'error-text', style: { minHeight: '15px' } });

    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } }, [
        el('div', { style: { width: '32px', height: '32px', flex: '0 0 32px' }, html: Icons.icon('idmlogo') }),
        el('div', { class: 'hint', style: { flex: '1', lineHeight: '1.5' }, text: 'Enter your registration details. The serial number is validated locally by this reconstruction; it is never sent to a licensing server.' }),
      ]),
      el('div', { class: 'field-row', style: { marginTop: '10px' } }, [
        el('label', { class: 'field-label', text: 'First name:', style: { width: '82px' } }),
        first,
      ]),
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Last name:', style: { width: '82px' } }),
        last,
      ]),
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Email:', style: { width: '82px' } }),
        email,
      ]),
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Serial:', style: { width: '82px' } }),
        serial,
      ]),
      error,
      el('div', { class: 'hint', text: 'Serial numbers use the format XXXXX-XXXXX-XXXXX-XXXXX (letters and digits).' }),
    ]);

    const inst = UI.open({
      title: 'Registration',
      width: 440,
      content,
      icon: 'idmlogo',
      autoFocus: true,
      buttons: [
        {
          label: 'Register',
          primary: true,
          onClick: async (api) => {
            const name = `${first.value.trim()} ${last.value.trim()}`.trim();
            const mail = email.value.trim();
            const key = serial.value.trim().toUpperCase();
            if (!name) {
              error.textContent = 'Enter your name.';
              return;
            }
            if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
              error.textContent = 'The email address is not valid.';
              return;
            }
            if (!/^[A-Z0-9]{4,6}(-[A-Z0-9]{4,6}){3,4}$/.test(key)) {
              error.textContent = 'The serial number is not valid. Use XXXXX-XXXXX-XXXXX-XXXXX.';
              return;
            }
            error.textContent = '';
            try {
              await App.saveSettings(
                {
                  registration: {
                    name,
                    email: mail,
                    serial: key,
                    registered: true,
                    registeredAt: new Date().toISOString(),
                  },
                },
                true
              );
              api.close('ok');
              toast('Thank you! Internet Download Manager has been registered.', 'success');
              Dlg.about();
            } catch (err) {
              error.textContent = err.message;
            }
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
        { label: 'Purchase…', onClick: () => Dlg.purchase() },
      ],
    });
    return inst;
  };

  /* ------------------------------------------------------------- Purchase */

  Dlg.purchase = function () {
    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' } }, [
        el('div', { style: { width: '40px', height: '40px', flex: '0 0 40px' }, html: Icons.icon('idmlogo') }),
        el('div', {}, [
          el('div', { text: 'Purchase Internet Download Manager', style: { fontSize: '14px', fontWeight: '600', marginBottom: '4px' } }),
          el('div', { class: 'hint', style: { lineHeight: '1.5' }, text: 'This screen mirrors the purchase prompt of the original application. No payment is processed by this reconstruction.' }),
        ]),
      ]),
      el('div', { class: 'groupbox', style: { background: '#fff' } }, [
        el('div', { class: 'section-title', text: 'Available licenses' }),
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 100px', gap: '6px 10px', padding: '0 6px' } }, [
          el('span', { text: '1-year subscription (1 PC)' }),
          el('span', { text: 'from $11.95', style: { textAlign: 'right' } }),
          el('span', { text: 'Lifetime license (1 PC)' }),
          el('span', { text: 'from $29.95', style: { textAlign: 'right' } }),
          el('span', { text: 'Lifetime license (3 PCs)' }),
          el('span', { text: 'from $39.95', style: { textAlign: 'right' } }),
        ]),
        el('div', { class: 'hint', style: { padding: '8px 6px 0' }, text: 'Prices are shown for reference only and are not an offer. Visit the official site for current pricing and terms.' }),
      ]),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' } }, [
        el('button', {
          class: 'btn',
          text: 'Open official purchase page',
          style: { minWidth: '180px' },
          onClick: () => window.open('https://www.internetdownloadmanager.com/register.html', '_blank', 'noopener'),
        }),
      ]),
    ]);
    const inst = UI.open({
      title: 'Purchase Internet Download Manager',
      width: 480,
      content,
      icon: 'idmlogo',
      buttons: [
        { label: 'Registration…', onClick: () => Dlg.registration() },
        { label: 'Close', primary: true, onClick: (api) => api.close('close') },
      ],
    });
    return inst;
  };

  /* ------------------------------------------------------------- Help */

  const HELP = [
    {
      title: 'Getting started',
      body: `Internet Download Manager adds, schedules and runs real HTTP(S) downloads from the local IDM service.

Press "Add URL" (Ctrl+N) to enter an address. After the file information is retrieved, the Download File Info dialog lets you choose the category, destination folder and description. "Start Download" begins immediately; "Download Later" only adds the file to the list.

Downloads are stored in the clone's storage folder. The folder tree shows All Downloads, categories, Unfinished, Finished, Grabber files and queues.`,
    },
    {
      title: 'Downloading files',
      body: `Select one or more rows in the list and use the toolbar:

• Resume — start or continue a paused/errored download.
• Stop — pause the selected downloads.
• Stop All — pause everything that is running.
• Delete — remove the selected downloads (and optionally their data).

Double-click a completed file to open it, or double-click an unfinished file to see its properties. Right-click for more commands. The progress window shows per-segment activity, speed and time left.`,
    },
    {
      title: 'Queues',
      body: `Queues let downloads run in a controlled order. Right-click a download and choose "Add to queue", then start a queue with the Start Queue toolbar button or the Scheduler dialog.

Queue concurrency is configured on the server (default 4 simultaneous files). Use the Queues node in the tree to view and manage queues.`,
    },
    {
      title: 'Scheduler',
      body: `Open Tasks → Scheduler (or the Scheduler toolbar button). Choose one-time or daily downloading, a start time, an optional stop time and retry count.

The server checks the schedule every 15 seconds. The schedule is persisted and survives restarts; it starts and stops the download queue automatically.`,
    },
    {
      title: 'Site Grabber',
      body: `Tasks → Run Site Grabber scans a web page for downloadable links. Choose how many link levels to follow and which file extensions to collect, press Scan, then add the selected files to the download list.

Only pages on the same site are followed. Scans are bounded to 12 pages and 500 results.`,
    },
    {
      title: 'Options',
      body: `Downloads → Options opens the configuration dialog with General, File types, Save to, Downloads, Connection, Proxy / Socks, Sites Logins, Dial Up / VPN and Sounds tabs.

Most settings are applied immediately to the local download service. Browser integration options are represented in the UI but no browser extension is installed by this reconstruction.`,
    },
    {
      title: 'Categories and columns',
      body: `Right-click the Categories node to add or edit categories. A category supplies a destination folder and a list of file extensions used to suggest it when a new download is added.

View → Columns lets you show, hide and reorder list columns. Column widths can be dragged in the header.`,
    },
    {
      title: 'Registration',
      body: `Registration → Registration accepts a locally validated serial number. It is stored in the application's JSON database. This reconstruction does not contact a licensing server.

Registration → Purchase shows reference license information and a link to the official site.`,
    },
    {
      title: 'Installer and first run',
      body: `The first run shows the reconstructed IDM Setup Wizard: splash screen, language selection, welcome, license, destination folder and desktop shortcut, installation progress and finish.

The wizard records the install path and language in the local database. Re-open the wizard at any time with ?setup=1 in the address bar.`,
    },
    {
      title: 'Troubleshooting',
      body: `If the download service cannot be reached, make sure the Node.js server is running (node app/server.js) and reload the page.

A download that fails shows the server's HTTP status in the Status column and in File Properties. Some servers reject HEAD requests or do not support byte ranges; IDM falls back to a single stream in that case.`,
    },
  ];

  Dlg.help = function (startTopic = 0) {
    let current = Math.min(startTopic, HELP.length - 1);
    const topics = el('div', { class: 'scroll-box', style: { width: '168px', flex: '0 0 168px', height: '330px' } });
    const body = el('div', { class: 'scroll-box', style: { flex: '1', height: '330px', padding: '8px 10px', userSelect: 'text' } });
    const search = el('input', { class: 'text-input', placeholder: 'Search help topics…', style: { width: '100%', marginBottom: '6px' } });

    function show(i) {
      current = i;
      Array.from(topics.children).forEach((row, idx) => (row.style.background = idx === i ? '#cce8ff' : ''));
      const topic = HELP[i];
      body.innerHTML = '';
      body.appendChild(el('h3', { text: topic.title, style: { margin: '0 0 8px', fontSize: '13.5px', color: '#123a5a' } }));
      for (const paragraph of topic.body.split(/\n\s*\n/)) {
        body.appendChild(el('p', { text: paragraph, style: { margin: '0 0 9px', lineHeight: '1.55', whiteSpace: 'pre-wrap' } }));
      }
    }

    function renderTopics(filter = '') {
      topics.innerHTML = '';
      const needle = filter.toLowerCase();
      HELP.forEach((t, i) => {
        if (needle && !(`${t.title} ${t.body}`.toLowerCase().includes(needle))) return;
        const row = el('div', { style: { padding: '4px 7px', cursor: 'default' }, text: t.title });
        row.addEventListener('click', () => show(i));
        row.addEventListener('dblclick', () => show(i));
        topics.appendChild(row);
      });
      const first = Array.from(topics.children)[0];
      if (first) first.click();
      else body.innerHTML = '<div class="hint">No help topics match the search.</div>';
    }

    search.addEventListener('input', () => renderTopics(search.value));
    renderTopics();
    show(current);

    const content = el('div', {}, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } }, [
        el('div', { text: 'Internet Download Manager Help', style: { fontWeight: '600', fontSize: '13px' } }),
        search,
      ]),
      el('div', { style: { display: 'flex', gap: '8px' } }, [topics, body]),
    ]);
    const inst = UI.open({
      title: 'Help',
      width: 620,
      content,
      icon: 'idmlogo',
      buttons: [
        { label: 'Contents', onClick: () => renderTopics('') },
        { label: 'Close', primary: true, onClick: (api) => api.close('close') },
      ],
    });
    return inst;
  };

  /* ------------------------------------------------------------- Updates */

  Dlg.checkUpdates = async function () {
    const content = el('div', {}, [
      el('div', { text: 'Checking for updates…', style: { marginBottom: '8px' } }),
      el('div', { class: 'progress-bar', style: { height: '16px' } }, [el('i', { style: { width: '0%' } })]),
    ]);
    const inst = UI.open({
      title: 'Internet Download Manager Update',
      width: 420,
      content,
      icon: 'idmlogo',
      buttons: [{ label: 'Cancel', onClick: (api) => api.close('cancel') }],
    });
    const fill = content.querySelector('.progress-bar > i');
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(92, progress + 12);
      fill.style.width = `${progress}%`;
    }, 120);
    let serverOk = true;
    try {
      await Api.get('/api/state');
    } catch {
      serverOk = false;
    }
    await new Promise((r) => setTimeout(r, 1000));
    clearInterval(timer);
    if (inst.closed) return;
    fill.style.width = '100%';
    content.innerHTML = '';
    content.appendChild(
      el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
        el('div', { style: { width: '32px', height: '32px', flex: '0 0 32px' }, html: Icons.icon(serverOk ? 'finished' : 'stop') }),
        el('div', {}, [
          el('div', {
            style: { fontWeight: '600', marginBottom: '5px' },
            text: serverOk ? 'Your version is up to date.' : 'The update service could not be contacted.',
          }),
          el('div', {
            class: 'hint',
            style: { lineHeight: '1.5' },
            text: serverOk
              ? 'Internet Download Manager 6.43 build 16 is the version provided by this reconstruction. Automatic updates are not available for the clone; replace the source files to update it.'
              : 'Make sure the local IDM service is running and try again.',
          }),
        ]),
      ])
    );
    inst.api.setFooter([
      { label: serverOk ? 'OK' : 'Retry', primary: true, onClick: (api) => api.close('ok') },
      { label: 'Close', onClick: (api) => api.close('close') },
    ]);
    if (!serverOk) {
      inst.api.setFooter([
        { label: 'Retry', primary: true, onClick: (api) => { api.close('retry'); Dlg.checkUpdates(); } },
        { label: 'Close', onClick: (api) => api.close('close') },
      ]);
    }
  };

  /* ------------------------------------------------------------- Tell a friend */

  Dlg.tellFriend = async function () {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    const yourName = el('input', { class: 'text-input', style: { flex: '1' } });
    const yourEmail = el('input', { class: 'text-input', style: { flex: '1' } });
    const friendName = el('input', { class: 'text-input', style: { flex: '1' } });
    const friendEmail = el('input', { class: 'text-input', style: { flex: '1' } });
    const message = el('textarea', { class: 'textarea', style: { height: '110px', width: '100%' } });
    message.value =
      'Hi,\n\nI use Internet Download Manager and thought you might like it too. It speeds up downloads by splitting files into segments and can resume interrupted transfers.\n\n' +
      'Take a look: https://www.internetdownloadmanager.com/\n';
    const error = el('div', { class: 'error-text', style: { minHeight: '14px' } });

    const content = el('div', {}, [
      el('div', { class: 'hint', style: { marginBottom: '8px' }, text: 'Tell a friend about Internet Download Manager. The message opens in your default mail application; this clone does not send mail itself.' }),
      el('div', { class: 'field-row' }, [el('label', { class: 'field-label', text: 'Your name:', style: { width: '86px' } }), yourName]),
      el('div', { class: 'field-row' }, [el('label', { class: 'field-label', text: 'Your email:', style: { width: '86px' } }), yourEmail]),
      el('div', { class: 'field-row' }, [el('label', { class: 'field-label', text: "Friend's name:", style: { width: '86px' } }), friendName]),
      el('div', { class: 'field-row' }, [el('label', { class: 'field-label', text: "Friend's email:", style: { width: '86px' } }), friendEmail]),
      el('div', { style: { marginBottom: '3px' }, text: 'Message:' }),
      message,
      error,
    ]);

    function validate() {
      const mail = friendEmail.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        error.textContent = "Enter a valid email address for your friend.";
        friendEmail.focus();
        return null;
      }
      const subject = encodeURIComponent(`${yourName.value.trim() || 'A friend'} recommends Internet Download Manager`);
      const body = encodeURIComponent(message.value);
      return `mailto:${encodeURIComponent(mail)}?subject=${subject}&body=${body}`;
    }

    const inst = UI.open({
      title: 'Tell A Friend',
      width: 520,
      content,
      icon: 'tellfriend',
      buttons: [
        {
          label: 'Send',
          primary: true,
          onClick: (api) => {
            const href = validate();
            if (!href) return;
            api.close('ok');
            window.location.href = href;
            toast('The message was passed to your mail application.', 'success');
          },
        },
        {
          label: 'Copy message',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(`${message.value}\n\n${friendEmail.value}`);
              toast('Message copied to the clipboard.', 'success');
            } catch {
              toast('Clipboard access is not available.', 'error');
            }
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
      ],
    });
    if (text) yourName.value = '';
    return inst;
  };

  /* ------------------------------------------------------------- Delete completed */

  Dlg.deleteCompleted = async function () {
    const done = App.downloads().filter((d) => d.status === 'complete');
    if (!done.length) {
      await messageBox({ title: 'Delete completed downloads', message: 'There are no completed downloads to delete.', kind: 'info' });
      return;
    }
    const deleteFiles = el('input', { type: 'checkbox', checked: true });
    const content = el('div', {}, [
      el('div', { text: `Delete ${done.length} completed download${done.length === 1 ? '' : 's'} from the list?`, style: { marginBottom: '8px' } }),
      el('div', { class: 'scroll-box', style: { height: '130px', marginBottom: '8px' } },
        done.slice(0, 200).map((d) => el('div', { style: { padding: '2px 6px', borderBottom: '1px solid #eef2f6' }, text: d.filename }))),
      el('label', { class: 'check' }, [deleteFiles, 'Also delete the downloaded files from the storage folder']),
    ]);
    const choice = await new Promise((resolve) => {
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      UI.open({
        title: 'Delete Completed Downloads',
        width: 480,
        content,
        icon: 'deletecompleted',
        buttons: [
          {
            label: 'Delete',
            primary: true,
            onClick: (api) => {
              finish({ approved: true, deleteFiles: deleteFiles.checked });
              api.close('ok');
            },
          },
          { label: 'Cancel', onClick: (api) => { finish({ approved: false }); api.close('cancel'); } },
        ],
        onClose: () => finish({ approved: false }),
      });
    });
    if (!choice.approved) return;
    try {
      const res = await Api.post('/api/downloads/actions/delete-completed', { deleteFiles: !!choice.deleteFiles });
      App.state.selection.clear();
      await App.refresh();
      toast(`${res.deleted} completed download${res.deleted === 1 ? '' : 's'} deleted.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  /* ------------------------------------------------------------- Customize toolbar */

  Dlg.toolbarCustomize = function () {
    const current = (App.state.settings.toolbarButtons || []).slice();
    const available = Object.keys(TOOLBAR_LABELS);
    let selected = 0;

    const activeList = el('div', { class: 'scroll-box', style: { height: '240px', flex: '1' } });
    const availableList = el('div', { class: 'scroll-box', style: { height: '240px', flex: '1' } });
    const styleSelect = el('select', { class: 'select-input', style: { width: '190px' } });
    [
      ['large3d', 'Large 3D buttons'],
      ['small3d', 'Small 3D buttons'],
      ['largeneon', 'Large Neon buttons'],
      ['smallneon', 'Small Neon buttons'],
    ].forEach(([v, l]) => styleSelect.appendChild(el('option', { value: v, text: l, selected: (App.state.settings.toolbarStyle || 'large3d') === v })));

    function render() {
      activeList.innerHTML = '';
      current.forEach((key, i) => {
        const label = TOOLBAR_LABELS[key] ? TOOLBAR_LABELS[key][0] : key;
        const row = el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 6px',
            background: selected === i ? '#cce8ff' : '',
            borderBottom: '1px solid #eef2f6',
          },
        }, [
          el('span', { style: { width: '18px', height: '18px', display: 'flex' }, html: Icons.icon(TOOLBAR_LABELS[key] ? TOOLBAR_LABELS[key][1] : 'settings') }),
          el('span', { text: label }),
        ]);
        row.addEventListener('click', () => {
          selected = i;
          render();
        });
        activeList.appendChild(row);
      });
      availableList.innerHTML = '';
      for (const key of available) {
        if (current.includes(key)) continue;
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', borderBottom: '1px solid #eef2f6' } }, [
          el('span', { style: { width: '18px', height: '18px', display: 'flex' }, html: Icons.icon(TOOLBAR_LABELS[key][1]) }),
          el('span', { text: TOOLBAR_LABELS[key][0] }),
        ]);
        row.addEventListener('dblclick', () => add(key));
        availableList.appendChild(row);
      }
      if (!availableList.children.length) {
        availableList.appendChild(el('div', { class: 'hint', text: 'All buttons are already on the toolbar.', style: { padding: '6px' } }));
      }
    }

    function add(key) {
      current.push(key);
      selected = current.length - 1;
      render();
    }

    const move = (delta) => {
      const target = selected + delta;
      if (target < 0 || target >= current.length) return;
      [current[selected], current[target]] = [current[target], current[selected]];
      selected = target;
      render();
    };

    const buttons = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', justifyContent: 'center' } }, [
      (() => {
        const b = el('button', { class: 'btn small', text: 'Add →', style: { minWidth: '70px' } });
        b.addEventListener('click', () => {
          const first = available.find((k) => !current.includes(k));
          if (first) add(first);
        });
        return b;
      })(),
      (() => {
        const b = el('button', { class: 'btn small', text: 'Remove', style: { minWidth: '70px' } });
        b.addEventListener('click', () => {
          if (!current.length) return;
          current.splice(selected, 1);
          selected = Math.max(0, selected - 1);
          render();
        });
        return b;
      })(),
      (() => {
        const b = el('button', { class: 'btn small', text: 'Move Up', style: { minWidth: '70px' } });
        b.addEventListener('click', () => move(-1));
        return b;
      })(),
      (() => {
        const b = el('button', { class: 'btn small', text: 'Move Down', style: { minWidth: '70px' } });
        b.addEventListener('click', () => move(1));
        return b;
      })(),
    ]);

    const content = el('div', {}, [
      el('div', { style: { display: 'flex', gap: '10px' } }, [
        el('div', { style: { flex: '1' } }, [el('div', { class: 'section-title', text: 'Toolbar buttons' }), activeList]),
        buttons,
        el('div', { style: { flex: '1' } }, [el('div', { class: 'section-title', text: 'Available buttons' }), availableList]),
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' } }, [
        el('span', { text: 'Button style:' }),
        styleSelect,
      ]),
      el('div', { class: 'hint', text: 'Double-click a button in the available list to add it.' }),
    ]);
    render();

    UI.open({
      title: 'Customize Toolbar',
      width: 580,
      content,
      icon: 'options',
      buttons: [
        {
          label: 'OK',
          primary: true,
          onClick: async (api) => {
            if (!current.length) {
              toast('The toolbar must contain at least one button.', 'error');
              return;
            }
            api.close('ok');
            await App.saveSettings({ toolbarButtons: current, toolbarStyle: styleSelect.value }, true);
            App.renderAll();
          },
        },
        { label: 'Cancel', onClick: (api) => api.close('cancel') },
        {
          label: 'Reset',
          onClick: () => {
            current.splice(0, current.length, 'addurl', 'resume', 'stop', 'stopall', 'delete', 'deletecompleted', 'options', 'scheduler', 'startqueue', 'stopqueue', 'grabber', 'tellfriend');
            selected = 0;
            render();
          },
        },
      ],
    });
  };
})();
