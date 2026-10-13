import {NextResponse} from 'next/server';
import {z} from 'zod';
import {adminToken,sameOrigin} from '@/lib/auth';
import {api} from '@/lib/directus';
import {limitedJson} from '@/lib/body';
import {siteSettings} from '@/lib/site-settings';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
  if(!await adminToken())return new Response(null,{status:403});
  try{return NextResponse.json(await siteSettings(),{headers});}
  catch{return NextResponse.json({error:'設定を取得できませんでした。'},{status:503,headers});}
}
export async function PATCH(request:Request){
  if(!sameOrigin(request))return new Response(null,{status:403});
  const token=await adminToken();if(!token)return new Response(null,{status:403});
  try{
    const input=z.object({username:z.string().trim().min(1).max(50).regex(/^[^\u0000-\u001f\u007f]+$/)}).strict().parse(await limitedJson(request));
    await api('/items/site_settings/main',{method:'PATCH',body:JSON.stringify(input)},token);
    return NextResponse.json(input,{headers});
  }catch(error){return NextResponse.json({error:error instanceof z.ZodError?'ユーザー名は1〜50文字で入力してください。改行は使用できません。':'設定を保存できませんでした。'},{status:400,headers});}
}
