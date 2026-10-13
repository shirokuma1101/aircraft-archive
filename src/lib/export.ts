import {formatInTimeZone} from 'date-fns-tz';
import {schema,statuses,type Archive} from './model';
import {cabinName} from './cabin';

// Quote every cell and neutralize spreadsheet formulas in user-entered strings.
export function csvCell(value:unknown) {
  let text=value==null?'':String(value);
  if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
}
export function flightCsv(data:Archive) {
  const airports=new Map(data.airports.map(r=>[r.id,r]));
  const airlines=new Map(data.airlines.map(r=>[r.id,r]));
  const aircraft=new Map(data.aircraft.map(r=>[r.id,r]));
  const types=new Map(data.aircraft_types.map(r=>[r.id,r]));
  const headers=['ID','便名','状態','出発空港名','出発IATA','出発ICAO','到着空港名','到着IATA','到着ICAO','出発タイムゾーン','到着タイムゾーン','予定出発日時','予定到着日時','実際の出発日時','実際の到着日時','航空会社','機種','機体番号','座席','搭乗クラス','メモ','インポート元'];
  const records=[...data.flights].sort((a,b)=>String(a.actual_departure||a.scheduled_departure||'').localeCompare(String(b.actual_departure||b.scheduled_departure||''))||a.id.localeCompare(b.id)).map(f=>{
    const from=airports.get(f.origin),to=airports.get(f.destination),plane=aircraft.get(f.aircraft);
    const date=(value:string|undefined,zone:string|undefined)=>value?formatInTimeZone(value,zone||'UTC',"yyyy-MM-dd'T'HH:mm:ss.SSSXXX"):'';
    return [f.id,f.flight_number,statuses[f.status]||f.status,from?.name,from?.iata,from?.icao,to?.name,to?.iata,to?.icao,from?.timezone,to?.timezone,date(f.scheduled_departure,from?.timezone),date(f.scheduled_arrival,to?.timezone),date(f.actual_departure,from?.timezone),date(f.actual_arrival,to?.timezone),f.airline_name||airlines.get(f.airline)?.name,types.get(plane?.type)?.name||String(f.notes||'').match(/^機種（インポート元）:\s*(.+)$/m)?.[1],f.registration||plane?.registration,f.seat,cabinName(f.cabin,f.import_source),f.notes,f.import_source];
  });
  return '\uFEFF'+[headers,...records].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function archiveJson(data:Archive,now=new Date()) {
  const collections=Object.fromEntries(Object.entries(schema).map(([collection,definition])=>[collection,(data[collection]||[]).map(row=>Object.fromEntries(['id',...Object.keys(definition.fields)].map(key=>[key,row[key]??null])))]));
  return JSON.stringify({format:'aircraft-archive',version:1,exported_at:now.toISOString(),includes_private_photo_metadata:true,includes_image_files:false,collections},null,2);
}
