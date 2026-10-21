import { escapeHtml as h } from './model.js';

export async function connectWorkspace(fallback, announce) {
  const response = await fetch('index.html', { method: 'HEAD' });
  if (response.headers.get('x-forge-workspace') !== '1') return { payload: fallback, connected: false };
  const controls = document.createElement('section');
  controls.id = 'workspace-connection';
  controls.innerHTML = '<h2>Development workspace</h2><p id="connection-state">Connect to send feedback and preserve uploaded papers.</p><label>Local access file<input id="access-file" type="file" accept=".key,.txt"></label>';
  document.querySelector('.notice') .after(controls);
  let session;
  async function api(path        , input ) {
    const result = await fetch(path, input ? { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(session?.csrf ? { 'X-Forge-CSRF': session.csrf } : {}) }, body: JSON.stringify(input) } : {});
    const data = await result.json(); if (!result.ok) throw new Error(data.message || 'Workspace request failed'); return data;
  }
  document.getElementById('access-file') .addEventListener('change', async event => {
    const input = event.target                    ;
    const file = input.files?.[0]; if (!file) return;
    try { await api('/api/connect', { token: (await file.text()).trim() }); location.reload(); }
    catch (error) { announce(error.message); input.value = ''; }
  });
  try { session = await api('/api/session'); }
  catch { return { payload: fallback, connected: false }; }
  const payload = await api('/api/catalog');
  const status = document.getElementById('connection-status');
  if (status) { status.textContent = session.purpose === 'qualification' ? 'Qualification workspace' : 'Connected workspace'; status.dataset.state = 'connected'; }
  (document.getElementById('access-file')                    ).parentElement .hidden = true;
  document.getElementById('connection-state') .textContent = `Connected as ${session.principal.id} (${session.principal.role}). Saved server records survive page and service restarts.`;
  document.querySelector('.notice') .innerHTML = (session.purpose === 'qualification'
    ? '<strong>Qualification workspace.</strong> Feedback here is marked as test data and cannot approve scientific results. '
    : '<strong>Connected workspace.</strong> ') + 'Submit saved feedback to the coordinator inbox. <span id="checkpoint"></span>';
  const send = document.createElement('button'); send.id = 'send-feedback'; send.className = 'primary-action'; send.textContent = 'Send saved feedback';
  (document.querySelector('.action-buttons') || controls).append(send);
  const refresh = document.createElement('button'); refresh.textContent = 'Refresh workspace'; refresh.onclick = () => location.reload(); controls.append(refresh);
  const state = await api('/api/state');
  const records = document.createElement('details'); records.id = 'server-feedback';
  records.innerHTML = '<summary>Received feedback and coordinator responses</summary><ul>' + state.feedback.map(event => {
    const inbox = state.inbox.find(item => item.feedback === event.id);
    return `<li><strong>${h(event.target)} · ${h(event.kind)} · ${event.synthetic ? 'TEST · ' : ''}${h(inbox?.status)}</strong><p>${h(event.comment)}</p>${inbox?.response ? `<p>Coordinator: ${h(inbox.response)}</p>` : ''}</li>`;
  }).join('') + '</ul>';
  controls.append(records);
  const action = async (operation, input) => (await api('/api/action', { operation, input: { request_id: crypto.randomUUID(), ...input } })).result;
  return { payload, connected: true, principal: session.principal, state, action, announce };
}

export function bindDelivery(live, getDrafts, markReceived, announce) {
  if (!live.connected) return;
  document.getElementById('send-feedback') .onclick = async () => {
    const button = document.getElementById('send-feedback')                     ; button.disabled = true;
    let received = 0; const failures           = [];
    try {
      for (const draft of getDrafts()) {
        try {
        if (!draft.target_revision) throw new Error('An older offline draft has no criterion revision. Recreate it after connecting; the exported original remains available.');
        if (draft.kind === 'priority') {
          if (!Number.isInteger(draft.expected_version)) throw new Error('Priority draft has no target version. Recreate it after connecting.');
          await live.action('target-update', { request_id: draft.id, target: draft.target, expected_version: draft.expected_version,
            patch: { priority: draft.priority, order: draft.order } });
        } else await live.action('feedback', { request_id: draft.id, target: draft.target, generation: draft.generation,
          target_revision: draft.target_revision, kind: draft.kind, comment: draft.comment, scope: draft.scope, anchor: draft.anchor });
        received++; markReceived(draft.id);
        } catch (error) { failures.push(`${draft.target}: ${error.message}`); }
      }
      announce(`${received} item(s) received by the workspace. ${failures.length ? failures.join(' ') + ' Unsent drafts were preserved.' : 'Refresh to see coordinator responses. Repeated delivery does not duplicate events.'}`);
    } catch (error) { announce(`${received} item(s) received. ${error.message} Remaining drafts were preserved.`); }
    finally { button.disabled = false; }
  };
}

export async function uploadPdf(live, file      , reference        ) {
  if (file.size > 100 * 1024 * 1024) throw new Error('PDF exceeds 100 MiB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  const request = (document.getElementById('intake-request')                     )?.value || undefined;
  return live.action('paper-import', { filename: file.name, bytes: btoa(binary), claimed_reference: reference, intake_request: request });
}

export function bindWorkspaceForms(live) {
  if (!live.connected) return;
  const { state, payload } = live;
  const intake = document.getElementById('intake') ;
  intake.querySelector('p') .textContent = 'Upload a downloaded PDF into the local workspace. Its exact bytes and extracted metadata are retained for review.';
  document.getElementById('pdf-status') .textContent = 'Select a PDF to store it and check its source identity.';
  const requestLabel = document.createElement('label'); requestLabel.textContent = 'Requested paper';
  const requestSelect = document.createElement('select'); requestSelect.id = 'intake-request';
  requestSelect.innerHTML = '<option value="">Unassigned paper</option>' + state.requests.filter(r => r.status !== 'resolved')
    .map(r => `<option value="${h(r.id)}">${h(r.title)}</option>`).join('');
  requestLabel.append(requestSelect); intake.prepend(requestLabel);
  const requests = document.createElement('div'); requests.innerHTML = '<h3>Paper requests</h3>' + (state.requests.length ? '<ul>' + state.requests.map(r => `<li><a href="${h(r.url)}" target="_blank" rel="noreferrer">${h(r.title)}</a> — ${h(r.status)}</li>`).join('') + '</ul>' : '<p>No pending requests.</p>'); intake.append(requests);
  const requestForm = document.createElement('form'); requestForm.className = 'review-form';
  requestForm.innerHTML = '<h3 class="wide">Request a paper</h3><label>Title<input name="title" required></label><label>DOI<input name="doi"></label><label class="wide">Publisher or repository link<input name="url" type="url" required placeholder="https://…"></label><button>Create intake request</button>';
  requestForm.onsubmit = async event => {
    event.preventDefault(); const fields = new FormData(requestForm);
    try { await live.action('paper-request', { title: fields.get('title'), doi: fields.get('doi'), url: fields.get('url') });
      live.announce('Paper request saved. Refresh to select it when uploading the PDF.'); requestForm.reset(); }
    catch (error) { live.announce(error.message); }
  }; intake.append(requestForm);
  const stored = document.createElement('p'); stored.innerHTML = state.papers.map(p => `<a href="/api/objects/${h(p.sha256)}" download="paper.pdf">Stored PDF ${h(p.sha256.slice(0, 12))}… (${h(p.status)})</a>`).join(' · '); intake.append(stored);
  if (live.principal.role !== 'researcher') return;
  const metadata = document.createElement('details'); metadata.innerHTML = '<summary>Confirm received paper metadata</summary>';
  for (const paper of state.papers.filter(p => p.status !== 'confirmed' || state.requests.some(r => r.sha256 === p.sha256 && r.status !== 'resolved'))) {
    const registered = payload.papers.find(p => p.id === paper.known_paper);
    const form = document.createElement('form'); form.className = 'review-form';
    form.innerHTML = `<p class="wide">Stored PDF ${h(paper.sha256.slice(0, 16))}… · ${paper.pages} pages · ${paper.metadata_conflict ? 'Metadata conflict needs explanation' : 'Review the source identity'}</p><label>Title<input name="title" value="${h(registered?.title || paper.title)}" required></label><label>DOI<input name="doi" value="${h(registered?.doi || paper.doi_candidates[0] || '')}" required></label><label class="wide">Explanation if metadata differ<input name="explanation"></label><button>Confirm source</button>`;
    form.onsubmit = async event => {
      event.preventDefault(); const fields = new FormData(form);
      try { await live.action('paper-confirm', { sha256: paper.sha256, expected_version: paper.version,
        title: fields.get('title'), doi: fields.get('doi'), explanation: fields.get('explanation') }); live.announce('Paper metadata confirmed. Refresh the workspace.'); form.querySelector('button') .disabled = true; }
      catch (error) { live.announce(error.message); }
    }; metadata.append(form);
  }
  intake.append(metadata);
  const criteria = document.createElement('details'); criteria.id = 'target-editor';
  criteria.innerHTML = '<summary>Edit target criteria and prerequisites</summary><form class="review-form"><label>Target<select name="target"></select></label><label>Conditions<input name="conditions" required></label><label class="wide">Acceptance criteria<textarea name="criteria" required></textarea></label><label>Add prerequisite<select name="dependency"><option value="">No new prerequisite</option></select></label><label>Required accepted scope<input name="scope" placeholder="Exact scope required from the prerequisite"></label><p class="wide" id="current-dependencies"></p><button>Save target revision</button></form>';
  document.getElementById('targets') .append(criteria);
  const form = criteria.querySelector('form') ;
  const targetSelect = form.elements.namedItem('target')                     ;
  const dependency = form.elements.namedItem('dependency')                     ;
  const options = state.targets.map(t => `<option value="${h(t.id)}">${h(t.id)} · ${h(t.title)}</option>`).join('');
  targetSelect.innerHTML = options; dependency.innerHTML += options;
  const fill = () => {
    const target = state.targets.find(t => t.id === targetSelect.value);
    (form.elements.namedItem('conditions')                    ).value = target.conditions;
    (form.elements.namedItem('criteria')                       ).value = target.criteria;
    document.getElementById('current-dependencies') .innerHTML = 'Current prerequisites: ' + (target.dependencies.map(e => `<label><input type="checkbox" name="remove" value="${h(e.target)}"> Remove ${h(e.target)} (${h(e.scope)})</label>`).join(' ') || 'none');
  }; targetSelect.onchange = fill; fill();
  form.onsubmit = async event => {
    event.preventDefault(); const fields = new FormData(form); const target = state.targets.find(t => t.id === targetSelect.value);
    const dependencies = target.dependencies.filter(edge => !fields.getAll('remove').includes(edge.target));
    if (fields.get('dependency')) dependencies.push({ target: fields.get('dependency'), scope: fields.get('scope') });
    try { await live.action('target-update', { target: target.id, expected_version: target.version,
      patch: { conditions: fields.get('conditions'), criteria: fields.get('criteria'), dependencies } });
      live.announce('Target revision saved. Refresh before another edit. Earlier passes retain their original criteria.'); }
    catch (error) { live.announce(error.message); }
  };
}
