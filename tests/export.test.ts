import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'csv-parse/sync';
import {flightCsv,archiveJson} from '../src/lib/export';
const data={flights:[{id:'f',flight_number:'JL1',status:'flown',origin:'a',destination:'b',scheduled_departure:'2025-01-01T00:00:00Z',actual_departure:'2025-01-01T00:05:00Z',notes:'a,"b"\n機種（インポート元）: A320',seat:'01A',cabin:'エコノミー',registration:'JA001'}],airports:[{id:'a',name:'Airport A',timezone:'Asia/Tokyo',iata:'AAA'},{id:'b',name:'Airport B',timezone:'UTC',iata:'BBB'}],airlines:[],aircraft:[],aircraft_types:[],photos:[{id:'p',title:'Private',visibility:'private',file:'image-id',token:'must-not-export'}]};
test('CSV preserves quoted multiline data, local offsets and empty unknown times',()=>{
  const csv=flightCsv(data);assert.ok(csv.startsWith('\uFEFF'));
  const [row]=parse(csv,{bom:true,columns:true}) as Record<string,string>[];
  assert.equal(row['予定出発日時'],'2025-01-01T09:00:00.000+09:00');assert.equal(row['実際の出発日時'],'2025-01-01T09:05:00.000+09:00');assert.equal(row['予定到着日時'],'');assert.equal(row['メモ'],data.flights[0].notes);assert.equal(row['座席'],'01A');assert.equal(row['機種'],'A320');
});
test('CSV neutralizes formulas and JSON retains raw strings and schema fields only',()=>{
  const input={...data,flights:[{...data.flights[0],notes:' =HYPERLINK("x")'}]};
  const [row]=parse(flightCsv(input),{bom:true,columns:true}) as Record<string,string>[];assert.equal(row['メモ'],"' =HYPERLINK(\"x\")");
  const output=JSON.parse(archiveJson(input));assert.equal(output.collections.flights[0].notes,input.flights[0].notes);assert.equal(output.collections.photos[0].visibility,'private');assert.equal(output.collections.photos[0].token,undefined);assert.equal(output.includes_image_files,false);
});
