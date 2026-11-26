import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const VIEWER_TOKEN_TTL=8*60*60*1000;
const PREFIX='ryan-office-viewer-v2';

export function matchesSecret(value,expected) {
 if(typeof value!=='string'||typeof expected!=='string'||!value||!expected)return false;
 const a=Buffer.from(value),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}

// Each unlock gets a different short-lived capability. The client holds it only
// in page memory; cookies and browser storage cannot restore an unlocked page.
export function createViewerToken(key,personalKey,now=Date.now()) {
 if(!key||!personalKey)throw new Error('Office access is not configured');
 const body=Buffer.from(JSON.stringify({iat:now,exp:now+VIEWER_TOKEN_TTL,nonce:randomBytes(24).toString('hex')})).toString('base64url');
 return `${PREFIX}.${body}.${signature(body,key,personalKey)}`;
}

function signature(body,key,personalKey) {
 // Rotating either credential invalidates all issued capabilities.
 const signingKey=createHmac('sha256',key).update(`${PREFIX}\0`).update(personalKey).digest();
 return createHmac('sha256',signingKey).update(`${PREFIX}.${body}`).digest('base64url');
}

export function verifyViewerToken(token,key,personalKey,now=Date.now()) {
 if(typeof token!=='string'||token.length>512||!key||!personalKey)return false;
 const parts=token.split('.');
 if(parts.length!==3||parts[0]!==PREFIX||!/^[a-zA-Z0-9_-]+$/.test(parts[1])||!/^[a-zA-Z0-9_-]{43}$/.test(parts[2]))return false;
 if(!matchesSecret(parts[2],signature(parts[1],key,personalKey)))return false;
 try {
  const data=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  return Number.isSafeInteger(data.iat)&&Number.isSafeInteger(data.exp)&&data.iat<=now+5000&&data.exp>now&&data.exp-data.iat===VIEWER_TOKEN_TTL&&typeof data.nonce==='string'&&/^[a-f0-9]{48}$/.test(data.nonce);
 }catch{return false;}
}

export function viewerAuthorized(req,key,personalKey,now=Date.now()) {
 const header=req.headers.get('authorization')||'';
 return header.startsWith('Bearer ')&&verifyViewerToken(header.slice(7),key,personalKey,now);
}

export function validateAccessPair(input,key,personalKey) {
 if(!key||!personalKey)return 'unconfigured';
 // Evaluate both comparisons even if the first fails.
 const first=matchesSecret(input?.key,key),second=matchesSecret(input?.personalKey,personalKey);
 return first&&second?'valid':'invalid';
}
