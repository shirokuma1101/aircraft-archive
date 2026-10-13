import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flightRankings} from '../src/lib/rankings';
const data={airports:[{id:'a',name:'Airport A',iata:'AAA'},{id:'b',name:'Airport B',iata:'BBB'}],airlines:[{id:'al',name:'Airline'}],aircraft:[{id:'p',registration:'NEW',type:'t'}],aircraft_types:[{id:'t',name:'Boeing 777'}]};
const f={id:'1',status:'flown',origin:'a',destination:'b',airline:'al',aircraft:'p',registration:'OLD'};
test('rankings count only flown flights, aggregate reverse routes and give equal counts equal ranks',()=>{
  const result=flightRankings(data,[f,{...f,id:'2',origin:'b',destination:'a'},{...f,status:'planned'},{...f,status:'cancelled'}]);
  assert.deepEqual(result[0].entries.map(e=>[e.count,e.rank]),[[2,1],[2,1]]);
  assert.equal(result[1].entries.length,1);assert.equal(result[1].entries[0].count,2);
  assert.equal(result[4].entries[0].name,'OLD');
  assert.equal(result[3].entries[0].name,'Boeing 777');
});
test('imported names work without master relations and missing values are excluded',()=>{
  const rows=[{id:'1',status:'flown',airline_name:'Example Air',registration:'ja123a',notes:'memo\n機種（インポート元）: Airbus A320'},{id:'2',status:'flown',airline_name:' example air ',registration:'JA123A',notes:'機種（インポート元）: Airbus A320'},{id:'3',status:'flown'}];
  const result=flightRankings(data,rows);
  assert.equal(result[2].entries.length,1);assert.equal(result[2].entries[0].count,2);
  assert.equal(result[3].entries[0].name,'Airbus A320');assert.equal(result[3].entries[0].count,2);
  assert.equal(result[4].entries[0].count,2);assert.equal(result[0].entries.length,0);
  assert.ok(flightRankings(data,[]).every(r=>r.entries.length===0));
});
test('recorded airline names take precedence over current master data',()=>{
  const result=flightRankings(data,[{...f,airline_name:'Historical airline'}]);
  assert.equal(result[2].entries[0].name,'Historical airline');
});
