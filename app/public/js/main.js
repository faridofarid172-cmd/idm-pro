(function () {
  const { el } = UI;

  function shell(children) {
    const wrap = el('div', {
      style: {
        position: 'fixed',
        inset: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        background: 'radial-gradient(1200px 700px at 60% 0%, #7fb2d8 0%, #3f7ba6 45%, #255b82 100%)',
        color: '#fff',
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        fontSize: '13px',
        zIndex: '10000',
      },
    }, children);
    document.body.appendChild(wrap);
    return wrap;
  }

  function showFatal(err) {
    shell([
      el('div', { style: { width: '52px', height: '52px' }, html: Icons.icon('stop') }),
      el('div', { text: 'The Internet Download Manager service could not be reached.', style: { fontWeight: '600', fontSize: '15px' } }),
      el('div', { text: err && err.message ? err.message : 'Start the Node.js server with "node app/server.js" and reload this page.', style: { maxWidth: '520px', textAlign: 'center', lineHeight: '1.5' } }),
      el('button', { class: 'btn', text: 'Retry', style: { marginTop: '6px' }, onClick: () => location.reload() }),
    ]);
  }

  function showCancelled() {
    shell([
      el('div', { style: { width: '48px', height: '48px' }, html: Icons.icon('idmlogo') }),
      el('div', { text: 'Internet Download Manager Setup was cancelled.', style: { fontWeight: '600', fontSize: '15px' } }),
      el('div', { text: 'The application is not installed yet. Run the setup wizard to continue.', style: { opacity: '.9' } }),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } }, [
        el('button', { class: 'btn', text: 'Run Setup again', onClick: () => location.reload() }),
      ]),
    ]);
  }

  function showClosed() {
    shell([
      el('div', { style: { width: '48px', height: '48px' }, html: Icons.icon('idmlogo') }),
      el('div', { text: 'Internet Download Manager has been installed.', style: { fontWeight: '600', fontSize: '15px' } }),
      el('div', { text: 'Setup finished and the application was not launched.', style: { opacity: '.9' } }),
      el('button', {
        class: 'btn',
        text: 'Start Internet Download Manager',
        style: { marginTop: '6px' },
        onClick: () => location.reload(),
      }),
    ]);
  }

  async function boot() {
    let state;
    try {
      state = await Api.get('/api/state');
    } catch (err) {
      showFatal(err);
      return;
    }
    const params = new URLSearchParams(location.search);
    const forceSetup = params.get('setup') === '1';
    if (!state.settings || !state.settings.installed || forceSetup) {
      const result = await Setup.run(state);
      if (!result || !result.completed) {
        showCancelled();
        return;
      }
      try {
        state = await Api.get('/api/state');
      } catch (err) {
        showFatal(err);
        return;
      }
      if (!result.launch) {
        showClosed();
        return;
      }
    }
    try {
      await App.init(state);
      App.showMain();
    } catch (err) {
      console.error(err);
      showFatal(err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
