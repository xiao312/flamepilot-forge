import { parseDrafts, validateDraft, relevantDrafts, duplicatePaper, escapeHtml as h } from './model.js';
                                                
import { bindDelivery, uploadPdf } from './live.js';

export function setupFeedback(payload, announce                        , live = { connected: false }) {
  const storageKey = live.connected ? 'flamepilot-forge-connected-feedback-v1' : 'flamepilot-forge-feedback-v1';
  let drafts          = [];
  let canPersist = true;
  const receipts           = [];
  const anchors = new Map                         ();
  try { drafts = parseDrafts(localStorage.getItem(storageKey)); }
  catch { canPersist = false; announce('Saved drafts could not be read. They were preserved. New drafts stay in memory; export them before closing.'); }
  function refreshCount() { document.getElementById('draft-count') .textContent = `(${drafts.length + receipts.length})`; }
  function markReceived(id        ) {
    const draft = drafts.find(d => d.id === id) ; draft.received_at = new Date().toISOString();
    if (canPersist) try { localStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { canPersist = false; }
  }
  function append(draft       ) {
    validateDraft(draft);
    if (drafts.length >= 1000) throw new Error('Draft limit reached. Export this collection before starting another review.');
    drafts.push(draft);
    if (canPersist) {
      try { localStorage.setItem(storageKey, JSON.stringify(drafts)); }
      catch { canPersist = false; }
    }
    refreshCount();
    announce(canPersist ? live.connected ? 'Draft saved. Use Send saved feedback to deliver it to the coordinator.' : 'Draft saved in this browser. Export feedback to hand it to the coordinator.' : 'Draft kept in memory only. Export feedback before closing this page.');
  }
  function base(figure        , kind        )        {
    return { id: crypto.randomUUID(), created_at: new Date().toISOString(), kind,
      target: figure.id, generation: figure.review_generation, snapshot: payload.snapshot_sha256,
      comment: '', scope: '', authority: 'local_draft', target_revision: figure.target_revision, expected_version: figure.target_version };
  }
  function history(figure        ) {
    const entries = relevantDrafts(figure, drafts).filter(d => d.kind !== 'priority');
    const other = drafts.filter(d => d.target === figure.id && d.generation !== figure.review_generation).length;
    return entries.map(d => `<li><strong>${h(d.kind.replaceAll('_', ' '))} draft · ${h(new Date(d.created_at).toLocaleString())}</strong>${h(d.comment)}${d.scope ? '\nScope: ' + h(d.scope) : ''}${d.anchor ? '\nImage anchor: ' + d.anchor.x.toFixed(3) + ', ' + d.anchor.y.toFixed(3) : ''}</li>`).join('') + (other ? `<li>${other} draft(s) belong to older generations. They remain in the export and do not apply here.</li>` : '');
  }
  function bindFigure(article             , figure        ) {
    const list = article.querySelector('.draft-list') ;
    list.innerHTML = history(figure);
    article.querySelectorAll                   ('.image-button').forEach(button => {
      button.addEventListener('click', event => {
        const img = button.querySelector('img') ;
        const rect = img.getBoundingClientRect();
        const keyboard = event.detail === 0;
        const anchor = { image_sha256: button.dataset.hash ,
          x: keyboard ? .5 : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          y: keyboard ? .5 : Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
        anchors.set(figure.id, anchor);
        article.querySelector                    ('.review') .open = true;
        article.querySelector('.anchor-label') .textContent = `Anchored to ${button.dataset.side} image (${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)}). Image coordinates, not physical data values.`;
        article.querySelector                     ('textarea') .focus();
      });
    });
    article.querySelector                   ('.clear-anchor') .onclick = () => {
      anchors.delete(figure.id); article.querySelector('.anchor-label') .textContent = 'No image anchor. Click an image to place one.';
    };
    article.querySelector                 ('form') .onsubmit = event => {
      event.preventDefault();
      const form = event.currentTarget                   ;
      const fields = new FormData(form);
      try {
        const draft = { ...base(figure, String(fields.get('kind'))), comment: String(fields.get('comment')).trim(),
          scope: String(fields.get('scope')).trim(), anchor: anchors.get(figure.id) };
        if (['pass', 'reject'].includes(draft.kind) && !figure.result_image) throw new Error('Import the result before drafting a decision');
        append(draft); list.innerHTML = history(figure); form.reset();
        anchors.delete(figure.id); article.querySelector('.anchor-label') .textContent = 'No image anchor. Click an image to place one.';
      } catch (error) { announce(error.message); }
    };
  }
  function schedule(figure        ) {
    return relevantDrafts(figure, drafts).filter(d => d.kind === 'priority').at(-1) || figure;
  }
  function saveSchedule(figure        , priority        , order        ) {
    append({ ...base(figure, 'priority'), priority, order, comment: 'Proposed target order; no scheduler action.' });
  }
  document.getElementById('export') .onclick = () => {
    const bundle = { schema: 'forge-feedback-drafts-v1', authority: 'untrusted_local_export',
      exported_at: new Date().toISOString(), snapshot_sha256: payload.snapshot_sha256,
      events: drafts, pdf_receipts: receipts, submitted: false,
      delivery_note: 'received_at is a browser receipt hint; the server event history is authoritative.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'forge-feedback-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Export downloaded. Send the JSON to the coordinator; attach any new PDF separately.');
  };
  document.getElementById('pdf') .addEventListener('change', async event => {
    const input = event.target                    ;
    const file = input.files?.[0]; if (!file) return;
    const output = document.getElementById('pdf-status') ;
    input.disabled = true; output.textContent = 'Checking the PDF on this device…';
    try {
      if (live.connected) {
        const receipt = await uploadPdf(live, file, (document.getElementById('pdf-reference')                    ).value.trim());
        output.textContent = `${receipt.duplicate ? 'Existing PDF verified' : 'PDF stored'} · ${receipt.version.sha256}. Refresh to review extracted metadata. The original bytes are preserved in the workspace.`;
        return;
      }
      if (file.size > 100 * 1024 * 1024) throw new Error('PDF exceeds the 100 MiB preview limit. Pass the file directly to the coordinator.');
      if (!new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()).startsWith('%PDF-')) throw new Error('The selected file has no PDF header.');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
      const duplicate = duplicatePaper(hash, payload.papers);
      receipts.push({ id: crypto.randomUUID(), filename: file.name, bytes: file.size, sha256: hash,
        claimed_reference: (document.getElementById('pdf-reference')                    ).value.trim(),
        existing_paper: duplicate, identity: duplicate ? 'known_exact_bytes' : 'needs_metadata_review', uploaded: false });
      output.textContent = duplicate ? `Already registered as ${duplicate}. Duplicate receipt added; no new source was created.` : `Receipt ready for ${file.name}. Metadata needs review. Export the receipt and attach the original PDF separately.`;
      refreshCount();
    } catch (error) { output.textContent = error.message; }
    finally { input.disabled = false; input.value = ''; }
  });
  refreshCount();
  bindDelivery(live, () => drafts.filter(d => !d.received_at), markReceived, announce);
  return { bindFigure, schedule, saveSchedule };
}
