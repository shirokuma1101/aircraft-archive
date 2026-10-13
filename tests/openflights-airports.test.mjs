import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAirports,mapAirport} from '../scripts/openflights-airports.mjs';
const row=(zone='Asia/Tokyo',lat='35.55')=>`2359,"Tokyo Haneda International Airport","Tokyo","Japan","HND","RJTT",${lat},139.78,35,9,"N",${zone==='\\N'?zone:`"${zone}"`},"airport","OurAirports"`;
test('source timezone and stable IDs',()=>{const a=parseAirports(row());assert.equal(a.airports[0].iata,'HND');assert.equal(a.airports[0].timezone,'Asia/Tokyo');assert.equal(a.inferred.length,0);assert.equal(a.airports[0].id,parseAirports(row()).airports[0].id);});
test('infer missing zones; reject invalid coordinates and duplicate IDs',()=>{assert.equal(parseAirports(row('\\N')).inferred.length,1);assert.throws(()=>parseAirports(row('Asia/Tokyo','91')));assert.throws(()=>parseAirports(row()+'\n'+row()));});
test('unique near code matching; ambiguous or remote reuse rejected',()=>{const a=parseAirports(row()).airports[0],old={...a,id:'old'};assert.equal(mapAirport(old,[a]).id,a.id);assert.equal(mapAirport({...old,icao:null},[a]).id,a.id);assert.equal(mapAirport({...old,latitude:-30},[a]),null);assert.equal(mapAirport({...old,icao:null},[a,{...a,id:'other'}]),null);});
