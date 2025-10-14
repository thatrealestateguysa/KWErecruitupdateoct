(function () {
  const API = window.KWE_CONFIG.apiBase;
  const AUTO_SYNC = !!window.KWE_CONFIG.autoSyncOnLoad;
  const SHOW_DIAG = !!window.KWE_CONFIG.showDiagnostics;

  const STATUS_ORDER = [
    'To Contact',
    'Whatsapp Sent',
    'No Whatsapp',
    'Replied',
    'Not Interested in KW',
    'Invite to Events/ Networking',
    'Appointment',
    'Appointment booked',
    'Ready to join KW',
    'cultivate',
    'decided not to join',
    'do not contact',
    'JOINED'
  ];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const fmtDate = (val) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toISOString().slice(0,10);
    } catch { return String(val); }
  };
  const toast = (msg) => {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), 2200);
  };
  const showDiag = (text) => {
    if (!SHOW_DIAG) return;
    const b = $('#diag'); const t = $('#diagText');
    t.textContent = text;
    b.classList.remove('hidden');
  };

  async function apiPost(action, payload={}) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    const raw = await res.text();
    try {
      const data = JSON.parse(raw);
      if (data.result !== 'success') throw new Error(data.message || 'Request failed');
      return data.payload ?? data.message;
    } catch (err) {
      showDiag(`API error for "${action}": ${err.message}. Raw: ${raw.slice(0,160)}…`);
      throw err;
    }
  }

  async function runDiagnostics() {
    try {
      const getRes = await fetch(API);
      const getTxt = await getRes.text();
      let okGet = false;
      try {
        const js = JSON.parse(getTxt);
        okGet = js && js.result === 'success';
      } catch (_) {}
      showDiag(okGet ? 'GET ✓ Web App reachable' : 'GET ? Received non-JSON or error; check deploy/public access');
    } catch (e) {
      showDiag('GET ✗ Could not reach Web App (network or permissions)');
    }
    try {
      await apiPost('getStats', {});
      showDiag('POST ✓ Actions available');
    } catch (e) {
      showDiag('POST ✗ "getStats" failed — likely old deployment. Deploy a new version.');
    }
    $('#hideDiag').addEventListener('click', ()=> $('#diag').classList.add('hidden'));
  }

  // state
  let recruits = [];
  let counts = {};
  let total = 0;
  let unique = 0;
  let activeStatus = 'All';

  function statusCountsToTabs() {
    const tabs = $('#statusTabs');
    tabs.innerHTML = '';
    const statuses = ['All', ...STATUS_ORDER];
    statuses.forEach(s => {
      const c = s === 'All' ? total : (counts[s] || 0);
      const el = document.createElement('div');
      el.className = 'tab' + (s === activeStatus ? ' active' : '');
      el.textContent = s;
      const span = document.createElement('span');
      span.className = 'count';
      span.textContent = c;
      el.appendChild(span);
      el.addEventListener('click', ()=> {
        activeStatus = s;
        statusCountsToTabs();
        renderTable();
      });
      tabs.appendChild(el);
    });
  }

  function getFiltered() {
    const q = $('#searchInput').value.trim().toLowerCase();
    let arr = recruits.slice();
    if (activeStatus !== 'All') arr = arr.filter(r => String(r.status||'') === activeStatus);
    if (q) arr = arr.filter(r => {
      return [r.name, r.surname, r.phone, r.suburb, r.agency, r.listingRef]
        .map(x => String(x||'').toLowerCase()).some(x => x.includes(q));
    });
    // newest last contact first
    arr.sort((a,b)=> new Date(b.lastContactDate||0) - new Date(a.lastContactDate||0));
    return arr;
  }

  function renderTable() {
    const tbody = $('#rows');
    tbody.innerHTML = '';
    const items = getFiltered();
    $('#empty').classList.toggle('hidden', items.length > 0);

    items.forEach((r) => {
      const tr = document.createElement('tr');

      const waButton = r.waLink ? `<a class="wa" href="${r.waLink}" target="_blank" rel="noopener">Open</a>` : '';
      const statusSel = `<select class="status" data-idx="${r.idx}">
        ${STATUS_ORDER.map(s => `<option value="${s}" ${s===r.status?'selected':''}>${s}</option>`).join('')}
      </select>`;

      tr.innerHTML = `
        <td>${r.idx+1}</td>
        <td><span class="badge">${r.listingType||''}</span></td>
        <td>${r.listingRef||''}</td>
        <td>${r.name||''}</td>
        <td>${r.surname||''}</td>
        <td>${r.phone||''}</td>
        <td>${r.suburb||''}</td>
        <td>${r.agency||''}</td>
        <td>${statusSel}</td>
        <td>${fmtDate(r.lastContactDate)||''}</td>
        <td>
          <div class="note-row">
            <input type="text" placeholder="Add note…" value="${(r.notes||'').toString().replace(/"/g,'&quot;')}" data-idx="${r.idx}" />
            <button class="btn" data-save-note="${r.idx}">Save</button>
          </div>
        </td>
        <td>${waButton}</td>
      `;
      tbody.appendChild(tr);
    });

    // events
    $$('#rows select.status').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const rowIndex = Number(e.target.getAttribute('data-idx'));
        const newStatus = e.target.value;
        try {
          await apiPost('updateSingleStatus', { rowIndex, newStatus });
          toast('Status updated');
          const item = recruits.find(x => x.idx === rowIndex);
          if (item) item.status = newStatus;
          await refreshStatsOnly();
          renderTable();
        } catch (err) {
          toast('Update failed (see Diagnostics)');
        }
      });
    });
    $$('#rows button[data-save-note]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const rowIndex = Number(e.target.getAttribute('data-save-note'));
        const input = $(`#rows input[data-idx="${rowIndex}"]`);
        const newNote = input ? input.value : '';
        try {
          await apiPost('updateSingleNote', { rowIndex, newNote });
          toast('Note saved');
        } catch (err) {
          toast('Save failed (see Diagnostics)');
        }
      });
    });
  }

  async function refreshStatsOnly() {
    const s = await apiPost('getStats', {});
    total = s.total || 0;
    counts = s.counts || {};
    unique = s.contactedUniqueByPhone || 0;
    $('#mTotal').textContent = total;
    $('#mUnique').textContent = unique;
    $('#mWhen').textContent = new Date().toLocaleString();
    statusCountsToTabs();
  }

  async function refreshAll({doSync=false}={}) {
    if (doSync) {
      showDiag('Running resync…');
      try { await apiPost('resyncContacts', {}); } catch(e) { showDiag('Resync failed — continue anyway.'); }
    }
    const [view] = await Promise.all([apiPost('getRecruitsView', {}), refreshStatsOnly()]);
    recruits = Array.isArray(view) ? view : [];
    if (!recruits.length) showDiag('No rows returned — confirm SHEET_ID/SHEET_NAME and data exists.');
    renderTable();
  }

  function bindControls() {
    $('#refreshBtn').addEventListener('click', ()=> refreshAll({doSync:false}));
    $('#syncBtn').addEventListener('click', async ()=> {
      toast('Syncing…');
      await refreshAll({doSync:true});
      toast('Synced');
    });
    $('#searchInput').addEventListener('input', ()=> renderTable());
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindControls();
    if (SHOW_DIAG) await runDiagnostics();
    await refreshAll({doSync: AUTO_SYNC});
  });
})();