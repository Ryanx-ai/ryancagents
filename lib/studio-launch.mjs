import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const STUDIO_URL='http://127.0.0.1:4174';
export const LAUNCHER_URL='http://127.0.0.1:4175/studio/launch';
export const STUDIO_TICKET_TTL=90000;
export const STUDIO_HQ_ORIGINS=Object.freeze(['https://ryancagents.vercel.app','https://www.ryancagents.app','https://ryancagents.app']);
export const STUDIO_FAILURE_REASONS=Object.freeze(['not-configured','not-installed','port-in-use','start-failed','start-timeout','unsupported-platform']);
const TICKET='ryan-studio-ticket-v1',RECEIPT='ryan-studio-receipt-v1';
const ACTION='launch-proposal-studio',CLOCK_SKEW=5000;
const validKey=key=>typeof key==='string'&&key.length>0;
const validInstallation=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(id);
const keysAre=(value,required,optional=[])=>value&&typeof value==='object'&&!Array.isArray(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));

function validOrigin(origin){
 if(typeof origin!=='string'||origin.length>256)return false;
 try{const url=new URL(origin);return url.origin===origin&&(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname));}catch{return false;}
}
/** Policy for HQ API callers. Local development is an explicit environment choice. */
export function allowedStudioOrigin(origin,development=false){
 if(!validOrigin(origin))return false;
 if(STUDIO_HQ_ORIGINS.includes(origin))return true;
 const url=new URL(origin);
 return development&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
}
function signature(prefix,body,key){
 const derived=createHmac('sha256',key).update(`ryan-hq-studio\0${prefix}`).digest();
 return createHmac('sha256',derived).update(`${prefix}.${body}`).digest('base64url');
}
function sign(prefix,value,key){
 const body=Buffer.from(JSON.stringify(value)).toString('base64url');
 return `${prefix}.${body}.${signature(prefix,body,key)}`;
}
function readSigned(token,prefix,key){
 if(!validKey(key)||typeof token!=='string'||token.length>2048)return null;
 const parts=token.split('.');
 if(parts.length!==3||parts[0]!==prefix||!/^[A-Za-z0-9_-]+$/.test(parts[1])||!/^[A-Za-z0-9_-]{43}$/.test(parts[2]))return null;
 const expected=Buffer.from(signature(prefix,parts[1],key)),actual=Buffer.from(parts[2]);
 if(!timingSafeEqual(actual,expected))return null;
 try{const bytes=Buffer.from(parts[1],'base64url');if(bytes.toString('base64url')!==parts[1])return null;return JSON.parse(bytes.toString('utf8'));}catch{return null;}
}
function ticketClaims(ticket,key,now){
 const data=readSigned(ticket,TICKET,key);
 if(!keysAre(data,['version','action','origin','installationId','nonce','iat','exp'])||data.version!==1||data.action!==ACTION)return null;
 if(!validOrigin(data.origin)||!validInstallation(data.installationId)||typeof data.nonce!=='string'||!/^[a-f0-9]{64}$/.test(data.nonce))return null;
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(data.iat)||data.iat<0||!Number.isSafeInteger(data.exp)||data.exp-data.iat!==STUDIO_TICKET_TTL||data.iat>now+CLOCK_SKEW||data.exp<=now)return null;
 return data;
}
function sanitizedResult(value){
 if(!keysAre(value,['status'],['reason']))return null;
 if(value.status==='ready'&&!Object.hasOwn(value,'reason'))return {status:'ready',url:STUDIO_URL};
 if(value.status==='unavailable'&&STUDIO_FAILURE_REASONS.includes(value.reason))return {status:'unavailable',reason:value.reason};
 return null;
}

export function issueStudioTicket(key,origin,installationId,now=Date.now()){
 if(!validKey(key)||!validOrigin(origin)||!validInstallation(installationId)||!Number.isSafeInteger(now)||now<0)throw new Error('Studio launch is not configured');
 return sign(TICKET,{version:1,action:ACTION,origin,installationId,nonce:randomBytes(32).toString('hex'),iat:now,exp:now+STUDIO_TICKET_TTL},key);
}
export function verifyStudioTicket(ticket,key,origin,installationId,now=Date.now()){
 const data=ticketClaims(ticket,key,now);
 return data&&data.origin===origin&&data.installationId===installationId?data:null;
}
export function createStudioReceipt(ticket,key,result,now=Date.now()){
 const claims=ticketClaims(ticket,key,now),safe=sanitizedResult(result);
 if(!claims||!safe)throw new Error('Invalid Studio launch receipt');
 return sign(RECEIPT,{version:1,ticketDigest:createHash('sha256').update(ticket).digest('hex'),nonce:claims.nonce,origin:claims.origin,installationId:claims.installationId,iat:now,exp:claims.exp,status:safe.status,...(safe.status==='unavailable'?{reason:safe.reason}:{})},key);
}
/** Verify the ticket against the configured installation separately at ingress. */
export function verifyStudioReceipt(ticket,receipt,key,origin,now=Date.now()){
 const claims=ticketClaims(ticket,key,now),data=readSigned(receipt,RECEIPT,key);
 if(!claims||claims.origin!==origin||!keysAre(data,['version','ticketDigest','nonce','origin','installationId','iat','exp','status'],['reason'])||data.version!==1)return null;
 if(data.ticketDigest!==createHash('sha256').update(ticket).digest('hex')||data.nonce!==claims.nonce||data.origin!==claims.origin||data.installationId!==claims.installationId||data.exp!==claims.exp)return null;
 if(!Number.isSafeInteger(data.iat)||data.iat<claims.iat-CLOCK_SKEW||data.iat>now+CLOCK_SKEW||data.iat>=data.exp)return null;
 return sanitizedResult({status:data.status,...(Object.hasOwn(data,'reason')?{reason:data.reason}:{})});
}
