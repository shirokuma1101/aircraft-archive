'use client';
import {useState} from 'react';
export default function ArchiveExport() {
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function download(format:'csv'|'json') {
    setBusy(format);setMessage('');setError('');
    try {
      const response=await fetch(`/api/export?format=${format}`,{cache:'no-store'});
      if(!response.ok)throw new Error((await response.json()).error||'書き出せませんでした。');
      const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||`archive.${format}`;
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('ファイルを書き出しました。');
    }catch(e){setError(e instanceof Error?e.message:'書き出せませんでした。');}finally{setBusy('');}
  }
  return <section className="export-panel panel"><h2>エクスポート</h2><div className="export-options"><section>
    <h3>フライト履歴</h3><p className="form-help">全フライト · CSV / UTF-8</p>
    <button className="button secondary" disabled={!!busy} onClick={()=>void download('csv')}>{busy==='csv'?'書き出し中…':'フライトCSVをダウンロード'}</button>
    </section><section><h3>全登録データ</h3><p className="form-help">非公開写真の情報を含みます。画像原本・アカウントは対象外。自動復元は未対応です。</p>
    <button className="button secondary" disabled={!!busy} onClick={()=>void download('json')}>{busy==='json'?'書き出し中…':'全データJSONをダウンロード'}</button>
    </section></div>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
