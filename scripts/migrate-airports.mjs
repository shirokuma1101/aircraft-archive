import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseAirports,mapAirport} from './openflights-airports.mjs';
const apply=process.argv.includes('--apply'),replace=process.argv.includes('--replace');
const base=process.env.DIRECTUS_URL;
if(!base||!process.env.ARCHIVE_TOKEN)throw new Error('DIRECTUS_URL and ARCHIVE_TOKEN required');
const source='https://raw.githubusercontent.com/jpatokal/openflights/master/data/';
async function download(file){const r=await fetch(source+file,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Download ${file}: ${r.status}`);return r.text();}
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${process.env.ARCHIVE_TOKEN}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`${method} ${path}: HTTP ${r.status}`);return r.status===204?null:(await r.json()).data;}
const [csv,license,before,flights,photos]=await Promise.all([download('airports.dat'),download('LICENSE'),api('/items/airports?limit=-1&sort=id'),api('/items/flights?limit=-1&sort=id'),api('/items/photos?limit=-1&sort=id')]);
const {airports,inferred}=parseAirports(csv);
if(airports.length<5000)throw new Error('Unexpected airport count. No changes made.');
const ids=new Set(airports.map(a=>a.id)),oldById=new Map(before.map(a=>[a.id,a]));
const mapping=new Map(before.map(a=>[a.id,mapAirport(a,airports)?.id]));
const patches={flights:[],photos:[]},unmatched=[];
for(const [collection,records,fields] of [['flights',flights,['origin','destination']],['photos',photos,['airport']]]){
  for(const row of records){
    const patch={id:row.id};
    for(const field of fields){if(!row[field])continue;const target=mapping.get(row[field]);if(!target)unmatched.push({collection,id:row.id,field,airport:oldById.get(row[field])});else if(target!==row[field])patch[field]=target;}
    if(Object.keys(patch).length>1)patches[collection].push(patch);
  }
}
const existingIds=new Set(before.map(a=>a.id)),matchedIds=new Set([...mapping.values()].filter(Boolean));
const additions=airports.filter(a=>!existingIds.has(a.id)&&(replace||!matchedIds.has(a.id)));
const removals=replace?before.filter(a=>!ids.has(a.id)):[];
const summary={source:'OpenFlights',retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(csv).digest('hex'),airports:airports.length,existing:before.length,adding:additions.length,removing:removals.length,flightReferences:replace?patches.flights.length:0,photoReferences:replace?patches.photos.length:0,inferredTimezones:inferred.length,unmatchedReferences:unmatched.length};
console.log(JSON.stringify(summary,null,2));
if(replace&&unmatched.length){console.log(JSON.stringify(unmatched,null,2));throw new Error('Referenced airports could not be matched. No changes made.');}
if(!apply){console.log('Preview only. Use --apply; add --replace to replace old airports and remap references.');process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=new URL(`../.local/airport-migration-${stamp}/`,import.meta.url);
await mkdir(backup,{recursive:true});
await writeFile(new URL('before.json',backup),JSON.stringify({airports:before,flights,photos},null,2));
await writeFile(new URL('plan.json',backup),JSON.stringify({summary,mapping:[...mapping],patches,removing:removals.map(a=>a.id),inferred},null,2));
const output=new URL('../public/openflights/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('airports.json',output),JSON.stringify({sourceUrl:'https://openflights.org/data',license:'ODbL-1.0',retrievedAt:summary.retrievedAt,sha256:summary.sha256,source:'OpenFlights',airports,inferred},null,2));
await writeFile(new URL('LICENSE.txt',output),license);
await writeFile(new URL('AIRPORTS-NOTICE.txt',output),'Contains information from OpenFlights (https://openflights.org/data), available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nThe accompanying airports.json is a transformed airports.dat extract under ODbL 1.0. Only airport records are included. Missing or invalid IANA timezones are inferred from coordinates using tz-lookup and listed in inferred. No private flight or photo records are included.\n');
for(let i=0;i<additions.length;i+=100){await api('/items/airports','POST',additions.slice(i,i+100));console.log(`Added ${Math.min(i+100,additions.length)}/${additions.length} airports`);}
if(replace){
  for(const collection of ['flights','photos'])for(let i=0;i<patches[collection].length;i+=100)await api(`/items/${collection}`,'PATCH',patches[collection].slice(i,i+100));
  for(const collection of ['flights','photos']){
    const current=await api(`/items/${collection}?limit=-1`),fields=collection==='flights'?['origin','destination']:['airport'];
    if(current.some(r=>fields.some(f=>r[f]&&!ids.has(r[f]))))throw new Error('References not verified; old airports have NOT been deleted.');
  }
  for(let i=0;i<removals.length;i+=100){await api('/items/airports','DELETE',removals.slice(i,i+100).map(a=>a.id));console.log(`Removed ${Math.min(i+100,removals.length)}/${removals.length} old airports`);}
}
const [after,afterFlights,afterPhotos]=await Promise.all([api('/items/airports?limit=-1'),api('/items/flights?limit=-1'),api('/items/photos?limit=-1')]);
if(replace&&(after.length!==airports.length||after.some(a=>!ids.has(a.id))))throw new Error('Final airport verification failed');
for(const [collection,original,current] of [['flights',flights,afterFlights],['photos',photos,afterPhotos]]){
  if(original.length!==current.length)throw new Error(`${collection} count changed`);
  for(const row of original){const expected={...row,...(replace?patches[collection].find(p=>p.id===row.id):{})},actual=current.find(r=>r.id===row.id);if(!actual||Object.keys(expected).some(k=>JSON.stringify(expected[k])!==JSON.stringify(actual[k])))throw new Error(`${collection} changed unexpectedly: ${row.id}`);}
}
await writeFile(new URL('result.json',backup),JSON.stringify({...summary,total:after.length,verified:true},null,2));
console.log(`Verified ${after.length} airports; flights and photos preserved. Backup: ${backup.pathname}`);
