import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {adminToken,sameOrigin} from '@/lib/auth';
import {api} from '@/lib/directus';
import {limitedBody} from '@/lib/body';
export async function POST(request:Request) {
  if (!sameOrigin(request) || !await adminToken()) return new Response(null,{status:403});
  try {
    const body = await limitedBody(request,31*1024*1024);
    const form = await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 30 * 1024 * 1024 || file.size === 0) throw new Error('画像は30MB以下で選択してください。');
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes,{limitInputPixels:80000000}).metadata();
    const mime: Record<string,string> = {jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
    if (!metadata.format || !mime[metadata.format] || (metadata.pages || 1) > 1) throw new Error('静止画のJPEG、PNG、WebPに対応しています。');
    const upload = new FormData();
    upload.set('file',new Blob([bytes],{type:mime[metadata.format]}),`photo.${metadata.format}`);
    const result = await api<{id:string}>('/files',{method:'POST',body:upload});
    return NextResponse.json({id:result.id});
  } catch(error) {return NextResponse.json({error:error instanceof Error && !error.message.startsWith('Directus') ? error.message : 'アップロードに失敗しました。'},{status:400});}
}
