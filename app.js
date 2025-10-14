/* KWE Recruit Machine — Frontend (Vanilla JS)
 * - Works with Apps Script backend using JSON actions
 * - API URL is set via window.DEFAULT_API in index.html
 */
const API_BASE = window.DEFAULT_API || 'https://script.google.com/macros/s/AKfycbxsYJMTFMxCp2hx1X7HrTSs-bhsr3m4rDWCZ_XPZNy1sKsR8Zyz43ox6Z0a_yNh-B5d8Q/exec';
document.getElementById('api-url').textContent = API_BASE;

const STATUS_OPTIONS = [
  'To Contact','Whatsapp Sent','No Whatsapp','Replied','Not Interested in KW',
  'Invite to Events/ Networking','Appointment','Ready to join KW','JOINED',
  'Appointment booked','cultivate','decided not to join','do not contact'
];

const TYPE_OPTIONS = ['On Show','New Listing','Rental','Other'];

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function toast(msg, t=2800){ const el=$('#toast'); el.textContent=msg; el.style.display='block'; setTimeout(()=>el.style.display='none', t); }

async function api(action, payload={}){
  const res = await fetch(API_BASE, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action, payload })
  });
  const j = await res.json().catch(()=>({result:'error', message:'Invalid JSON'}));
  if(j.result!=='success') throw new Error(j.message||'API error');
  return j.payload || j.message || 'OK';
}

let RAW_ROWS = []; // full dataset from server
let VIEW_ROWS = []; // filtered view

function fillStatusDropdowns(){
  const sf = $('#status-filter');
  const bs = $('#bulk-status');
  STATUS_OPTIONS.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; sf.appendChild(o.cloneNode(true)); });
  STATUS_OPTIONS.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; bs.appendChild(o); });
}

function fmtDate(d){
  if(!d) return '';
  try{ const dt = (d instanceof Date) ? d : new Date(d); if(isNaN(dt)) return ''; return dt.toISOString().slice(0,10); }catch(_){ return ''}
}

function rowMatchesFilter(r, term, status, type){
  const hay = [r.name, r.surname, r.phone, r.email, r.suburb, r.agency].map(x=>String(x||'').toLowerCase()).join(' ');
  if(term && !hay.includes(term)) return false;
  if(status && String(r.status||'')!==status) return false;
  if(type && String(r.listingType||'')!==type) return false;
  return true;
}

function renderKPIs(stats) {
  const el = $('#kpis');
  const counts = stats?.counts || RAW_ROWS.reduce((acc,r)=>{const k=String(r.status||'').trim(); acc[k]=(acc[k]||0)+1; return acc;},{});
  const total = stats?.total ?? RAW_ROWS.length;
  el.innerHTML = `
    <div class="kpi"><div class="label">Total Contacts</div><div class="value">${total}</div></div>
    <div class="kpi"><div class="label">Whatsapp Sent</div><div class="value">${counts['Whatsapp Sent']||0}</div></div>
    <div class="kpi"><div class="label">Replied</div><div class="value">${counts['Replied']||0}</div></div>
    <div class="kpi"><div class="label">Appointments</div><div class="value">${(counts['Appointment']||0)+(counts['Appointment booked']||0)}</div></div>
  `;
}

function renderTable() {
  const body = $('#grid-body');
  body.innerHTML = '';
  const term = $('#search').value.trim().toLowerCase();
  const st = $('#status-filter').value;
  const lt = $('#type-filter').value;
  VIEW_ROWS = RAW_ROWS.filter(r => rowMatchesFilter(r, term, st, lt));
  $('#empty').style.display = VIEW_ROWS.length ? 'none' : 'block';

  for(const r of VIEW_ROWS){
    const tr = document.createElement('tr');

    // checkbox
    const tdSel = document.createElement('td');
    tdSel.innerHTML = `<input class="row-check checkbox" type="checkbox" data-idx="${r.idx}">`;
    tr.appendChild(tdSel);

    const tdType = document.createElement('td'); tdType.textContent = r.listingType || ''; tr.appendChild(tdType);
    const tdRef = document.createElement('td'); tdRef.textContent = r.listingRef || ''; tr.appendChild(tdRef);
    const tdName = document.createElement('td'); tdName.textContent = r.name || ''; tr.appendChild(tdName);
    const tdSurname = document.createElement('td'); tdSurname.textContent = r.surname || ''; tr.appendChild(tdSurname);
    const tdPhone = document.createElement('td'); tdPhone.textContent = r.phone || ''; tr.appendChild(tdPhone);
    const tdEmail = document.createElement('td'); tdEmail.innerHTML = r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : ''; tr.appendChild(tdEmail);
    const tdSuburb = document.createElement('td'); tdSuburb.textContent = r.suburb || ''; tr.appendChild(tdSuburb);
    const tdAgency = document.createElement('td'); tdAgency.textContent = r.agency || ''; tr.appendChild(tdAgency);

    // status select
    const tdStatus = document.createElement('td');
    const sel = document.createElement('select');
    sel.innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
    sel.value = r.status || '';
    sel.addEventListener('change', async () => {
      try{ await api('updateSingleStatus', { rowIndex:r.idx, newStatus: sel.value }); toast('Status updated'); r.status = sel.value; }
      catch(e){ console.error(e); toast('Failed to update status'); }
    });
    tdStatus.appendChild(sel); tr.appendChild(tdStatus);

    const tdLCD = document.createElement('td'); tdLCD.textContent = fmtDate(r.lastContactDate); tr.appendChild(tdLCD);

    // notes (inline textarea + save)
    const tdNotes = document.createElement('td');
    const ta = document.createElement('textarea'); ta.className='textarea'; ta.value = r.notes || '';
    const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.style.marginTop='6px';
    saveBtn.addEventListener('click', async()=>{
      try{ await api('updateSingleNote', { rowIndex:r.idx, newNote: ta.value }); toast('Note saved'); r.notes = ta.value; }
      catch(e){ console.error(e); toast('Failed to save note'); }
    });
    tdNotes.appendChild(ta); tdNotes.appendChild(saveBtn);
    tr.appendChild(tdNotes);

    // WhatsApp
    const tdWA = document.createElement('td');
    if(r.waLink) { tdWA.innerHTML = `<a class="wa" href="${r.waLink}" target="_blank">Open</a>`; }
    else { tdWA.innerHTML = `<span class="small">n/a</span>`; }
    tr.appendChild(tdWA);

    body.appendChild(tr);
  }
}

async function loadData(){
  try{
    const [rows, stats] = await Promise.all([
      api('getRecruitsView', {}),
      api('getStats', {}).catch(_=>null)
    ]);
    RAW_ROWS = rows || [];
    renderKPIs(stats);
    renderTable();
    toast('Loaded');
  }catch(e){
    console.error(e);
    toast('Load failed');
  }
}

function getSelectedIdxs(){
  return $$('.row-check:checked').map(ch => parseInt(ch.getAttribute('data-idx'),10)).filter(n=>!isNaN(n));
}

async function applyBulkStatus(){
  const newStatus = $('#bulk-status').value;
  if(!newStatus) return toast('Choose a bulk status');
  const ids = getSelectedIdxs();
  if(!ids.length) return toast('Select at least one row');
  if(!confirm(`Set ${ids.length} row(s) to "${newStatus}"?`)) return;
  try{ await api('bulkUpdateStatus', { rowIndices: ids, newStatus }); toast('Bulk updated'); await loadData(); }
  catch(e){ console.error(e); toast('Bulk update failed'); }
}

function exportCSV(){
  const rows = [['Listing Type','Listing Ref','Name','Surname','Contact Number','Email','Suburb','Agency','Status','Last Contact Date','Notes','WhatsApp Link','WhatsApp Message','Contact ID']];
  for(const r of VIEW_ROWS){
    rows.push([r.listingType||'', r.listingRef||'', r.name||'', r.surname||'', r.phone||'', r.email||'', r.suburb||'', r.agency||'', r.status||'', fmtDate(r.lastContactDate)||'', (r.notes||'').replace(/\n/g,' '), r.waLink||'', r.waMessage||'', r.contactId||'']);
  }
  const csv = rows.map(row => row.map(v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g,'""')}"` : String(v)).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kwe-recruits.csv';
  a.click();
}

function clearFilters(){
  $('#search').value = '';
  $('#status-filter').value = '';
  $('#type-filter').value = '';
  renderTable();
}

function wireUI(){
  fillStatusDropdowns();
  $('#btn-refresh').addEventListener('click', loadData);
  $('#btn-rerun').addEventListener('click', async ()=>{
    try{ await api('rerunAutomations', {}); toast('Re-run complete'); await loadData(); }
    catch(e){ console.error(e); toast('Re-run failed'); }
  });
  $('#btn-fix').addEventListener('click', async()=>{
    try{ await api('fixDataValidation', {}); toast('Dropdowns fixed'); }
    catch(e){ console.error(e); toast('Fix failed'); }
  });
  $('#btn-import').addEventListener('click', async()=>{
    if(!confirm('Process Import sheet into Recruits now?')) return;
    try{ const msg = await api('processImport', {}); toast(msg || 'Import complete'); await loadData(); }
    catch(e){ console.error(e); toast('Import failed'); }
  });
  $('#btn-setup-import').addEventListener('click', async()=>{
    try{ await api('setupImportSheet', {}); toast('Import/Contacts/Interactions ready'); }
    catch(e){ console.error(e); toast('Setup failed'); }
  });
  $('#search').addEventListener('input', renderTable);
  $('#status-filter').addEventListener('change', renderTable);
  $('#type-filter').addEventListener('change', renderTable);
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#apply-bulk').addEventListener('click', applyBulkStatus);
  $('#export-csv').addEventListener('click', exportCSV);
  $('#check-all').addEventListener('change', (e)=>{ $$('.row-check').forEach(c=>c.checked=e.target.checked); });
}

window.addEventListener('DOMContentLoaded', async()=>{ wireUI(); await loadData(); });
