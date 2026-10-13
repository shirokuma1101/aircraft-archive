'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {Monitor,Sun,Moon} from 'lucide-react';
type Preference='system'|'light'|'dark';
const ThemeContext=createContext({dark:false,preference:'system' as Preference,setPreference:(_value:Preference)=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const [preference,setPreferenceState]=useState<Preference>('system');
  const [dark,setDark]=useState(false);
  useEffect(()=>{
    const media=matchMedia('(prefers-color-scheme: dark)');
    const sync=()=>{
      let p:Preference='system';
      try{const stored=localStorage.getItem('archive-theme');if(stored==='light'||stored==='dark')p=stored;}catch{}
      const next=p==='dark'||p==='system'&&media.matches;
      setPreferenceState(p);setDark(next);document.documentElement.dataset.theme=next?'dark':'light';
    };
    sync();media.addEventListener('change',sync);window.addEventListener('storage',sync);
    return ()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',sync);};
  },[]);
  function setPreference(value:Preference){
    try{localStorage.setItem('archive-theme',value);}catch{}
    setPreferenceState(value);
    const next=value==='dark'||value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(next);document.documentElement.dataset.theme=next?'dark':'light';
  }
  return <ThemeContext.Provider value={{dark,preference,setPreference}}>{children}</ThemeContext.Provider>;
}
export const useTheme=()=>useContext(ThemeContext);
export function ThemeToggle(){
  const {preference,setPreference}=useTheme();
  const next:Preference=preference==='system'?'light':preference==='light'?'dark':'system';
  const names={system:'端末設定',light:'ライト',dark:'ダーク'};
  const Icon=preference==='system'?Monitor:preference==='light'?Sun:Moon;
  const label=`カラーモード：${names[preference]}（${names[next]}に切り替え）`;
  return <button type="button" className="icon-button theme-toggle" aria-label={label} title={label} onClick={()=>setPreference(next)}><Icon size={19} aria-hidden="true"/></button>;
}
