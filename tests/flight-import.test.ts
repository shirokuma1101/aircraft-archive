import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFlightCsv,previewFlights} from '../src/lib/flight-import';
const data={airports:[
  {id:'11111111-1111-4111-8111-111111111111',name:'Haneda',iata:'HND',icao:'RJTT',timezone:'Asia/Tokyo'},
  {id:'22222222-2222-4222-8222-222222222222',name:'San Francisco',iata:'SFO',icao:'KSFO',timezone:'America/Los_Angeles'},
  {id:'33333333-3333-4333-8333-333333333333',name:'Chitose',iata:'CTS',icao:'RJCC',timezone:'Asia/Tokyo'},
],airlines:[],aircraft:[],flights:[]};
const header='Date,Flight number,From,To,Dep time,Arr time,Duration,Airline,Aircraft,Registration,Seat number,Flight class,Note';
const csv=header+'\n2025-01-01,NH1,Tokyo (HND/RJTT),San Francisco (SFO/KSFO),17:00,10:00,10:00,ANA,B777,JA123A,1A,1,"hello, world"';
test('myFR24 BOM, quoted comma and date-line times resolve using local airport time',()=>{
  const p=previewFlights('\uFEFF'+csv,undefined,{},data);
  assert.equal(p.source,'myFlightradar24');assert.deepEqual(p.entries[0].errors,[]);
  const r=p.entries[0].record!;
  assert.equal(r.actual_departure,'2025-01-01T08:00:00.000Z');assert.equal(r.actual_arrival,'2025-01-01T18:00:00.000Z');
  assert.match(r.notes,/hello, world/);assert.match(r.notes,/B777/);assert.equal(r.registration,'JA123A');assert.equal(r.scheduled_departure,null);assert.equal(r.cabin,'エコノミー');
});
test('OpenFlights embedded time, duration, class and quoted multiline notes',()=>{
  const c='Date,From,To,Flight_Number,Duration,Class,Note,From_OID\n2025-01-01 09:00,HND,CTS,NH1,01:30,Y,"line1\nline2",1';
  const p=previewFlights(c,undefined,{},data);assert.equal(p.source,'OpenFlights');assert.deepEqual(p.entries[0].errors,[]);
  assert.equal(p.entries[0].record!.cabin,'エコノミー');assert.equal(p.entries[0].record!.notes,'line1\nline2');
});
test('missing times are not invented; per-row corrections allow importing',()=>{
  const c='Date,From,To,Flight_Number\n2025-01-01,HND,CTS,NH1';
  assert.ok(previewFlights(c,undefined,{},data).entries[0].errors.length);
  const p=previewFlights(c,undefined,{'0':{departure:'09:00',duration:'01:30'}},data);
  assert.deepEqual(p.entries[0].errors,[]);
});
test('CSV duplicates and existing records skipped, formatting of flight number normalized',()=>{
  const r=previewFlights(csv,undefined,{},data).entries[0].record!;
  assert.equal(previewFlights(csv,undefined,{}, {...data,flights:[{...r,id:'x',flight_number:'NH 1'}]}).entries[0].duplicate,true);
  assert.equal(previewFlights(csv+'\n'+csv.split('\n')[1],undefined,{},data).entries[1].duplicate,true);
});
test('unknown and ambiguous airports, missing arrival date, malformed dates and DST are errors',()=>{
  for(const overrides of [{origin:'XXX'},{date:'2025-02-30'},{duration:'',arrival:'10:00'},{duration:'0:00'},{departure:'25:00'},{arrival:'09:00'},{origin:'HND',destination:'HND'},{status:'unknown'}]) {
    assert.ok(previewFlights(csv,undefined,{'0':overrides},data).entries[0].errors.length,JSON.stringify(overrides));
  }
  assert.ok(previewFlights(csv,undefined,{}, {...data,airports:[...data.airports,{...data.airports[0],id:'other'}]}).entries[0].errors.length);
  for(const [date,departure] of [['2025-03-09','02:30'],['2025-11-02','01:30']])assert.ok(previewFlights(csv,undefined,{'0':{origin:'SFO',destination:'HND',date,departure,duration:'10:00',arrival:''}},data).entries[0].errors.length);
});
test('explicit arrival dates and future planned status; offset disambiguates DST',()=>{
  const p=previewFlights(csv,undefined,{'0':{origin:'SFO',destination:'HND',departure:'2025-11-02T01:30:00-08:00',arrival:'2025-11-03T04:30:00+09:00',duration:''}},data,',',0);
  assert.deepEqual(p.entries[0].errors,[]);assert.equal(p.entries[0].record!.status,'planned');
});
test('generic CSV supports custom mappings, delimiters and Japanese headings',()=>{
  const c='搭乗日;番号;出発空港;到着空港;出発時刻;所要時間\n2025-01-01;NH1;HND;CTS;09:00;01:30';
  const parsed=readFlightCsv(c,';');
  const p=previewFlights(c,{...parsed.mapping,flight_number:'番号'},{},data,';');assert.deepEqual(p.entries[0].errors,[]);
});
test('malformed CSV, duplicate headers, huge files, and more than 500 rows rejected',()=>{
  for(const c of ['Date,Date\na,b','Date,From\na','Date,From\n"unterminated','a\n'+'x'.repeat(2*1024*1024),'a\n'+'x\n'.repeat(501)])assert.throws(()=>readFlightCsv(c));
});
