import {NextResponse} from 'next/server';
import {z} from 'zod';
import {api} from '@/lib/directus';
import {sameOrigin,setSession,clearSession} from '@/lib/auth';
import {limitedJson} from '@/lib/body';
import {turnstileConfig,verifyTurnstile} from '@/lib/turnstile';
export async function POST(request:Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'許可されていないリクエストです。'},{status:403});
  let challenge;
  try {challenge=turnstileConfig();}
  catch {return NextResponse.json({error:'ログイン認証が未設定です。管理者にお問い合わせください。'},{status:503});}
  try {
    const input = z.object({email:z.email(),password:z.string().min(1).max(1000),turnstileToken:z.unknown().optional()}).parse(await limitedJson(request));
    if(!await verifyTurnstile(input.turnstileToken,challenge)) return NextResponse.json({error:'認証を確認できませんでした。もう一度認証してからログインしてください。'},{status:403});
    const credentials={email:input.email,password:input.password};
    if (credentials.email.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) throw new Error('Invalid user');
    const auth = await api<{access_token:string;expires:number}>('/auth/login',{method:'POST',body:JSON.stringify(credentials)},'');
    await setSession(auth.access_token,auth.expires);
    return NextResponse.json({ok:true});
  } catch {return NextResponse.json({error:'ログインできませんでした。入力内容または接続設定を確認してください。'},{status:401});}
}
export async function DELETE(request:Request) {
  if (!sameOrigin(request)) return new Response(null,{status:403});
  await clearSession();
  return NextResponse.json({ok:true});
}
