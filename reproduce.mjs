import {readFile, writeFile, access} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const {values} = parseArgs({options:{data:{type:'string'},recipe:{type:'string'},output:{type:'string'},plan:{type:'boolean'}}});
try {
  const manifest = JSON.parse(await readFile(resolve(root,'site-manifest.json'),'utf8'));
  const read = async name => {
    if (!/^assets\/[a-zA-Z0-9_-]+\.json$/.test(name || '')) throw new Error('Select a declared assets/*.json file');
    const bytes = await readFile(resolve(root,name));
    if (createHash('sha256').update(bytes).digest('hex') !== manifest.files[name]) throw new Error(`Changed input: ${name}`);
    return JSON.parse(bytes);
  };
  const table = await read(values.data), recipe = await read(values.recipe);
  let result;
  if(recipe.schema==='forge-paper-style-v1'){
    const {renderPaperComparison}=await import('./reproduction/plots/paper-style.mjs');
    result=renderPaperComparison(table.series,recipe);
  }else if(recipe.schema==='forge-plot-v1'){
    const {renderComparison}=await import('./reproduction/plots/render.mjs');
    result=await renderComparison(table,recipe);
  }else throw new Error(`Unsupported plotting recipe: ${recipe.schema}`);
  if (!values.output) throw new Error('Supply a new --output SVG path');
  const output = resolve(values.output);
  try {await access(output); throw new Error('Output exists; choose a new path');} catch(error) {if(error.code !== 'ENOENT') throw error;}
  console.log(JSON.stringify({action:values.plan?'plan':'replot',target:table.target,view:recipe.id,output,solver_execution:false}));
  if (!values.plan) await writeFile(output,result.svg,{flag:'wx'});
} catch(error) {console.error(error.message);process.exitCode=1;}
