const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function addLegend(svg, entries) {
  const header = svg.match(/^<svg[^>]*width="(\d+)" height="(\d+)" viewBox="0 0 \d+ \d+"[^>]*>/);
  if (!header) throw new Error('Unexpected SVG dimensions');
  const width = Number(header[1]), height = Number(header[2]);
  const newHeight = height + Math.ceil(entries.length / 2) * 23 + 18;
  const newHeader = header[0].replace(`height="${height}"`,`height="${newHeight}"`).replace(`viewBox="0 0 ${width} ${height}"`,`viewBox="0 0 ${width} ${newHeight}"`);
  const rows = entries.map((entry,i) => {
    const x = 45 + (i%2) * (width-65)/2, y = height + 12 + Math.floor(i/2)*23;
    const marker = entry.paper ? '' : entry.shape === 'square' ? '<rect x="-3" y="-3" width="6" height="6"/>'
      : entry.shape === 'triangle-up' ? '<path d="M0 -4 L4 3 L-4 3Z"/>'
      : entry.shape === 'diamond' ? '<path d="M0 -4 L4 0 L0 4 L-4 0Z"/>'
      : entry.shape === 'cross' ? '<path d="M-1 -4 H1 V-1 H4 V1 H1 V4 H-1 V1 H-4 V-1 H-1Z"/>'
      : '<circle r="3.5"/>';
    return `<g transform="translate(${x},${y})"><g stroke="${entry.color}" stroke-width="1.6" fill="white">${entry.line ? `<path d="M-12 0H12" ${entry.paper?'stroke-dasharray="5 4"':''}/>`:''}${marker}</g><text x="19" y="4" fill="#263b36" font-family="Segoe UI, Arial, sans-serif" font-size="11">${escape(entry.label)}</text></g>`;
  }).join('');
  return svg.replace(header[0],newHeader)
    .replace(`<rect width="${width}" height="${height}" fill="#ffffff"/>`,`<rect width="${width}" height="${newHeight}" fill="#ffffff"/>`)
    .replace('</svg>',`<g aria-label="Series legend">${rows}</g></svg>`);
}
