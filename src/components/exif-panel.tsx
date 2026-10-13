'use client';
import {useEffect,useState} from 'react';
import {Camera,MapPin,ArrowUpRight} from 'lucide-react';
import dynamic from 'next/dynamic';
import type {ExifInfo} from '@/lib/exif';
const PhotoLocationMap=dynamic(()=>import('./photo-location-map'),{ssr:false,loading:()=> <p className="form-help">地図を読み込み中…</p>});
export default function ExifPanel({photoId}:{photoId:string}) {
  const [info,setInfo]=useState<ExifInfo|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setInfo(null);setError(false);
    fetch(`/api/photos/${photoId}/exif`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error();return response.json();})
      .then(setInfo).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[photoId,retry]);
  return <section className="panel exif-panel" aria-label="EXIF情報"><h2><Camera size={18}/>撮影情報 <span>EXIF</span></h2>
    {error?<div role="status"><p className="form-help">EXIF情報を読み込めませんでした。</p><button className="button secondary" onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>:!info?<p role="status" className="form-help">撮影情報を読み込み中…</p>:<>
      {info.fields.length?<dl className="exif-fields">{info.fields.map(field=><div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>:!info.geo&&<p className="form-help">この画像には表示できるEXIF撮影情報がありません。</p>}
      {info.width&&info.height&&<p className="exif-size">原本サイズ：{info.width.toLocaleString()} × {info.height.toLocaleString()} px</p>}
      {info.geo?<section className="photo-location" aria-label="GPS位置情報"><div className="location-heading"><h3><MapPin size={17}/>撮影位置 <small>GPS</small></h3><a href={`https://www.openstreetmap.org/?mlat=${info.geo.latitude}&mlon=${info.geo.longitude}#map=16/${info.geo.latitude}/${info.geo.longitude}`} target="_blank" rel="noreferrer">地図で開く <ArrowUpRight size={15}/></a></div><dl className="exif-fields"><div><dt>緯度</dt><dd>{info.geo.latitude.toFixed(6)}°</dd></div><div><dt>経度</dt><dd>{info.geo.longitude.toFixed(6)}°</dd></div>{info.geo.altitude!==undefined&&<div><dt>標高（EXIF）</dt><dd>{Number(info.geo.altitude.toFixed(1))} m</dd></div>}</dl><PhotoLocationMap key={`${info.geo.latitude},${info.geo.longitude}`} geo={info.geo}/></section>:<p className="exif-size">GPS位置情報は記録されていません。</p>}
    </>}
  </section>;
}
