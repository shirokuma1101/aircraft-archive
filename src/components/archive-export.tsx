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
  return <section className="export-panel panel"><h2>登録データをエクスポート</h2>
    <h2>フライト履歴（CSV）</h2><p className="form-help">搭乗予定・搭乗済み・欠航・未搭乗を含む全フライトを出力します。予定・実績日時は各空港の現地時刻とUTCオフセット付きです。空港、航空会社、機種、機体番号、座席、クラス、メモを含みます。Excel向けのUTF-8形式です。</p>
    <button className="button secondary" disabled={!!busy} onClick={()=>void download('csv')}>{busy==='csv'?'書き出し中…':'フライトCSVをダウンロード'}</button>
    <h2>全登録データ（JSON）</h2><p className="form-help">フライト・空港・航空会社・機種・機体・機体履歴・写真情報・カテゴリーをIDと関連付けを保って保存します。非公開写真の登録情報も含みます。画像ファイル自体と管理者アカウントは含みません。JSONの自動復元機能は未対応です。</p>
    <button className="button secondary" disabled={!!busy} onClick={()=>void download('json')}>{busy==='json'?'書き出し中…':'全データJSONをダウンロード'}</button>
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
