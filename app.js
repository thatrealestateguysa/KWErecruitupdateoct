/* Compact red/grey/white frontend, GET fallback, instant row removal, auto-refresh on open */
const API = window.DEFAULT_API;
document.getElementById('api-url').textContent = API;

const STATUSES = [
  'To Contact','Whatsapp Sent','No Whatsapp','Replied','Not Interested in KW',
  'Invite to Events/ Networking','Appointment','Ready to join KW','JOINED',
  'Appointment booked','cultivate','decided not to join','do not contact'
];

const KPI_ORDER = [
  ['TOTAL', null],
  ['TO CONTACT','To Contact'],
  ['WHATSAPP SENT','Whatsapp Sent'],
  ['NO WHATSAPP','No Whatsapp'],
  ['REPLIED','Replied'],
  ['NOT INTERESTED IN KW','Not Interested in KW'],
  ['INVITE TO EVENTS/ NETWORKING','Invite to Events/ Networking'],
  ['APPOINTMENT','Appointment'],
  ['READY TO JOIN KW','Ready to join KW'],
  ['JOINED','JOINED'],
  ['APPOINTMENT BOOKED','Appointment booked'],
  ['CULTIVATE','cultivate'],
  ['DECIDED NOT TO JOIN','decided not to join'],
  ['DO NOT CONTACT','do not contact']
];

const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
function toast(m,t=2400){const el=$('#toast'); el.textContent=m; el.style.display='block'; setTimeout(()=>el.style.display='none',t);}

async function postAPI(action, payload={}){
  const r = await fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,payload})});
  const j = await r.json().catch(()=>({result:'error',message:'Invalid JSON'}));
  if(j.result!=='success') throw new Error(j.message||'API error');
  return j.payload || j.message || 'OK';
}
async function getAPI(){
  const r = await fetch(API);
  const j = await r.json().catch(()=>({result:'error'}));
  if(j.result!=='success' || !Array.isArray(j.data)) throw new Error('GET fallback failed');
  return j.data;
}

function mapSheetRowsToView(matrix){
  if(!matrix || matrix.length<2) return [];
  const headers = matrix[0].map(x=>String(x||'').trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());
  const pick = (row, colName) => { const i = idx(colName); return i>=0 ? row[i] : ''; };
  const rows = [];
  for(let i=1;i<matrix.length;i++){
    const r = matrix[i];
    if(r.every(cell => (cell===null || cell===undefined || String(cell).trim()===''))) continue;
    rows.push({
      idx: i-1,
      listingType: pick(r,'Listing Type'),
      listingRef: pick(r,'Listing Ref'),
      name: pick(r,'Name'),
      surname: pick(r,'Surname'),
      phone: pick(r,'Contact Number'),
      email: pick(r,'Email'),
      suburb: pick(r,'Suburb'),
      agency: pick(r,'Agency'),
      status: pick(r,'Status'),
      lastContactDate: pick(r,'Last Contact Date'),
      notes: pick(r,'Notes'),
      waLink: pick(r,'WhatsApp Link'),
      waMessage: pick(r,'WhatsApp Message'),
      contactId: pick(r,'Contact ID')
    });
  }
  return rows;
}

let ALL = [], VIEW = [], CURRENT_STATUS_FILTER = '';

function uniq(arr){ return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))); }

function fillDropdowns(){
  const sf = $('#status-filter'); const bs = $('#bulk-status');
  sf.innerHTML = `<option value="">All statuses</option>` + STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('');
  bs.innerHTML = `<option value="">Set Status to...</option>` + STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('');
}

function fillAgency(agencies){
  const sel = $('#agency-filter');
  sel.innerHTML = `<option value="">Agency (all)</option>` + agencies.map(a=>`<option value="${a}">${a}</option>`).join('');
}

function computeCounts(rows){
  const counts = {};
  rows.forEach(r=>{ const k = String(r.status||'').trim(); counts[k]=(counts[k]||0)+1; });
  return counts;
}

function renderKPIs(rows, serverStats){
  const el = $('#kpi-row');
  const counts = serverStats?.counts || computeCounts(rows);
  const total = serverStats?.total ?? rows.length;
  el.innerHTML = KPI_ORDER.map(([label, status])=>{
    const val = status ? (counts[status]||0) : total;
    const active = (status && CURRENT_STATUS_FILTER===status) || (!status && !CURRENT_STATUS_FILTER);
    return `<div class="kpi ${active?'active':''}" data-status="${status||''}">
      <div class="val">${val}</div>
      <div class="lab">${label}</div>
    </div>`;
  }).join('');
  $$('#kpi-row .kpi').forEach(k=>k.addEventListener('click',()=>{
    CURRENT_STATUS_FILTER = k.dataset.status || '';
    $('#status-filter').value = CURRENT_STATUS_FILTER;
    renderTable();
    renderKPIs(ALL, serverStats);
  }));
}

function matchFilters(r){
  const q = $('#search').value.trim().toLowerCase();
  const ag = $('#agency-filter').value;
  const st = $('#status-filter').value || CURRENT_STATUS_FILTER;
  if(q){
    const hay = [r.name,r.surname,r.phone,r.email,r.suburb,r.agency].map(x=>String(x||'').toLowerCase()).join(' ');
    if(!hay.includes(q)) return false;
  }
  if(ag && String(r.agency||'')!==ag) return false;
  if(st && String(r.status||'')!==st) return false;
  return true;
}

function renderTable(){
  const body = $('#grid-body'); body.innerHTML='';
  VIEW = ALL.filter(matchFilters);
  $('#empty').style.display = VIEW.length ? 'none' : 'block';

  for(const r of VIEW){
    const tr = document.createElement('tr');

    const tdChk = document.createElement('td'); tdChk.innerHTML = `<input class="row-check" type="checkbox" data-idx="${r.idx}">`; tr.appendChild(tdChk);
    const tdType = document.createElement('td'); tdType.textContent = r.listingType||''; tr.appendChild(tdType);
    const tdWa = document.createElement('td'); tdWa.innerHTML = r.waLink ? `<a class="wa" target="_blank" href="${r.waLink}">Open</a>` : '<span class="muted">n/a</span>'; tr.appendChild(tdWa);

    // Status select
    const tdStatus = document.createElement('td');
    const sel = document.createElement('select');
    sel.innerHTML = STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('');
    sel.value = r.status || '';
    sel.addEventListener('change', async()=>{
      const newStatus = sel.value;
      try{
        await postAPI('updateSingleStatus', {rowIndex:r.idx, newStatus});
        r.status = newStatus;
        r.lastContactDate = new Date().toISOString();
        renderTable();           // row disappears if filtered out
        renderKPIs(ALL, null);   // instant KPI refresh
        toast('Status updated');
      }catch(e){
        console.error(e);
        toast('Failed to update status');
        sel.value = r.status || '';
      }
    });
    tdStatus.appendChild(sel); tr.appendChild(tdStatus);

    const tdName = document.createElement('td'); tdName.textContent = r.name||''; tr.appendChild(tdName);
    const tdSurname = document.createElement('td'); tdSurname.textContent = r.surname||''; tr.appendChild(tdSurname);
    const tdPhone = document.createElement('td'); tdPhone.textContent = r.phone||''; tr.appendChild(tdPhone);

    // Notes area
    const tdNotes = document.createElement('td');
    const ta = document.createElement('textarea'); ta.className='textarea'; ta.value = r.notes || '';
    const btn = document.createElement('button'); btn.textContent = 'Save'; btn.className='ghost'; btn.style.marginTop='6px';
    btn.addEventListener('click', async()=>{
      try{ await postAPI('updateSingleNote', {rowIndex:r.idx, newNote: ta.value}); r.notes = ta.value; toast('Note saved'); }
      catch(e){ console.error(e); toast('Failed to save note'); }
    });
    tdNotes.appendChild(ta); tdNotes.appendChild(btn);
    tr.appendChild(tdNotes);

    const tdAgency = document.createElement('td'); tdAgency.textContent = r.agency||''; tr.appendChild(tdAgency);
    const tdSuburb = document.createElement('td'); tdSuburb.textContent = r.suburb||''; tr.appendChild(tdSuburb);

    body.appendChild(tr);
  }
}

function getChecked(){ return $$('.row-check:checked').map(x=>parseInt(x.dataset.idx,10)).filter(n=>!isNaN(n)); }

async function applyBulk(){
  const st = $('#bulk-status').value;
  const rows = getChecked();
  if(!st) return toast('Choose a status');
  if(!rows.length) return toast('Select rows');
  if(!confirm(`Set ${rows.length} row(s) to "${st}"?`)) return;
  try{
    await postAPI('bulkUpdateStatus', {rowIndices: rows, newStatus: st});
    ALL.forEach(r=>{ if(rows.includes(r.idx)) r.status = st; });
    renderTable(); renderKPIs(ALL, null);
    toast('Updated');
  }catch(e){ console.error(e); toast('Bulk failed'); }
}

function clearBulk(){ $$('#grid .row-check').forEach(c=>c.checked=false); $('#bulk-status').value=''; }

async function load(){
  try{
    let rows;
    try{ rows = await postAPI('getRecruitsView', {}); }
    catch(e){ const matrix = await getAPI(); rows = mapSheetRowsToView(matrix); }
    ALL = rows || [];
    let stats=null; try{ stats = await postAPI('getStats', {});}catch(_){}
    fillAgency(uniq(ALL.map(r=>r.agency)));
    renderKPIs(ALL, stats);
    renderTable();
  }catch(e){
    console.error(e); toast('Load failed');
  }
}

async function boot(){
  // Clear any stale filters first
  CURRENT_STATUS_FILTER = '';
  $('#status-filter').value = '';
  $('#agency-filter').value = '';
  $('#search').value = '';
  try { await postAPI('rerunAutomations', {}); } catch(_) { /* ignore if not available */ }
  await load();
}

function wire(){
  $('#btn-refresh').addEventListener('click', load);
  $('#btn-prepare').addEventListener('click', async()=>{ try{ await postAPI('prepareSheet', {}); toast('Prepared'); }catch(e){ toast('Prepare failed'); }});
  $('#btn-rerun').addEventListener('click', async()=>{ try{ await postAPI('rerunAutomations', {}); toast('Refreshed'); await load(); }catch(e){ toast('Re-run failed'); }});
  $('#btn-fix').addEventListener('click', async()=>{ try{ await postAPI('fixDataValidation', {}); toast('Dropdowns fixed'); }catch(e){ toast('Fix failed'); }});
  $('#btn-import').addEventListener('click', async()=>{ if(!confirm('Process Import → Recruits now?')) return; try{ const m = await postAPI('processImport', {}); toast(m||'Imported'); await load(); }catch(e){ toast('Import failed'); }});

  $('#btn-reset').addEventListener('click', ()=>{ $('#search').value=''; $('#agency-filter').value=''; $('#status-filter').value=''; CURRENT_STATUS_FILTER=''; renderTable(); renderKPIs(ALL, null); });
  $('#search').addEventListener('input', renderTable);
  $('#agency-filter').addEventListener('change', renderTable);
  $('#status-filter').addEventListener('change', ()=>{ CURRENT_STATUS_FILTER = $('#status-filter').value; renderTable(); renderKPIs(ALL, null); });

  $('#check-all').addEventListener('change', e=>{ $$('.row-check').forEach(c=>c.checked=e.target.checked); });
  $('#btn-apply').addEventListener('click', applyBulk);
  $('#btn-clear').addEventListener('click', clearBulk);

  fillDropdowns();
}

window.addEventListener('DOMContentLoaded', ()=>{ wire(); boot(); });
