// Add/remove only explicitly tracked demonstration records. Never replaces user records.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const url=process.env.DIRECTUS_URL;
if(!url||!process.env.ARCHIVE_TOKEN)throw new Error('DIRECTUS_URL and ARCHIVE_TOKEN are required');
const manifestPath=new URL('../.local/demo-data.json',import.meta.url);
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
let manifest={url,records:[]};
try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(manifest.url!==url)throw new Error('Demo manifest belongs to another Directus URL');
const persist=()=>writeFile(manifestPath,JSON.stringify(manifest,null,2));
async function api(path,method='GET',body){
  const response=await fetch(url+path,{method,headers:{Authorization:`Bearer ${process.env.ARCHIVE_TOKEN}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw new Error(`${method} ${path}: ${response.status}`);
  return response.status===204?null:(await response.json()).data;
}
if(process.argv.includes('--remove')){
  // References are removed before their targets. The manifest is kept in sync.
  for(const collection of ['photos','flights','aircraft','aircraft_types','airlines','files']){
    for(const row of [...manifest.records].filter(r=>r.collection===collection)){
      await api(`${collection==='files'?'/files':'/items/'+collection}/${row.id}`,'DELETE');
      manifest.records=manifest.records.filter(r=>r.id!==row.id);await persist();
    }
  }
  console.log('Removed tracked demo records. Existing airports and user records preserved.');
  process.exit(0);
}
async function add(key,collection,body){
  const existing=manifest.records.find(r=>r.key===key);
  if(existing)return api(`/items/${collection}/${existing.id}`);
  const row=await api(`/items/${collection}`,'POST',body);
  manifest.records.push({key,collection,id:row.id});await persist();return row;
}
const airports=await api('/items/airports?limit=-1&fields=id,iata,name');
const airport=code=>{const found=airports.find(a=>a.iata===code);if(!found)throw new Error(`Import airports first: ${code}`);return found;};
for(const code of ['HND','CTS','ITM','FUK','OKA','SFO','SIN'])airport(code);
const categories=await api('/items/categories?limit=-1');
const airline=await add('airline','airlines',{name:'Archive Air（サンプル）'});
const wideType=await add('type-wide','aircraft_types',{name:'Boeing 787-9（サンプル）',manufacturer:'Boeing',icao:'B789'});
const narrowType=await add('type-narrow','aircraft_types',{name:'Airbus A320neo（サンプル）',manufacturer:'Airbus',icao:'A20N'});
const wide=await add('aircraft-wide','aircraft',{registration:'DEMO-789',type:wideType.id,airline:airline.id,notes:'画面確認用の架空の機体です。実在する登録記号ではありません。'});
const narrow=await add('aircraft-narrow','aircraft',{registration:'DEMO-320',type:narrowType.id,airline:airline.id,notes:'画面確認用の架空の機体です。実在する登録記号ではありません。'});
const entries=[
  ['101','HND','CTS','2026-01-18T00:00:00Z',100,'flown'],
  ['102','CTS','HND','2026-01-21T08:00:00Z',105,'flown'],
  ['201','HND','ITM','2026-03-12T01:00:00Z',70,'flown'],
  ['202','ITM','HND','2026-03-14T09:00:00Z',75,'flown'],
  ['301','HND','FUK','2026-05-08T23:00:00Z',120,'flown'],
  ['302','FUK','HND','2026-05-11T07:00:00Z',110,'flown'],
  ['401','HND','SFO','2026-07-10T12:00:00Z',560,'flown'],
  ['402','SFO','HND','2026-07-17T18:00:00Z',650,'flown'],
  ['501','HND','OKA','2026-09-26T00:00:00Z',165,'planned'],
  ['601','HND','SIN','2026-11-15T15:00:00Z',430,'planned'],
  ['602','SIN','HND','2026-11-18T14:00:00Z',410,'planned'],
  ['701','HND','CTS','2026-08-20T01:00:00Z',100,'cancelled'],
];
const flights=[];
for(const [number,from,to,departure,minutes,status]of entries){
  const aircraft=['SFO','SIN'].includes(from)||['SFO','SIN'].includes(to)?wide:narrow;
  const end=new Date(Date.parse(departure)+minutes*60000).toISOString();
  flights.push(await add(`flight-${number}`,'flights',{
    flight_number:`DEMO ${number}`,status,origin:airport(from).id,destination:airport(to).id,
    scheduled_departure:departure,scheduled_arrival:end,
    actual_departure:status==='flown'?new Date(Date.parse(departure)+5*60000).toISOString():null,
    actual_arrival:status==='flown'?new Date(Date.parse(end)+3*60000).toISOString():null,
    airline:airline.id,airline_name:airline.name,aircraft:aircraft.id,registration:aircraft.registration,
    seat:'12A',cabin:'Economy',notes:'【サンプル】表示・操作確認用の架空の搭乗記録です。実際の運航情報ではありません。',
  }));
}
function illustration(kind){
  const palettes=[['#cbe1ec','#658ea4','#d6d6b1'],['#efcfac','#9e97b2','#7a8187'],['#b5dce8','#558ca1','#ecf4f4'],['#9cafbb','#4e667f','#b4c6ba']];
  const [sky,horizon,ground]=palettes[kind];
  const aircraft=`<g transform="translate(245 340) rotate(-10)"><path d="M0 27 Q15 6 90 5 L400 5 L456 -105 L495 -105 L473 6 Q535 8 550 27 Q535 44 476 43 L345 43 L254 143 L201 143 L243 43 L86 43 L29 80 L0 80 L26 41Z" fill="#f5f5ef"/><path d="M400 5 L456 -105 L495 -105 L473 6Z" fill="#25695f"/><path d="M40 28 H454" stroke="#559b88" stroke-width="8"/><g fill="#315765">${Array.from({length:17},(_,i)=>`<rect x="${85+i*19}" y="15" width="8" height="7" rx="3"/>`).join('')}</g></g>`;
  const terminal=`<path d="M0 470 L1200 405 V800 H0Z" fill="${ground}"/><path d="M0 550 H1200 M0 680 H1200" stroke="#c7c8b5" stroke-width="4"/><rect x="65" y="205" width="340" height="275" fill="#253e4b" opacity=".87"/>${[0,1,2,3,4].map(i=>`<path d="M${85+i*66} 210 V475" stroke="#8ca4a7" stroke-width="6"/>`).join('')}<path d="M65 310 H405 M65 410 H405" stroke="#8ca4a7" stroke-width="6"/><path d="M490 455 V210 H555 V455 M480 210 H565 L552 155 H496Z" fill="#586f78"/>`;
  const wing=`<path d="M-80 790 L350 615 L905 335 L959 230 L997 218 L986 358 L613 690 L1000 790Z" fill="#eaf0ef"/><path d="M350 615 L986 358 L613 690" fill="#a5bdc4"/><path d="M905 335 L959 230 L997 218 L986 358Z" fill="#38796b"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${horizon}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#sky)"/><circle cx="950" cy="165" r="72" fill="#fff4d9" opacity=".75"/><g fill="#fff" opacity=".35"><ellipse cx="160" cy="185" rx="180" ry="27"/><ellipse cx="680" cy="480" rx="230" ry="35"/><ellipse cx="1050" cy="570" rx="230" ry="35"/></g>${kind===1?terminal:kind===2?wing:`<path d="M0 590 Q300 535 600 610 T1200 550 V800 H0Z" fill="${ground}"/>${aircraft}`}<rect x="48" y="46" width="205" height="35" rx="4" fill="#17373d" opacity=".8"/><text x="66" y="69" font-family="sans-serif" font-size="16" letter-spacing="3" fill="#fff">SAMPLE / ILLUSTRATION</text><text x="50" y="745" font-family="sans-serif" font-size="23" letter-spacing="8" fill="#fff">AIRCRAFT ARCHIVE</text></svg>`;
}
const photos=[
  ['空へ向かう一機（サンプル）','航空機','HND',flights[6],wide,'2026-07-10','public'],
  ['夕暮れのターミナル（サンプル）','空港','FUK',flights[4],null,'2026-05-09','public'],
  ['窓の向こう、太平洋（サンプル）','機内','SFO',flights[7],wide,'2026-07-17','public'],
  ['非公開画像の確認用（サンプル）','航空機','CTS',flights[0],narrow,'2026-01-18','private'],
];
for(let i=0;i<photos.length;i++){
  const [title,category,code,flight,aircraft,date,visibility]=photos[i];
  let file=manifest.records.find(r=>r.key===`file-${i}`);
  if(!file){
    const bytes=await sharp(Buffer.from(illustration(i))).png().toBuffer();
    const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),`archive-demo-${i}.png`);
    const uploaded=await api('/files','POST',form);
    file={key:`file-${i}`,collection:'files',id:uploaded.id};manifest.records.push(file);await persist();
  }
  await add(`photo-${i}`,'photos',{title,file:file.id,visibility,category:categories.find(c=>c.name===category)?.id||null,tags:['サンプル','イラスト'],taken_on:date,location:airport(code).name,airport:airport(code).id,flight:flight.id,aircraft:aircraft?.id||null,registration:aircraft?.registration||null,description:'【サンプル】画面確認用に作成したイラストです。実写写真・実際の搭乗記録ではありません。'});
}
console.log('Demo ready: 12 flights, 2 aircraft, 4 illustrations (3 public / 1 private). Manifest: .local/demo-data.json');
