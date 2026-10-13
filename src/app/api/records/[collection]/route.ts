import {NextResponse} from 'next/server';
import {schema, type Row} from '@/lib/model';
import {validateRecord} from '@/lib/validation';
import {api,rows} from '@/lib/directus';
import {adminToken,sameOrigin} from '@/lib/auth';
import {z} from 'zod';
import {limitedJson} from '@/lib/body';
type Context = {params:Promise<{collection:string}>};
export async function GET(request:Request,context:Context) {
  const {collection} = await context.params;
  if (!Object.hasOwn(schema,collection)) return new Response(null,{status:404});
  try {return NextResponse.json(await rows(collection,Boolean(await adminToken())),{headers:{'Cache-Control':'private, no-store'}});}
  catch {return NextResponse.json({error:'データを取得できませんでした。'},{status:503});}
}
async function save(request:Request, context:Context, update:boolean) {
  const {collection} = await context.params;
  if (!Object.hasOwn(schema,collection)) return new Response(null,{status:404});
  if (!sameOrigin(request) || !await adminToken()) return new Response(null,{status:403});
  try {
    const body = await limitedJson(request);
    const id = update ? z.uuid().parse(body.id) : undefined;
    if (update) delete body.id;
    const data = validateRecord(collection,body);
    if (collection === 'flights' || collection === 'photos') {
      if (!data.registration && data.aircraft && !update) data.registration = (await api<Row>(`/items/aircraft/${data.aircraft}`)).registration;
      if (collection === 'flights' && !data.airline_name && data.airline && !update) data.airline_name = (await api<Row>(`/items/airlines/${data.airline}`)).name;
    }
    if (collection === 'photos') {
      const file = await api<Row>(`/files/${data.file}?fields=id,type`);
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPEG、PNG、WebPの画像を選択してください。');
    }
    const result = await api(`/items/${collection}${id ? `/${id}` : ''}`,{method:update?'PATCH':'POST',body:JSON.stringify(data)});
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const message = error instanceof z.ZodError ? error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' / ') : error instanceof Error && !error.message.startsWith('Directus') ? error.message : '保存できませんでした。関連データと接続状態を確認してください。';
    return NextResponse.json({error:message},{status:400});
  }
}
export const POST = (r:Request,c:Context) => save(r,c,false);
export const PATCH = (r:Request,c:Context) => save(r,c,true);
