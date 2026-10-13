import {cabinName} from './cabin';
import {parse} from 'csv-parse/sync';
import {formatInTimeZone,fromZonedTime} from 'date-fns-tz';
import {validateRecord} from './validation';
import type {Row} from './model';

import {importFields,type ImportField,type ImportValues,type ImportMapping,type ImportEntry} from './flight-import-fields';
const aliases:Record<ImportField,string[]> = {
  date:['date','departuredate','出発日','搭乗日'], flight_number:['flightnumber','flight','flightno','便名'],
  origin:['from','origin','departureairport','出発空港'], destination:['to','destination','arrivalairport','到着空港'],
  departure:['deptime','departuretime','departure','scheduleddeparture','出発時刻','出発日時'],
  arrival:['arrtime','arrivaltime','arrival','scheduledarrival','到着時刻','到着日時'],arrival_date:['arrivaldate','到着日'],
  duration:['duration','flighttime','所要時間'],airline_name:['airline','airlinename','航空会社'],
  registration:['registration','tailnumber','機体番号'],aircraft_type:['aircraft','plane','aircrafttype','機種'],
  seat:['seat','seatnumber','座席'],cabin:['class','flightclass','cabin','クラス'],status:['status','状態'],notes:['note','notes','comment','メモ'],
};
const normalized=(s:string)=>s.toLowerCase().replace(/[\s_\-]/g,'');
export function readFlightCsv(csv:string,delimiter= ',') {
  if(![',',';','\t'].includes(delimiter))throw new Error('区切り文字を確認してください。');
  if(Buffer.byteLength(csv,'utf8')>2*1024*1024)throw new Error('CSVは2MB以下にしてください。');
  let table:string[][];
  try{table=parse(csv,{bom:true,delimiter,skip_empty_lines:true,trim:true,max_record_size:64000});}
  catch{throw new Error('CSVを読み込めません。区切り文字、引用符、列数を確認してください。');}
  if(table.length<2||table.length>501)throw new Error('見出し行付きのCSVを選択してください（1〜500件）。');
  const headers=table[0];
  if(headers.length>80||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error('列名は空欄や重複を避け、80列以内にしてください。');
  const mapping:ImportMapping={};
  for(const field of Object.keys(importFields) as ImportField[]) {
    const header=headers.find(h=>aliases[field].includes(normalized(h)));
    if(header)mapping[field]=header;
  }
  const source=headers.some(h=>['flightclass','depid'].includes(normalized(h)))?'myFlightradar24':headers.some(h=>normalized(h)==='fromoid')?'OpenFlights':'CSV';
  return {headers,rows:table.slice(1),mapping,source};
}
function day(value:string) {
  let result=value;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(value)){const [m,d,y]=value.split('/');result=`${y}-${m}-${d}`;}
  if(/^\d{2}\.\d{2}\.\d{4}$/.test(value)){const [d,m,y]=value.split('.');result=`${y}-${m}-${d}`;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||new Date(`${result}T00:00:00Z`).toISOString().slice(0,10)!==result)throw new Error('日付はYYYY-MM-DD形式で入力してください。年のみの記録は日付の補完が必要です。');
  return result;
}
function instant(value:string,date:string,zone:string) {
  if(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value))throw new Error('日時の形式を確認してください。');
    day(value.slice(0,10));
    return new Date(value).toISOString();
  }
  const parts=value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/);
  const time=parts?parts[2]:value;
  if(!/^\d{2}:\d{2}(?::\d{2})?$/.test(time))throw new Error('時刻が不足または無効です。HH:mmで補完してください。');
  const local=`${day(parts?parts[1]:date)}T${time.length===5?time+':00':time}`;
  const utc=fromZonedTime(local,zone);
  if(!Number.isFinite(utc.getTime())||formatInTimeZone(utc,zone,"yyyy-MM-dd'T'HH:mm:ss")!==local)throw new Error('現地日時が無効です。夏時間の切替も確認してください。');
  // Ambiguous clock times must be explicitly disambiguated with an offset.
  for(const delta of [-120,-60,-30,30,60,120])if(formatInTimeZone(new Date(utc.getTime()+delta*60000),zone,"yyyy-MM-dd'T'HH:mm:ss")===local)throw new Error('夏時間終了時の重複時刻です。日時にUTCオフセットを付けてください。');
  return utc.toISOString();
}
function airport(value:string,airports:Row[]) {
  const code=value.toUpperCase().trim();
  const codes=code.match(/\(([A-Z0-9]{3,4})(?:\/([A-Z0-9]{3,4}))?\)\s*$/);
  const matches=airports.filter(a=>[a.iata,a.icao].some(c=>c&&(c===code||c===codes?.[1]||c===codes?.[2]))||a.name.toLowerCase()===value.toLowerCase());
  if(matches.length!==1)throw new Error(`空港「${value||'未指定'}」を一意に特定できません。登録済みのIATA／ICAOコードを入力してください。`);
  return matches[0];
}
export function flightKey(row:Record<string,any>) {
  return [normalized(String(row.flight_number)),row.origin,row.destination,new Date(row.actual_departure||row.scheduled_departure).toISOString()].join('|');
}
export function previewFlights(csv:string,mapping:ImportMapping|undefined,overrides:Record<string,ImportValues>,data:{airports:Row[];airlines:Row[];aircraft:Row[];flights:Row[]},delimiter=',',now=Date.now(),sourceOverride:'auto'|'myFlightradar24'|'OpenFlights'|'CSV'='auto') {
  const parsed=readFlightCsv(csv,delimiter),map=mapping??parsed.mapping;
  const source=sourceOverride==='auto'?parsed.source:sourceOverride;
  for(const header of Object.values(map))if(header&&!parsed.headers.includes(header))throw new Error('存在しないCSV列が指定されています。');
  const keys=new Set(data.flights.map(flightKey));
  const entries:ImportEntry[]=parsed.rows.map((row,index)=>{
    const values:ImportValues={};
    for(const field of Object.keys(importFields) as ImportField[])values[field]=(overrides[String(index)]?.[field]??(map[field]?row[parsed.headers.indexOf(map[field]!)]:''))?.trim()||'';
    const entry:ImportEntry={index,values,errors:[],warnings:[],duplicate:false};
    try {
      const a=airport(values.origin!,data.airports),b=airport(values.destination!,data.airports);
      const dateParts=values.date!.split(/[T ]/);
      const dep=instant(values.departure||dateParts[1]||'',dateParts[0],a.timezone);
      const duration=values.duration?.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
      if(values.duration&&!duration)throw new Error('所要時間はHH:mmまたはHH:mm:ssで入力してください。');
      const seconds=duration?Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]||0):0;
      if(duration&&(seconds<=0||seconds>48*3600))throw new Error('所要時間は0時間超〜48時間にしてください。');
      let arr:string;
      if(values.arrival_date||/^\d{4}-/.test(values.arrival||'')){
        arr=instant(values.arrival!,values.arrival_date||'',b.timezone);
        if(seconds&&Date.parse(arr)-Date.parse(dep)!==seconds*1000)throw new Error('出発・到着日時と所要時間が一致しません。確認して不要な値を空欄にしてください。');
      }
      else if(seconds){
        arr=new Date(Date.parse(dep)+seconds*1000).toISOString();
        if(values.arrival&&formatInTimeZone(arr,b.timezone,values.arrival.length===5?'HH:mm':'HH:mm:ss')!==values.arrival)throw new Error('到着時刻と所要時間が一致しません。到着日・日時を確認してください。');
        entry.warnings.push('到着日時は出発日時と所要時間から算出しました。');
      }else if(values.arrival){
        throw new Error('到着日または所要時間を補完してください（日付またぎを推測しません）。');
      }else throw new Error('到着日時または所要時間が必要です。');
      const statusMap:Record<string,string>={flown:'flown',planned:'planned',cancelled:'cancelled',canceled:'cancelled',not_taken:'not_taken','搭乗済み':'flown','搭乗予定':'planned','欠航':'cancelled','未搭乗':'not_taken'};
      const status=values.status?statusMap[values.status.toLowerCase()]:Date.parse(arr)<now?'flown':'planned';
      if(!status)throw new Error('状態はflown / planned / cancelled / not_takenで指定してください。');
      if(!values.status)entry.warnings.push(`状態を日時から${status==='flown'?'搭乗済み':'搭乗予定'}に設定しました。`);
      const airline=data.airlines.filter(r=>r.name.toLowerCase()===values.airline_name!.toLowerCase()||[r.iata,r.icao].some(c=>c&&values.airline_name!.endsWith(`(${c})`)));
      const aircraft=data.aircraft.filter(r=>normalized(r.registration)===normalized(values.registration||'')&&values.registration);
      const notes=[values.notes,values.aircraft_type?`機種（インポート元）: ${values.aircraft_type}`:''].filter(Boolean);

      if(values.airline_name&&airline.length!==1)entry.warnings.push('航空会社名を保存します（マスターとの紐付けなし）。');
      if(values.registration&&aircraft.length!==1)entry.warnings.push('機体番号を保存します（マスターとの紐付けなし）。');
      const actual=source==='myFlightradar24'&&status==='flown';
      const record=validateRecord('flights',{flight_number:values.flight_number,status,origin:a.id,destination:b.id,import_source:source,scheduled_departure:actual?null:dep,scheduled_arrival:actual?null:arr,actual_departure:actual?dep:null,actual_arrival:actual?arr:null,airline_name:values.airline_name||null,registration:values.registration||null,airline:airline.length===1?airline[0].id:null,aircraft:aircraft.length===1?aircraft[0].id:null,seat:values.seat||null,cabin:cabinName(values.cabin,source),notes:notes.join('\n')||null});
      const key=flightKey(record);entry.duplicate=keys.has(key);keys.add(key);entry.record=record;
    }catch(error){entry.errors.push(error instanceof Error?error.message:'行を確認してください。');}
    return entry;
  });
  return {headers:parsed.headers,mapping:map,source,entries};
}
