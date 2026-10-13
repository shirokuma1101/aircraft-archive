import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {myFr24Migration} from '../src/lib/flight-migration';
import type {Row} from '../src/lib/model';

async function main() {
  if(!process.argv.includes('--confirm-myfr24'))throw new Error('Confirm that legacy imported records came from myFlightradar24 with --confirm-myfr24.');
  const url=process.env.MIGRATION_DIRECTUS_URL||'http://localhost:12001';
  const target=new URL(url);
  if(!['localhost','127.0.0.1'].includes(target.hostname))throw new Error('This migration is restricted to the local Directus instance.');
  if(!process.env.ARCHIVE_TOKEN)throw new Error('ARCHIVE_TOKEN is required');
  async function api(path:string,method='GET',body?:unknown) {
    const response=await fetch(url+path,{method,headers:{Authorization:`Bearer ${process.env.ARCHIVE_TOKEN}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(!response.ok)throw new Error(`${method} ${path}: ${response.status}`);
    return (await response.json()).data;
  }
  const before:Row[]=await api('/items/flights?limit=-1');
  const changes=before.map(myFr24Migration).filter(r=>r!==null);
  console.log(JSON.stringify({total:before.length,candidates:changes.length,apply:process.argv.includes('--apply')}));
  if(!changes.length||!process.argv.includes('--apply'))return;
  await mkdir('.local',{recursive:true});
  await writeFile(`.local/flights-before-myfr24-${Date.now()}.json`,JSON.stringify(before,null,2),{flag:'wx'});
  await api('/items/flights','PATCH',changes);
  const after:Row[]=await api('/items/flights?limit=-1');
  assert.equal(after.length,before.length);
  const updates=new Map(changes.map(r=>[r.id,r]));
  for(const original of before) {
    const actual=after.find(r=>r.id===original.id)!;
    const expected:Row={...original,...updates.get(original.id)};
    for(const key of Object.keys(expected)) {
      if(key.endsWith('_departure')||key.endsWith('_arrival'))assert.equal(actual[key]?Date.parse(actual[key]):null,expected[key]?Date.parse(expected[key]):null);
      else assert.deepEqual(actual[key],expected[key]);
    }
  }
  assert.equal(after.map(myFr24Migration).filter(Boolean).length,0);
  console.log(JSON.stringify({migrated:changes.length,verified:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
