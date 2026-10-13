import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord} from '../src/lib/validation';
import {isPending} from '../src/lib/model';
import {routePoints,distance} from '../src/lib/geo';
import {limitedBody} from '../src/lib/body';
const flight={flight_number:'NH1',status:'planned',origin:'11111111-1111-4111-8111-111111111111',destination:'22222222-2222-4222-8222-222222222222',scheduled_departure:'2026-10-03T10:00:00+09:00',scheduled_arrival:'2026-10-03T12:00:00+09:00'};
test('arrival compares actual instants across date line and timezone offsets',()=>{
  assert.doesNotThrow(()=>validateRecord('flights',{...flight,scheduled_departure:'2026-10-03T17:00:00+09:00',scheduled_arrival:'2026-10-03T10:00:00-07:00'}));
  assert.throws(()=>validateRecord('flights',{...flight,scheduled_arrival:'2026-10-03T09:00:00+09:00'}));
});
test('only expired planned flights await confirmation',()=>{
  const row={...flight,id:'test'};
  assert.equal(isPending(row,Date.parse('2026-10-04T00:00:00Z')),true);
  assert.equal(isPending({...row,status:'flown'},Date.parse('2026-10-04T00:00:00Z')),false);
  assert.equal(isPending(row,Date.parse('2026-10-01T00:00:00Z')),false);
});
test('bad visibility, unknown fields and invalid coordinates are rejected',()=>{
  assert.throws(()=>validateRecord('photos',{title:'x',file:flight.origin,visibility:'unlisted'}));
  assert.throws(()=>validateRecord('flights',{...flight,admin:true}));
  assert.throws(()=>validateRecord('airports',{name:'x',latitude:91,longitude:0,timezone:'Asia/Tokyo'}));
  assert.throws(()=>validateRecord('airports',{name:'x',latitude:35,longitude:140,timezone:'Invalid/Zone'}));
});
test('Pacific routes do not jump 360 degrees at the date line',()=>{
  const points=routePoints([35.55,139.78],[37.62,-122.38]);
  for(let i=1;i<points.length;i++)assert.ok(Math.abs(points[i][1]-points[i-1][1])<10);
  const reverse=routePoints([37.62,-122.38],[35.55,139.78]).reverse();
  points.forEach((point,i)=>assert.ok(Math.abs(point[1]-reverse[i][1])<0.00001));
  assert.ok(distance([35.55,139.78],[37.62,-122.38])>8000);
  assert.ok(distance([35.55,139.78],[37.62,-122.38])<9000);
});
test('request body limit also applies without Content-Length',async()=>{
  const request=new Request('http://localhost',{method:'POST',body:'x'.repeat(1025)});
  await assert.rejects(()=>limitedBody(request,1024));
});
