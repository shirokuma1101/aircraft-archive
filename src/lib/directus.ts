import 'server-only';
import {schema, type Archive, type Row} from './model';
export function configured() {return Boolean(process.env.DIRECTUS_URL && process.env.ARCHIVE_TOKEN);}
export async function directus(path: string, init: RequestInit = {}, token = process.env.ARCHIVE_TOKEN) {
  if (!process.env.DIRECTUS_URL) throw new Error('Directus接続先が設定されていません。');
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type','application/json');
  const read = !init.method || init.method === 'GET';
  for (let attempt=0;;attempt++) {
    const response = await fetch(`${process.env.DIRECTUS_URL}${path}`, {...init, headers, cache:'no-store', signal: AbortSignal.timeout(20000)});
    if (!read || ![429,503].includes(response.status) || attempt>=2) return response;
    await response.body?.cancel();
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
}
export async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await directus(path, init, token);
  if (!response.ok) throw new Error(`Directus request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return (await response.json()).data;
}
export async function rows(collection: string, includePrivate = false): Promise<Row[]> {
  const params = new URLSearchParams({fields: ['id',...Object.keys(schema[collection].fields)].join(','), limit:'-1', sort:'id'});
  if (collection === 'photos' && !includePrivate) params.set('filter[visibility][_eq]','public');
  // This initial version loads the full archive. One query avoids offset drift
  // while an airport import is running; Directus UUIDs do not support _gt.
  return api<Row[]>(`/items/${collection}?${params}`);
}
export async function archive(includePrivate = false): Promise<Archive> {
  return Object.fromEntries(await Promise.all(Object.keys(schema).map(async key => [key,await rows(key,includePrivate)])));
}
