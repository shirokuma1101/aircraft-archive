import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flightRoutes,routeColor} from '../src/lib/flight-routes';
import {cabinName} from '../src/lib/cabin';
import {myFr24Migration} from '../src/lib/flight-migration';
import {importId} from '../src/lib/flight-import-id';
import {validateRecord} from '../src/lib/validation';
import {readFlightCsv,previewFlights,flightKey} from '../src/lib/flight-import';

const legacy={id:'',flight_number:'NH1',status:'flown',origin:'11111111-1111-4111-8111-111111111111',destination:'22222222-2222-4222-8222-222222222222',scheduled_departure:'2025-01-01T00:00:00Z',scheduled_arrival:'2025-01-01T01:30:00Z',cabin:'4'};
legacy.id=importId(legacy);
test('route frequency combines both directions, separates plans and excludes cancellations',()=>{
  const rows=[legacy,{...legacy,id:'2',origin:legacy.destination,destination:legacy.origin},{...legacy,id:'3',status:'planned'},{...legacy,id:'4',status:'cancelled'},{...legacy,id:'5',status:'not_taken'}];
  const groups=flightRoutes(rows);
  assert.equal(groups.length,1);assert.equal(groups[0].flown,2);assert.equal(groups[0].planned,1);
  assert.notEqual(routeColor(1,10),routeColor(10,10));
  assert.equal(routeColor(1,1),routeColor(1,10));
  const luminance=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).reduce((a,b)=>a+b);
  assert.ok(luminance(routeColor(1,10))>luminance(routeColor(5,10)));
  assert.ok(luminance(routeColor(5,10))>luminance(routeColor(10,10)));
});
test('migration preserves flight identity and is idempotent; skips unrelated or existing actuals',()=>{
  const patch=myFr24Migration(legacy)!;
  const migrated={...legacy,...patch};
  assert.equal(patch.cabin,'エコノミー＋');assert.equal(patch.scheduled_departure,null);
  assert.equal(patch.actual_departure,legacy.scheduled_departure);
  assert.equal(flightKey(migrated),flightKey(legacy));assert.equal(importId(migrated),legacy.id);
  assert.equal(myFr24Migration(migrated),null);
  for(const changes of [{id:'manual'},{import_source:'OpenFlights'},{status:'planned'},{actual_arrival:'2025-01-01T02:00:00Z'}])assert.equal(myFr24Migration({...legacy,...changes}),null);
});
test('actual-only records are valid, but planned or incomplete pairs require correction',()=>{
  const {id,...record}={...legacy,...myFr24Migration(legacy)};
  assert.doesNotThrow(()=>validateRecord('flights',record));
  for(const changes of [{status:'planned'},{actual_arrival:null},{actual_departure:null},{actual_arrival:legacy.scheduled_departure}])assert.throws(()=>validateRecord('flights',{...record,...changes}));
});
test('FR24 codes use names without assuming arbitrary numeric cabin values are FR24',()=>{
  assert.deepEqual(['1','2','3','4','5'].map(c=>cabinName(c,'myFlightradar24')),['エコノミー','ビジネス','ファースト','エコノミー＋','プライベート']);
  assert.equal(cabinName('1','CSV'),'1');assert.equal(cabinName('99','myFlightradar24'),'99');
});
test('flown records with complete actuals can retain a known scheduled departure only',()=>{
  const {id,...record}={...legacy,...myFr24Migration(legacy)};
  assert.doesNotThrow(()=>validateRecord('flights',{...record,scheduled_departure:legacy.scheduled_departure}));
  assert.throws(()=>validateRecord('flights',{...record,status:'planned',scheduled_departure:legacy.scheduled_departure}));
  assert.throws(()=>validateRecord('flights',{...record,actual_departure:null,actual_arrival:null,scheduled_departure:legacy.scheduled_departure}));
});
test('generic Dep time headers remain scheduled; explicitly selected FR24 uses actual and deduplicates migrated data',()=>{
  const csv='Date,Flight number,From,To,Dep time,Duration,Class\n2025-01-01,NH1,HND,CTS,09:00,01:30,4';
  const data={airports:[{id:legacy.origin,name:'Haneda',iata:'HND',timezone:'Asia/Tokyo'},{id:legacy.destination,name:'Chitose',iata:'CTS',timezone:'Asia/Tokyo'}],airlines:[],aircraft:[],flights:[{...legacy,...myFr24Migration(legacy)}]};
  assert.equal(readFlightCsv(csv).source,'CSV');
  const generic=previewFlights(csv,undefined,{},data).entries[0];
  assert.equal(generic.record!.actual_departure,null);assert.equal(generic.duplicate,true);
  const actual=previewFlights(csv,undefined,{},data,',',Date.now(),'myFlightradar24').entries[0];
  assert.deepEqual(actual.errors,[]);assert.equal(actual.duplicate,true);assert.equal(actual.record!.cabin,'エコノミー＋');assert.equal(actual.record!.scheduled_departure,null);
  const planned=previewFlights(csv,undefined,{},data,',',0,'myFlightradar24').entries[0];
  assert.equal(planned.record!.status,'planned');assert.equal(planned.record!.actual_departure,null);
});
