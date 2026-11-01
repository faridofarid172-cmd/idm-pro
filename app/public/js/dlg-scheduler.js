(function () {
  const Dlg = (window.Dlg = window.Dlg || {});
  const { el, toast, confirm, prompt, messageBox } = UI;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function timeField(value) {
    const input = el('input', {
      class: 'text-input',
      type: 'time',
      value: value || '12:00',
      step: '60',
      style: { width: '108px' },
    });
    return input;
  }

  function makeTabs(container, items, initial = 0) {
    const strip = el('div', { class: 'tab-strip' });
    const panels = el('div', { class: 'tab-panels' });
    const entries = [];
    let current = initial;
    items.forEach((item, i) => {
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

  Dlg.scheduler = function (startQueueId) {
    const draft = clone(App.state.schedule || {});
    draft.days = Array.isArray(draft.days) ? draft.days : [1, 2, 3, 4, 5];
    let selectedQueue = App.state.queues.find((q) => q.id === startQueueId) || App.state.queues[0] || null;

    const root = el('div', { style: { display: 'flex', gap: '10px', width: '100%', minHeight: '392px' } });
    const left = el('div', { style: { width: '184px', flex: '0 0 184px', display: 'flex', flexDirection: 'column' } });
    const right = el('div', { style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column' } });

    /* ------------------------------------------------------------ queues list */
    const queueHead = el('div', { style: { textAlign: 'center', fontSize: '11.5px', marginBottom: '4px' }, text: 'Queues' });
    const queueList = el('div', { class: 'scroll-box', style: { flex: '1', minHeight: '270px' } });
    const queueButtons = el('div', { style: { display: 'flex', gap: '5px', marginTop: '6px' } });

    function renderQueues() {
      queueList.innerHTML = '';
      for (const q of App.state.queues) {
        const row = el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 5px',
            background: selectedQueue && selectedQueue.id === q.id ? '#cce8ff' : '',
            borderBottom: '1px solid #eef2f6',
          },
        }, [
          el('span', { style: { width: '16px', height: '16px', display: 'flex' }, html: Icons.icon(q.id === 'q_main' ? 'queue' : 'folder') }),
          el('span', { text: q.name, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        ]);
        row.addEventListener('click', () => {
          selectedQueue = q;
          renderQueues();
          renderFiles();
          queueTitle.textContent = q.name;
        });
        row.addEventListener('dblclick', () => renameQueue(q));
        queueList.appendChild(row);
      }
      if (!App.state.queues.length) {
        queueList.appendChild(el('div', { class: 'hint', style: { padding: '6px' }, text: '(no queues)' }));
      }
    }

    const newQueueBtn = el('button', { class: 'btn small', text: 'New queue', style: { flex: '1' } });
    const deleteQueueBtn = el('button', { class: 'btn small', text: 'Delete', style: { flex: '1' } });
    newQueueBtn.addEventListener('click', async () => {
      const name = await prompt({
        title: 'New download queue',
        label: 'Queue name:',
        hint: 'Queues group downloads that are started and stopped together.',
      });
      if (!name) return;
      try {
        const res = await Api.post('/api/queues', { name });
        await App.refresh();
        selectedQueue = res.queue;
        renderQueues();
        renderFiles();
        queueTitle.textContent = selectedQueue.name;
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    deleteQueueBtn.addEventListener('click', async () => {
      if (!selectedQueue) return;
      if (selectedQueue.id === 'q_main') {
        await messageBox({ title: 'Delete queue', message: 'The main download queue cannot be deleted.', kind: 'error' });
        return;
      }
      const ok = await confirm(`Delete the queue "${selectedQueue.name}"?`, 'Downloads assigned to this queue will stay in the download list.');
      if (!ok) return;
      try {
        await Api.del(`/api/queues/${selectedQueue.id}`);
        selectedQueue = App.state.queues.find((q) => q.id === 'q_main') || null;
        await App.refresh();
        selectedQueue = App.state.queues.find((q) => q.id === 'q_main') || App.state.queues[0] || null;
        renderQueues();
        renderFiles();
        if (selectedQueue) queueTitle.textContent = selectedQueue.name;
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    queueButtons.appendChild(newQueueBtn);
    queueButtons.appendChild(deleteQueueBtn);
    left.appendChild(queueHead);
    left.appendChild(queueList);
    left.appendChild(queueButtons);

    /* ------------------------------------------------------------ schedule tab */
    const queueTitle = el('div', {
      textAlign: 'center',
      fontWeight: '600',
      fontSize: '12px',
      marginBottom: '5px',
      text: selectedQueue ? selectedQueue.name : 'Main download queue',
    });

    function buildScheduleTab() {
      const wrap = el('div', {});
      const modes = el('div', { style: { display: 'flex', gap: '34px', marginBottom: '10px' } });
      const oneTime = el('input', { type: 'radio', name: 'schedMode', checked: draft.oneTime !== false && !draft.periodic });
      const periodic = el('input', { type: 'radio', name: 'schedMode', checked: !!draft.periodic });
      oneTime.addEventListener('change', () => {
        draft.oneTime = true;
        draft.periodic = false;
      });
      periodic.addEventListener('change', () => {
        draft.oneTime = false;
        draft.periodic = true;
      });
      modes.appendChild(el('label', { class: 'radio' }, [oneTime, 'One-time downloading']));
      modes.appendChild(el('label', { class: 'radio' }, [periodic, 'Periodic synchronization']));
      wrap.appendChild(modes);

      const startup = el('input', { type: 'checkbox', checked: !!draft.startOnStartup });
      startup.addEventListener('change', () => (draft.startOnStartup = startup.checked));
      wrap.appendChild(el('label', { class: 'check', style: { display: 'flex', marginBottom: '10px' } }, [startup, 'Start download on IDM startup']));

      const startCheck = el('input', { type: 'checkbox', checked: !!draft.startEnabled });
      startCheck.addEventListener('change', () => (draft.startEnabled = startCheck.checked));
      const startTime = timeField(draft.startTime);
      startTime.addEventListener('change', () => (draft.startTime = startTime.value || '12:00'));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '7px' } }, [
          el('label', { class: 'check' }, [startCheck, 'Start download at']),
          startTime,
        ])
      );

      const onceRadio = el('input', { type: 'radio', name: 'startWhen', checked: !draft.periodic });
      const dailyRadio = el('input', { type: 'radio', name: 'startWhen', checked: !!draft.periodic });
      const onceRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0 4px 18px' } }, [
        el('label', { class: 'radio' }, [onceRadio, 'Once at']),
        (() => {
          const input = el('input', { class: 'text-input', type: 'date', value: draft.once || '', style: { width: '142px' } });
          input.addEventListener('change', () => (draft.once = input.value));
          return input;
        })(),
      ]);
      const daysBox = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '2px 10px',
          margin: '2px 0 7px 18px',
        },
      });
      DAYS.forEach((name, idx) => {
        const cb = el('input', { type: 'checkbox', checked: draft.days.includes(idx) });
        cb.addEventListener('change', () => {
          const set = new Set(draft.days);
          if (cb.checked) set.add(idx);
          else set.delete(idx);
          draft.days = Array.from(set).sort((a, b) => a - b);
        });
        daysBox.appendChild(el('label', { class: 'check' }, [cb, name]));
      });
      const dailyRow = el('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginLeft: '18px' } }, [
        el('label', { class: 'radio', style: { marginTop: '4px' } }, [dailyRadio, 'Daily']),
        daysBox,
      ]);
      const syncWhen = () => {
        const daily = dailyRadio.checked;
        daysBox.style.opacity = daily ? '1' : '.5';
        daysBox.querySelectorAll('input').forEach((i) => (i.disabled = !daily));
        onceRow.style.opacity = daily ? '.5' : '1';
        onceRow.querySelectorAll('input').forEach((i) => (i.disabled = daily));
      };
      onceRadio.addEventListener('change', () => {
        draft.periodic = false;
        draft.oneTime = true;
        periodic.checked = false;
        oneTime.checked = true;
        syncWhen();
      });
      dailyRadio.addEventListener('change', () => {
        draft.periodic = true;
        draft.oneTime = false;
        periodic.checked = true;
        oneTime.checked = false;
        syncWhen();
      });
      wrap.appendChild(onceRow);
      wrap.appendChild(dailyRow);
      syncWhen();

      wrap.appendChild(el('hr', { style: { border: 'none', borderTop: '1px solid #d0dae4', margin: '8px 0 7px' } }));

      const stopCheck = el('input', { type: 'checkbox', checked: !!draft.stopEnabled });
      stopCheck.addEventListener('change', () => (draft.stopEnabled = stopCheck.checked));
      const stopTime = timeField(draft.stopTime);
      stopTime.addEventListener('change', () => (draft.stopTime = stopTime.value || '20:30'));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' } }, [
          el('label', { class: 'check' }, [stopCheck, 'Stop download at']),
          stopTime,
        ])
      );

      const retries = el('input', { class: 'text-input', value: draft.retries == null ? 10 : draft.retries, style: { width: '62px' } });
      retries.addEventListener('input', () => (draft.retries = Math.max(0, Number(retries.value) || 0)));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
          el('span', { text: 'Number of retries for each file if downloading failed:' }),
          el('div', { style: { flex: '1' } }),
          retries,
        ])
      );

      const openCheck = el('input', { type: 'checkbox', checked: !!draft.openWhenDone });
      openCheck.addEventListener('change', () => (draft.openWhenDone = openCheck.checked ? draft.openWhenDone : ''));
      const openPath = el('input', { class: 'text-input', value: draft.openWhenDone || '', style: { flex: '1' } });
      openPath.addEventListener('input', () => {
        draft.openWhenDone = openPath.value;
        openCheck.checked = !!openPath.value;
      });
      const openBrowse = el('button', { class: 'btn small', text: '…', style: { minWidth: '27px' }, title: 'Browse for a file on the server' });
      openBrowse.addEventListener('click', async () => {
        const picked = await UI.folderPicker(Fmt.dirname(openPath.value) || 'Downloads');
        if (picked) {
          openPath.value = picked;
          draft.openWhenDone = picked;
          openCheck.checked = true;
        }
      });
      wrap.appendChild(el('label', { class: 'check' }, [openCheck, 'Open the following file when done:']));
      wrap.appendChild(
        el('div', { style: { display: 'flex', gap: '6px', margin: '3px 0 10px 18px' } }, [openPath, openBrowse])
      );

      const hang = el('input', { type: 'checkbox', checked: !!draft.hangUp });
      hang.addEventListener('change', () => (draft.hangUp = hang.checked));
      wrap.appendChild(el('label', { class: 'check', style: { display: 'flex' } }, [hang, 'Hang up modem when done']));

      const exit = el('input', { type: 'checkbox', checked: !!draft.exitIdm });
      exit.addEventListener('change', () => (draft.exitIdm = exit.checked));
      wrap.appendChild(el('label', { class: 'check', style: { display: 'flex' } }, [exit, 'Exit Internet Download Manager when done']));

      const shutdown = el('input', { type: 'checkbox', checked: !!draft.shutdown });
      shutdown.addEventListener('change', () => (draft.shutdown = shutdown.checked));
      const shutdownMode = el('select', { class: 'select-input', style: { width: '150px' } });
      ['Shut down', 'Restart', 'Sleep', 'Hibernate', 'Log off'].forEach((label, i) => {
        shutdownMode.appendChild(el('option', { value: label, text: label, selected: (draft.shutdownMode || 'Shut down') === label }));
      });
      shutdownMode.addEventListener('change', () => (draft.shutdownMode = shutdownMode.value));
      wrap.appendChild(
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          el('label', { class: 'check' }, [shutdown, 'Turn off computer when done']),
          el('div', { style: { flex: '1' } }),
          shutdownMode,
        ])
      );
      const force = el('input', { type: 'checkbox', checked: !!draft.forceShutdown });
      force.addEventListener('change', () => (draft.forceShutdown = force.checked));
      wrap.appendChild(el('label', { class: 'check', style: { display: 'flex', marginLeft: '18px', marginTop: '2px' } }, [force, 'Force processes to terminate']));
      return wrap;
    }

    /* ------------------------------------------------------------ files tab */
    const filesPanel = el('div', {});
    function renderFiles() {
      filesPanel.innerHTML = '';
      if (!selectedQueue) {
        filesPanel.appendChild(el('div', { class: 'hint', text: 'Select a queue.' }));
        return;
      }
      const rows = App.downloads()
        .filter((d) => d.queueId === selectedQueue.id)
        .sort((a, b) => (a.queueRank || 0) - (b.queueRank || 0));
      let selected = null;
      const table = el('div', { class: 'scroll-box', style: { height: '292px' } });
      const head = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 96px 78px',
          gap: '6px',
          background: 'linear-gradient(to bottom,#f6f9fc,#e6edf5)',
          borderBottom: '1px solid #c3d1de',
          padding: '3px 6px',
          fontWeight: '600',
        },
      }, [el('span', { text: 'File Name' }), el('span', { text: 'Status' }), el('span', { text: 'Size' })]);
      table.appendChild(head);
      for (const d of rows) {
        const row = el('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '1fr 96px 78px',
            gap: '6px',
            padding: '3px 6px',
            borderBottom: '1px solid #eef2f6',
            background: selected && selected.id === d.id ? '#cce8ff' : '',
          },
        }, [
          el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: `${d.queueRank || 0}. ${d.filename}`, title: d.filename }),
          el('span', { text: Fmt.status(d) }),
          el('span', { text: d.size ? Fmt.bytes(d.size) : '' }),
        ]);
        row.addEventListener('click', () => {
          selected = d;
          renderFiles();
        });
        table.appendChild(row);
      }
      if (!rows.length) table.appendChild(el('div', { class: 'hint', style: { padding: '8px' }, text: 'This queue is empty. Add downloads to it from the main window.' }));
      filesPanel.appendChild(table);
      const bar = el('div', { style: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' } });
      const mk = (label, fn, disabled) => {
        const b = el('button', { class: 'btn small', text: label, disabled: !!disabled });
        b.addEventListener('click', fn);
        bar.appendChild(b);
      };
      mk('Move Up', async () => {
        if (!selected) return;
        await moveRank(selected, -1);
      }, !selected);
      mk('Move Down', async () => {
        if (!selected) return;
        await moveRank(selected, 1);
      }, !selected);
      mk('Remove from queue', async () => {
        if (!selected) return;
        await Api.post(`/api/downloads/${selected.id}/queue`, { queueId: null });
        selected = null;
        await App.refresh();
        renderFiles();
      }, !selected);
      mk('Add downloads…', () => addDownloadsToQueue(selectedQueue), false);
      filesPanel.appendChild(bar);
    }

    async function moveRank(d, delta) {
      const rows = App.downloads()
        .filter((x) => x.queueId === d.queueId)
        .sort((a, b) => (a.queueRank || 0) - (b.queueRank || 0));
      const idx = rows.findIndex((x) => x.id === d.id);
      const other = rows[idx + delta];
      if (!other) return;
      const a = d.queueRank || idx + 1;
      const b = other.queueRank || idx + delta + 1;
      try {
        await Api.post(`/api/downloads/${d.id}/queue`, { queueId: d.queueId, queueRank: b });
        await Api.post(`/api/downloads/${other.id}/queue`, { queueId: other.queueId, queueRank: a });
        await App.refresh();
        renderFiles();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function addDownloadsToQueue(queue) {
      const candidates = App.downloads().filter((d) => d.queueId !== queue.id);
      let chosen = new Set();
      const list = el('div', { class: 'scroll-box', style: { height: '230px' } });
      function renderList() {
        list.innerHTML = '';
        if (!candidates.length) {
          list.appendChild(el('div', { class: 'hint', text: 'All downloads are already in this queue.', style: { padding: '8px' } }));
          return;
        }
        for (const d of candidates) {
          const cb = el('input', { type: 'checkbox', checked: chosen.has(d.id) });
          cb.addEventListener('change', () => {
            if (cb.checked) chosen.add(d.id);
            else chosen.delete(d.id);
          });
          list.appendChild(
            el('label', { class: 'check', style: { display: 'flex', padding: '3px 6px', borderBottom: '1px solid #eef2f6' } }, [
              cb,
              el('span', { text: d.filename, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
            ])
          );
        }
      }
      renderList();
      UI.open({
        title: 'Add downloads to queue',
        width: 460,
        content: el('div', {}, [
          el('div', { text: `Select downloads to add to "${queue.name}":`, style: { marginBottom: '6px' } }),
          list,
        ]),
        buttons: [
          {
            label: 'Add',
            primary: true,
            onClick: async (api) => {
              if (!chosen.size) {
                toast('Select at least one download.', 'error');
                return;
              }
              for (const id of chosen) {
                await Api.post(`/api/downloads/${id}/queue`, { queueId: queue.id }).catch((err) => toast(err.message, 'error'));
              }
              api.close('ok');
              await App.refresh();
              renderFiles();
            },
          },
          { label: 'Cancel', onClick: (api) => api.close('cancel') },
        ],
      });
    }

    async function renameQueue(q) {
      const name = await prompt({ title: 'Rename queue', label: 'Queue name:', value: q.name });
      if (!name || name === q.name) return;
      try {
        await Api.post('/api/queues/rename', { id: q.id, name });
        await App.refresh();
        renderQueues();
        if (selectedQueue && selectedQueue.id === q.id) queueTitle.textContent = q.name;
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const tabsRoot = el('div', { style: { flex: '1', minWidth: '0' } });
    makeTabs(tabsRoot, [
      { label: 'Schedule', build: buildScheduleTab },
      { label: 'Files in the queue', build: () => filesPanel, onShow: () => renderFiles() },
    ]);

    right.appendChild(queueTitle);
    right.appendChild(tabsRoot);
    root.appendChild(left);
    root.appendChild(right);

    renderQueues();
    renderFiles();

    const inst = UI.open({
      title: 'Scheduler',
      width: 720,
      content: root,
      icon: 'scheduler',
      buttons: [
        {
          label: 'Start now',
          onClick: async () => {
            await Api.post('/api/queue/start');
            await App.refresh();
            toast('Download queue started.', 'info');
          },
        },
        {
          label: 'Stop',
          onClick: async () => {
            await Api.post('/api/queue/stop');
            await App.refresh();
            toast('Download queue stopped.', 'info');
          },
        },
        { label: 'Help', onClick: () => Dlg.help() },
        {
          label: 'Apply',
          onClick: async () => {
            draft.enabled = !!(draft.startEnabled || draft.stopEnabled || draft.startOnStartup);
            try {
              const res = await Api.post('/api/schedule', draft);
              if (res.schedule) App.state.schedule = res.schedule;
              toast('Schedule applied.', 'success');
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        { label: 'Close', primary: true, onClick: (api) => api.close('close') },
      ],
    });
    return inst;
  };
})();
