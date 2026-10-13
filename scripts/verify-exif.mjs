import {chromium,expect} from '@playwright/test';
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
const base=process.env.APP_ORIGIN,service=process.env.DIRECTUS_URL;
if(!base||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local environment required');
const token=process.env.ARCHIVE_TOKEN;
async function api(path,method='GET',body){const r=await fetch(service+path,{method,headers:{Authorization:`Bearer ${token}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`${method} ${path}: ${r.status}`);return r.status===204?null:(await r.json()).data;}
let file,photo;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const bytes=await sharp({create:{width:800,height:500,channels:3,background:'#6b8890'}}).withExif({IFD0:{Make:'Canon',Model:'Canon EOS R6',Artist:'Hidden owner'},IFD2:{DateTimeOriginal:'2026:10:05 10:20:30',OffsetTimeOriginal:'+09:00',ExposureTime:'1/1000',FNumber:'56/10',ISOSpeedRatings:'400',LensModel:'RF100-500mm',BodySerialNumber:'Hidden serial'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'35/1 33/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'139/1 47/1 0/1',GPSAltitudeRef:'0',GPSAltitude:'15/1'}}).jpeg().toBuffer();
  const form=new FormData();form.set('file',new Blob([bytes],{type:'image/jpeg'}),'exif-verification.jpg');
  file=await api('/files','POST',form);
  photo=await api('/items/photos','POST',{title:'EXIF verification (temporary)',file:file.id,visibility:'public'});
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  await page.goto(`${base}/photos/${photo.id}`);
  await expect(page.getByText('Canon EOS R6',{exact:true})).toBeVisible();
  await expect(page.getByText('1/1000 秒',{exact:true})).toBeVisible();
  await expect(page.getByText('f/5.6',{exact:true})).toBeVisible();
  await expect(page.getByText('35.550000°',{exact:true})).toBeVisible();
  await expect(page.getByText('139.783333°',{exact:true})).toBeVisible();
  await expect(page.getByText('15 m',{exact:true})).toBeVisible();
  await expect(page.locator('.photo-location-map')).toBeVisible();
  await expect(page.getByRole('link',{name:'地図で開く'})).toHaveAttribute('href',/mlat=35.55&mlon=139.783333/);
  const response=await page.request.get(`${base}/api/photos/${photo.id}/exif`);
  expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
  const body=await response.text();expect(body).not.toContain('Hidden');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('region',{name:'EXIF情報'}).scrollIntoViewIfNeeded();
  await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/exif-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await api(`/items/photos/${photo.id}`,'PATCH',{visibility:'private'});
  expect((await page.request.get(`${base}/api/photos/${photo.id}/exif`)).status()).toBe(404);
  const login=await page.request.post(`${base}/api/auth`,{headers:{Origin:base},data:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}});expect(login.status()).toBe(200);
  expect((await page.request.get(`${base}/api/photos/${photo.id}/exif`)).status()).toBe(200);
  const samples=await api('/items/photos?filter[tags][_nnull]=true&fields=id,title&limit=20');
  const sample=samples.find(row=>row.title.includes('サンプル'));
  if(sample){await page.goto(`${base}/photos/${sample.id}`);await expect(page.getByText('この画像には表示できるEXIF撮影情報がありません。')).toBeVisible();}
  console.log('PASS: EXIF/GPS fields and map, mobile layout, privacy allowlist, public/private/admin access, no-EXIF state');
}finally{
  if(photo)await api(`/items/photos/${photo.id}`,'DELETE');
  if(file)await api(`/files/${file.id}`,'DELETE');
  await browser.close();
}
