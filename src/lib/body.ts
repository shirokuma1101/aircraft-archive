export async function limitedBody(request:Request,limit:number) {
  if (Number(request.headers.get('content-length'))>limit) throw new Error('送信データが大きすぎます。');
  const reader=request.body?.getReader();
  if(!reader)throw new Error('送信データがありません。');
  const parts:Uint8Array[]=[];let length=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error('送信データが大きすぎます。');}parts.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  return bytes;
}
export async function limitedJson(request:Request){return JSON.parse(new TextDecoder().decode(await limitedBody(request,128*1024)));}
