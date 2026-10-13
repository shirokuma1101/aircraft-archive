import {formatInTimeZone} from 'date-fns-tz';
import {adminToken} from '@/lib/auth';
import {archive,rows} from '@/lib/directus';
import {flightCsv,archiveJson} from '@/lib/export';
import type {Archive} from '@/lib/model';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  if(!await adminToken())return Response.json({error:'管理者としてログインしてください。'},{status:403,headers});
  const format=new URL(request.url).searchParams.get('format');
  if(format!=='csv'&&format!=='json')return Response.json({error:'書き出し形式を確認してください。'},{status:400,headers});
  try {
    const data:Archive=format==='json'?await archive(true):Object.fromEntries(await Promise.all(['flights','airports','airlines','aircraft','aircraft_types'].map(async name=>[name,await rows(name,true)])));
    const stamp=formatInTimeZone(new Date(),'Asia/Tokyo','yyyyMMdd-HHmmss');
    const filename=`${format==='csv'?'flights':'aircraft-archive'}-${stamp}.${format}`;
    return new Response(format==='csv'?flightCsv(data):archiveJson(data),{headers:{...headers,'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`}});
  }catch{return Response.json({error:'書き出しに失敗しました。接続状態を確認して再実行してください。'},{status:503,headers});}
}
