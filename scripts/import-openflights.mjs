import {parse} from 'csv-parse/sync';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const apply=process.argv.includes('--apply');
const base=process.env.DIRECTUS_URL;
if(!base||!process.env.ARCHIVE_TOKEN)throw new Error('DIRECTUS_URL and ARCHIVE_TOKEN required');
const source='https://raw.githubusercontent.com/jpatokal/openflights/master/data/';
const output=new URL('../public/openflights/',import.meta.url);
const normal=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const clean=s=>!s||['\\N','N/A','-'].includes(s.trim())?null:s.trim();
const code=(s,re)=>{const c=clean(s)?.toUpperCase();return c&&re.test(c)?c:null;};
async function api(path,method='GET',body){
  const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${process.env.ARCHIVE_TOKEN}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error(`${method} ${path}: HTTP ${r.status}. Retry the import; existing rows are preserved.`);
  return r.status===204?null:(await r.json()).data;
}
async function download(name){const r=await fetch(source+name,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Download ${name}: ${r.status}`);return r.text();}
function id(collection,key){const h=createHash('sha256').update(`openflights:${collection}:${key}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
const [airlineCsv,planeCsv,license]=await Promise.all(['airlines.dat','planes.dat','LICENSE'].map(download));
const airlineRows=parse(airlineCsv,{skip_empty_lines:true}),planeRows=parse(planeCsv,{skip_empty_lines:true});
if(airlineRows.length<1000||planeRows.length<100)throw new Error('Unexpected source size; no changes made.');
const candidates={
  airlines:airlineRows.filter(r=>r.length===8&&clean(r[1])&&!['unknown','privateflight'].includes(normal(r[1]))).map(r=>({id:id('airlines',r[0]),name:clean(r[1]),iata:code(r[3],/^[A-Z0-9]{2}$/),icao:code(r[4],/^[A-Z]{3}$/)})).filter(r=>r.iata||r.icao),
  aircraft_types:planeRows.filter(r=>r.length===3&&clean(r[0])).map(r=>({id:id('aircraft_types',normal(r[0])),name:clean(r[0]),icao:code(r[2],/^[A-Z0-9]{2,4}$/)})),
};
const report={source:'OpenFlights',license:'ODbL-1.0',retrievedAt:new Date().toISOString(),sourceUrl:'https://openflights.org/data',hashes:{airlines:createHash('sha256').update(airlineCsv).digest('hex'),planes:createHash('sha256').update(planeCsv).digest('hex')},collections:{}};
const plans={};
for(const collection of Object.keys(candidates)){
  const before=await api(`/items/${collection}?limit=-1&sort=id`);
  const seen=[...before],added=[],skipped=[];
  for(const candidate of candidates[collection]){
    const match=seen.find(r=>r.id===candidate.id||normal(r.name)===normal(candidate.name)||(candidate.icao&&r.icao===candidate.icao));
    if(match){skipped.push({name:candidate.name,matched:match.id,reason:'ID, name or ICAO already exists'});continue;}
    seen.push(candidate);added.push(candidate);
  }
  plans[collection]={before,added};
  report.collections[collection]={sourceRows:collection==='airlines'?airlineRows.length:planeRows.length,eligible:candidates[collection].length,existing:before.length,adding:added.length,skipped};
  console.log(`${collection}: ${before.length} existing; ${added.length} to add; ${skipped.length} duplicates; ${report.collections[collection].sourceRows-candidates[collection].length} excluded (no usable code/name).`);
}
if(!apply){console.log('Preview only. Run with --apply to import.');process.exit(0);}
// Publish only source-derived reference data; never export personal flights or photos.
await mkdir(output,{recursive:true});
await writeFile(new URL('LICENSE.txt',output),license);
await writeFile(new URL('reference-data.json',output),JSON.stringify({source:report.source,license:report.license,sourceUrl:report.sourceUrl,retrievedAt:report.retrievedAt,...candidates},null,2));
await writeFile(new URL('NOTICE.txt',output),'Contains information from OpenFlights (https://openflights.org/data), available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nThe accompanying reference-data.json is a transformed extract under ODbL 1.0. Names and supported codes are retained; missing codes are null. Airlines without a usable IATA/ICAO code and unknown/private-flight placeholders are omitted. Historical airlines are included. Active status is not inferred. No personal flight logs or photos are included. Manufacturer is not inferred.\n');
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
await writeFile(new URL('../.local/openflights-import-before.json',import.meta.url),JSON.stringify(plans,null,2));
for(const [collection,{before,added}] of Object.entries(plans)){
  for(let i=0;i<added.length;i+=100){await api(`/items/${collection}`,'POST',added.slice(i,i+100));console.log(`${collection}: imported ${Math.min(i+100,added.length)}/${added.length}`);}
  const after=await api(`/items/${collection}?limit=-1&sort=id`);
  const byId=new Map(after.map(r=>[r.id,r]));
  if(before.some(r=>JSON.stringify(byId.get(r.id))!==JSON.stringify(r)))throw new Error(`Existing ${collection} records changed during import; review required.`);
  if(added.some(r=>!byId.has(r.id)))throw new Error(`Missing imported ${collection} rows.`);
  report.collections[collection].total=after.length;
}
await writeFile(new URL('../.local/openflights-import-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log('Import verified. Existing records unchanged. Report: .local/openflights-import-report.json');
