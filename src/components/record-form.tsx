'use client';
import {cabinNames} from '@/lib/cabin';
import {useState} from 'react';
import {formatInTimeZone,fromZonedTime} from 'date-fns-tz';
import {Save,Upload,Check,ArrowUpRight} from 'lucide-react';
import {schema,find,label,statuses,type Archive,type Row} from '@/lib/model';

function airportZone(key:string,values:Record<string,any>,data:Archive) {return find(data,'airports',values[key.includes('arrival')?'destination':'origin'])?.timezone;}
function initialValues(collection:string,record:Row|undefined,data:Archive) {
  const result:Record<string,any>={};
  for(const [key,field] of Object.entries(schema[collection].fields)) {
    let value=record?.[key]??(key==='status'?'planned':key==='visibility'?'public':'');
    if(field.type==='timestamp'&&value) value=formatInTimeZone(value,airportZone(key,record||{},data)||'UTC',"yyyy-MM-dd'T'HH:mm");
    if(field.type==='json') value=Array.isArray(value)?value.join(', '):'';
    result[key]=value;
  }
  return result;
}
const nameOrder=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
function RelationSelect({name,value,rows,onChange,required}:{name:string;value:string;rows:Row[];onChange:(v:string)=>void;required?:boolean}) {
  const [query,setQuery]=useState('');
  return <div className="relation-select">{rows.length>15&&<input type="search" aria-label={`${name}の候補を検索`} placeholder="名前・コードで候補を絞り込み" value={query} onChange={e=>setQuery(e.target.value)}/>}<select aria-label={name} required={required} value={value} onChange={e=>onChange(e.target.value)}><option value="">{required?'選択してください':'未設定'}</option>{rows.filter(row=>row.id===value||[label(row),row.iata,row.icao].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>nameOrder.compare(label(a),label(b))||nameOrder.compare(a.id,b.id)).map(row=><option key={row.id} value={row.id}>{row.iata?`${row.iata} · `:''}{label(row)}</option>)}</select></div>;
}
export default function RecordForm({collection,data,record,onClose}:{collection:string;data:Archive;record?:Row;onClose:()=>void}) {
  const [values,setValues]=useState(()=>initialValues(collection,record,data)),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[uploaded,setUploaded]=useState('');
  function update(key:string,value:any) {
    setValues(old=>{
      const next={...old,[key]:value};
      if(key==='aircraft'&&value) next.registration=find(data,'aircraft',value)?.registration||old.registration;
      if(key==='airline'&&collection==='flights'&&value) next.airline_name=find(data,'airlines',value)?.name||old.airline_name;
      return next;
    });
  }
  async function upload(file:File) {
    setUploading(true);setError('');
    try {
      if(file.size>30*1024*1024)throw new Error('30MB以下の画像を選択してください。');
      const form=new FormData();form.set('file',file);
      const response=await fetch('/api/upload',{method:'POST',body:form});
      if(!response.ok)throw new Error((await response.json()).error||'アップロードできませんでした。再ログインもお試しください。');
      update('file',(await response.json()).id);setUploaded(file.name);
    } catch(error){setError(error instanceof Error?error.message:'アップロードに失敗しました。');}finally{setUploading(false);}
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      const payload:Record<string,any>={};
      for(const [key,field] of Object.entries(schema[collection].fields)) {
        const value=values[key];
        if(value===''||value==null) {payload[key]=field.type==='json'?[]:null;continue;}
        if(field.type==='float')payload[key]=Number(value);
        else if(field.type==='json')payload[key]=[...new Set(String(value).split(',').map(s=>s.trim()).filter(Boolean))];
        else if(field.type==='timestamp') {
          const timezone=airportZone(key,values,data);
          if(!timezone)throw new Error('出発・到着空港とタイムゾーンを先に設定してください。');
          const parsed=fromZonedTime(value,timezone);
          if(!Number.isFinite(parsed.getTime())||formatInTimeZone(parsed,timezone,"yyyy-MM-dd'T'HH:mm")!==value)throw new Error('日時が無効です。夏時間への切替時刻も確認してください。');
          payload[key]=parsed.toISOString();
        } else payload[key]=value;
      }
      if(record)payload.id=record.id;
      const response=await fetch(`/api/records/${collection}`,{method:record?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!response.ok) {const body=await response.json().catch(()=>({}));throw new Error(body.error||'保存できませんでした。ログイン状態を確認してください。');}
      onClose();
    }catch(error){setError(error instanceof Error?error.message:'保存に失敗しました。');}finally{setBusy(false);}
  }
  return <form className="record-form panel" onSubmit={save}><div className="form-heading"><h3>{record?'記録を編集':'新しい記録'}</h3><span>* 必須項目</span></div>{collection==='flights'&&<p className="form-help">日時は各空港の現地時刻で入力します。搭乗予定には予定日時が必要です。搭乗済みは実際の日時だけでも保存できます。搭乗後は状態を「搭乗済み」に変更し、実績を入力してください。入力したメモも一般公開されます。</p>}{collection==='photos'&&<p className="form-help">原本を保存し、公開ページには縮小版を表示します。非公開にすると画像も管理者だけが閲覧できます。</p>}
    <div className="form-grid">{Object.entries(schema[collection].fields).filter(([,field])=>!field.hidden).map(([key,field])=><label key={key} className={field.type==='text'||key==='file'?'full':''}><span>{field.label}{field.required&&<em> *</em>}</span>{key==='file'?<div className="upload-box"><Upload size={24}/><strong>{uploading?'アップロード中…':uploaded|| (values.file?'画像登録済み。選び直すと差し替えます':'写真を選択')}</strong><input aria-label="画像ファイル" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading||busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/><small>JPEG / PNG / WebP · 最大30MB · 最大8,000万画素</small>{values.file&&<span className="upload-complete"><Check size={14}/>アップロード済み</span>}{record&&<a href={`/api/photos/${record.id}/image?size=large`} target="_blank" rel="noreferrer">現在の画像を確認 <ArrowUpRight size={14}/></a>}</div>:field.relation?<RelationSelect name={field.label} value={values[key]} rows={data[field.relation]||[]} onChange={v=>update(key,v)} required={field.required}/>:field.options?<select required={field.required} value={values[key]} onChange={e=>update(key,e.target.value)}>{field.options.map(value=><option key={value} value={value}>{statuses[value]||({public:'公開',private:'非公開'} as Record<string,string>)[value]||value}</option>)}</select>:key==='cabin'?<><input list="cabin-names" value={values[key]} onChange={e=>update(key,e.target.value)}/><datalist id="cabin-names">{cabinNames.map(name=><option key={name} value={name}/>)}</datalist></>:field.type==='text'?<textarea rows={4} value={values[key]} onChange={e=>update(key,e.target.value)}/>:<input required={field.required} type={field.type==='timestamp'?'datetime-local':field.type==='date'?'date':field.type==='float'?'number':'text'} step={field.type==='float'?'any':undefined} value={values[key]} onChange={e=>update(key,e.target.value)} maxLength={field.type==='json'?2000:500}/>} {field.type==='timestamp'&&<small className="field-help">{airportZone(key,values,data)||'先に空港を選択してください'}</small>}</label>)}</div>
    {error&&<p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy||uploading}>キャンセル</button><button className="button" disabled={busy||uploading||collection==='photos'&&!values.file}><Save size={16}/>{busy?'保存中…':'保存する'}</button></div>
  </form>;
}
