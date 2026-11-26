import { timingSafeEqual, createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
export function matches(a: string, b: string | undefined) { if (!b || !a) return false; const aa=Buffer.from(a), bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
export function sessionToken(key: string) { return createHmac('sha256',key).update('ryan-office-viewer-v1').digest('hex'); }
export async function authorized() { const key=process.env.OFFICE_ACCESS_KEY; return !!key && matches((await cookies()).get('office_session')?.value || '',sessionToken(key)); }
export function sameOrigin(req:Request) {try {const origin=new URL(req.headers.get('origin')||'');return origin.host===req.headers.get('host')&&(process.env.NODE_ENV!=='production'||origin.protocol==='https:');}catch{return false;}}
export function bridgeAuthorized(req:Request) {return matches(req.headers.get('authorization')?.replace(/^Bearer /,'')||'',process.env.OFFICE_BRIDGE_KEY);}
