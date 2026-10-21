/** Pure renderer for a measured paper recipe. No interpolation, fitting, or acceptance decisions. */
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const number = value => { if (!Number.isFinite(value)) throw new Error('Expected finite geometry'); return value; };
const positive = value => { number(value); if (value <= 0) throw new Error('Expected positive dimension'); return value; };
const color = value => { if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Use an explicit six-digit color'); return value; };
function vector(value, count) {
  if (!Array.isArray(value) || value.length !== count) throw new Error(`Expected ${count} geometry values`);
  value.forEach(number); return value;
}
function axis(value) {
  const [lo, hi] = vector(value?.domain, 2);
  if (hi <= lo || !Array.isArray(value.ticks)) throw new Error('Invalid axis domain or ticks');
  for (const tick of value.ticks) if (number(tick) < lo || tick > hi) throw new Error('Tick outside axis domain');
}
function validate(recipe, series) {
  if (recipe?.schema !== 'forge-paper-style-v1' || !/^[a-z0-9-]+$/.test(recipe.id)) throw new Error('Invalid paper style recipe');
  if (!/^[0-9a-f]{64}$/.test(recipe.source?.sha256) || !Number.isInteger(recipe.source.page) || recipe.source.page < 1 || !recipe.source.method) throw new Error('Paper SHA-256, page, and extraction method are required');
  positive(recipe.canvas?.width); positive(recipe.canvas?.height);
  const [vx, vy, vw, vh] = vector(recipe.canvas.viewBox, 4); positive(vw); positive(vh);
  const [left, top, right, bottom] = vector(recipe.frame, 4);
  if (left >= right || top >= bottom || left < vx || top < vy || right > vx + vw || bottom > vy + vh) throw new Error('Frame must fit inside canvas');
  axis(recipe.x); axis(recipe.y); positive(recipe.gridWidth); positive(recipe.font?.size);
  if (!recipe.font.family) throw new Error('Declare the font family');
  for (const key of ['x','y']) number(recipe.legend?.[key]);
  for (const key of ['rowHeight','sampleWidth','textGap']) positive(recipe.legend?.[key]);
  if (!recipe.axisGlyphs?.length && !recipe.labels?.length) throw new Error('Supply measured axis glyphs or explicit labels');
  for (const glyph of recipe.axisGlyphs || []) {
    if (!/^[MmZzLlHhVvCcSsQqTtAaEe0-9+.,\s-]+$/.test(glyph.path)) throw new Error('Unsafe glyph path');
    vector(glyph.transform, 6);
  }
  for (const label of recipe.labels || []) { number(label.x); number(label.y); if (!label.text) throw new Error('Empty axis label'); }
  if (!Array.isArray(series) || !series.length || !series.some(s => s.origin === 'computed')) throw new Error('Computed comparison series are required');
  const ids = new Set();
  for (const item of series) {
    if (!/^[a-z0-9-]+$/.test(item.id) || ids.has(item.id) || !item.label) throw new Error('Unique series identity is required');
    ids.add(item.id);
    if (!['paper','computed'].includes(item.origin) || !item.provenance) throw new Error('Series origin and provenance are required');
    if (!['line','points','line-points'].includes(item.mark)) throw new Error('Invalid series mark');
    color(item.color); positive(item.lineWidth);
    if (item.mark !== 'line') { positive(item.markerRadius); positive(item.markerWidth); }
    if (item.dash) { if (!Array.isArray(item.dash) || !item.dash.length) throw new Error('Invalid dash pattern'); item.dash.forEach(positive); }
    if (!Array.isArray(item.points) || !item.points.length) throw new Error('Series requires actual points');
    let previous = -Infinity;
    for (const point of item.points) {
      number(point.x); number(point.y);
      if (point.x <= previous) throw new Error('Points must have strictly increasing abscissae');
      previous = point.x;
    }
  }
}

export function renderPaperComparison(series, recipe) {
  validate(recipe, series);
  const [left,top,right,bottom] = recipe.frame;
  const x = value => left + (value-recipe.x.domain[0])/(recipe.x.domain[1]-recipe.x.domain[0])*(right-left);
  const y = value => bottom - (value-recipe.y.domain[0])/(recipe.y.domain[1]-recipe.y.domain[0])*(bottom-top);
  const line = (x1,y1,x2,y2,stroke,width,dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''}/>`;
  const circle = (cx,cy,r,stroke,width) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  const [vx,vy,vw,vh] = recipe.canvas.viewBox;
  let body = `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`;
  for (const tick of recipe.x.ticks) body += line(x(tick),top,x(tick),bottom,'#bfbfbf',recipe.gridWidth);
  for (const tick of recipe.y.ticks) body += line(left,y(tick),right,y(tick),'#bfbfbf',recipe.gridWidth);
  body += `<rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="none" stroke="#000000" stroke-width="${recipe.gridWidth}"/>`;
  const clipId = `paper-${recipe.id}`;
  body += `<defs><clipPath id="${clipId}"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs>`;
  for (const item of series) {
    body += `<g data-series="${item.id}">`;
    if (item.mark !== 'points') {
      const path = item.points.map((p,i) => `${i ? 'L' : 'M'}${x(p.x)} ${y(p.y)}`).join('');
      body += `<path d="${path}" clip-path="url(#${clipId})" fill="none" stroke="${item.color}" stroke-width="${item.lineWidth}"${item.dash ? ` stroke-dasharray="${item.dash.join(' ')}"` : ''}/>`;
    }
    if (item.mark !== 'line') for (const p of item.points) {
      if (p.x >= recipe.x.domain[0] && p.x <= recipe.x.domain[1] && p.y >= recipe.y.domain[0] && p.y <= recipe.y.domain[1]) body += circle(x(p.x),y(p.y),item.markerRadius,item.color,item.markerWidth);
    }
    body += '</g>';
  }
  for (const glyph of recipe.axisGlyphs || []) body += `<path d="${escape(glyph.path)}" transform="matrix(${glyph.transform.join(',')})" fill="#000000"/>`;
  for (const label of recipe.labels || []) body += `<text x="${label.x}" y="${label.y}" font-family="${escape(recipe.font.family)}" font-size="${recipe.font.size}">${escape(label.text)}</text>`;
  for (let i=0;i<series.length;i++) {
    const item=series[i], lx=recipe.legend.x, ly=recipe.legend.y+i*recipe.legend.rowHeight;
    body += item.mark==='points' ? circle(lx+recipe.legend.sampleWidth/2,ly-2,item.markerRadius,item.color,item.markerWidth) : line(lx,ly-2,lx+recipe.legend.sampleWidth,ly-2,item.color,item.lineWidth,item.dash);
    body += `<text x="${lx+recipe.legend.sampleWidth+recipe.legend.textGap}" y="${ly}" font-family="${escape(recipe.font.family)}" font-size="${recipe.font.size}">${escape(item.label)}</text>`;
  }
  return {
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${recipe.canvas.width}" height="${recipe.canvas.height}" viewBox="${recipe.canvas.viewBox.join(' ')}" role="img"><title>${escape(recipe.id)}</title>${body}</svg>`,
    receipt:{schema:'forge-paper-render-v1',recipe_id:recipe.id,source:structuredClone(recipe.source),interpolated_reference_points:0,
      series:series.map(item=>({id:item.id,origin:item.origin,point_count:item.points.length,
        points_within_axes:item.points.filter(p=>p.x>=recipe.x.domain[0]&&p.x<=recipe.x.domain[1]&&p.y>=recipe.y.domain[0]&&p.y<=recipe.y.domain[1]).length,
        provenance:structuredClone(item.provenance)})),
      scientific_status:'not_assessed',font_availability:'not_checked_by_renderer'},
  };
}
