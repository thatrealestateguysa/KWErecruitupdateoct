(function(){
  const API = window.KWE_CONFIG.apiBase;
  const SHOW_DIAG = !!window.KWE_CONFIG.showDiagnostics;

  // exact order & labels requested (includes the new statuses)
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

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const toast = (t)=>{ const el=$('#toast'); el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 2000); };
  const showDiag = (t)=>{ if(!SHOW_DIAG) return; $('#diagText').textContent=t; $('#diag').classList.remove('hidden'); };
  const fmt = v => !v ? '' : (isNaN(new Date(v)) ? String(v) : new Date(v).toISOString().slice(0,10));
  const digits = p => String(p||'').replace(/\D/g,'');

  async function post(action, payload={}){
    const r = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    const raw = await r.text();
    try {
      const js = JSON.parse(raw);
      if (js.result!=='success') throw new Error(js.message||'Request failed');
      return js.payload ?? js.message;
    } catch(e){ throw new Error(`${action}: ${e.message}. Raw=${raw.slice(0,140)}…`); }
  }
  async function get(){
    const r = await fetch(API);
    const raw = await r.text();
    try{
      const js = JSON.parse(raw);
      if (js.result==='success') return js;
      throw new Error(js.message||'GET not success');
    }catch(e){ throw new Error(`GET parse: ${e.message}. Raw=${raw.slice(0,120)}…`); }
  }

  function mapHeaders(hdrs){
    const m={}; hdrs.forEach((h,i)=>{ m[String(h||'').trim().toLowerCase()] = i; }); return m;
  }
  function pick(row, map, key){
    const i = map[key]; return i==null ? '' : (row[i] ?? '');
  }

  // state
  let all = []; // normalized rows
  let counts = {}; let total = 0; let unique = 0;
  let active = 'All';

  function compute(){
    const c={}; const seen=new Set();
    all.forEach(r=>{ c[r.status]=(c[r.status]||0)+1; const d=digits(r.phone); if(d.length>=9) seen.add('27'+d.slice(-9)); });
    counts=c; total=all.length; unique=seen.size;
    $('#mTotal').textContent=total; $('#mUnique').textContent=unique; $('#mWhen').textContent=new Date().toLocaleString();
  }

  function buildTabs(){
    const wrap = $('#statusTabs'); wrap.innerHTML='';
    const list = ['All', ...STATUS_ORDER];
    list.forEach(s=>{
      const el = document.createElement('div');
      el.className='tab'+(s===active?' active':'');
      el.innerHTML = `${s} <span class="count">${s==='All'?total:(counts[s]||0)}</span>`;
      el.addEventListener('click', ()=>{ active=s; buildTabs(); render(); });
      wrap.appendChild(el);
    });
  }

  function filtered(){
    const q = $('#searchInput').value.trim().toLowerCase();
    let rows = active==='All'? all.slice() : all.filter(r => String(r.status||'')===active);
    if(q){
      rows = rows.filter(r => [r.name,r.surname,r.phone,r.suburb,r.agency].some(x=>String(x||'').toLowerCase().includes(q)));
    }
    // sort by last contact desc if present
    rows.sort((a,b)=> new Date(b.lastContactDate||0) - new Date(a.lastContactDate||0));
    return rows;
  }

  function render(){
    const tb = $('#rows'); tb.innerHTML='';
    const rows = filtered();
    $('#empty').classList.toggle('hidden', rows.length>0);
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const statusSel = `<select class="status" data-idx="${r.idx}">${STATUS_ORDER.map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>`;
      tr.innerHTML = `
        <td>${r.idx+1}</td>
        <td><span class="badge">${r.listingType||''}</span></td>
        <td>${r.waLink?`<a class="wa" href="${r.waLink}" target="_blank" rel="noopener">Open</a>`:''}</td>
        <td>${statusSel}</td>
        <td>${r.name||''}</td>
        <td>${r.surname||''}</td>
        <td>${r.phone||''}</td>
        <td>
          <div class="note-row">
            <input type="text" placeholder="Add note…" value="${(r.notes||'').toString().replace(/"/g,'&quot;')}" data-idx="${r.idx}" />
            <button class="btn" data-save-note="${r.idx}">Save</button>
          </div>
        </td>
        <td>${r.agency||''}</td>
        <td>${r.suburb||''}</td>
      `;
      tb.appendChild(tr);
    });

    // events
    $$('#rows select.status').forEach(sel=>{
      sel.addEventListener('change', async (e)=>{
        const idx = Number(e.target.getAttribute('data-idx')); const newStatus=e.target.value;
        try{
          await post('updateSingleStatus',{rowIndex: idx, newStatus});
          const row = all.find(x=>x.idx===idx); if(row) row.status=newStatus;
          compute(); buildTabs(); render(); // row will move if a tab is active
          toast('Status updated');
        }catch(err){ showDiag(err.message); toast('Failed'); }
      });
    });
    $$('#rows button[data-save-note]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const idx = Number(e.target.getAttribute('data-save-note'));
        const input = $(`#rows input[data-idx="${idx}"]`);
        try{
          await post('updateSingleNote',{rowIndex: idx, newNote: input?input.value:''});
          toast('Note saved');
        }catch(err){ showDiag(err.message); toast('Failed'); }
      });
    });
  }

  async function load(){
    // try modern endpoint first
    try{
      const rows = await post('getRecruitsView',{});
      if(Array.isArray(rows) && rows.length){
        all = rows.map((r,i)=>({idx:r.idx ?? i, ...r}));
      }else{ throw new Error('Empty view'); }
    }catch(e){
      showDiag('Falling back to GET (legacy backend)');
      const js = await get();
      const values = js.data || js.values || [];
      if(!values.length) throw new Error('No rows');
      const hdr = values[0]; const map = mapHeaders(hdr);
      all = [];
      for(let i=1;i<values.length;i++){
        const row = values[i];
        all.push({
          idx: i-1,
          listingType: pick(row,map,'listing type'),
          listingRef: pick(row,map,'listing ref'),
          name: pick(row,map,'name'),
          surname: pick(row,map,'surname'),
          phone: pick(row,map,'contact number'),
          email: pick(row,map,'email'),
          suburb: pick(row,map,'suburb'),
          agency: pick(row,map,'agency'),
          status: pick(row,map,'status') || 'To Contact',
          lastContactDate: pick(row,map,'last contact date'),
          notes: pick(row,map,'notes'),
          waLink: pick(row,map,'whatsapp link'),
          waMessage: pick(row,map,'whatsapp message'),
          contactId: pick(row,map,'contact id'),
        });
      }
    }
  }

  async function init(){
    $('#hideDiag').addEventListener('click', ()=>$('#diag').classList.add('hidden'));
    $('#refreshBtn').addEventListener('click', async ()=>{ await load(); compute(); buildTabs(); render(); });
    $('#syncBtn').addEventListener('click', async ()=>{
      try{ await post('resyncContacts',{}); toast('Synced'); } catch(err){ showDiag('Sync failed: '+err.message); }
      await load(); compute(); buildTabs(); render();
    });
    $('#searchInput').addEventListener('input', render);

    // draw tabs immediately so the user sees them
    // with zero counts until data loads
    (function drawEmptyTabs(){
      const wrap = $('#statusTabs'); wrap.innerHTML='';
      ['All',...STATUS_ORDER].forEach(s=>{
        const el = document.createElement('div'); el.className='tab'+(s==='All'?' active':'');
        el.innerHTML = `${s} <span class="count">0</span>`;
        el.addEventListener('click', ()=>{ active=s; buildTabs(); render(); });
        wrap.appendChild(el);
      });
    })();

    try {
      await load();
      compute();
      buildTabs();
      render();
    } catch(e) {
      showDiag('Load failed: '+e.message);
      $('#empty').classList.remove('hidden');
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();