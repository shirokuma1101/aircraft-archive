import {parse} from 'csv-parse/sync';
import {createHash} from 'node:crypto';
import tzLookup from 'tz-lookup';
const clean=v=>v&&v!=='\\N'?v.trim():null;
const validZone=z=>{try{if(!z)return false;new Intl.DateTimeFormat('en',{timeZone:z});return true;}catch{return false;}};
export function airportId(key){const h=createHash('sha256').update(`openflights:airports:${key}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export function parseAirports(csv){
  const rows=parse(csv,{skip_empty_lines:true,bom:true}),airports=[],inferred=[],seen=new Set();
  for(const row of rows){
    if(row.length!==14)throw new Error('Unexpected airport column count');
    if(row[12]!=='airport')continue;
    const [sourceId,name,,country,iata,icao,lat,lon,,,,zone]=row;
    const latitude=Number(lat),longitude=Number(lon);
    if(!/^\d+$/.test(sourceId)||!clean(name)||!clean(lat)||!clean(lon)||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw new Error(`Invalid airport: ${sourceId}`);
    const id=airportId(sourceId);if(seen.has(id))throw new Error(`Duplicate source ID: ${sourceId}`);seen.add(id);
    let timezone=clean(zone);if(!validZone(timezone)){timezone=tzLookup(latitude,longitude);inferred.push({sourceId,name,timezone});}
    airports.push({id,name:clean(name),country:clean(country),iata:clean(iata),icao:clean(icao),latitude,longitude,timezone});
  }
  return {airports,inferred};
}
function near(a,b){const rad=Math.PI/180,dlat=(a.latitude-b.latitude)*rad,dlon=(a.longitude-b.longitude)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))<100;}
export function mapAirport(old,airports){
  const exact=airports.find(a=>a.id===old.id);if(exact)return exact;
  const icao=old.icao?airports.filter(a=>a.icao===old.icao):[];if(icao.length===1&&near(old,icao[0]))return icao[0];
  // IATA codes can be reassigned; require a unique, geographically close match.
  const iata=old.iata?airports.filter(a=>a.iata===old.iata):[];if(iata.length===1&&near(old,iata[0]))return iata[0];
  return null;
}
