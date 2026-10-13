'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function SiteSettings(){
  const router=useRouter();const [username,setUsername]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{const controller=new AbortController();fetch('/api/site-settings',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('設定を取得できませんでした。ページを再読み込みしてください。');const data=await r.json();setUsername(data.username||'');setReady(true);}).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);});return()=>controller.abort();},[]);
  return <section aria-label="公開プロフィール"><form className="panel record-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/site-settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});const data=await r.json();if(!r.ok)throw Error(data.error);setUsername(data.username);setMessage('保存しました。');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}}}><h2>公開プロフィール</h2><label>公開ユーザー名<input value={username} onChange={e=>setUsername(e.target.value)} required maxLength={50} disabled={!ready||busy}/></label><p className="form-help">ブラウザーのタブに「Aircraft Archive — ユーザー名」と表示します。ログイン用のメールアドレスは変わりません。</p><div className="form-actions"><button className="button" disabled={!ready||busy}>{busy?'保存中…':'サイト設定を保存'}</button></div>{message&&<p role="status">{message}</p>}</form></section>;
}
