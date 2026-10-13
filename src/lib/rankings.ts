import type {Archive,Row} from './model';
import {airportCode} from './model';

export type RankingEntry={key:string;name:string;detail?:string;count:number;rank:number};
export type Ranking={key:string;title:string;note:string;entries:RankingEntry[]};
const normalize=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const order=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
export function flightRankings(data:Archive,flights:Row[]):Ranking[] {
  const airports=new Map((data.airports||[]).map(r=>[r.id,r]));
  const airlines=new Map((data.airlines||[]).map(r=>[r.id,r]));
  const aircraft=new Map((data.aircraft||[]).map(r=>[r.id,r]));
  const types=new Map((data.aircraft_types||[]).map(r=>[r.id,r]));
  const groups:Record<string,Map<string,RankingEntry>>=Object.fromEntries(['airports','routes','airlines','types','aircraft'].map(k=>[k,new Map()]));
  function add(group:string,key:string,name:string,detail?:string) {
    if(!name.trim())return;
    const existing=groups[group].get(key);
    if(existing)existing.count++;else groups[group].set(key,{key,name,detail,count:1,rank:0});
  }
  for(const f of flights) {
    if(f.status!=='flown')continue;
    for(const id of [f.origin,f.destination]) {
      const a=airports.get(id);
      if(a)add('airports',id,airportCode(a)==='—'?a.name:airportCode(a),a.name);
    }
    const ids=[f.origin,f.destination].sort(),a=airports.get(ids[0]),b=airports.get(ids[1]);
    if(a&&b)add('routes',JSON.stringify(ids),`${airportCode(a)==='—'?a.name:airportCode(a)} ↔ ${airportCode(b)==='—'?b.name:airportCode(b)}`,`${a.name} / ${b.name}`);
    // Prefer the recorded airline and registration over the aircraft's current owner or registration.
    const airline=String(f.airline_name||airlines.get(f.airline)?.name||'').trim();
    add('airlines',normalize(airline),airline);
    const plane=aircraft.get(f.aircraft);
    const registration=String(f.registration||plane?.registration||'').trim().toUpperCase();
    add('aircraft',normalize(registration),registration);
    const type=String(types.get(plane?.type)?.name||String(f.notes||'').match(/^機種（インポート元）:\s*(.+)$/m)?.[1]||'').trim();
    add('types',normalize(type),type);
  }
  const definitions=[['airports','空港','出発・到着をそれぞれ1回として集計'],['routes','ルート','往復を同じルートとして集計'],['airlines','航空会社','記録された航空会社名で集計'],['types','機種','登録機種・インポート時の機種名で集計'],['aircraft','機体','記録された機体番号で集計']];
  return definitions.map(([key,title,note])=>{
    const entries=[...groups[key].values()].sort((a,b)=>b.count-a.count||order.compare(a.name,b.name)||a.key.localeCompare(b.key));
    entries.forEach((entry,i)=>{entry.rank=i>0&&entries[i-1].count===entry.count?entries[i-1].rank:i+1;});
    return {key,title,note,entries};
  });
}
