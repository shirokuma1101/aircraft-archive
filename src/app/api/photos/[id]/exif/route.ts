import {NextResponse} from 'next/server';
import {z} from 'zod';
import {api,directus} from '@/lib/directus';
import {adminToken} from '@/lib/auth';
import {readExif} from '@/lib/exif';
const headers={'Cache-Control':'private, no-store'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers});
  try {
    const response=await directus(`/items/photos/${id}?fields=file,visibility`);
    if(response.status===403||response.status===404)return new Response(null,{status:404,headers});
    if(!response.ok)throw new Error('Photo unavailable');
    const {data:photo}=await response.json();
    if(photo.visibility!=='public'&&!await adminToken())return new Response(null,{status:404,headers});
    const file=await api<{filesize:string|number}>(`/files/${photo.file}?fields=filesize`);
    if(Number(file.filesize)>30*1024*1024)throw new Error('File exceeds metadata read limit');
    const original=await directus(`/assets/${photo.file}`);
    if(!original.ok)throw new Error('Original unavailable');
    const reader=original.body?.getReader();if(!reader)throw new Error('Empty response');
    const chunks:Uint8Array[]=[];let size=0;
    try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>30*1024*1024){await reader.cancel();throw new Error('File too large');}chunks.push(value);}}finally{reader.releaseLock();}
    return NextResponse.json(await readExif(Buffer.concat(chunks)),{headers});
  }catch{return NextResponse.json({error:'EXIF情報を読み込めませんでした。'},{status:503,headers});}
}
