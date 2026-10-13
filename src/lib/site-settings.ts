import 'server-only';
import {api} from './directus';
export async function siteSettings(){return api<{username:string}>('/items/site_settings/main?fields=username');}
export async function siteTitle(){
  try {const {username}=await siteSettings();return username?.trim()?`Aircraft Archive — ${username.trim()}`:'Aircraft Archive';}
  catch{return 'Aircraft Archive';}
}
