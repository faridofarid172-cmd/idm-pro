(function () {
  const { el, toast } = UI;

  const LANGUAGES = [
    'English',
    'Deutsch',
    'Español',
    'Français',
    'Italiano',
    'Português (Brasil)',
    'Русский',
    'Українська',
    'العربية',
    '中文（简体）',
    '日本語',
    '한국어',
  ];

  const EULA = `SAMPLE LICENSE AGREEMENT — NOT THE ORIGINAL IDM EULA

This application is an independent, non-commercial reconstruction of the Internet Download Manager user interface and download workflow, created for evaluation and educational purposes. It is not published by, endorsed by, or affiliated with Tonec Inc.

The original Internet Download Manager is commercial software. Its name, artwork and license text remain the property of their respective owners. No original Tonec binary, artwork, help file or license text is included in this reconstruction.

This reconstruction is provided "as is", without warranty of any kind. Downloads performed by this application transfer data directly from the addresses you enter. You are responsible for ensuring that you have the right to download and use that data.

By selecting "I accept the terms in the license agreement" and continuing, you acknowledge that you have read this sample notice and that this installation is a reconstruction, not a licensed copy of the commercial product.`;

  function makeWindow(className = 'setup-window') {
    const win = el('div', { class: className });
    document.body.appendChild(win);
    return win;
  }

  function icon(size = 40) {
    return el('div', { style: { width: `${size}px`, height: `${size}px`, flex: `0 0 ${size}px` }, html: Icons.icon('idmlogo') });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function splash() {
    return new Promise((resolve) => {
      const win = makeWindow('setup-window setup-splash');
      win.style.width = '440px';
      win.appendChild(
        el('div', { class: 'setup-head' }, [
          icon(34),
          el('div', { style: { flex: '1' } }, [
            el('h1', { text: 'Internet Download Manager 6.43 Setup' }),
            el('div', { class: 'hint', text: 'Tonec Inc. — reconstruction' }),
          ]),
        ])
      );
      const fill = el('i', { style: { width: '0%' } });
      const statusText = el('div', { class: 'hint', text: 'Initializing IDM Installation Wizard…' });
      win.appendChild(
        el('div', { class: 'setup-splash-body' }, [
          el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' } }, [
            icon(52),
            el('div', {}, [
              el('div', { style: { fontSize: '15px', fontWeight: '600', color: '#123a5a' }, text: 'Initializing IDM Installation Wizard…' }),
              el('div', { class: 'hint', text: 'Preparing the setup program. This will only take a moment.' }),
            ]),
          ]),
          el('div', { class: 'progress-bar setup-progress' }, [fill]),
          statusText,
        ])
      );
      let progress = 0;
      const steps = [
        [18, 'Checking system requirements…'],
        [42, 'Unpacking setup components…'],
        [68, 'Loading installation scripts…'],
        [88, 'Preparing the welcome page…'],
        [100, 'Starting the Installation Wizard…'],
      ];
      let index = 0;
      const timer = setInterval(() => {
        if (index >= steps.length) return;
        const [target, label] = steps[index];
        progress = target;
        fill.style.width = `${progress}%`;
        statusText.textContent = label;
        index++;
      }, 280);
      setTimeout(() => {
        clearInterval(timer);
        win.remove();
        resolve();
      }, 1700);
    });
  }

  function SetupWizard(initial) {
    this.initial = initial || {};
    this.step = 0;
    this.accepted = false;
    this.language = this.initial.settings?.language || 'English';
    this.installPath =
      this.initial.settings?.installPath || 'C:\\Program Files (x86)\\Internet Download Manager';
    this.createDesktopIcon = this.initial.settings?.createDesktopIcon !== false;
    this.launch = true;
    this.finished = false;
    this.cancelled = false;
  }

  SetupWizard.prototype.run = function () {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.win = makeWindow();
      this.win.style.width = '620px';

      this.head = el('div', { class: 'setup-head' }, []);
      this.body = el('div', { class: 'setup-body' });
      this.footer = el('div', { class: 'setup-footer' });
      this.win.appendChild(this.head);
      this.win.appendChild(this.body);
      this.win.appendChild(this.footer);

      this.header();
      this.render();
    });
  };

  SetupWizard.prototype.header = function () {
    this.head.innerHTML = '';
    this.head.appendChild(icon(34));
    this.head.appendChild(
      el('div', { style: { flex: '1' } }, [
        el('h1', { text: 'Internet Download Manager 6.43 Setup' }),
        el('div', { class: 'hint', text: 'This wizard will guide you through the installation of the reconstruction.' }),
      ])
    );
    const close = el('button', { class: 'win-btn close', title: 'Cancel setup', html: '✕', style: { width: '34px', height: '20px' } });
    close.addEventListener('click', () => this.cancel());
    this.head.appendChild(close);
  };

  SetupWizard.prototype.setFooter = function (buttons) {
    this.footer.innerHTML = '';
    for (const b of buttons) {
      const btn = el('button', { class: `btn${b.primary ? ' default' : ''}`, text: b.label, disabled: !!b.disabled });
      btn.addEventListener('click', () => b.onClick && b.onClick(btn));
      this.footer.appendChild(btn);
    }
  };

  SetupWizard.prototype.title = function (text, subtitle) {
    return el('div', { class: 'setup-step' }, [
      el('h2', { text }),
      subtitle ? el('div', { class: 'setup-subtitle', text: subtitle }) : null,
    ]);
  };

  SetupWizard.prototype.render = function () {
    this.body.innerHTML = '';
    const step = this.step;
    if (step === 0) this.renderLanguage();
    else if (step === 1) this.renderWelcome();
    else if (step === 2) this.renderLicense();
    else if (step === 3) this.renderDestination();
    else if (step === 4) this.renderReady();
    else if (step === 5) this.renderInstalling();
    else if (step === 6) this.renderFinish();
  };

  SetupWizard.prototype.backNext = function (nextDisabled) {
    this.setFooter([
      { label: '< Back', onClick: () => this.back() },
      { label: 'Next >', primary: true, disabled: !!nextDisabled, onClick: () => this.next() },
      { label: 'Cancel', onClick: () => this.cancel() },
    ]);
  };

  SetupWizard.prototype.back = function () {
    if (this.step > 0) {
      this.step--;
      this.render();
    }
  };

  SetupWizard.prototype.next = function () {
    if (this.step === 2 && !this.accepted) {
      toast('You must accept the sample license agreement to continue.', 'error');
      return;
    }
    if (this.step < 6) {
      this.step++;
      this.render();
    }
  };

  SetupWizard.prototype.cancel = function () {
    const overlay = el('div', { class: 'modal-shade', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.15)' } });
    const box = el('div', {
      style: {
        background: '#f0f0f0',
        border: '1px solid #5b83a5',
        boxShadow: '0 10px 34px rgba(0,0,0,.4)',
        padding: '16px 18px',
        width: '370px',
      },
    }, [
      el('div', { text: 'Are you sure you want to cancel Internet Download Manager Setup?', style: { marginBottom: '12px', lineHeight: '1.5' } }),
      el('div', { style: { display: 'flex', gap: '7px', justifyContent: 'flex-end' } }, [
        (() => {
          const b = el('button', { class: 'btn', text: 'Resume setup', style: { minWidth: '94px' } });
          b.addEventListener('click', () => box.remove());
          overlay.appendChild(box);
          return b;
        })(),
        (() => {
          const b = el('button', { class: 'btn default', text: 'Exit Setup', style: { minWidth: '84px' } });
          b.addEventListener('click', () => {
            box.remove();
            overlay.remove();
            this.cancelled = true;
            this.win.remove();
            this.resolve({ completed: false });
          });
          return b;
        })(),
      ]),
    ]);
    document.body.appendChild(overlay);
  };

  SetupWizard.prototype.renderLanguage = function () {
    this.body.appendChild(this.title('Select the language to use during setup', 'The selected language will be remembered by the installed application.'));
    const select = el('select', { class: 'select-input', style: { width: '300px', height: '24px' } });
    for (const language of LANGUAGES) {
      select.appendChild(el('option', { value: language, text: language, selected: language === this.language }));
    }
    select.addEventListener('change', () => (this.language = select.value));
    this.body.appendChild(el('div', { class: 'field-row' }, [el('label', { class: 'field-label', text: 'Language:', style: { width: '70px' } }), select]));
    this.body.appendChild(
      el('div', { class: 'setup-note' }, [
        'This reconstruction ships with English interface text only. The language choice is stored as an installation preference.',
      ])
    );
    this.backNext(false);
  };

  SetupWizard.prototype.renderWelcome = function () {
    this.body.appendChild(this.title('Welcome to the Internet Download Manager Setup Wizard'));
    this.body.appendChild(
      el('p', {
        text:
          'This wizard will install Internet Download Manager 6.43 build 16 (reconstruction) on your computer. It reproduces the screens and download workflow of the original application using a local JavaScript service.',
      })
    );
    this.body.appendChild(
      el('div', { class: 'setup-note' }, [
        el('strong', { text: 'Note: ' }),
        'this is an independent clone created for evaluation. It is not Tonec Inc.’s installer, and it does not install a Windows service, browser extensions, shell extensions or system drivers.',
      ])
    );
    this.body.appendChild(
      el('p', {
        text: 'To continue, click Next. If you want to review or change any settings, click Back later in the wizard.',
        style: { marginTop: '14px' },
      })
    );
    this.backNext(false);
  };

  SetupWizard.prototype.renderLicense = function () {
    this.body.appendChild(this.title('License Agreement', 'Please read the following sample agreement carefully.'));
    const text = el('textarea', { class: 'eula', readonly: true });
    text.value = EULA;
    this.body.appendChild(text);
    const accept = el('input', { type: 'checkbox', checked: this.accepted });
    const label = el('label', { class: 'check', style: { marginTop: '8px', display: 'flex' } }, [accept, 'I accept the terms in the license agreement']);
    accept.addEventListener('change', () => {
      this.accepted = accept.checked;
      this.setFooter([
        { label: '< Back', onClick: () => this.back() },
        { label: 'Next >', primary: true, disabled: !this.accepted, onClick: () => this.next() },
        { label: 'Cancel', onClick: () => this.cancel() },
      ]);
    });
    this.body.appendChild(label);
    this.backNext(!this.accepted);
  };

  SetupWizard.prototype.renderDestination = function () {
    this.body.appendChild(this.title('Choose Install Location', 'Choose the folder in which to install Internet Download Manager.'));
    const pathInput = el('input', { class: 'text-input', value: this.installPath, style: { flex: '1' } });
    pathInput.addEventListener('input', () => (this.installPath = pathInput.value));
    this.body.appendChild(
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label', text: 'Destination folder:', style: { width: '116px' } }),
        pathInput,
      ])
    );
    this.body.appendChild(
      el('div', { class: 'hint', style: { marginLeft: '116px', marginBottom: '12px' }, text: 'This path is recorded as an application preference. The reconstruction stores downloaded files in its own storage folder.' })
    );
    const desktop = el('input', { type: 'checkbox', checked: this.createDesktopIcon });
    desktop.addEventListener('change', () => (this.createDesktopIcon = desktop.checked));
    this.body.appendChild(el('label', { class: 'check' }, [desktop, 'Create a desktop shortcut']));
    const quick = el('input', { type: 'checkbox', checked: true });
    quick.addEventListener('change', () => {});
    this.body.appendChild(el('label', { class: 'check', style: { marginTop: '4px' } }, [quick, 'Add Internet Download Manager to the Start menu']));
    this.body.appendChild(
      el('div', { class: 'setup-note', style: { marginTop: '16px' } }, [
        el('strong', { text: 'Disk space required: ' }),
        'about 24 MB for the application and its local database. Downloaded files require additional space according to their size.',
      ])
    );
    this.backNext(false);
  };

  SetupWizard.prototype.renderReady = function () {
    this.body.appendChild(this.title('Ready to Install', 'Setup is now ready to begin installing Internet Download Manager on your computer.'));
    this.body.appendChild(
      el('div', { class: 'setup-summary' }, [
        el('div', { class: 'kv', style: { gridTemplateColumns: '116px 1fr' } }, [
          el('span', { class: 'k', text: 'Language:' }),
          el('span', { class: 'v', text: this.language }),
          el('span', { class: 'k', text: 'Destination:' }),
          el('span', { class: 'v', text: this.installPath }),
          el('span', { class: 'k', text: 'Desktop shortcut:' }),
          el('span', { class: 'v', text: this.createDesktopIcon ? 'Create' : 'Do not create' }),
          el('span', { class: 'k', text: 'Version:' }),
          el('span', { class: 'v', text: '6.43 build 16 (reconstruction)' }),
        ]),
      ])
    );
    this.body.appendChild(el('p', { text: 'Click Install to begin the installation. Click Back to review or change the settings.', style: { marginTop: '16px' } }));
    this.setFooter([
      { label: '< Back', onClick: () => this.back() },
      { label: 'Install', primary: true, onClick: () => { this.step = 5; this.render(); } },
      { label: 'Cancel', onClick: () => this.cancel() },
    ]);
  };

  SetupWizard.prototype.renderInstalling = function () {
    this.body.appendChild(this.title('Installing', 'Please wait while Internet Download Manager is being installed.'));
    const status = el('div', { class: 'hint', text: 'Preparing…' });
    const fill = el('i', { style: { width: '0%' } });
    const bar = el('div', { class: 'progress-bar setup-progress' }, [fill]);
    const stepsList = el('div', { class: 'setup-steps' });
    this.body.appendChild(bar);
    this.body.appendChild(status);
    this.body.appendChild(stepsList);
    this.setFooter([{ label: 'Cancel', disabled: true }]);

    const labels = [
      'Creating application folders',
      'Writing configuration defaults',
      'Registering download categories',
      'Creating desktop shortcut',
      'Finalizing the installation',
    ];
    let index = 0;
    const tick = async () => {
      const start = Date.now();
      const span = 280;
      while (Date.now() - start < span) {
        const pct = Math.min(100, Math.round(((index + (Date.now() - start) / span) / labels.length) * 100));
        fill.style.width = `${pct}%`;
        await sleep(30);
      }
      if (index < labels.length) {
        stepsList.appendChild(el('div', { class: 'setup-step-line', text: `✓ ${labels[index]}` }));
        status.textContent = labels[index] + '…';
        index++;
        if (index < labels.length) tick();
        else finishInstall();
      }
    };

    const finishInstall = async () => {
      fill.style.width = '100%';
      status.textContent = 'Finalizing the installation…';
      try {
        await Api.post('/api/setup', {
          language: this.language,
          installPath: this.installPath,
          createDesktopIcon: this.createDesktopIcon,
        });
        this.finished = true;
        this.step = 6;
        this.render();
      } catch (err) {
        status.textContent = `The installation could not be completed: ${err.message}`;
        status.className = 'error-text';
        this.setFooter([
          { label: 'Try again', primary: true, onClick: () => { this.step = 5; this.render(); } },
          { label: 'Cancel', onClick: () => this.cancel() },
        ]);
      }
    };
    tick();
  };

  SetupWizard.prototype.renderFinish = function () {
    this.body.appendChild(this.title('Completing the Internet Download Manager Setup Wizard'));
    this.body.appendChild(
      el('p', { text: 'Internet Download Manager has been installed on your computer. Click Finish to close this wizard.' })
    );
    this.body.appendChild(
      el('div', { class: 'setup-note' }, [
        el('strong', { text: 'Installed files: ' }),
        'this reconstruction runs from its source folder and keeps its data in app/data/db.json. Downloads are stored under app/storage/downloads.',
      ])
    );
    const launch = el('input', { type: 'checkbox', checked: this.launch });
    launch.addEventListener('change', () => (this.launch = launch.checked));
    this.body.appendChild(el('label', { class: 'check', style: { marginTop: '14px', display: 'flex' } }, [launch, 'Launch Internet Download Manager']));
    this.setFooter([
      { label: 'Finish', primary: true, onClick: () => {
        this.win.remove();
        this.resolve({ completed: true, launch: this.launch, language: this.language, installPath: this.installPath });
      } },
    ]);
  };

  async function run(initial) {
    await splash();
    const wizard = new SetupWizard(initial);
    const result = await wizard.run();
    return result;
  }

  window.Setup = { run, LANGUAGES, EULA };
})();
