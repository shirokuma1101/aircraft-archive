import {test} from 'node:test';
import assert from 'node:assert/strict';
import {turnstileConfig,verifyTurnstile} from '../src/lib/turnstile';
const env={APP_ORIGIN:'https://archive.example.com',TURNSTILE_SITE_KEY:'real-site-key',TURNSTILE_SECRET_KEY:'real-secret-key'};
const config=turnstileConfig(env);
const mock=(value:unknown,status=200)=>(async()=>new Response(JSON.stringify(value),{status})) as typeof fetch;
test('production requires both real keys; local testing cannot be enabled for public origins',()=>{
  assert.throws(()=>turnstileConfig({APP_ORIGIN:env.APP_ORIGIN}));
  assert.throws(()=>turnstileConfig({...env,TURNSTILE_SECRET_KEY:''}));
  assert.throws(()=>turnstileConfig({...env,TURNSTILE_MODE:'test'}));
  assert.throws(()=>turnstileConfig({...env,TURNSTILE_MODE:'disabled'}));
  const local=turnstileConfig({APP_ORIGIN:'http://localhost:12000',TURNSTILE_MODE:'test'});
  assert.equal(local.test,true);
  assert.throws(()=>turnstileConfig({...env,TURNSTILE_SITE_KEY:local.siteKey}));
  assert.throws(()=>turnstileConfig({...env,TURNSTILE_SECRET_KEY:local.secretKey}));
});
test('missing, empty and oversized tokens never reach Siteverify',async()=>{
  let calls=0;const fetcher=(async()=>{calls++;throw new Error();}) as typeof fetch;
  for(const value of [undefined,null,'',' ',{},'x'.repeat(2049)])assert.equal(await verifyTurnstile(value,config,fetcher),false);
  assert.equal(calls,0);
});
test('production checks Siteverify success, action and hostname',async()=>{
  const valid={success:true,hostname:'archive.example.com',action:'login'};
  assert.equal(await verifyTurnstile('token',config,mock(valid)),true);
  for(const result of [{...valid,success:false},{...valid,success:'true'},{...valid,hostname:'evil.example'},{...valid,action:'signup'},{success:true},null])assert.equal(await verifyTurnstile('token',config,mock(result)),false);
  assert.equal(await verifyTurnstile('token',config,mock(valid,503)),false);
  assert.equal(await verifyTurnstile('token',config,(async()=>{throw new Error('Timeout');}) as typeof fetch),false);
});
test('verification sends secret only to Cloudflare and uses a bounded uncached request',async()=>{
  await verifyTurnstile('token',config,(async(url,options)=>{
    assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.deepEqual(JSON.parse(options?.body as string),{secret:env.TURNSTILE_SECRET_KEY,response:'token'});
    assert.equal(options?.method,'POST');assert.equal(options?.cache,'no-store');assert.ok(options?.signal);
    return new Response(JSON.stringify({success:false}));
  }) as typeof fetch);
});
test('explicit local test mode accepts synthetic metadata but never failed challenges',async()=>{
  const local=turnstileConfig({APP_ORIGIN:'http://127.0.0.1:12000',TURNSTILE_MODE:'test'});
  assert.equal(await verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX',local,mock({success:true,hostname:'localhost',action:'test'})),true);
  assert.equal(await verifyTurnstile('token',local,mock({success:false})),false);
});
