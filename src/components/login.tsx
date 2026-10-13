'use client';
import {useEffect,useRef,useState} from 'react';
import Script from 'next/script';
import {useRouter} from 'next/navigation';
import {ArrowRight} from 'lucide-react';
import {useTheme} from './theme-provider';

type TurnstileApi={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;reset:(id:string)=>void};
declare global {interface Window {turnstile?:TurnstileApi}}

export default function Login() {
  const router=useRouter();
  const {dark}=useTheme();
  const container=useRef<HTMLDivElement>(null),widget=useRef<string|undefined>(undefined);
  const [config,setConfig]=useState<{siteKey:string;test:boolean}|null>(null);
  const [ready,setReady]=useState(false),[token,setToken]=useState(''),[error,setError]=useState(''),[challengeError,setChallengeError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/auth/challenge',{cache:'no-store',signal:controller.signal}).then(async response=>{
      const result=await response.json();
      if(!response.ok)throw new Error(result.error);
      setConfig(result);
    }).catch(error=>{if(!controller.signal.aborted)setChallengeError(error instanceof Error?error.message:'認証を読み込めませんでした。');});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!config||!ready||!container.current||!window.turnstile)return;
    const api=window.turnstile;
    setToken('');
    widget.current=api.render(container.current,{
      sitekey:config.siteKey,action:'login',theme:dark?'dark':'light',size:'flexible','response-field':false,
      callback:(value:string)=>{setToken(value);setChallengeError('');},
      'expired-callback':()=>{setToken('');setChallengeError('認証の有効期限が切れました。再認証してください。');},
      'error-callback':()=>{setToken('');setChallengeError('認証を読み込めませんでした。接続を確認して再読み込みしてください。');},
      'timeout-callback':()=>{setToken('');setChallengeError('認証がタイムアウトしました。再認証してください。');},
    });
    return ()=>{if(widget.current!==undefined)api.remove(widget.current);widget.current=undefined;};
  },[config,ready,dark]);
  useEffect(()=>{
    if(ready)return;
    const timeout=setTimeout(()=>setChallengeError('認証の読み込みに時間がかかっています。接続を確認して再読み込みしてください。'),20000);
    return ()=>clearTimeout(timeout);
  },[ready]);
  return <main className="page narrow"><p className="eyebrow">FOR THE ARCHIVIST</p><h1>管理者ログイン</h1>
    {config&&<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={()=>setReady(true)} onError={()=>setChallengeError('認証を読み込めませんでした。接続を確認して再読み込みしてください。')}/>}
    <form className="panel login-form" onSubmit={async e=>{
      e.preventDefault();if(!token||busy)return;setBusy(true);setError('');
      const form=new FormData(e.currentTarget);
      try {
        const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password'),turnstileToken:token})});
        if(!response.ok)throw new Error((await response.json()).error);
        router.refresh();
      } catch(error){setError(error instanceof Error?error.message:'ログインできませんでした。');}
      finally{setToken('');if(widget.current!==undefined)window.turnstile?.reset(widget.current);setBusy(false);}
    }}>
      <label>メールアドレス<input name="email" type="email" autoComplete="username" required/></label>
      <label>パスワード<input name="password" type="password" autoComplete="current-password" required/></label>
      <div ref={container} aria-label="ログイン認証"/>
      {!ready&&!challengeError&&<p className="form-help" role="status">認証を読み込んでいます…</p>}
      {config?.test&&<p className="form-help">Turnstile テストモード（ローカル専用）</p>}
      {challengeError&&<div><p className="form-error" role="alert">{challengeError}</p><button type="button" className="button secondary" onClick={()=>{setToken('');setChallengeError('');if(widget.current!==undefined)window.turnstile?.reset(widget.current);else window.location.reload();}}>再認証</button></div>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button" disabled={busy||!token}>{busy?'ログイン中…':'ログイン'}<ArrowRight size={17}/></button>
      <p className="form-help">閲覧にはログイン不要です。新規ユーザー登録は受け付けていません。</p>
    </form></main>;
}
