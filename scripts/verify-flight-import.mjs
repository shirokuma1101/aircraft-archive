import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base=process.env.APP_ORIGIN,service=process.env.DIRECTUS_URL;
if(!base||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local environment required');
const flightNumber=`IMPORT-TEST-${randomUUID()}`;
async function api(path,method='GET') {const r=await fetch(service+path,{method,headers:{Authorization:`Bearer ${process.env.ARCHIVE_TOKEN}`}});if(!r.ok)throw new Error(`${method}: ${r.status}`);return r.status===204?null:(await r.json()).data;}
const csv=`Date,Flight number,From,To,Dep time,Duration,Note\n2024-01-02,${flightNumber},HND,CTS,09:00,01:30,"test, note"\n2024-01-03,${flightNumber},CTS,HND,,,missing times`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const payload={action:'preview',csv};
  expect((await page.request.post(`${base}/api/flights/import`,{headers:{Origin:base},data:payload})).status()).toBe(403);
  const login=await page.request.post(`${base}/api/auth`,{headers:{Origin:base},data:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}});expect(login.status()).toBe(200);
  expect((await page.request.post(`${base}/api/flights/import`,{headers:{Origin:'https://example.invalid'},data:payload})).status()).toBe(403);
  await page.goto(`${base}/manage`);await page.getByText('フライトをCSVからインポート',{exact:true}).click();
  await page.locator('.flight-import input[type=file]').setInputFiles({name:'flights.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByRole('button',{name:'プレビュー・再検証'}).click();
  await expect(page.locator('.import-summary')).toContainText('要修正 1件',{timeout:60000});
  const invalid=page.locator('.import-row').nth(1);await invalid.locator('summary').click();
  await invalid.getByLabel('出発時刻／日時',{exact:true}).fill('11:00');await invalid.getByLabel('所要時間',{exact:true}).fill('01:30');
  await expect(page.getByRole('button',{name:/公開して取り込む/})).toBeDisabled();
  await page.getByRole('button',{name:'プレビュー・再検証'}).click();await expect(page.locator('.import-summary')).toContainText('取込可能 2件',{timeout:60000});
  await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/import-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/import-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'選択した2件を公開して取り込む'}).click();
  await expect(page.locator('.flight-import [role=status]')).toContainText('2件を取り込みました',{timeout:60000});
  const overrides={'1':{departure:'11:00',duration:'01:30'}};
  const repeated=await page.request.post(`${base}/api/flights/import`,{headers:{Origin:base},data:{action:'import',csv,overrides,selected:[0,1]}});
  expect(repeated.status()).toBe(200);expect(await repeated.json()).toEqual({imported:0,skipped:2});
  const bad=await page.request.post(`${base}/api/flights/import`,{headers:{Origin:base},data:{action:'import',csv,selected:[1]}});expect(bad.status()).toBe(400);
  const records=await api(`/items/flights?filter[flight_number][_eq]=${encodeURIComponent(flightNumber)}`);expect(records.length).toBe(2);
  expect(records.some(r=>r.notes==='test, note')).toBe(true);
  console.log('PASS: auth, origin, CSV upload, preview, row correction, mobile layout, import, retry deduplication and invalid-row rejection');
}finally {
  const records=await api(`/items/flights?filter[flight_number][_eq]=${encodeURIComponent(flightNumber)}&fields=id`);
  for(const r of records)await api(`/items/flights/${r.id}`,'DELETE');
  await browser.close();
}
