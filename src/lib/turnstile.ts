type Environment = Record<string,string|undefined>;
export type TurnstileConfig = {siteKey:string;secretKey:string;hostname:string;test:boolean};
const testSiteKey='1x00000000000000000000AA';
const testSecretKey='1x0000000000000000000000000000000AA';

export function turnstileConfig(env:Environment=process.env):TurnstileConfig {
  const origin=new URL(env.APP_ORIGIN||'');
  if(!['https:','http:'].includes(origin.protocol)) throw new Error('Invalid origin');
  const mode=env.TURNSTILE_MODE||'production';
  if(mode==='test') {
    if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('Test mode requires a loopback origin');
    return {siteKey:testSiteKey,secretKey:testSecretKey,hostname:origin.hostname,test:true};
  }
  const siteKey=env.TURNSTILE_SITE_KEY?.trim(),secretKey=env.TURNSTILE_SECRET_KEY?.trim();
  if(mode!=='production'||!siteKey||!secretKey||/^[123]x0{10}/.test(siteKey)||/^[123]x0{10}/.test(secretKey)) throw new Error('Turnstile is not configured');
  return {siteKey,secretKey,hostname:origin.hostname,test:false};
}

export async function verifyTurnstile(token:unknown,config:TurnstileConfig,fetcher:typeof fetch=fetch):Promise<boolean> {
  if(typeof token!=='string'||!token.trim()||token.length>2048) return false;
  try {
    const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({secret:config.secretKey,response:token}),
      signal:AbortSignal.timeout(10000),cache:'no-store',
    });
    if(!response.ok) return false;
    const result=await response.json() as {success?:unknown;hostname?:unknown;action?:unknown};
    // Official test keys return synthetic hostname/action values. Only local test mode permits them.
    return result.success===true&&(config.test||result.hostname===config.hostname&&result.action==='login');
  } catch {return false;}
}
