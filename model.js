                      
                                                                                          
                                                                                         
                                                                                 
                                                                                       
                      
                                                    
                                                                                              
                                                                                 
                                                                                   
                  
                                                                            
                                                                                                   
  
                     
                                                                                   
                                                                                      
                                                                                    
                                                      
                       
  
export const draftKey = (figure        ) => figure.id + '@' + figure.review_generation;
export function relevantDrafts(figure        , drafts         ) {
  return drafts.filter(d => d.target === figure.id && d.generation === figure.review_generation);
}
export function validateDraft(draft       ) {
  if (!draft || draft.authority !== 'local_draft' || !['comment', 'request_revision', 'request_evidence', 'pass', 'reject', 'priority'].includes(draft.kind)) throw new Error('Unknown draft type');
  for (const field of ['id', 'created_at', 'target', 'generation', 'snapshot', 'comment', 'scope']) {
    if (typeof draft[field] !== 'string') throw new Error('Incomplete draft: ' + field);
  }
  if (draft.comment.length > 3000 || draft.scope.length > 600) throw new Error('Feedback is too long');
  if (draft.kind !== 'priority' && !draft.comment.trim()) throw new Error('Add a comment or review rationale');
  if (['pass', 'reject'].includes(draft.kind) && !draft.scope.trim()) throw new Error('State the conditions and criteria covered by this decision draft');
  if (draft.kind === 'priority' && (!['high', 'normal', 'deferred'].includes(draft.priority || '') || !Number.isInteger(draft.order) || draft.order  < 0)) throw new Error('Invalid target priority or order');
  if (draft.anchor && (!/^[a-f0-9]{64}$/.test(draft.anchor.image_sha256) || ![draft.anchor.x, draft.anchor.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1))) throw new Error('Invalid image anchor');
  return draft;
}
export function parseDrafts(raw               )          {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 1000) throw new Error('Invalid saved draft collection');
  return data.map(validateDraft);
}
export function duplicatePaper(hash        , papers                                      ) {
  return papers.find(paper => paper.pdf_sha256 === hash)?.id || null;
}
export const escapeHtml = (value         ) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ));
