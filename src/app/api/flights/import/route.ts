import {importId} from '@/lib/flight-import-id';
import {z} from 'zod';
import {adminToken,sameOrigin} from '@/lib/auth';
import {api,rows} from '@/lib/directus';
import {limitedBody} from '@/lib/body';
import {previewFlights} from '@/lib/flight-import';
import {importFields} from '@/lib/flight-import-fields';
import type {Row} from '@/lib/model';

const fields=z.enum(Object.keys(importFields) as [keyof typeof importFields,...(keyof typeof importFields)[]]);
const values=z.partialRecord(fields,z.string().max(10000));
const input=z.object({source:z.enum(['auto','myFlightradar24','OpenFlights','CSV']).default('auto'),csv:z.string().max(2*1024*1024),delimiter:z.enum([',',';','\t']).default(','),mapping:values.optional(),overrides:z.record(z.string().regex(/^\d{1,3}$/),values).default({}),selected:z.array(z.number().int().min(0).max(499)).max(500).optional(),action:z.enum(['preview','import'])});
export async function POST(request:Request) {
  if(!sameOrigin(request)||!await adminToken())return Response.json({error:'管理者としてログインしてください。'},{status:403});
  try {
    const body=input.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await limitedBody(request,4*1024*1024))));
    const [airports,airlines,aircraft,flights]=await Promise.all(['airports','airlines','aircraft','flights'].map(c=>rows(c,true)));
    const preview=previewFlights(body.csv,body.mapping,body.overrides,{airports,airlines,aircraft,flights},body.delimiter,Date.now(),body.source);
    if(body.action==='preview')return Response.json(preview,{headers:{'Cache-Control':'private, no-store'}});
    const selected=[...new Set(body.selected||[])];
    if(!selected.length)throw new Error('取り込む行を選択してください。');
    const entries=selected.map(index=>preview.entries[index]);
    if(entries.some(e=>!e||e.errors.length||!e.record))throw new Error('選択行にエラーがあります。もう一度プレビューしてください。');
    const pending=entries.filter(e=>!e.duplicate).map(e=>({...e.record!,id:importId(e.record!)}));
    // Stable IDs also prevent duplicate creates after timeouts or concurrent retries.
    const existingIds=new Set(flights.map(f=>f.id));
    const records=pending.filter(r=>!existingIds.has(r.id));
    if(records.length) {
      try {await api<Row[]>('/items/flights',{method:'POST',body:JSON.stringify(records)});}
      catch {
        const current=new Set((await rows('flights',true)).map(f=>f.id));
        const saved=records.filter(r=>current.has(r.id)).length;
        return Response.json({error:`保存結果を再確認してください。今回の対象${records.length}件中${saved}件を確認できました。再プレビューして再実行できます。`,saved},{status:503,headers:{'Cache-Control':'no-store'}});
      }
    }
    return Response.json({imported:records.length,skipped:entries.length-records.length},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const message=error instanceof z.ZodError?'入力形式を確認してください。':error instanceof Error&&!error.message.startsWith('Directus')?error.message:'データを取得できませんでした。接続状態を確認してください。';
    return Response.json({error:message},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
