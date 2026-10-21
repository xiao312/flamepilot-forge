import retainedPayload from './data.js';
import { escapeHtml as h } from './model.js';
import { setupFeedback } from './feedback.js';
import { connectWorkspace, bindWorkspaceForms } from './live.js';
                                         

if (retainedPayload.publication) {
  const { mountPublication } = await import('./article.js');
  mountPublication(retainedPayload);
} else {
const byId = (id        ) => document.getElementById(id) ;
const announce = (text        ) => { byId('message').textContent = text; };
const live = await connectWorkspace(retainedPayload, announce);
const payload = live.payload;
const feedback = setupFeedback(payload, announce, live);
const paperSelect = byId('paper')                     ;
const statusSelect = byId('status')                     ;
const search = byId('search')                    ;
const paperById = new Map(payload.papers.map(p => [p.id, p]));
const figures = payload.figures            ;
byId('checkpoint').textContent = `Checkpoint: ${payload.captured_at}. ${payload.figures.filter(f => f.result_image).length} comparisons imported; remaining targets retain their import status.`;
paperSelect.innerHTML += payload.papers.map(p => `<option value="${h(p.id)}">${h(p.short)}</option>`).join('');

function imagePanel(figure        , side                    ) {
  const image = side === 'result' ? figure.result_image : figure.paper_image;
  const hash = side === 'result' ? figure.result_image_sha256 : figure.paper_image_sha256;
  const paper = paperById.get(figure.paper);
  const title = side === 'result' ? 'Computed + extracted paper data' : 'Original paper figure';
  const link = side === 'result' ? (figure.data ? `<a href="${h(figure.data)}" download>Data JSON</a>` : '') : `<a href="#ref-${h(figure.paper)}">${h(paper.short)} ↗</a>`;
  const caption = side === 'result' ? 'Shared plot style. Click an image to anchor feedback. Solid curves and circles are computed; dashed curves are extracted references.' : figure.caption;
  return `<figure class="panel"><div class="panel-label"><span>${title}</span>${link}</div>${image ? `<button class="image-button" data-hash="${h(hash)}" data-side="${side}" aria-label="Place feedback anchor on ${side} image for ${h(figure.id)}"><img src="${h(image)}" alt="${h(title + ': ' + figure.title)}" loading="lazy"></button>` : '<div class="missing">No result imported into this preview. Existing results may be available in the project archive.</div>'}<figcaption>${h(image ? caption : 'Import state is separate from scientific status.')}</figcaption></figure>`;
}
function article(figure        ) {
  const paper = paperById.get(figure.paper);
  const rangeNote = ['liang-3', 'liang-5'].includes(figure.id) && figure.result_image
    ? '<p class="range-note">The computed hydrogen curves retain a wider equivalence-ratio range than the paper crop. Equal panel widths do not imply identical axes.</p>' : '';
  return `<article class="figure" id="figure-${h(figure.id)}"><div class="figure-header"><div><h3>${h(paper.short)} · Figure ${h(figure.number)} — ${h(figure.title)}</h3><p>${h(figure.id)}</p></div><span class="state">${figure.accepted ? 'Scoped review accepted' : figure.result_image ? 'Awaiting scoped review' : 'Not imported'}</span></div>
  <p class="conditions">${h(figure.conditions || 'Conditions and comparison criteria require import.')}</p><div class="panels">${imagePanel(figure, 'result')}${imagePanel(figure, 'paper')}</div>${rangeNote}<p class="evidence-note">${h(figure.note)}</p>
  <details class="review"><summary>Feedback and review drafts</summary><p>Review criteria: ${h(figure.criteria || 'Not defined. Set criteria in the target register before accepting a result.')}</p>${figure.readiness?.reasons.length ? `<p>Work prerequisites: ${h(figure.readiness.reasons.join('; '))}</p>` : ''}<form class="review-form"><label>Feedback type<select name="kind"><option value="comment">Comment / question</option><option value="request_revision">Request revision</option><option value="request_evidence">Request evidence</option>${figure.result_image ? '<option value="pass">Draft a scoped pass</option><option value="reject">Draft a scoped rejection</option>' : ''}</select></label><label>Review scope<input name="scope" maxlength="600" placeholder="Conditions, curve, metric, or criterion"></label><label class="wide">Comment or rationale<textarea name="comment" rows="3" maxlength="3000" required placeholder="What should the coordinator investigate or change?"></textarea></label><div class="wide review-actions"><button type="submit">Save draft</button><button class="clear-anchor" type="button">Clear anchor</button></div><p class="wide anchor-label">No image anchor. Click an image to place one.</p></form><ul class="draft-list"></ul></details>
  <details class="provenance"><summary>Source and generation</summary><dl><dt>Review</dt><dd>${h(figure.review_generation)}</dd><dt>Result SHA-256</dt><dd>${h(figure.result_image_sha256 || 'Not imported')}</dd><dt>Data SHA-256</dt><dd>${h(figure.data_sha256 || 'Not imported')}</dd><dt>PDF SHA-256</dt><dd>${h(paper.pdf_sha256)}</dd><dt>Location</dt><dd>Page ${figure.page_index + 1}; crop ${h(figure.crop_pt.join(', '))} pt</dd></dl><p>Per-point jobs and code references are in Data JSON. This view does not claim that historical build associations are complete.</p></details></article>`;
}
function renderFigures() {
  const query = search.value.toLowerCase().trim();
  const selected = figures.filter(f => (paperSelect.value === 'all' || f.paper === paperSelect.value)
    && (statusSelect.value === 'all' || f.status === statusSelect.value)
    && `${f.id} ${f.title} ${f.number} ${paperById.get(f.paper).short}`.toLowerCase().includes(query));
  byId('figures').innerHTML = selected.map(article).join('');
  byId('empty').hidden = selected.length !== 0;
  byId('count').textContent = `${selected.length} of ${figures.length} targets`;
  for (const figure of selected) feedback.bindFigure(byId('figure-' + figure.id), figure);
}
function revealTarget() {
  if (!location.hash.startsWith('#figure-')) return;
  const id = location.hash.slice(8);
  const figure = figures.find(f => f.id === id); if (!figure) return;
  if (!byId('figure-' + id)) {
    search.value = ''; paperSelect.value = figure.paper; statusSelect.value = 'all'; renderFigures();
  }
  byId('figure-' + id).scrollIntoView({ block: 'start' });
}
byId('target-rows').innerHTML = figures.map(f => {
  const setting = feedback.schedule(f);
  return `<tr data-target="${h(f.id)}"><td><a href="#figure-${h(f.id)}">${h(paperById.get(f.paper).short)} · Fig. ${h(f.number)}</a><br>${h(f.title)}</td><td>${f.result_image ? 'Imported' : 'Not imported'}</td><td><select aria-label="Priority for ${h(f.id)}">${['high', 'normal', 'deferred'].map(p => `<option value="${p}"${setting.priority === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td><input aria-label="Order for ${h(f.id)}" type="number" min="0" step="1" value="${setting.order}"></td><td><button>Save draft</button></td></tr>`;
}).join('');
byId('target-rows').querySelectorAll                     ('tr').forEach(row => {
  row.querySelector('button') .onclick = () => {
    try { feedback.saveSchedule(figures.find(f => f.id === row.dataset.target) , row.querySelector('select') .value, Number(row.querySelector('input') .value)); }
    catch (error) { announce(error.message); }
  };
});
byId('reference-list').innerHTML = payload.papers.map(p => `<article class="reference" id="ref-${h(p.id)}"><h3>${h(p.short)}</h3><p>${h(p.authors)}. ${h(p.title)} (${p.year}). <a href="${h(p.url)}" target="_blank" rel="noreferrer">DOI: ${h(p.doi)}</a></p><p><small>Private supplied PDF · SHA-256 ${h(p.pdf_sha256)}</small></p><div class="backlinks" aria-label="Figures citing ${h(p.short)}">${figures.filter(f => f.paper === p.id).map(f => `<a href="#figure-${h(f.id)}">Fig. ${h(f.number)}</a>`).join('')}</div></article>`).join('');
for (const control of [search, paperSelect, statusSelect]) control.addEventListener('input', renderFigures);
window.addEventListener('hashchange', revealTarget);
renderFigures(); revealTarget();
bindWorkspaceForms(live);
}
