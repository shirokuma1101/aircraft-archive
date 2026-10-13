import 'server-only';
import {cookies} from 'next/headers';
import {EncryptJWT, jwtDecrypt} from 'jose';
import {createHash} from 'node:crypto';
import {api} from './directus';
const cookieName = 'archive_session';
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return createHash('sha256').update(secret).digest();
}
export async function adminToken(): Promise<string | null> {
  const session = (await cookies()).get(cookieName)?.value;
  if (!session) return null;
  try {
    const {payload} = await jwtDecrypt(session,key(),{issuer:'aircraft-archive',audience:'admin'});
    if (typeof payload.token !== 'string') return null;
    const user = await api<{email:string;status:string}>('/users/me?fields=email,status',{},payload.token);
    return user.email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() && user.status === 'active' ? payload.token : null;
  } catch {return null;}
}
export async function setSession(token:string, expiresMs:number) {
  const seconds = Math.max(1,Math.min(Math.floor(expiresMs / 1000),28800));
  const session = await new EncryptJWT({token}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer('aircraft-archive').setAudience('admin').setIssuedAt().setExpirationTime(`${seconds}s`).encrypt(key());
  (await cookies()).set(cookieName,session,{httpOnly:true,secure:process.env.APP_ORIGIN?.startsWith('https://'),sameSite:'strict',path:'/',maxAge:seconds});
}
export async function clearSession() {(await cookies()).delete(cookieName);}
export function sameOrigin(request:Request) {
  return Boolean(process.env.APP_ORIGIN && request.headers.get('origin') === new URL(process.env.APP_ORIGIN).origin);
}
