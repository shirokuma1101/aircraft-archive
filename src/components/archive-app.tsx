'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import dynamic from 'next/dynamic';
import {Plane,ArrowUpRight,ArrowRight,Camera,Globe2,Search,SlidersHorizontal,Plus,MapPin,CalendarDays,LogOut,LayoutDashboard,Route,Clock3,Lock,ImageIcon,ChevronLeft} from 'lucide-react';
import {formatInTimeZone} from 'date-fns-tz';
import {schema,find,label,airportCode,statuses,isPending,type Archive,type Row} from '@/lib/model';
import {flightRoutes,routeColor} from '@/lib/flight-routes';
import {cabinName} from '@/lib/cabin';
import {distance} from '@/lib/geo';
import RecordForm from './record-form';
import ExifPanel from './exif-panel';
import FlightImport from './flight-import';
import FlightRankings from './flight-rankings';
import FlightDelay from './flight-delay';
import EmbedBuilder from './embed-builder';
import ArchiveExport from './archive-export';
import Login from './login';
import SiteSettings from './site-settings';
import {ThemeToggle,useTheme} from './theme-provider';
const FlightMap=dynamic(()=>import('./flight-map'),{ssr:false,loading:()=> <div className="map-loading">地図を読み込んでいます…</div>});
const nameOrder=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
const number=(n:number)=>new Intl.NumberFormat('ja-JP').format(Math.round(n));
function localDate(value:string,timezone='Asia/Tokyo',format='yyyy.MM.dd HH:mm') {try{return formatInTimeZone(value,timezone,format);}catch{return '—';}}
function flightDate(row:Row,data:Archive) {return localDate(row.actual_departure || row.scheduled_departure,find(data,'airports',row.origin)?.timezone,'yyyy.MM.dd');}
function routeDistance(f:Row,data:Archive) {const a=find(data,'airports',f.origin),b=find(data,'airports',f.destination);return a&&b?distance([a.latitude,a.longitude],[b.latitude,b.longitude]):0;}

export default function ArchiveApp({data,path,admin,connection}:{data:Archive;path:string[];admin:boolean;connection:string}) {
  const section=path[0] || 'flights';
  const router=useRouter();
  const [logoutError,setLogoutError]=useState('');
  return <>
    <header className="header"><Link href="/" className="brand"><span className="brand-icon"><Plane size={22}/></span><span>AIRCRAFT<span className="brand-sub">ARCHIVE</span></span></Link>
      <nav aria-label="メインナビゲーション"><Link href="/" className={section==='flights'?'active':''}><Route size={16}/>フライト</Link><Link href="/photos" className={section==='photos'?'active':''}><Camera size={16}/>フォトギャラリー</Link><Link href="/aircraft" className={section==='aircraft'?'active':''}><Plane size={16}/>航空機</Link></nav>
      <div className="header-end"><ThemeToggle/>{admin&&<><Link href="/manage" className="manage-link" aria-label="管理画面"><LayoutDashboard size={17}/><span>管理画面</span></Link><button className="icon-button" aria-label="ログアウト" onClick={async()=>{try{const r=await fetch('/api/auth',{method:'DELETE'});if(!r.ok)throw new Error();router.refresh();}catch{setLogoutError('ログアウトできませんでした。');}}}><LogOut size={17}/></button></>}</div>
    </header>
    {logoutError&&<p role="alert" className="notice error">{logoutError}</p>}
    {connection!=='ready'&&<div className="notice" role="status">{connection==='unconfigured'?'セットアップ待ちです。Directusへの接続を設定すると、登録した記録がここに表示されます。':'データに接続できません。しばらくして再読み込みしてください。管理者はDirectusの起動状態を確認してください。'}</div>}
    {section==='manage' ? admin ? <Manage data={data} initialCollection={path[1]}/> : <Login/> : path[1] ? <Detail data={data} collection={section} id={path[1]} admin={admin}/> : section==='photos' ? <Gallery data={data} admin={admin}/> : section==='aircraft' ? <AircraftList data={data} admin={admin}/> : <Dashboard data={data} admin={admin}/>}
    <footer><Link href="/" className="footer-brand"><Plane size={16}/> AIRCRAFT ARCHIVE</Link><span>空港・航空会社・機種：<a href="https://openflights.org/data" target="_blank" rel="noreferrer">OpenFlights</a>（<a href="/openflights/LICENSE.txt">ODbL</a>） · <a href="/openflights/airports.json" download>空港データ</a> · <a href="/openflights/reference-data.json" download>航空会社・機種データ</a></span></footer>
  </>;
}
function Heading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle?:string;action?:React.ReactNode}) {return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle&&<p className="subtitle">{subtitle}</p>}</div>{action}</div>;}
function Dashboard({data,admin}:{data:Archive;admin:boolean}) {
  const {dark}=useTheme();
  const [historyOpen,setHistoryOpen]=useState(false);
  const [year,setYear]=useState('all'),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[route,setRoute]=useState<string[]|null>(null);
  const years=[...new Set(data.flights.map(f=>flightDate(f,data).slice(0,4)))].sort().reverse();
  const flights=data.flights.filter(f=>(year==='all'||flightDate(f,data).startsWith(year))&&(status==='all'||f.status===status)&&(!route||f.origin===route[0]&&f.destination===route[1]||f.origin===route[1]&&f.destination===route[0])&&[f.flight_number,f.registration,f.airline_name,flightEquipment(f,data),find(data,'aircraft_types',find(data,'aircraft',f.aircraft)?.type)?.icao,label(find(data,'airports',f.origin)),airportCode(find(data,'airports',f.origin)),label(find(data,'airports',f.destination)),airportCode(find(data,'airports',f.destination))].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.actual_departure||b.scheduled_departure||'').localeCompare(a.actual_departure||a.scheduled_departure||''));
  const maxRouteCount=Math.max(1,...flightRoutes(flights).map(r=>r.flown));
  const flown=flights.filter(f=>f.status==='flown');
  const airports=new Set(flown.flatMap(f=>[f.origin,f.destination]));
  const countries=new Set([...airports].map(id=>find(data,'airports',id)?.country).filter(Boolean));
  return <main className="page">
    <Heading eyebrow="THE FLIGHT JOURNAL" title="フライト一覧" action={admin?<Link className="button" href="/manage/flights"><Plus size={17}/>フライトを記録</Link>:<span className="journal-mark"><Globe2 size={16}/> MY FLIGHT MAP</span>}/>
    <section className="stats" aria-label="搭乗済みの集計"><Stat icon={<Plane/>} value={number(flown.length)} label="搭乗フライト" unit="FLIGHTS"/><Stat icon={<Route/>} value={number(flown.reduce((sum,f)=>sum+routeDistance(f,data),0))} label="総飛行距離（概算）" unit="KM"/><Stat icon={<MapPin/>} value={number(airports.size)} label="訪れた空港" unit="AIRPORTS"/><Stat icon={<Globe2/>} value={number(countries.size)} label="国・地域" unit="COUNTRIES"/></section>
    <section className="map-card"><div className="map-toolbar"><div><span className="live-dot"/><strong>フライトマップ</strong><span className="muted map-count">{flights.length} flights</span></div><div className="filters"><SlidersHorizontal size={15}/><select aria-label="年で絞り込み" value={year} onChange={e=>setYear(e.target.value)}><option value="all">すべての年</option>{years.map(y=><option key={y}>{y}</option>)}</select><select aria-label="搭乗状態で絞り込み" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">すべてのフライト</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></div>
      <div className="map-wrap"><FlightMap data={data} flights={flights} onRoute={(a,b)=>{setRoute([a,b]);setHistoryOpen(true);}}/>{!flights.length&&<div className="map-empty"><Plane size={22}/><strong>{data.flights.length?'条件に合うフライトがありません':'フライトが登録されていません'}</strong><span>{data.flights.length?'フィルターを変更してください。':'フライトを登録すると、空港とルートが地図に表示されます。'}</span>{admin&&!data.flights.length&&<Link href="/manage/flights">最初のフライトを登録 <ArrowRight size={14}/></Link>}</div>}</div>
      <div className="map-legend"><span>搭乗済み 1回 <i className="route-gradient" style={{background:`linear-gradient(90deg,${routeColor(1,maxRouteCount,dark)},${routeColor(maxRouteCount,maxRouteCount,dark)})`}}/> {maxRouteCount}回（往復合算）</span><span><i className="line planned"/>搭乗予定</span><span className="legend-note">搭乗回数が多いほど{dark?'明るく':'濃く'}・太く表示（概略ルート）</span></div>
    </section>
    <div className="section-heading"><div><p className="eyebrow">FLIGHT LOG</p><h2>搭乗履歴 <small>{flights.length}</small></h2></div>{(flights.length>5||historyOpen)&&<button className="button secondary" aria-expanded={historyOpen} aria-controls="flight-history" onClick={()=>setHistoryOpen(!historyOpen)}>{historyOpen?'最新5件に戻す':'すべて表示'}</button>}</div>
    <section id="flight-history"><label className="search"><Search size={17}/><input aria-label="フライト検索" placeholder="便名・空港・機種・機体番号で検索" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {route&&<button className="route-chip" onClick={()=>setRoute(null)}>{airportCode(find(data,'airports',route[0]))} ↔ {airportCode(find(data,'airports',route[1]))}　× 絞り込み解除</button>}
    <FlightTable data={data} flights={historyOpen?flights:flights.slice(0,5)}/></section>
    <FlightRankings data={data} flights={flights}/>
    <div className="section-heading"><div><p className="eyebrow">THROUGH THE LENS</p><h2>最新のフォト</h2></div><Link href="/photos" className="text-link">ギャラリーへ <ArrowUpRight size={17}/></Link></div>
    <PhotoGrid data={data} photos={[...data.photos].sort((a,b)=>(b.taken_on||'').localeCompare(a.taken_on||'')).slice(0,3)}/>
  </main>;
}
function Stat({icon,value,label:caption,unit}:{icon:React.ReactNode;value:string;label:string;unit:string}) {return <div className="stat"><div className="stat-top"><span>{caption}</span>{icon}</div><div className="stat-value">{value}<span>{unit}</span></div></div>;}
function flightEquipment(f:Row,data:Archive) {
  const aircraft=find(data,'aircraft',f.aircraft);
  return find(data,'aircraft_types',aircraft?.type)?.name||String(f.notes||'').match(/^機種（インポート元）:\s*(.+)$/m)?.[1]||'機種未登録';
}
function FlightTimes({flight,data}:{flight:Row;data:Archive}) {
  const departure=flight.actual_departure||flight.scheduled_departure;
  const originZone=find(data,'airports',flight.origin)?.timezone;
  const departureDate=localDate(departure,originZone,'yyyy-MM-dd');
  return <div className="flight-times">{(['departure','arrival'] as const).map(phase=>{
    const value=flight[`actual_${phase}`]||flight[`scheduled_${phase}`];
    const zone=find(data,'airports',flight[phase==='departure'?'origin':'destination'])?.timezone;
    const differentDay=value&&localDate(value,zone,'yyyy-MM-dd')!==departureDate;
    return <div key={phase} className={phase}><small>{phase==='departure'?'出発':'到着'} {flight[`actual_${phase}`]?'実績':'予定'}</small><time dateTime={value||undefined} title={value?`${localDate(value,zone)} (${zone||'Asia/Tokyo'})`:'時刻未入力'}>{value?localDate(value,zone,differentDay?'MM/dd HH:mm':'HH:mm'):'—'}</time></div>;
  })}</div>;
}
function FlightTable({data,flights}:{data:Archive;flights:Row[]}) {return flights.length?<div className="table-wrap"><table className="flight-table"><thead><tr><th>日付 / 便名</th><th>ルート</th><th>航空会社</th><th>機材 / 機体番号</th><th>ステータス</th><th>遅延（実績 − 予定）</th><th><span className="sr-only">詳細</span></th></tr></thead><tbody>{flights.map(f=><tr key={f.id}><td><span className="table-date">{flightDate(f,data)}</span><Link href={`/flights/${f.id}`} className="flight-number">{f.flight_number}</Link></td><td><div className="airport-pair"><strong>{airportCode(find(data,'airports',f.origin))}</strong><span className="route-line"><Plane size={15}/></span><strong>{airportCode(find(data,'airports',f.destination))}</strong></div><FlightTimes flight={f} data={data}/></td><td>{f.airline_name||label(find(data,'airlines',f.airline))}</td><td className="flight-equipment">{flightEquipment(f,data)}<div className="table-sub mono">{f.registration||find(data,'aircraft',f.aircraft)?.registration||'機体未確定'}</div></td><td><span className={`badge ${f.status}`}>{statuses[f.status]}</span></td><td><FlightDelay flight={f}/></td><td><Link className="icon-button" aria-label={`${f.flight_number}の詳細`} href={`/flights/${f.id}`}><ArrowUpRight size={19}/></Link></td></tr>)}</tbody></table></div>:<Empty icon={<Plane/>} title="フライトはまだありません" text="登録したフライトをここで検索・閲覧できます。"/>;}
function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) {return <div className="empty">{icon}<h3>{title}</h3><p>{text}</p></div>;}
function PhotoGrid({data,photos}:{data:Archive;photos:Row[]}) {return photos.length?<div className="photo-grid">{photos.map(p=><Link href={`/photos/${p.id}`} className="photo-card" key={p.id}><div className="photo-frame"><img src={`/api/photos/${p.id}/image`} alt={p.title} loading="lazy"/>{p.visibility==='private'&&<span className="photo-private"><Lock size={12}/>非公開</span>}<span className="photo-arrow"><ArrowUpRight size={20}/></span></div><div className="photo-caption"><span className="eyebrow">{find(data,'categories',p.category)?.name||'PHOTO'} {p.registration&&` / ${p.registration}`}</span><h3>{p.title}</h3><p>{p.location||find(data,'airports',p.airport)?.name||'撮影場所未登録'}<span>{p.taken_on?.replaceAll('-','.')}</span></p></div></Link>)}</div>:<Empty icon={<Camera/>} title="写真はまだありません" text="登録した写真をここで検索・閲覧できます。"/>;}
function Gallery({data,admin}:{data:Archive;admin:boolean}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
  const photos=data.photos.filter(p=>(category==='all'||p.category===category)&&[p.title,p.registration,p.location,p.description,...(p.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.taken_on||'').localeCompare(a.taken_on||''));
  return <main className="page"><Heading eyebrow="AVIATION PHOTOGRAPHY" title="写真一覧" action={admin&&<Link href="/manage/photos" className="button"><Plus size={17}/>写真を投稿</Link>}/><div className="gallery-toolbar"><div className="tabs"><button className={category==='all'?'selected':''} onClick={()=>setCategory('all')}>すべて</button>{data.categories.map(c=><button key={c.id} className={category===c.id?'selected':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div><label className="search"><Search size={17}/><input aria-label="写真検索" placeholder="タイトル・タグ・機体番号" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><p className="result-count">{photos.length} PHOTOS</p><PhotoGrid data={data} photos={photos}/></main>;
}
function AircraftList({data,admin}:{data:Archive;admin:boolean}) {
  const [query,setQuery]=useState('');
  const aircraft=data.aircraft.filter(a=>[a.registration,a.serial_number,label(find(data,'aircraft_types',a.type)),label(find(data,'airlines',a.airline))].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <main className="page"><Heading eyebrow="AIRCRAFT COLLECTION" title="航空機一覧" action={admin&&<Link className="button" href="/manage/aircraft"><Plus size={17}/>機体を登録</Link>}/><label className="search"><Search size={17}/><input aria-label="航空機検索" placeholder="機体番号・機種・航空会社" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="aircraft-grid">{aircraft.map(a=><Link key={a.id} href={`/aircraft/${a.id}`} className="aircraft-card"><Plane size={30}/><span className="eyebrow">{find(data,'aircraft_types',a.type)?.name||'AIRCRAFT'}</span><h2>{a.registration}</h2><p>{find(data,'airlines',a.airline)?.name||'所属未登録'}</p><div>{data.flights.filter(f=>f.aircraft===a.id).length} flights · {data.photos.filter(p=>p.aircraft===a.id).length} photos <ArrowUpRight size={16}/></div></Link>)}</div>{!aircraft.length&&<Empty icon={<Plane/>} title="機体情報がありません" text="機体を登録すると、フライトと写真をまとめて見ることができます。"/>}</main>;
}
function Detail({data,collection,id,admin}:{data:Archive;collection:string;id:string;admin:boolean}) {
  const row=find(data,collection,id);
  if(!row) return <main className="page"><Empty icon={<Search/>} title="記録を読み込めませんでした" text="接続状態を確認して再読み込みしてください。"/></main>;
  const title=collection==='flights'?row.flight_number:collection==='photos'?row.title:row.registration;
  return <main className="page"><Link className="back-link" href={collection==='flights'?'/':`/${collection}`}><ChevronLeft size={16}/>一覧に戻る</Link><Heading eyebrow={collection.toUpperCase()} title={title} subtitle={collection==='flights'?`${label(find(data,'airports',row.origin))} → ${label(find(data,'airports',row.destination))}`:collection==='photos'?row.description||'':label(find(data,'aircraft_types',row.type))} action={admin&&<Link href={`/manage/${collection}?edit=${id}`} className="button secondary">記録を編集</Link>}/>
    {collection==='photos'?<><div className="detail-image"><img src={`/api/photos/${id}/image?size=large`} alt={row.title}/></div><div className="detail-meta"><span><CalendarDays size={16}/>{row.taken_on||'撮影日未登録'}</span><span><MapPin size={16}/>{row.location||'場所未登録'}</span><span>{find(data,'categories',row.category)?.name}</span><span>{row.visibility==='private'?'非公開':'公開'}</span>{(row.tags||[]).map((tag:string)=><span className="tag" key={tag}>#{tag}</span>)}</div><div className="related-links">{row.aircraft&&<Link href={`/aircraft/${row.aircraft}`}><Plane size={16}/>{row.registration||label(find(data,'aircraft',row.aircraft))}</Link>}{row.flight&&<Link href={`/flights/${row.flight}`}><Route size={16}/>{label(find(data,'flights',row.flight))}</Link>}{admin&&<a href={`/api/photos/${id}/image?original=1`}>原本をダウンロード <ArrowUpRight size={16}/></a>}</div></>:collection==='flights'?<><div className="detail-map"><FlightMap data={data} flights={[row]}/></div><div className="detail-panels"><section className="panel"><h2>フライト情報</h2><div className="detail-delay"><FlightDelay flight={row}/><p className="form-help">登録された予定と実績の差です。日時が未入力の場合は比較できません。</p></div><dl><dt>状態</dt><dd>{statuses[row.status]}</dd>{[['予定出発','scheduled_departure','origin'],['予定到着','scheduled_arrival','destination'],['実際の出発','actual_departure','origin'],['実際の到着','actual_arrival','destination']].map(([caption,key,airport])=><div className="dl-row" key={key}><dt>{caption}</dt><dd>{row[key]?`${localDate(row[key],find(data,'airports',row[airport])?.timezone)} (${find(data,'airports',row[airport])?.timezone})`:'未入力'}</dd></div>)}</dl></section><section className="panel"><h2>搭乗の記録</h2><dl><dt>航空会社</dt><dd>{row.airline_name||'未登録'}</dd><dt>搭乗機</dt><dd>{row.aircraft?<Link href={`/aircraft/${row.aircraft}`}>{row.registration||'機体情報へ'} ↗</Link>:row.registration||'未確定'}</dd><dt>座席 / クラス</dt><dd>{row.seat||'—'} / {cabinName(row.cabin,row.import_source)||'—'}</dd><dt>公開メモ</dt><dd className="pre-wrap">{row.notes||'—'}</dd></dl></section></div><h2 className="section-title">このフライトの写真</h2><PhotoGrid data={data} photos={data.photos.filter(p=>p.flight===id)}/></>:<><section className="panel"><dl><dt>製造番号</dt><dd>{row.serial_number||'未登録'}</dd><dt>現在の航空会社</dt><dd>{find(data,'airlines',row.airline)?.name||'未登録'}</dd><dt>機体情報</dt><dd className="pre-wrap">{row.notes||'—'}</dd></dl></section>{data.aircraft_history.some(h=>h.aircraft===id)&&<section className="panel"><h2>機体番号・所属履歴</h2>{data.aircraft_history.filter(h=>h.aircraft===id).sort((a,b)=>(a.start_date||'').localeCompare(b.start_date||'')).map(h=><p key={h.id}>{h.start_date||'不明'} 〜 {h.end_date||'現在'} · <strong>{h.registration}</strong> · {find(data,'airlines',h.airline)?.name||'所属未登録'}</p>)}</section>}<h2 className="section-title">この機体のフライト</h2><FlightTable data={data} flights={data.flights.filter(f=>f.aircraft===id)}/><h2 className="section-title">この機体の写真</h2><PhotoGrid data={data} photos={data.photos.filter(p=>p.aircraft===id)}/></>}
    {collection==='photos'&&<ExifPanel key={`${id}-${row.file}`} photoId={id}/>}
  </main>;
}
function Manage({data,initialCollection}:{data:Archive;initialCollection?:string}) {
  const collection=initialCollection&&Object.hasOwn(schema,initialCollection)?initialCollection:'flights';
  const pending=data.flights.filter(f=>isPending(f));
  const [editing,setEditing]=useState<Row|null>(null),[open,setOpen]=useState(false),[query,setQuery]=useState('');
  const searchId=useSearchParams().get('edit');
  const record=editing || (searchId?find(data,collection,searchId):undefined);
  const showForm=open||Boolean(record);
  const router=useRouter();
  const section=initialCollection==='transfer'?'transfer':['settings','embeds'].includes(initialCollection||'')?'settings':'records';
  const navigation=<nav className="manage-tabs" aria-label="管理画面の切り替え">{[['records','記録管理','/manage'],['transfer','インポート／エクスポート','/manage/transfer'],['settings','サイト設定','/manage/settings']].map(([key,title,href])=><Link key={key} href={href} aria-current={section===key?'page':undefined}>{title}</Link>)}</nav>;
  if(section==='transfer')return <main className="page"><Heading eyebrow="ARCHIVE WORKSPACE" title="データの入出力"/>{navigation}<section className="panel"><h2>フライトをCSVからインポート</h2><FlightImport data={data}/></section><ArchiveExport/></main>;
  if(section==='settings')return <main className="page"><Heading eyebrow="ARCHIVE WORKSPACE" title="サイト設定"/>{navigation}{initialCollection==='embeds'?<><Link className="back-link" href="/manage/settings">← サイト設定に戻る</Link><EmbedBuilder/></>:<><SiteSettings/><section className="panel"><h2>搭乗実績の埋め込み</h2><p className="form-help">外部サイトに表示するデザインを選び、埋め込みコードを作成できます。</p><Link className="button secondary settings-embed-link" href="/manage/embeds">埋め込みを作成 <ArrowUpRight size={16}/></Link></section></>}</main>;
  return <main className="page"><Heading eyebrow="ARCHIVE WORKSPACE" title="記録を管理"/>{navigation}{pending.length>0&&<section className="pending-panel"><div><Clock3 size={22}/><div><h2>実績入力待ち <small>{pending.length}</small></h2><p>予定到着日時を過ぎた便です。搭乗結果と実際の情報を確定してください。</p></div></div><div className="pending-items">{pending.map(f=><Link key={f.id} href={`/manage/flights?edit=${f.id}`} onClick={()=>{setEditing(null);setOpen(false);}}>{f.flight_number} · {flightDate(f,data)} <ArrowRight size={15}/></Link>)}</div></section>}
    <div className="manage-layout"><aside className="manage-nav" aria-label="管理メニュー">{Object.entries(schema).sort(([a],[b])=>['flights','photos'].includes(a)?-1:['flights','photos'].includes(b)?1:0).map(([key,value])=><Link href={`/manage/${key}`} className={collection===key?'selected':''} key={key} onClick={()=>{setEditing(null);setOpen(false);setQuery('');}}>{value.label}<span>{data[key].length}</span></Link>)}</aside><section className="manage-content" key={collection}><div className="section-heading"><h2>{schema[collection].label}</h2><button className="button" onClick={()=>{setEditing(null);setOpen(true);if(searchId)router.replace(`/manage/${collection}`);}}><Plus size={16}/>新規登録</button></div>{showForm?<RecordForm key={`${collection}-${record?.id||'new'}`} collection={collection} data={data} record={record||undefined} onClose={()=>{setEditing(null);setOpen(false);router.replace(`/manage/${collection}`);router.refresh();}}/>:<><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="登録内容を検索" aria-label="管理データ検索"/></label><div className="record-list">{data[collection].filter(r=>Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>nameOrder.compare(label(a),label(b))||nameOrder.compare(a.id,b.id)).map(r=><button key={r.id} onClick={()=>{setEditing(r);setOpen(true);}}><span><strong>{collection==='aircraft_history'?r.registration:label(r)}</strong><small>{collection==='flights'?`${flightDate(r,data)} · ${statuses[r.status]}`:collection==='photos'?`${r.visibility==='private'?'非公開':'公開'} · ${r.taken_on||''}`:collection==='airports'?`${r.iata||'—'} / ${r.icao||'—'}`:r.iata||r.manufacturer||r.start_date||''}</small></span><span>編集 <ArrowUpRight size={15}/></span></button>)}</div>{!data[collection].length&&<Empty icon={<ImageIcon/>} title="まだ登録がありません" text="「新規登録」から追加できます。関連する空港や機種は先に登録してください。"/>}</>}</section></div>
  </main>;
}
