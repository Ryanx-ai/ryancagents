import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {STUDIO_URL,STUDIO_TICKET_TTL,STUDIO_FAILURE_REASONS,allowedStudioOrigin,issueStudioTicket,verifyStudioTicket,createStudioReceipt,verifyStudioReceipt} from '../lib/studio-launch.mjs';
const key='fixture-bridge-key',origin='https://ryancagents.vercel.app',installation='fixture-installation-123',now=1800000000000;
const ticket=()=>issueStudioTicket(key,origin,installation,now);
function signedWith(token,change){
 const [prefix,body]=token.split('.'),data=JSON.parse(Buffer.from(body,'base64url'));change(data);
 const encoded=Buffer.from(JSON.stringify(data)).toString('base64url');
 const derived=createHmac('sha256',key).update(`ryan-hq-studio\0${prefix}`).digest();
 const signature=createHmac('sha256',derived).update(`${prefix}.${encoded}`).digest('base64url');
 return `${prefix}.${encoded}.${signature}`;
}

test('tickets are unique, installation-bound and valid for exactly 90 seconds',()=>{
 const first=ticket(),second=ticket(),claims=verifyStudioTicket(first,key,origin,installation,now);
 assert.notEqual(first,second);assert.equal(claims.action,'launch-proposal-studio');assert.equal(claims.exp-claims.iat,90000);
 assert.equal(verifyStudioTicket(first,key,origin,installation,now+STUDIO_TICKET_TTL-1).nonce,claims.nonce);
 for(const at of [now+STUDIO_TICKET_TTL,now-5001,NaN])assert.equal(verifyStudioTicket(first,key,origin,installation,at),null);
 assert.equal(verifyStudioTicket(first,key,origin,'other-installation',now),null);
 assert.equal(verifyStudioTicket(first,key,'https://www.ryancagents.app',installation,now),null);
 assert.equal(verifyStudioTicket(first,'another-key',origin,installation,now),null);
});

test('malformed, forged and wrongly scoped signed claims fail closed',()=>{
 const first=ticket();
 for(const value of [null,{},'x'.repeat(3000),first+'.extra',first.replace('ticket','receipt'),first.slice(0,-1)+'!'])assert.equal(verifyStudioTicket(value,key,origin,installation,now),null);
 for(const change of [v=>v.exp++,v=>v.action='run-command',v=>v.version=2,v=>v.nonce='bad',v=>v.command='anything',v=>v.origin='https://user:pass@ryancagents.vercel.app',v=>v.iat='1800000000000'])assert.equal(verifyStudioTicket(signedWith(first,change),key,origin,installation,now),null);
 const parts=first.split('.');const decoded=JSON.parse(Buffer.from(parts[1],'base64url'));decoded.installationId='another-installation';parts[1]=Buffer.from(JSON.stringify(decoded)).toString('base64url');
 assert.equal(verifyStudioTicket(parts.join('.'),key,origin,'another-installation',now),null);
 for(const args of [['',origin,installation],[key,'https://example.test/path',installation],[key,origin,'short']])assert.throws(()=>issueStudioTicket(...args,now));
});

test('receipts bind the exact ticket and cannot be reflected into tickets or arbitrary URLs',()=>{
 const first=ticket(),second=ticket(),receipt=createStudioReceipt(first,key,{status:'ready'},now+1);
 assert.deepEqual(verifyStudioReceipt(first,receipt,key,origin,now+2),{status:'ready',url:STUDIO_URL});
 assert.equal(verifyStudioReceipt(second,receipt,key,origin,now+2),null);
 assert.equal(verifyStudioReceipt(first,receipt,key,'https://www.ryancagents.app',now+2),null);
 assert.equal(verifyStudioReceipt(first,receipt,'wrong-key',origin,now+2),null);
 assert.equal(verifyStudioReceipt(first,first,key,origin,now+2),null);
 assert.equal(verifyStudioTicket(receipt,key,origin,installation,now+2),null);
 assert.equal(verifyStudioReceipt(first,receipt,key,origin,now+STUDIO_TICKET_TTL),null);
 for(const change of [v=>v.url='https://attacker.test',v=>v.nonce='0'.repeat(64),v=>v.installationId='other-installation',v=>v.exp++,v=>v.iat=now+6000,v=>v.status='running',v=>v.reason='start-failed'])assert.equal(verifyStudioReceipt(first,signedWith(receipt,change),key,origin,now+2),null);
 assert.throws(()=>createStudioReceipt(first,key,{status:'ready',url:'https://attacker.test'},now));
 assert.throws(()=>createStudioReceipt(first,key,{status:'ready'},now+STUDIO_TICKET_TTL));
});

test('unavailable receipts expose only the finite reason enum',()=>{
 for(const reason of STUDIO_FAILURE_REASONS){const first=ticket(),receipt=createStudioReceipt(first,key,{status:'unavailable',reason},now);assert.deepEqual(verifyStudioReceipt(first,receipt,key,origin,now),{status:'unavailable',reason});}
 for(const result of [{status:'unavailable'},{status:'unavailable',reason:'/private/path'},{status:'unavailable',reason:'start-failed',error:'private output'},{status:'ready',reason:'start-failed'}])assert.throws(()=>createStudioReceipt(ticket(),key,result,now));
 const first=ticket(),receipt=createStudioReceipt(first,key,{status:'unavailable',reason:'start-failed'},now);
 assert.equal(verifyStudioReceipt(first,signedWith(receipt,v=>v.reason='private output'),key,origin,now),null);
});

test('HQ origin policy is exact and loopback development is explicitly enabled',()=>{
 for(const value of ['https://ryancagents.vercel.app','https://ryancagents.app','https://www.ryancagents.app'])assert.equal(allowedStudioOrigin(value),true);
 for(const value of ['null','https://ryancagents.vercel.app.attacker.test','https://other.vercel.app','http://ryancagents.app','https://ryancagents.app/','https://user@ryancagents.app','https://ryancagents.app:444','http://127.0.0.1:3100'])assert.equal(allowedStudioOrigin(value),false);
 assert.equal(allowedStudioOrigin('http://127.0.0.1:3100',true),true);assert.equal(allowedStudioOrigin('http://localhost:3100',true),true);
 assert.equal(allowedStudioOrigin('http://192.168.1.5:3100',true),false);
});
