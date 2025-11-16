// ===== CONFIG =====
// Replace this with your deployed Apps Script Web App URL.
// Example: const API_BASE = 'https://script.google.com/macros/s/AKfycbx12345/exec';
const API_BASE = 'YOUR_WEB_APP_URL_HERE';

let sources = [];
let statuses = [];
let leads = [];

const apiStatusEl = document.getElementById('apiStatus');
const leadCountEl = document.getElementById('leadCount');
const leadsBodyEl = document.getElementById('leadsBody');
const refreshBtn = document.getElementById('refreshBtn');
const sendEmailBtn = document.getElementById('sendEmailBtn');
const selectAllEl = document.getElementById('selectAll');

async function apiGet(action) {
  setApiStatus('Loading ' + action + '…');
  const res = await fetch(API_BASE + '?action=' + encodeURIComponent(action), {
    method: 'GET',
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error('GET ' + action + ' failed: ' + res.status);
  }
  const data = await res.json();
  setApiStatus('Connected', 'ok');
  return data;
}

async function apiPost(payload) {
  setApiStatus('Saving…');
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error('POST failed: ' + res.status);
  }
  const data = await res.json();
  setApiStatus('Connected', 'ok');
  return data;
}

function setApiStatus(text, state) {
  apiStatusEl.textContent = text;
  apiStatusEl.classList.remove('ok', 'error');
  if (state) apiStatusEl.classList.add(state);
}

async function initialise() {
  try {
    const lists = await apiGet('lists');
    sources = lists.sources || [];
    statuses = lists.statuses || [];

    const leadData = await apiGet('leads');
    leads = leadData.leads || [];
    renderLeads();
  } catch (err) {
    console.error(err);
    setApiStatus('Error: ' + err.message, 'error');
  }
}

function renderLeads() {
  leadsBodyEl.innerHTML = '';
  leadCountEl.textContent = (leads.length || 0) + ' leads';

  if (!leads.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 11;
    td.textContent = 'No leads found.';
    tr.appendChild(td);
    leadsBodyEl.appendChild(tr);
    return;
  }

  leads.forEach((lead, idx) => {
    const tr = document.createElement('tr');

    const selTd = document.createElement('td');
    selTd.className = 'checkbox-cell';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.row = lead.row;
    selTd.appendChild(cb);
    tr.appendChild(selTd);

    const sourceTd = document.createElement('td');
    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'source-pill';
    sourceSpan.textContent = lead.source || '—';
    sourceTd.appendChild(sourceSpan);
    tr.appendChild(sourceTd);

    const statusTd = document.createElement('td');
    const statusSel = document.createElement('select');
    statusSel.className = 'status-select';
    statusSel.dataset.row = lead.row;

    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = '—';
    statusSel.appendChild(blankOpt);

    statuses.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      if (lead.status === st) opt.selected = true;
      statusSel.appendChild(opt);
    });

    statusSel.addEventListener('change', async () => {
      const newStatus = statusSel.value;
      try {
        await apiPost({ action: 'updateStatus', row: lead.row, status: newStatus });
        lead.status = newStatus;
      } catch (err) {
        console.error(err);
        setApiStatus('Error updating status', 'error');
      }
    });

    statusTd.appendChild(statusSel);
    tr.appendChild(statusTd);

    const waTd = document.createElement('td');
    if (lead.whatsapp) {
      const waBtn = document.createElement('button');
      waBtn.textContent = 'Open WhatsApp';
      waBtn.className = 'whatsapp-btn';
      waBtn.addEventListener('click', () => {
        window.open(lead.whatsapp, '_blank');
      });
      waTd.appendChild(waBtn);
    } else {
      waTd.textContent = '—';
    }
    tr.appendChild(waTd);

    const nameTd = document.createElement('td');
    nameTd.textContent = lead.name || '';
    tr.appendChild(nameTd);

    const surnameTd = document.createElement('td');
    surnameTd.textContent = lead.surname || '';
    tr.appendChild(surnameTd);

    const mobileTd = document.createElement('td');
    mobileTd.textContent = lead.mobile || '';
    tr.appendChild(mobileTd);

    const emailTd = document.createElement('td');
    emailTd.textContent = lead.email || '';
    tr.appendChild(emailTd);

    const agencyTd = document.createElement('td');
    agencyTd.textContent = lead.agency || '';
    tr.appendChild(agencyTd);

    const regionTd = document.createElement('td');
    regionTd.textContent = lead.region || '';
    tr.appendChild(regionTd);

    const notesTd = document.createElement('td');
    notesTd.className = 'notes-cell';

    const notesArea = document.createElement('textarea');
    notesArea.className = 'notes-input';
    notesArea.value = lead.notes || '';
    notesArea.rows = 2;
    notesTd.appendChild(notesArea);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'row-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      const newNotes = notesArea.value;
      try {
        await apiPost({ action: 'updateNotes', row: lead.row, notes: newNotes });
        lead.notes = newNotes;
      } catch (err) {
        console.error(err);
        setApiStatus('Error saving notes', 'error');
      }
    });
    actionsDiv.appendChild(saveBtn);
    notesTd.appendChild(actionsDiv);

    tr.appendChild(notesTd);

    leadsBodyEl.appendChild(tr);
  });
}

async function handleSendEmails() {
  const selectedRows = Array.from(
    leadsBodyEl.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => Number(cb.dataset.row));

  if (!selectedRows.length) {
    setApiStatus('No rows selected', 'error');
    return;
  }

  try {
    const result = await apiPost({
      action: 'sendEmails',
      rows: selectedRows,
      dryRun: false
    });
    const count = result.sentCount || 0;
    setApiStatus('Emails sent: ' + count, 'ok');
  } catch (err) {
    console.error(err);
    setApiStatus('Error sending emails', 'error');
  }
}

function handleSelectAll() {
  const checked = selectAllEl.checked;
  const checkboxes = leadsBodyEl.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshBtn.addEventListener('click', initialise);
  sendEmailBtn.addEventListener('click', handleSendEmails);
  selectAllEl.addEventListener('change', handleSelectAll);
  initialise();
});
