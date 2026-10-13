import {readFile} from 'node:fs/promises';
const definitions = JSON.parse(await readFile(new URL('../src/lib/schema.json',import.meta.url),'utf8'));
const url = process.env.DIRECTUS_URL || 'http://localhost:12001';
for (const name of ['ADMIN_EMAIL','ADMIN_PASSWORD','ARCHIVE_TOKEN']) if (!process.env[name]) throw new Error(`Set ${name}`);
if (process.env.ARCHIVE_TOKEN.length < 32) throw new Error('ARCHIVE_TOKEN must contain at least 32 characters');
let token;
async function call(path,method='GET',body) {
  const response = await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : (await response.json()).data;
}
for (let attempt=0; attempt<30; attempt++) {
  try {token = (await call('/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})).access_token; break;}
  catch(error) {if (attempt===29) throw error; await new Promise(resolve=>setTimeout(resolve,2000));}
}
const existing = new Set((await call('/collections')).map(item=>item.collection));
for (const [collection,definition] of Object.entries(definitions)) {
  const fields = Object.entries(definition.fields).map(([field,info])=>({
    field,type:info.type,meta:{hidden:!!info.hidden,interface:info.relation?'select-dropdown-m2o':info.type==='text'?'input-multiline':'input',...(info.relation?{special:['m2o']}:{})},
    schema:{is_nullable:!info.required},
  }));
  if (!existing.has(collection)) {
    await call('/collections','POST',{collection,meta:{note:definition.label},schema:{},fields:[{field:'id',type:'uuid',meta:{hidden:true,readonly:true,special:['uuid']},schema:{is_primary_key:true,is_nullable:false}},...fields]});
    console.log(`Created ${collection}`);
  } else {
    const current = new Set((await call(`/fields/${collection}`)).map(item=>item.field));
    for (const field of fields) if (!current.has(field.field)) await call(`/fields/${collection}`,'POST',field);
  }
}
// Public display name is separate from login credentials and flight records.
if (!existing.has('site_settings')) await call('/collections','POST',{collection:'site_settings',meta:{note:'サイト設定'},schema:{},fields:[{field:'id',type:'string',schema:{is_primary_key:true,is_nullable:false},meta:{hidden:true}},{field:'username',type:'string',schema:{is_nullable:false},meta:{interface:'input'}}]});
const settings=await call('/items/site_settings?filter[id][_eq]=main&fields=id');
if (!settings.length) await call('/items/site_settings','POST',{id:'main',username:''});

// Existing installations also need to accept actual-only flight records.
for (const field of ['scheduled_departure','scheduled_arrival']) {
  const current = await call('/fields/flights/'+field);
  if (!current.schema.is_nullable) await call('/fields/flights/'+field,'PATCH',{schema:{is_nullable:true}});
}
const relations = new Set((await call('/relations')).map(item=>`${item.collection}.${item.field}`));
for (const [collection,definition] of Object.entries(definitions)) {
  for (const [field,info] of Object.entries(definition.fields)) {
    if (info.relation && !relations.has(`${collection}.${field}`)) await call('/relations','POST',{collection,field,related_collection:info.relation,schema:{on_delete:'RESTRICT'},meta:{many_collection:collection,many_field:field,one_collection:info.relation}});
  }
}
const self = await call('/users/me?fields=id');
await call(`/users/${self.id}`,'PATCH',{token:process.env.ARCHIVE_TOKEN});
const categories = await call('/items/categories?limit=-1');
for (const name of ['航空機','空港','機内','機内食','その他']) if (!categories.some(item=>item.name===name)) await call('/items/categories','POST',{name});
console.log('Schema ready. Public Directus permissions are not granted. Only expose the web service.');
