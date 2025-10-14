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
    const tryParse = new Date(val);
    if (!isNaN(tryParse.getTime())) return tryParse.toISOString().slice(0,10);
    return String(val);
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
      // bubble error to caller
      throw new Error(`POST ${action}: ${err.message}; raw=${raw.slice(0,140)}…`);
    }
  }

  async function apiGet() {
    const r = await fetch(API);
    const raw = await r.text();
    try {
      const json = JSON.parse(raw);
      if (json.result === 'success') return json;
      throw new Error(json.message || 'GET returned non-success');
    } catch (e) {
      throw new Error(`GET parse error; raw=${raw.slice(0,160)}…`);
    }
  }

  // --- transform helpers for GET raw sheet
  function mapHeaderToIndex(headerRow) {
    const map = {};
    headerRow.forEach((h, i) => {
      const key = String(h || '').trim().toLowerCase();
      map[key] = i;
    });
    return map;
  }
  function pick(row, map, label) {
    const idx = map[label];
    return idx == null ? '' : (row[idx] ?? '');
    }
  function normalizePhone(p) {
    const digits = String(p||'').replace(/\D/g,'');
    if (!digits) return '';
    if (digits.length >= 9) return '27' + digits.slice(-9);
    return digits;
  }

  // state
  let recruits = [];
  let counts = {};
  let total = 0;
  let unique = 0;
  let activeStatus = 'All';

  function computeStats(rows) {
    const c = {};
    const seen = new Set();
    rows.forEach(r => {
      c[r.status] = (c[r.status] || 0) + 1;
      const n = normalizePhone(r.phone);
      if (n) seen.add(n);
    });
    return { counts: c, unique: seen.size, total: rows.length };
  }

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
          const s = computeStats(recruits);
          counts = s.counts; total = s.total; unique = s.unique;
          statusCountsToTabs();
          renderTable();
        } catch (err) {
          showDiag('Status update failed: ' + err.message);
          toast('Update failed');
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
          showDiag('Note save failed: ' + err.message);
          toast('Save failed');
        }
      });
    });
  }

  async function loadRows() {
    // Try modern endpoints first
    try {
      const rows = await apiPost('getRecruitsView', {});
      if (Array.isArray(rows) && rows.length) return rows;
      throw new Error('Empty getRecruitsView');
    } catch (e) {
      showDiag('Using GET fallback (legacy backend): ' + e.message);
      // GET fallback: transform raw sheet values
      const js = await apiGet();
      const values = js.data || js.values || [];
      if (!values.length) throw new Error('GET returned no rows');
      const headers = values[0] || [];
      const map = mapHeaderToIndex(headers);
      const out = [];
      for (let i=1; i<values.length; i++) {
        const row = values[i];
        out.push({
          idx: i-1,
          listingType: pick(row, map, 'listing type'),
          listingRef: pick(row, map, 'listing ref'),
          name: pick(row, map, 'name'),
          surname: pick(row, map, 'surname'),
          phone: pick(row, map, 'contact number'),
          email: pick(row, map, 'email'),
          suburb: pick(row, map, 'suburb'),
          agency: pick(row, map, 'agency'),
          status: pick(row, map, 'status') || 'To Contact',
          lastContactDate: pick(row, map, 'last contact date'),
          notes: pick(row, map, 'notes'),
          waLink: pick(row, map, 'whatsapp link'),
          waMessage: pick(row, map, 'whatsapp message'),
          contactId: pick(row, map, 'contact id'),
        });
      }
      return out;
    }
  }

  async function refreshAll({doSync=false}={}) {
    if (doSync) {
      try { await apiPost('resyncContacts', {}); }
      catch (e) { showDiag('Resync failed — continue anyway.'); }
    }
    try {
      recruits = await loadRows();
      const s = computeStats(recruits);
      counts = s.counts; total = s.total; unique = s.unique;
      $('#mTotal').textContent = total;
      $('#mUnique').textContent = unique;
      $('#mWhen').textContent = new Date().toLocaleString();
      statusCountsToTabs();
      renderTable();
    } catch (e) {
      showDiag('Load failed: ' + e.message);
      $('#empty').classList.remove('hidden');
    }
  }

  function bindControls() {
    $('#refreshBtn').addEventListener('click', ()=> refreshAll({doSync:false}));
    $('#syncBtn').addEventListener('click', async ()=> {
      toast('Syncing…');
      await refreshAll({doSync:true});
      toast('Synced');
    });
    $('#searchInput').addEventListener('input', ()=> renderTable());
    $('#hideDiag').addEventListener('click', ()=> $('#diag').classList.add('hidden'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindControls();
    await refreshAll({doSync: AUTO_SYNC});
  });
})();