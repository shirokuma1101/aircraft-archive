import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {archive,configured} from '@/lib/directus';
import {adminToken} from '@/lib/auth';
import {schema,type Archive} from '@/lib/model';
import ArchiveApp from '@/components/archive-app';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{path?:string[]}>}):Promise<Metadata> {
  const {path=[]}=await params;
  return path[0]==='manage' ? {robots:{index:false,follow:false}} : {};
}
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  const {path=[]}=await params;
  if(path.length>2 || path.length && !['flights','photos','aircraft','manage'].includes(path[0])) notFound();
  const admin=Boolean(await adminToken());
  let data:Archive=Object.fromEntries(Object.keys(schema).map(key=>[key,[]]));
  let connection:'ready'|'unconfigured'|'error'=configured()?'ready':'unconfigured';
  if(connection==='ready') try {data=await archive(admin);} catch {connection='error';}
  if(path.length===2 && path[0]!=='manage' && connection==='ready' && !data[path[0]]?.some(row=>row.id===path[1])) notFound();
  return <ArchiveApp data={data} path={path} admin={admin} connection={connection}/>;
}
