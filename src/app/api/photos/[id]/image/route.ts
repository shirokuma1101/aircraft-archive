import {api,directus} from '@/lib/directus';
import {adminToken} from '@/lib/auth';
import {z} from 'zod';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null,{status:404});
  try {
    const photo = await api<{file:string;visibility:string}>(`/items/photos/${id}?fields=file,visibility`);
    const original = new URL(request.url).searchParams.get('original') === '1';
    if ((photo.visibility !== 'public' || original) && !await adminToken()) return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
    const size = new URL(request.url).searchParams.get('size') === 'large' ? 1600 : 640;
    const response = await directus(`/assets/${photo.file}${original ? '' : `?width=${size}&height=${size}&fit=inside&withoutEnlargement=true&quality=82&format=webp`}`);
    if (!response.ok) throw new Error('Asset unavailable');
    const headers = new Headers({'Content-Type':response.headers.get('Content-Type') || 'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    if (original) headers.set('Content-Disposition','attachment; filename="original-photo"');
    return new Response(response.body,{headers});
  } catch {return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});}
}
