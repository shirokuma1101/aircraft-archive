'use client';
import dynamic from 'next/dynamic';
import {formatInTimeZone} from 'date-fns-tz';
import {airportCode,type Archive} from '@/lib/model';
import {distance} from '@/lib/geo';
import type {EmbedDesign} from '@/lib/embed';
const FlightMap=dynamic(()=>import('./flight-map'),{ssr:false,loading:()=> <div className="embed-loading">地図を読み込んでいます…</div>});
const number=(n:number)=>Math.round(n).toLocaleString('ja-JP');
export default function EmbedWidget({design,data,theme,year,failed}:{design:EmbedDesign;data:Archive;theme:string;year:string;failed:boolean}) {
  const airports=new Map(data.airports.map(a=>[a.id,a]));
  const date=(value:string,airport:string,pattern='yyyy.MM.dd')=>{try{return formatInTimeZone(value,airports.get(airport)?.timezone||'UTC',pattern);}catch{return '—';}};
  const flights=data.flights.filter(f=>!year||date(f.actual_departure||f.scheduled_departure,f.origin,'yyyy')===year).sort((a,b)=>Date.parse(b.actual_departure||b.scheduled_departure)-Date.parse(a.actual_departure||a.scheduled_departure));
  const visited=new Set(flights.flatMap(f=>[f.origin,f.destination]));
  const countries=new Set([...visited].map(id=>airports.get(id)?.country).filter(Boolean));
  const km=flights.reduce((total,f)=>{const a=airports.get(f.origin),b=airports.get(f.destination);return total+(a&&b?distance([a.latitude,a.longitude],[b.latitude,b.longitude]):0);},0);
  return <main className={`embed-widget embed-${theme} embed-${design}`}>
    <header className="embed-heading"><span>AIRCRAFT ARCHIVE</span><span>{year?`${year}年`:'全期間'} · 搭乗済み</span></header>
    {failed?<p className="embed-message" role="status">搭乗実績を取得できませんでした。時間をおいて再読み込みしてください。</p>:<>
      {design==='summary'?<><h1>搭乗実績</h1><div className="embed-stats">{[[flights.length,'搭乗回数','回'],[km,'飛行距離（概算）','km'],[visited.size,'空港','空港'],[countries.size,'国・地域','']].map(([value,label,unit])=><div key={String(label)}><strong>{number(Number(value))}<small>{unit}</small></strong><span>{label}</span></div>)}</div></>:
      design==='map'?<><h1>フライトマップ <small>{number(flights.length)}回</small></h1>{flights.length?<FlightMap data={data} flights={flights} night={false}/>:<p className="embed-message">この期間の搭乗実績はありません。</p>}<p className="embed-note">往復合算 · 搭乗回数が多いほど濃く・太く表示</p></>:
      <><h1>最新の搭乗履歴</h1>{flights.length?<ol className="embed-recent">{flights.slice(0,5).map(f=><li key={f.id}><div><time>{date(f.actual_departure||f.scheduled_departure,f.origin)}</time><a href={`/flights/${f.id}`} target="_blank" rel="noopener noreferrer">{f.flight_number} ↗</a></div><strong>{airportCode(airports.get(f.origin))} <span>→</span> {airportCode(airports.get(f.destination))}</strong></li>)}</ol>:<p className="embed-message">この期間の搭乗実績はありません。</p>}</>}
    </>}
    <a className="embed-credit" href="/" target="_blank" rel="noopener noreferrer">搭乗実績を詳しく見る ↗</a>
  </main>;
}
