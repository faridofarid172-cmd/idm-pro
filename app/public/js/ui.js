(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  /* ------------------------------------------------------------- toasts */

  function toast(message, kind = '', title = '') {
    const layer = $('#toast-layer');
    const node = el('div', { class: `toast ${kind}` }, [
      title ? el('strong', { text: title }) : null,
      el('span', { text: message }),
    ]);
    layer.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .25s';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 260);
    }, kind === 'error' ? 6000 : 4200);
  }

  /* ------------------------------------------------------------- dialogs */

  let zBase = 3000;
  let openCount = 0;
  const stack = [];

  class DialogInstance {
    constructor(opts) {
      this.opts = opts;
      this.id = opts.id || `dlg_${Math.random().toString(36).slice(2)}`;
      this.closed = false;
      this.build();
    }

    build() {
      const o = this.opts;
      const width = Math.min(o.width || 420, window.innerWidth - 24);
      const dialog = el('div', { class: 'dialog', style: { width: `${width}px` } });
      dialog.dataset.dialogId = this.id;

      const titleBtn = el('button', { class: 'win-btn close', title: 'Close', html: '✕' });
      titleBtn.addEventListener('click', () => this.close('close'));
      const titleIcon = el('span', { class: 'title-icon', html: o.icon === false ? '' : Icons.icon(o.icon || 'idmlogo') });
      const titleText = el('span', { class: 'text', text: o.title || 'Internet Download Manager' });
      const titleBar = el('div', { class: 'dialog-title' }, [titleIcon, titleText, el('div', { class: 'spacer' }), titleBtn]);

      const body = el('div', { class: 'dialog-body' });
      if (typeof o.content === 'string') body.innerHTML = o.content;
      else if (o.content) body.appendChild(o.content);

      const footer = el('div', { class: 'dialog-footer' });
      const api = {
        el: dialog,
        body,
        footer,
        close: (reason) => this.close(reason),
        setTitle: (t) => (titleText.textContent = t),
        setFooter: (buttons) => renderFooter(footer, buttons, this),
        setBusy: (busy) => dialog.classList.toggle('busy', !!busy),
        focus: () => this.focus(),
      };
      this.api = api;
      this.footerButtons = o.buttons || null;
      this.renderFooter(footer);

      dialog.appendChild(titleBar);
      dialog.appendChild(body);
      if (o.buttons !== false) dialog.appendChild(footer);
      else dialog.classList.add('no-footer');

      if (o.modal !== false) {
        this.shade = el('div', { class: 'modal-shade' });
        document.body.appendChild(this.shade);
      }

      $('#dialog-layer').appendChild(dialog);
      this.node = dialog;
      this.titleBar = titleBar;

      // center with a small cascade offset when other dialogs are open
      const rect = dialog.getBoundingClientRect();
      const offset = (openCount % 5) * 18;
      const left = Math.max(10, (window.innerWidth - width) / 2 + offset - 20);
      const top = Math.max(10, (window.innerHeight - rect.height) / 2 + offset - 30);
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
      dialog.style.zIndex = String(++zBase);
      if (this.shade) this.shade.style.zIndex = String(zBase - 1);

      makeDraggable(this);
      dialog.addEventListener('pointerdown', () => this.focus(), true);

      // escape handling is global; only the topmost gets it
      stack.push(this);
      openCount++;
      this.focus();

      if (o.onMount) o.onMount(api);
      if (o.autoFocus) {
        setTimeout(() => {
          const sel = typeof o.autoFocus === 'string' ? o.autoFocus : 'input, select, textarea';
          const target = dialog.querySelector(sel);
          if (target) {
            target.focus();
            if (target.select) target.select();
          }
        }, 30);
      }

      window.addEventListener('resize', this.onResize = () => this.constrain());
    }

    renderFooter(footer) {
      const o = this.opts;
      footer.innerHTML = '';
      if (o.leftButtons && o.leftButtons.length) {
        const left = el('div', { class: 'left-actions' });
        for (const b of o.leftButtons) left.appendChild(makeButton(b, this));
        footer.appendChild(left);
      }
      const spacer = el('div', { class: 'spacer' });
      footer.appendChild(spacer);
      for (const b of this.footerButtons || []) footer.appendChild(makeButton(b, this));
    }

    focus() {
      for (const d of stack) {
        if (d !== this) d.node.classList.add('blurred');
      }
      this.node.classList.remove('blurred');
      this.node.style.zIndex = String(++zBase);
      if (this.shade) this.shade.style.zIndex = String(zBase - 1);
      const idx = stack.indexOf(this);
      if (idx >= 0 && idx !== stack.length - 1) {
        stack.splice(idx, 1);
        stack.push(this);
      }
    }

    constrain() {
      const r = this.node.getBoundingClientRect();
      const maxW = window.innerWidth - 20;
      if (r.width > maxW) this.node.style.width = `${maxW}px`;
      if (r.right > window.innerWidth - 6) this.node.style.left = `${Math.max(6, window.innerWidth - r.width - 8)}px`;
      if (r.bottom > window.innerHeight - 6) this.node.style.top = `${Math.max(6, window.innerHeight - r.height - 8)}px`;
      if (r.top < 2) this.node.style.top = '8px';
    }

    close(reason = 'close') {
      if (this.closed) return;
      this.closed = true;
      const result = this.opts.onClose ? this.opts.onClose(reason) : undefined;
      this.node.remove();
      if (this.shade) this.shade.remove();
      window.removeEventListener('resize', this.onResize);
      const idx = stack.indexOf(this);
      if (idx >= 0) stack.splice(idx, 1);
      openCount = Math.max(0, openCount - 1);
      if (stack.length) stack[stack.length - 1].focus();
      if (this.resolve) this.resolve(result);
    }

    whenClosed() {
      if (this.closed) return Promise.resolve();
      return new Promise((resolve) => {
        this.resolve = resolve;
      });
    }
  }

  function makeButton(btn, dlg) {
    const node = el('button', {
      class: `btn${btn.primary ? ' default' : ''}${btn.small ? ' small' : ''}${btn.className ? ' ' + btn.className : ''}`,
      disabled: !!btn.disabled,
      text: btn.label,
      title: btn.title || '',
    });
    node.addEventListener('click', () => {
      if (node.disabled) return;
      if (btn.onClick) btn.onClick(dlg.api, dlg);
      else dlg.close(btn.value || 'ok');
    });
    btn.node = node;
    return node;
  }

  function renderFooter(footerEl, buttons, dlgInstance) {
    footerEl.innerHTML = '';
    for (const b of buttons || []) footerEl.appendChild(makeButton(b, dlgInstance));
  }

  function makeDraggable(inst) {
    const handle = inst.titleBar;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    let dragging = false;

    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const r = inst.node.getBoundingClientRect();
      origLeft = r.left;
      origTop = r.top;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const left = Math.min(window.innerWidth - 60, Math.max(-inst.node.offsetWidth + 80, origLeft + e.clientX - startX));
      const top = Math.max(0, Math.min(window.innerHeight - 30, origTop + e.clientY - startY));
      inst.node.style.left = `${left}px`;
      inst.node.style.top = `${top}px`;
    });
    handle.addEventListener('pointerup', (e) => {
      dragging = false;
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
  }

  function open(opts) {
    const inst = new DialogInstance(opts);
    if (opts.show) opts.show(inst.api);
    return inst;
  }

  function messageBox({ title = 'Internet Download Manager', message, detail, kind = 'info', buttons, icon }) {
    return new Promise((resolve) => {
      const content = el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
        el('div', {
          style: { flex: '0 0 32px' },
          html: Icons.icon(icon || (kind === 'error' ? 'stop' : kind === 'question' ? 'idmlogo' : 'finished')),
        }),
        el('div', {}, [
          el('div', { text: message, style: { marginBottom: detail ? '6px' : '0', lineHeight: '1.45' } }),
          detail ? el('div', { class: 'hint', text: detail, style: { lineHeight: '1.45' } }) : null,
        ]),
      ]);
      const inst = open({
        title,
        width: 400,
        icon: 'idmlogo',
        content,
        modal: true,
        buttons:
          buttons ||
          [
            { label: 'OK', primary: true, onClick: (api) => { api.close('ok'); resolve('ok'); } },
          ],
        onClose: () => resolve('close'),
      });
      return inst;
    });
  }

  function confirm(message, detail, { title = 'Internet Download Manager', yes = 'Yes', no = 'No' } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => {
        if (done) return;
        done = true;
        resolve(val);
      };
      const content = el('div', { style: { display: 'flex', gap: '14px', alignItems: 'flex-start' } }, [
        el('div', { style: { flex: '0 0 32px' }, html: Icons.icon('options') }),
        el('div', {}, [
          el('div', { text: message, style: { lineHeight: '1.5', marginBottom: detail ? '6px' : 0 } }),
          detail ? el('div', { class: 'hint', text: detail, style: { lineHeight: '1.5' } }) : null,
        ]),
      ]);
      open({
        title,
        width: 420,
        content,
        buttons: [
          { label: yes, primary: true, onClick: (api) => { finish(true); api.close('yes'); } },
          { label: no, onClick: (api) => { finish(false); api.close('no'); } },
        ],
        onClose: () => finish(false),
      });
    });
  }

  function prompt({ title, label, value = '', hint = '', okLabel = 'OK', width = 380 }) {
    return new Promise((resolve) => {
      let settled = false;
      const input = el('input', { class: 'text-input', value, style: { width: '100%' } });
      const content = el('div', {}, [
        el('div', { text: label, style: { marginBottom: '5px' } }),
        input,
        hint ? el('div', { class: 'hint', text: hint, style: { marginTop: '5px' } }) : null,
      ]);
      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const inst = open({
        title,
        width,
        content,
        autoFocus: true,
        buttons: [
          {
            label: okLabel,
            primary: true,
            onClick: (api) => {
              const v = input.value.trim();
              done(v || null);
              api.close('ok');
            },
          },
          { label: 'Cancel', onClick: (api) => { done(null); api.close('cancel'); } },
        ],
        onClose: () => done(null),
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = input.value.trim();
          done(v || null);
          inst.close('ok');
        }
      });
    });
  }

  /* ------------------------------------------------------------- context menu */

  let currentMenu = null;

  function closeMenu() {
    if (currentMenu) {
      currentMenu.remove();
      currentMenu = null;
    }
  }

  function contextMenu(items, x, y) {
    closeMenu();
    const menu = el('div', { class: 'menu-popup', style: { left: `${x}px`, top: `${y}px` } });
    for (const item of items) {
      if (item === 'sep') {
        menu.appendChild(el('div', { class: 'menu-sep' }));
        continue;
      }
      const node = el('div', {
        class: `menu-item${item.disabled ? ' disabled' : ''}`,
        style: item.style || {},
      }, [
        el('span', { class: 'chk', text: item.checked ? '✓' : '' }),
        el('span', { text: item.label }),
        item.shortcut ? el('span', { class: 'shortcut', text: item.shortcut }) : null,
        item.submenu ? el('span', { class: 'caret', text: '▸' }) : null,
      ]);
      if (!item.disabled && item.onClick) {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenu();
          item.onClick();
        });
        node.addEventListener('mouseenter', () => {
          if (item.submenu) {
            /* submenus are rendered flat by callers when needed */
          }
        });
      }
      menu.appendChild(node);
    }
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth - 4) menu.style.left = `${Math.max(4, window.innerWidth - r.width - 4)}px`;
    if (r.bottom > window.innerHeight - 4) menu.style.top = `${Math.max(4, window.innerHeight - r.height - 4)}px`;
    currentMenu = menu;
    setTimeout(() => {
      document.addEventListener(
        'pointerdown',
        (e) => {
          if (currentMenu && !currentMenu.contains(e.target)) closeMenu();
        },
        { once: true }
      );
    }, 0);
  }

  /* ------------------------------------------------------------- tabs */

  function tabs(container, items, opts = {}) {
    const strip = el('div', { class: 'tab-strip' });
    const panels = el('div', { class: 'tab-panels' });
    const entries = [];
    items.forEach((item, i) => {
      const tab = el('div', { class: `tab${i === 0 ? ' active' : ''}`, text: item.label });
      const panel = el('div', { class: `tab-panel${i === 0 ? ' active' : ''}` });
      if (item.content) panel.appendChild(item.content);
      tab.addEventListener('click', () => activate(i));
      entries.push({ tab, panel, item });
      strip.appendChild(tab);
      panels.appendChild(panel);
    });
    container.appendChild(strip);
    container.appendChild(panels);

    function activate(index) {
      entries.forEach((e, i) => {
        e.tab.classList.toggle('active', i === index);
        e.panel.classList.toggle('active', i === index);
      });
      const entry = entries[index];
      if (entry.item.onShow) entry.item.onShow(entry.panel);
      if (opts.onChange) opts.onChange(index);
    }
    return { el: strip, panels, entries, activate, active: () => entries.findIndex((e) => e.tab.classList.contains('active')) };
  }

  /* ------------------------------------------------------------- folder picker */

  async function folderPicker(startPath = 'Downloads') {
    return new Promise((resolve) => {
      let current = startPath || 'Downloads';
      let settled = false;
      const list = el('div', { class: 'scroll-box', style: { height: '190px' } });
      const pathInput = el('input', { class: 'text-input', value: current, style: { flex: '1' } });
      const upBtn = el('button', { class: 'btn small', text: 'Up', style: { minWidth: '52px' } });
      const newBtn = el('button', { class: 'btn small', text: 'New folder…', style: { minWidth: '88px' } });
      const content = el('div', {}, [
        el('div', { class: 'field-row' }, [upBtn, pathInput]),
        list,
        el('div', { class: 'hint', text: 'Folders are created inside the clone’s download storage.', style: { marginTop: '5px' } }),
      ]);

      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };

      async function load(p) {
        try {
          const data = await Api.get(`/api/folders?path=${encodeURIComponent(p)}`);
          current = data.path;
          pathInput.value = current;
          list.innerHTML = '';
          if (data.parent != null) {
            const up = el('div', {
              text: '.. (Up one level)',
              style: { padding: '4px 7px', cursor: 'default' },
            });
            up.addEventListener('dblclick', () => load(data.parent));
            up.addEventListener('click', () => load(data.parent));
            list.appendChild(up);
          }
          for (const d of data.dirs) {
            const row = el('div', { style: { padding: '4px 7px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'default' } }, [
              el('span', { html: Icons.icon('folder'), style: { width: '16px', height: '16px', display: 'inline-flex' } }),
              el('span', { text: d }),
            ]);
            row.addEventListener('click', () => {
              Array.from(list.children).forEach((c) => (c.style.background = ''));
              row.style.background = '#cce8ff';
            });
            row.addEventListener('dblclick', () => load(joinV(current, d)));
            list.appendChild(row);
          }
          if (!data.dirs.length) {
            list.appendChild(el('div', { class: 'hint', text: '(no subfolders)', style: { padding: '6px' } }));
          }
        } catch (err) {
          toast(err.message, 'error');
        }
      }

      function joinV(a, b) {
        const base = String(a || '').replace(/[\\/]+$/, '');
        return base ? `${base}\\${b}` : b;
      }

      upBtn.addEventListener('click', () => {
        const parent = current.includes('\\') ? current.slice(0, current.lastIndexOf('\\')) : '';
        load(parent || '');
      });
      newBtn.addEventListener('click', async () => {
        const name = await prompt({
          title: 'New folder',
          label: 'Folder name:',
          width: 340,
          okLabel: 'Create',
        });
        if (!name) return;
        try {
          await Api.post('/api/folders', { path: current, name });
          load(current);
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      const inst = open({
        title: 'Browse for Folder',
        width: 420,
        content,
        icon: 'folder',
        buttons: [
          {
            label: 'OK',
            primary: true,
            onClick: (api) => {
              const typed = pathInput.value.trim();
              done(typed || current);
              api.close('ok');
            },
          },
          { label: 'Cancel', onClick: (api) => { done(null); api.close('cancel'); } },
        ],
        onClose: () => done(null),
      });
      inst.api.setTitle('Browse for Folder');
      load(current);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      const top = stack[stack.length - 1];
      if (top && !top.opts.ignoreEscape) top.close('escape');
    }
  });

  window.UI = {
    $,
    $$,
    el,
    toast,
    open,
    messageBox,
    confirm,
    prompt,
    contextMenu,
    closeMenu,
    tabs,
    folderPicker,
    stack,
  };
})();
