import * as vega from 'vega';
import { compile } from 'vega-lite';
import { interpolate, validatePoints } from './interpolate.mjs';
import { addLegend } from './legend.mjs';

const cases = {'1':'#256f97', '2':'#197e70', '3':'#8862a3', '4':'#bb7531', '5':'#b74755'};
const engines = {'paper':'#647279', 'cantera':'#197e70', 'developed-openfoam':'#bd713f', 'deepflame':'#8066aa', 'reactingfoam':'#356fa3'};

export function validateSeries(table) {
  if (table.schema !== 'forge-series-v1' || !table.target || !Array.isArray(table.series)) throw new Error('Invalid series table');
  const ids = new Set();
  for (const series of table.series) {
    if (!/^[a-z0-9-]+$/.test(series.id) || ids.has(series.id)) throw new Error('Invalid or duplicate series ID');
    if (!series.label || !series.engine || !['computed', 'paper'].includes(series.origin)) throw new Error('Missing series identity');
    validatePoints(series.points);
    ids.add(series.id);
  }
  return table;
}

export async function renderComparison(table, recipe) {
  validateSeries(table);
  if (recipe.schema !== 'forge-plot-v1' || !recipe.id || !recipe.title || !recipe.x?.label || !recipe.y?.label) throw new Error('Incomplete plot recipe');
  if (!Array.isArray(recipe.series) || !recipe.series.length) throw new Error('Select at least one series');
  if (!['pchip', 'linear', 'points'].includes(recipe.smoothing)) throw new Error('Select a supported interpolation method');
  if (!['case', 'engine'].includes(recipe.colorBy)) throw new Error('Select case or engine colors');
  for (const axis of [recipe.x, recipe.y]) {
    if (axis.domain && (axis.domain.length !== 2 || !axis.domain.every(Number.isFinite) || axis.domain[0] >= axis.domain[1])) throw new Error('Invalid axis domain');
  }
  const selected = recipe.series.map(id => {
    const series = table.series.find(s => s.id === id);
    if (!series) throw new Error(`Unavailable series: ${id}`);
    return series;
  });
  if (!selected.some(s => s.origin === 'computed')) throw new Error('Comparison requires computed data');
  const names = selected.map(s => s.label);
  if (new Set(names).size !== names.length) throw new Error('Selected series labels must be unique');
  const colors = selected.map(s => recipe.colorBy === 'case' ? cases[s.case] || '#647279' : engines[s.engine] || '#647279');
  const shapes = selected.map(s => recipe.colorBy === 'case' ? ({'1':'circle','2':'square','3':'triangle-up','4':'cross','5':'diamond'}[s.case]||'circle') : ({'cantera':'circle','developed-openfoam':'triangle-up','deepflame':'square','reactingfoam':'cross'}[s.engine]||'circle'));
  const lineValues = [], pointValues = [];
  for (const series of selected) {
    const common = {series:series.label, origin:series.origin};
    const method = series.origin === 'paper' ? 'linear' : recipe.smoothingBySeries?.[series.id] || recipe.smoothing;
    if (!['pchip','linear','points'].includes(method)) throw new Error('Unknown series interpolation method');
    if (method !== 'points') for (const p of interpolate(series.points, method)) lineValues.push({...p, ...common});
    if (series.origin === 'computed') for (const {x,y} of series.points) pointValues.push({x,y,...common});
  }
  const axes = {
    x:{field:'x', type:'quantitative', title:recipe.x.label, scale:recipe.x.domain ? {domain:recipe.x.domain, zero:false} : {zero:false}},
    y:{field:'y', type:'quantitative', title:recipe.y.label, scale:recipe.y.domain ? {domain:recipe.y.domain, zero:false} : {zero:false}}
  };
  const color = {field:'series', type:'nominal', scale:{domain:names,range:colors}, legend:null};
  const spec = {
    $schema:'https://vega.github.io/schema/vega-lite/v6.json', width:600, height:360,
    background:'#ffffff', padding:18,
    title:{text:recipe.title,subtitle:recipe.subtitle || (recipe.smoothing === 'pchip' ? 'Markers: computed samples · smooth guides: PCHIP · dashed: paper traces' : 'Markers: computed samples · dashed: paper traces'),anchor:'start',fontSize:17,subtitleFontSize:11,offset:18},
    config:{font:'Segoe UI, Arial, sans-serif',view:{stroke:null},axis:{labelFontSize:12,titleFontSize:13,titlePadding:12,gridColor:'#e9edeb',domainColor:'#a9b4b0',tickColor:'#a9b4b0'},legend:{labelFontSize:11,symbolStrokeWidth:2}},
    layer:[
      {data:{values:lineValues},mark:{type:'line',strokeWidth:2,clip:true},encoding:{...axes,color,detail:{field:'series'},strokeDash:{field:'origin',type:'nominal',scale:{domain:['computed','paper'],range:[[1,0],[5,4]]},legend:null}}},
      {data:{values:pointValues},mark:{type:'point',filled:true,fill:'#ffffff',size:45,strokeWidth:1.7,clip:true},encoding:{...axes,stroke:color,shape:{field:'series',type:'nominal',scale:{domain:names,range:shapes},legend:null},tooltip:[{field:'series'},{field:'x',format:'.4g'},{field:'y',format:'.5g'}]}}
    ], resolve:{scale:{color:'shared',stroke:'shared'}}
  };
  const view = new vega.View(vega.parse(compile(spec).spec), {renderer:'none'});
  // Vega assigns process-global clip IDs. Canonicalize them for exact replay across plot batches.
  const clipIds = new Map();
  const baseSvg = (await view.toSVG()).replace(/\b(id="|clip-path="url\(#)(clip\d+)/g,(_,prefix,id)=>{
    if (!clipIds.has(id)) clipIds.set(id,`clip${clipIds.size+1}`);
    return prefix+clipIds.get(id);
  });
  const svg = addLegend(baseSvg,selected.map((s,i)=>({label:s.label,color:colors[i],shape:shapes[i],paper:s.origin==='paper',line:s.origin==='paper'||((recipe.smoothingBySeries?.[s.id]||recipe.smoothing)!=='points'&&s.points.length>1)})));
  view.finalize();
  return {svg,spec,recipe:{...recipe,renderer:'forge-series-v1',interpolation_is_evidence:false,source_target:table.target}};
}
