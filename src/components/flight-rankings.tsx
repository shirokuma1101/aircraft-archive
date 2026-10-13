'use client';
import {useState} from 'react';
import {flightRankings,type Ranking} from '@/lib/rankings';
import type {Archive,Row} from '@/lib/model';

function RankingCard({ranking}:{ranking:Ranking}) {
  const [expanded,setExpanded]=useState(false);
  const {key,title,note,entries}=ranking;
  const visible=expanded?entries:entries.slice(0,5);
  return <section className="ranking-card" aria-labelledby={`ranking-title-${key}`}>
    <div className="ranking-heading"><h3 id={`ranking-title-${key}`}>{title}</h3><span>{entries.length}項目</span></div>
    <p className="ranking-note">{note}</p>
    {entries.length?<ol id={`ranking-list-${key}`} className="ranking-list">{visible.map(entry=><li key={entry.key}>
      <span className="ranking-place">{entry.rank}<span className="sr-only">位</span></span>
      <div className="ranking-item"><div className="ranking-label"><span title={entry.detail||entry.name}>{entry.name}</span><strong>{entry.count.toLocaleString('ja-JP')}<small>回</small></strong></div>{entry.detail&&<p>{entry.detail}</p>}<div className="ranking-track" aria-hidden="true"><div style={{width:`${entry.count/entries[0].count*100}%`}}/></div></div>
    </li>)}</ol>:<p className="ranking-empty">集計できる記録がありません</p>}
    {(entries.length>5||expanded)&&<button className="text-link ranking-toggle" aria-expanded={expanded} aria-controls={`ranking-list-${key}`} onClick={()=>setExpanded(!expanded)}>{expanded?'上位5件に戻す':`${title}をすべて表示`}</button>}
  </section>;
}
export default function FlightRankings({data,flights}:{data:Archive;flights:Row[]}) {
  const rankings=flightRankings(data,flights);
  return <section aria-labelledby="rankings-title"><div className="section-heading"><h2 id="rankings-title">ランキング</h2><span className="ranking-scope">現在の絞り込み条件・搭乗済み {flights.filter(f=>f.status==='flown').length}件</span></div><p className="ranking-help">未登録の項目は集計対象外です。同じ回数は同順位で表示します。</p><div className="ranking-grid">{rankings.map(r=><RankingCard key={r.key} ranking={r}/>)}</div></section>;
}
