'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {formatInTimeZone} from 'date-fns-tz';
import {importFields,type ImportField,type ImportValues,type ImportMapping,type ImportEntry} from '@/lib/flight-import-fields';
import type {Archive} from '@/lib/model';

type Preview={headers:string[];mapping:ImportMapping;source:string;entries:ImportEntry[]};
export default function FlightImport({data}:{data:Archive}) {
  const router=useRouter();
  const [source,setSource]=useState('auto');
  const [csv,setCsv]=useState(''),[delimiter,setDelimiter]=useState(','),[mapping,setMapping]=useState<ImportMapping>();
  const [overrides,setOverrides]=useState<Record<string,ImportValues>>({}),[preview,setPreview]=useState<Preview|null>(null),[dirty,setDirty]=useState(false);
  const [selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
  async function load(file:File) {
    setError('');setResult('');setPreview(null);setMapping(undefined);setOverrides({});setSelected([]);
    try{if(file.size>2*1024*1024)throw new Error('CSVは2MB以下にしてください。');setCsv(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));setDirty(true);}
    catch{setCsv('');setError('2MB以下のUTF-8 CSVを選択してください。');}
  }
  async function send(action:'preview'|'import') {
    setBusy(true);setError('');setResult('');
    try {
      const response=await fetch('/api/flights/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,csv,source,delimiter,mapping,overrides,selected})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'処理できませんでした。');
      if(action==='preview'){setPreview(payload);setMapping(payload.mapping);setSelected(payload.entries.filter((e:ImportEntry)=>!e.errors.length&&!e.duplicate).map((e:ImportEntry)=>e.index));setDirty(false);}
      else {setResult(`${payload.imported}件を取り込みました。重複${payload.skipped}件をスキップしました。`);setPreview(null);setSelected([]);setDirty(true);router.refresh();}
    }catch(e){setError(e instanceof Error?e.message:'処理できませんでした。');if(action==='import'){setDirty(true);router.refresh();}}
    finally{setBusy(false);}
  }
  function timestamp(value:string,airportId:string) {const zone=data.airports.find(a=>a.id===airportId)?.timezone||'UTC';return `${formatInTimeZone(value,zone,'yyyy-MM-dd HH:mm')} (${zone})`;}
  return <section className="panel flight-import" aria-label="フライトCSVインポート"><h2>フライトをインポート</h2>
    <p>myFlightradar24・OpenFlightsのCSV、または列を割り当てたCSVを読み込みます（UTF-8・2MB・500件まで）。</p>
    <p className="form-help"><a href="https://my.flightradar24.com/settings/export" target="_blank" rel="noreferrer">myFlightradar24からCSVを出力 ↗</a> · <a href="/flight-import-template.csv" download>汎用CSVテンプレート</a></p>
    <p className="form-help">取り込んだフライトとメモは一般公開されます。空港は登録済みデータと照合します。時刻は各空港の現地時刻として扱います。myFlightradar24の搭乗済み記録は実際の日時、それ以外は予定日時に保存します。日付・時刻がない行は補完が必要です。</p>
    <fieldset disabled={busy}>
      <div className="import-controls"><label>インポート元<select value={source} onChange={e=>{setSource(e.target.value);setDirty(true);}}><option value="auto">自動判別</option><option>myFlightradar24</option><option>OpenFlights</option><option value="CSV">汎用CSV</option></select></label><label>CSVファイル<input type="file" accept=".csv,text/csv" onChange={e=>{if(e.target.files?.[0])void load(e.target.files[0]);}}/></label><label>区切り文字<select value={delimiter} onChange={e=>{setDelimiter(e.target.value);setMapping(undefined);setOverrides({});setPreview(null);setDirty(true);}}><option value=",">カンマ</option><option value=";">セミコロン</option><option value={'\t'}>タブ</option></select></label></div>
      <details><summary>CSVを貼り付け・編集</summary><textarea aria-label="CSVデータ" rows={7} value={csv} onChange={e=>{setCsv(e.target.value);setOverrides({});setPreview(null);setMapping(undefined);setDirty(true);}}/></details>
      {preview&&<details className="import-mapping"><summary>列の割り当て（{preview.source}）</summary><div className="form-grid">{Object.entries(importFields).map(([field,label])=><label key={field}>{label}<select value={mapping?.[field as ImportField]||''} onChange={e=>{setMapping({...mapping,[field]:e.target.value});setOverrides({});setDirty(true);}}><option value="">割り当てなし</option>{preview.headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div><p className="form-help">割り当てない列（サービス独自ID、距離、旅行目的など）は取り込みません。必要な情報はメモに移してください。スラッシュ区切りの日付はMM/DD/YYYYとして扱います。</p></details>}
      <button className="button secondary" disabled={!csv||busy} onClick={()=>void send('preview')}>{busy?'処理中…':'プレビュー・再検証'}</button>
      {preview&&<><p className="import-summary">{preview.entries.length}件中、取込可能 {preview.entries.filter(e=>!e.errors.length&&!e.duplicate).length}件 ／ 重複 {preview.entries.filter(e=>e.duplicate).length}件 ／ 要修正 {preview.entries.filter(e=>e.errors.length).length}件</p>
        <p className="form-help">重複は便名・出発空港・到着空港・出発日時で判定します。既存の記録は上書きしません。</p>
        {dirty&&<p role="status">変更があります。「プレビュー・再検証」で確認してください。</p>}
        <div className="import-rows">{preview.entries.map(entry=><article key={entry.index} className="import-row"><label className="import-select"><input type="checkbox" aria-label={`行${entry.index+1}を取り込む`} checked={selected.includes(entry.index)} disabled={dirty||!!entry.errors.length||entry.duplicate} onChange={e=>setSelected(e.target.checked?[...selected,entry.index]:selected.filter(i=>i!==entry.index))}/><strong>{entry.index+1}. {entry.values.flight_number||'便名未入力'} · {entry.values.origin} → {entry.values.destination}</strong></label>
          {entry.record&&<p>{entry.record.actual_departure?'実際の日時':'予定日時'}：{timestamp(entry.record.actual_departure||entry.record.scheduled_departure,entry.record.origin)} → {timestamp(entry.record.actual_arrival||entry.record.scheduled_arrival,entry.record.destination)} · {entry.record.cabin||'クラス未入力'}</p>}
          {entry.duplicate&&<p>重複：スキップします</p>}{entry.errors.map((e,i)=><p key={i} className="form-error">{e}</p>)}{entry.warnings.map((w,i)=><p key={i} className="form-help">{w}</p>)}
          <details><summary>取込内容の確認・修正</summary><div className="form-grid">{Object.entries(importFields).map(([field,label])=><label key={field}>{label}<input value={overrides[entry.index]?.[field as ImportField]??entry.values[field as ImportField]??''} onChange={e=>{setOverrides({...overrides,[entry.index]:{...overrides[entry.index],[field]:e.target.value}});setDirty(true);}} placeholder={field==='arrival_date'?'YYYY-MM-DD':undefined}/></label>)}</div></details>
        </article>)}</div><button className="button" disabled={dirty||!selected.length||busy} onClick={()=>void send('import')}>選択した{selected.length}件を公開して取り込む</button></>}
    </fieldset>{error&&<p className="form-error" role="alert">{error}</p>}{result&&<p role="status">{result}</p>}
  </section>;
}
