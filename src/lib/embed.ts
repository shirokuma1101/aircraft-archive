export const embedDesigns={summary:{name:'集計カード',height:270},map:{name:'フライトマップ',height:510},recent:{name:'最新の搭乗履歴',height:520}};
export type EmbedDesign=keyof typeof embedDesigns;
export function embedOptions(query:Record<string,string|string[]|undefined>) {
  return {theme:query.theme==='dark'?'dark':'light',year:typeof query.year==='string'&&/^(19|20|21)\d{2}$/.test(query.year)?query.year:''};
}
export function embedAddress(base:string,design:EmbedDesign,theme:string,year:string) {
  const origin=new URL(base);
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('公開URLを http:// または https:// で入力してください。');
  const url=new URL(`/embed/${design}`,origin.origin);
  if(theme==='dark')url.searchParams.set('theme','dark');
  if(year) {
    if(!/^(19|20|21)\d{2}$/.test(year))throw new Error('年は4桁で入力してください。');
    url.searchParams.set('year',year);
  }
  return url.toString();
}
export function embedCode(url:string,design:EmbedDesign) {
  const escaped=url.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  return `<iframe src="${escaped}" title="搭乗実績：${embedDesigns[design].name}" width="100%" height="${embedDesigns[design].height}" style="border:0;border-radius:12px;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}
