import { escapeHtml as h } from './model.js';
                                         

                                                                               
                                                                                                
                                                                                                  
                                                                                                                                    
                                                                           

// This renderer consumes the validated static payload. It has no workspace or network client.
export function mountPublication(payload) {
  const publication = payload.publication;
  const papers = new Map             (payload.papers.map(p => [p.id, p]));
  const topics = payload.topics || [];
  const stages = [...(payload.stages || [])].sort((a, b) => a.order - b.order);
  const stageRank = (id         ) => { const i = stages.findIndex(s => s.id === id); return i < 0 ? stages.length : i; };
  const central=payload.central_ladder;
  const figures                  = central ? [...payload.figures] : payload.figures.filter(f => f.selected !== false)
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || a.order - b.order);
  const byId = (id        ) => document.getElementById(id) ;
  const selectedViews = new Map                ();
  const anchors = new Map                ();
  const repository = 'https://github.com/' + publication.repository;
  const viewsFor = (f               )         => f.views?.length ? f.views : f.result_image ? [{ id: 'result',
    label: 'Computed comparison', image: f.result_image, image_sha256: f.result_image_sha256 ,
    data: f.data, data_sha256: f.data_sha256, note: f.note }] : [];
  const currentView = (f               ) => viewsFor(f).find(v => v.id === selectedViews.get(f.id)) || viewsFor(f)[0];
  const hasResult = (f               ) => viewsFor(f).some(v => !!v.image);
  const safeUrl = (value        ) => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const describe = (value         )         => Array.isArray(value) ? value.map(describe).join(', ')
    : value && typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${k}: ${describe(v)}`).join('; ') : String(value ?? '');

  document.body.classList.add('publication');
  document.title = `${publication.title} · Forge`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
  document.querySelector('.app-header nav') .innerHTML = '<a href="#comparisons">Study</a><a href="#targets">Target catalogue</a><a href="#references">References</a>';
  document.querySelector('main') .innerHTML = `<header class="report-intro"><h1>${h(publication.title)}</h1>
    <p class="report-deck">${h(publication.subtitle)}</p><div class="report-introduction">${(publication.introduction || []).map(t => `<p>${h(t)}</p>`).join('')}</div>
    <p class="report-meta">Snapshot: ${h(payload.captured_at)} · <a href="${h(repository)}" target="_blank" rel="noreferrer">Publication repository</a></p>
    ${central ? `<section class="ladder-status" aria-label="Full ladder status"><h2>Full registered V&amp;V ladder</h2><p><strong>${figures.length} registered targets</strong> · ${central.summary.results_available} have imported results · ${central.summary.human_accepted} have scoped human acceptance.</p><p>Campaign: ${h(central.summary.campaign_status)}. Numerical evidence, agent review, and human acceptance are separate. Completing a bounded worker task does not complete this ladder.</p><p>Numerical review: ${central.summary.numerical_pending} pending, ${central.summary.numerical_needs_work} need work. Agent review: ${central.summary.agent_review_pending} pending, ${central.summary.agent_review_needs_work} need work.</p></section>` : ''}
    ${publication.export_notice ? `<details class="publication-rights"><summary>Publication and third-party material</summary><p>${h(describe(publication.export_notice))}</p></details>` : ''}</header>
    <div class="article-layout"><aside class="stage-rail"><nav aria-label="Study stages" id="stage-nav"></nav></aside><div class="article-body">
    <section id="comparisons" aria-labelledby="comparison-title"><div class="section-heading"><h2 id="comparison-title">Evidence and open questions</h2><span id="count" role="status"></span></div>
    <div class="filters"><label>Find a target<input id="search" type="search" placeholder="Question, figure, or paper"></label>
    <label>Topic<select id="topic"><option value="all">All topics</option>${topics.map(t => `<option value="${h(t.id)}">${h(t.title)}</option>`).join('')}</select></label>
    <label>Evidence<select id="status"><option value="all">${central ? 'All registered targets' : 'All selected targets'}</option><option value="available">Results available</option><option value="planned">Planned comparisons</option></select></label></div>
    <p id="topic-description" class="topic-description" hidden></p><div id="figures"></div><p id="empty" hidden>No targets match. Clear the search or select all topics and evidence.</p></section>
    <section id="targets" aria-labelledby="target-title"><h2 id="target-title">Target catalogue</h2><p>${central ? 'All registered targets remain in their fixed catalogue order. Optional targets remain visible. Filters do not change registration.' : 'Selected development targets, in stage order.'} Availability does not establish scientific acceptance.</p>
    <div class="table-wrap" role="region" aria-label="Selected targets" tabindex="0"><table><caption class="visually-hidden">Selected targets and their evidence state</caption>
    <thead><tr><th scope="col">Target</th><th scope="col">Stage</th><th scope="col">Evidence</th></tr></thead><tbody id="target-rows"></tbody></table></div></section>
    <section id="references" aria-labelledby="references-title"><h2 id="references-title">References</h2><div id="reference-list"></div></section>
    <footer>Discuss a target through its GitHub issue link. GitHub requires sign-in to post. Comments do not automatically reach a coordinator or establish scientific acceptance.</footer>
    </div></div><p id="message" class="visually-hidden" role="status" aria-live="polite"></p>`;
  const search = byId('search')                    ;
  const topic = byId('topic')                     ;
  const status = byId('status')                     ;

  function permalink(f               ) {
    const url = new URL(location.href); url.search = ''; url.hash = `figure-${f.id}`;
    url.searchParams.set('target', f.id);
    const view = currentView(f); if (view) url.searchParams.set('view', view.id);
    return url.href;
  }
  function feedbackUrl(f               ) {
    let url = new URL(`${repository}/issues/new`);
    try { const configured = new URL(publication.feedback_url);
      if (configured.origin === 'https://github.com' && configured.pathname === url.pathname) url = configured;
    } catch { /* The canonical repository supplies the feedback destination. */ }
    const view = currentView(f); const anchor = anchors.get(f.id);
    url.searchParams.set('title', `[Figure review] ${f.id}: ${f.title}`);
    url.searchParams.set('body', [`Target: ${f.id}`, `Generation: ${f.review_generation}`, `Snapshot: ${payload.snapshot_sha256}`,
      `View: ${view?.id || 'planned'}`, `Image SHA-256: ${view?.image_sha256 || 'not_imported'}`,
      `Data SHA-256: ${view?.data_sha256 || 'not_imported'}`, `URL: ${permalink(f)}`,
      ...(anchor ? [`Anchor: ${anchor.side}, image ${anchor.image_sha256}, normalized image coordinates (${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`] : []),
      '', 'Review scope:', '', 'Observation or requested evidence:', '', 'This issue is feedback, not scientific acceptance.'].join('\n'));
    return url.href;
  }
  function image(f               , side                    ) {
    const view = currentView(f); const path = side === 'result' ? view?.image : f.paper_image;
    const hash = side === 'result' ? view?.image_sha256 : f.paper_image_sha256;
    if (!path) return side === 'paper' ? '<p class="missing">Original figure not imported. See the source reference below.</p>' : planned(f);
    return `<button type="button" class="image-button" data-side="${side}" data-hash="${h(hash)}" aria-label="Anchor feedback on ${side} image for ${h(f.id)}"><img src="${h(path)}" alt="${h((side === 'result' ? view .label : 'Original paper figure') + ': ' + f.title)}" loading="lazy"></button>`;
  }
  function planned(f               ) {
    const plan = f.plot_plan || {};
    return `<div class="planned-comparison"><h4>Planned comparison</h4><p>${h(plan.layout ? describe(plan.layout) : 'Result data have not been imported for this comparison.')}</p>
      ${plan.quantities ? `<p>Quantities: ${h(describe(plan.quantities))}</p>` : ''}
      <p>${h(f.readiness?.reasons?.length ? f.readiness.reasons.join('; ') : f.readiness?.eligible ? 'Ready for work; a result is still required.' : 'Readiness has not been established.')}</p></div>`;
  }
  function originalCaption(f               ) {
    const caption=f.original_caption;
    if(caption?.status!=='verified')return '<div class="original-caption"><strong>Original paper caption</strong><p class="missing">Original caption has not been verified or imported.</p></div>';
    return `<div class="original-caption"><strong>Original paper caption</strong>${caption.image ? `<a href="${h(caption.image)}" target="_blank" rel="noreferrer"><img src="${h(caption.image)}" alt="Original paper caption for ${h(f.id)}" loading="lazy"></a>` : ''}${caption.text ? `<p>${h(caption.text)}</p>` : ''}${caption.panel_relation ? `<p>${h(caption.panel_relation)}</p>` : ''}<small>Source page ${caption.page_index +1}.</small>${caption.image ? `<p class="data-links"><a href="${h(caption.image)}" target="_blank" rel="noreferrer">Open original caption</a></p>` : ''}</div>`;
  }
  function renderFigure(f               ) {
    const paper = papers.get(f.paper); const view = currentView(f); const views = viewsFor(f);
    const available = !!view?.image; const label = f.accepted ? 'Scoped review recorded · inspect conditions' : available ? 'Result available · review scope applies' : 'Planned comparison';
    return `<article class="figure" id="figure-${h(f.id)}"><header class="figure-header"><div><h3>${h(f.question || f.title)}</h3>
      <p><a href="#ref-${h(f.paper)}">${h(paper?.short || f.paper)} · Figure ${h(f.number)}</a> · ${h(f.id)}${f.role ? ` · ${h(f.role)}` : ''}</p></div><span class="state${available ? '' : ' planned'}">${label}</span></header>
      ${f.why ? `<p class="figure-purpose">${h(f.why)}</p>` : ''}<p class="conditions">${h(f.conditions || 'Conditions and comparison criteria require import.')}</p>
      ${central ? `<p class="target-review-state"><strong>Numerical:</strong> ${h(f.development_state?.numerical || 'not_assessed')} · <strong>Agent review:</strong> ${h(f.development_state?.agent_review || 'not_assessed')} · <strong>Human acceptance:</strong> ${h(f.development_state?.human_acceptance || 'not_assessed')}${f.selected===false ? ' · Optional registered target' : ''}</p>` : ''}
      ${views.length > 1 ? `<div class="view-tabs" role="tablist" aria-label="Result views for ${h(f.id)}">${views.map(v => `<button type="button" role="tab" id="tab-${h(f.id)}-${h(v.id)}" data-view="${h(v.id)}" aria-controls="result-${h(f.id)}" aria-selected="${v.id === view.id}" tabindex="${v.id === view.id ? 0 : -1}">${h(v.label)}</button>`).join('')}</div>` : ''}
      <div class="panels"><figure class="panel"><div class="panel-label"><span>Computed result and reference data</span></div>
      <div id="result-${h(f.id)}"${views.length > 1 ? ` role="tabpanel" aria-labelledby="tab-${h(f.id)}-${h(view.id)}" tabindex="0"` : ''}>${image(f, 'result')}</div>
      <figcaption>${h(view?.note || (available ? 'Method note not supplied. Consult retained data before interpreting the curve.' : 'No curve is shown until result data are available.'))}</figcaption>
      ${view?.data || view?.recipe ? `<p class="data-links">${view.image ? `<a href="${h(view.image)}" target="_blank" rel="noreferrer">Open full-size plot</a>` : ''}${view.data ? `<a href="${h(view.data)}" download>Data JSON</a>` : ''}${view.recipe ? `<a href="${h(view.recipe)}" download>Plot recipe</a>` : ''}</p>` : ''}</figure>
      <figure class="panel"><div class="panel-label"><span>Original paper figure</span><a href="#ref-${h(f.paper)}">Source reference</a></div>${image(f, 'paper')}${originalCaption(f)}<figcaption><strong>Comparison description:</strong> ${h(f.caption)}${f.rights ? `<span class="source-rights">${h(describe(f.rights))}</span>` : ''}</figcaption><p class="data-links"><a href="${h(f.paper_image)}" target="_blank" rel="noreferrer">Open full-size figure</a></p></figure></div>
      ${['liang-3', 'liang-5'].includes(f.id) && available ? '<p class="range-note">The computed hydrogen curves retain a wider equivalence-ratio range than the paper crop. Equal panel widths do not imply identical axes.</p>' : ''}
      ${f.note ? `<p class="evidence-note">${h(f.note)}</p>` : ''}
      <div class="public-feedback"><a class="feedback-link" href="${h(feedbackUrl(f))}" target="_blank" rel="noreferrer">Discuss this target on GitHub</a><a class="figure-permalink" href="${h(permalink(f))}">Link to this view</a>
      <p class="anchor-label">${h(anchorText(f))}</p><button type="button" class="clear-anchor"${anchors.has(f.id) ? '' : ' hidden'}>Clear image anchor</button></div>
      <details class="provenance"><summary>Conditions, source, and generation</summary><p>Review criteria: ${h(f.criteria || 'Not specified. No scientific acceptance is implied.')}</p>
      ${f.dependencies?.length ? `<p>Prerequisites: ${f.dependencies.map(id => figures.some(other => other.id === id) ? `<a href="#figure-${h(id)}">${h(id)}</a>` : h(id)).join(', ')}</p>` : ''}
      <dl><dt>Source commit</dt><dd>${h(publication.source_commit || 'not_verified')}</dd><dt>Review generation</dt><dd>${h(f.review_generation)}</dd><dt>Selected view</dt><dd>${h(view?.id || 'planned')}</dd>
      ${f.evidence_binding ? `<dt>Evidence source</dt><dd>${h(describe(f.evidence_binding.source))}</dd><dt>Retained run</dt><dd>${h(describe(f.evidence_binding.run))}</dd><dt>Review record</dt><dd>${h(describe(f.evidence_binding.review))}</dd>` : ''}
      <dt>Result SHA-256</dt><dd>${h(view?.image_sha256 || 'not_imported')}</dd><dt>Data SHA-256</dt><dd>${h(view?.data_sha256 || 'not_imported')}</dd>
      ${f.original_caption?.status==='verified' ? `<dt>Original caption method</dt><dd>${h(f.original_caption.method)}</dd><dt>Original caption SHA-256</dt><dd>${h(f.original_caption.image_sha256 || 'Text retained in target generation')}</dd>` : ''}
      <dt>Reference SHA-256</dt><dd>${h(f.paper_image_sha256 || 'not_imported')}</dd><dt>Source PDF SHA-256</dt><dd>${h(paper?.pdf_sha256 || 'not_imported')}</dd>
      <dt>Source location</dt><dd>${Number.isInteger(f.page_index) ? `Page ${f.page_index + 1}` : 'Page not imported'}${f.crop_pt?.length ? `; crop ${h(f.crop_pt.join(', '))} pt` : ''}</dd></dl></details></article>`;
  }
  function anchorText(f               ) {
    const a = anchors.get(f.id);
    return a ? `Anchor: ${a.side} image (${a.x.toFixed(3)}, ${a.y.toFixed(3)}). Image coordinates, not physical values.`
      : currentView(f)?.image || f.paper_image ? 'Select a point on either image to include its location in the issue.'
      : 'GitHub feedback includes this target and its planned view.';
  }
  function bindFigure(f               ) {
    const element = byId('figure-' + f.id);
    const updateAnchor = () => {
      element.querySelector                   ('.feedback-link') .href = feedbackUrl(f);
      element.querySelector('.anchor-label') .textContent = anchorText(f);
      element.querySelector                   ('.clear-anchor') .hidden = !anchors.has(f.id);
    };
    element.querySelectorAll                   ('.image-button').forEach(button => button.onclick = event => {
      const rect = button.querySelector('img') .getBoundingClientRect();
      anchors.set(f.id, { image_sha256: button.dataset.hash , side: button.dataset.side ,
        x: event.detail === 0 ? .5 : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: event.detail === 0 ? .5 : Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) });
      updateAnchor(); byId('message').textContent = anchorText(f);
    });
    element.querySelector                   ('.clear-anchor') .onclick = () => { anchors.delete(f.id); updateAnchor(); };
    const tabs = [...element.querySelectorAll                   ('[role="tab"]')];
    tabs.forEach((tab, index) => {
      tab.onclick = () => {
        selectedViews.set(f.id, tab.dataset.view ); anchors.delete(f.id);
        element.outerHTML = renderFigure(f); bindFigure(f);
        byId(`tab-${f.id}-${tab.dataset.view}`).focus();
        history.replaceState(null, '', permalink(f));
      };
      tab.onkeydown = event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!offset && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length].click();
      };
    });
  }
  function render() {
    const query = search.value.toLowerCase().trim();
    const visible = figures.filter(f => (topic.value === 'all' || f.topic === topic.value)
      && (status.value === 'all' || (status.value === 'available') === hasResult(f))
      && `${f.id} ${f.title} ${f.question || ''} ${papers.get(f.paper)?.short || ''}`.toLowerCase().includes(query));
    const groups = central ? visible.reduce((groups, figure) => {
      let group=groups.at(-1);
      if(!group||group.sourceStage!==figure.stage){const stage=stages.find(s=>s.id===figure.stage)||{title:'Other registered targets',description:''};
        group={...stage,id:`registered-${groups.length}`,sourceStage:figure.stage,figures:[]};groups.push(group);}
      group.figures.push(figure);return groups;
    }, []         ) : [...stages, { id: '', title: 'Other selected targets', description: '' }].map(stage => ({ ...stage,
      figures: visible.filter(f => stage.id ? f.stage === stage.id : !stages.some(s => s.id === f.stage)) })).filter(s => s.figures.length);
    byId('figures').innerHTML = groups.map(s => `<section class="study-stage" id="stage-${h(s.id || 'other')}"><header class="stage-heading"><h2>${h(s.title)}</h2>${s.description ? `<p>${h(s.description)}</p>` : ''}</header>${s.figures.map(renderFigure).join('')}</section>`).join('');
    byId('stage-nav').innerHTML = `<p>In this study</p>${groups.map(s => `<a href="#stage-${h(s.id || 'other')}">${h(s.title)}</a>`).join('')}<a href="#targets">Target catalogue</a><a href="#references">References</a>`;
    byId('count').textContent = `${visible.length} of ${figures.length} ${central ? 'registered' : 'selected'} targets`;
    byId('empty').hidden = visible.length > 0;
    const description = topics.find(t => t.id === topic.value)?.description || '';
    byId('topic-description').textContent = description; byId('topic-description').hidden = !description;
    for (const f of visible) bindFigure(f);
  }
  function revealTarget() {
    let id        ; try { id = decodeURIComponent(location.hash.slice(8)); } catch { return; }
    if (!location.hash.startsWith('#figure-')) return;
    const f = figures.find(f => f.id === id); if (!f) return;
    const params = new URL(location.href).searchParams;
    if (params.get('target') === id && viewsFor(f).some(v => v.id === params.get('view'))) selectedViews.set(id, params.get('view') );
    search.value = ''; topic.value = 'all'; status.value = 'all'; render();
    byId('figure-' + id).scrollIntoView({ block: 'start' });
  }
  byId('target-rows').innerHTML = figures.map(f => `<tr><td><a href="#figure-${h(f.id)}">${h(f.id)}</a><br>${h(f.title)}</td><td>${h(stages.find(s => s.id === f.stage)?.title || 'Unassigned')}</td><td>${hasResult(f) ? 'Result available' : 'Planned comparison'}</td></tr>`).join('');
  byId('reference-list').innerHTML = payload.papers.map(p => {
    const url = safeUrl(p.url);
    const cited = figures.filter(f => f.paper === p.id);
    return `<article class="reference" id="ref-${h(p.id)}"><h3>${h(p.short)}</h3><p>${h(p.authors)}. ${h(p.title)} (${h(p.year)}). ${url ? `<a href="${h(url)}" target="_blank" rel="noreferrer">${h(p.doi ? 'DOI: ' + p.doi : 'Source publication')}</a>` : ''}</p>
      ${cited.length ? `<div class="backlinks" aria-label="Figures citing ${h(p.short)}">${cited.map(f => `<a href="#figure-${h(f.id)}">${h(f.id)} · Fig. ${h(f.number)}</a>`).join('')}</div>` : '<p class="reference-note">Background/source review; no independent figure target selected.</p>'}</article>`;
  }).join('');
  for (const control of [search, topic, status]) control.addEventListener('input', render);
  window.addEventListener('hashchange', revealTarget);
  render(); revealTarget();
}
