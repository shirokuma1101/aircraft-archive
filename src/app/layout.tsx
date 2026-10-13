import {ThemeProvider} from '@/components/theme-provider';
import {themeScript} from '@/lib/theme-init';
import type {Metadata} from 'next';
import {siteTitle} from '@/lib/site-settings';
import './globals.css';
import 'leaflet/dist/leaflet.css';
export async function generateMetadata():Promise<Metadata>{return {title:{default:await siteTitle(),template:'%s | Aircraft Archive'},description:'フライトログと航空写真のアーカイブ。',icons:{icon:'/favicon.svg?v=2'}};}
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ja" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;}
