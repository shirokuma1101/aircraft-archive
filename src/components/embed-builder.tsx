'use client';
import {useEffect,useState} from 'react';
import {embedAddress,embedCode,embedDesigns,type EmbedDesign} from '@/lib/embed';
export default function EmbedBuilder() {
  const [base,setBase]=useState(''),[design,setDesign]=useState<EmbedDesign>('summary'),[theme,setTheme]=useState('light'),[year,setYear]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{setBase(window.location.origin);},[]);
  let url='',code='',error='';
  try{if(base){url=embedAddress(base,design,theme,year);code=embedCode(url,design);}}catch(e){error=e instanceof Error?e.message:'URLを確認してください。';}
  const preview=(()=>{try{return embedAddress('http://localhost',design,theme,year).replace('http://localhost','');}catch{return '';}})();
  return <section className="panel embed-builder"><div className="form-grid">
    <label>デザイン<select value={design} onChange={e=>{setDesign(e.target.value as EmbedDesign);setMessage('');}}>{Object.entries(embedDesigns).map(([key,d])=><option key={key} value={key}>{d.name}</option>)}</select></label>
    <label>配色<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">ライト</option><option value="dark">ダーク</option></select></label>
    <label>対象年<input type="text" inputMode="numeric" placeholder="空欄ですべての年" maxLength={4} value={year} onChange={e=>setYear(e.target.value)}/></label>
    <label>公開サイトURL<input type="url" value={base} onChange={e=>setBase(e.target.value)}/></label>
  </div><p className="form-help">外部サイトで使う場合は、Cloudflare Tunnelなどで公開したURLを指定してください。localhostは他の端末から閲覧できません。公開済みの搭乗実績を表示し、再読み込み時に最新データを取得します。</p>
    <h2>プレビュー</h2>{preview&&<iframe className="embed-preview" src={preview} title="埋め込みプレビュー" height={embedDesigns[design].height}/>}
    <h2>埋め込みコード</h2><p className="form-help">貼り付け先のHTML欄にコピーしてください。iframeに対応しているサイトで利用できます。高さは必要に応じて調整できます。</p>
    <textarea aria-label="埋め込みコード" readOnly rows={5} value={code}/><button className="button" disabled={!code} onClick={async()=>{try{await navigator.clipboard.writeText(code);setMessage('コピーしました。');}catch{setMessage('コード欄を選択してコピーしてください。');}}}>コードをコピー</button>
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
