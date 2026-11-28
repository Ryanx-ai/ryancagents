import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createViewerToken} from '../lib/access.mjs';
import {STUDIO_URL,issueStudioTicket,createStudioReceipt,verifyStudioTicket} from '../lib/studio-launch.mjs';

const moduleURL=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const origin='https://ryancagents.vercel.app',key='fixture-bridge-key',installation='fixture-installation-123';

test('Studio route keeps the authenticated browser and pinned installation boundary',async t=>{
 const names=['OFFICE_ACCESS_KEY','OFFICE_PERSONAL_KEY','OFFICE_BRIDGE_KEY','OFFICE_STUDIO_INSTALLATION_ID','NODE_ENV'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 Object.assign(process.env,{OFFICE_ACCESS_KEY:'fixture-viewer-key',OFFICE_PERSONAL_KEY:'fixture-personal-key',OFFICE_BRIDGE_KEY:key,OFFICE_STUDIO_INSTALLATION_ID:installation,NODE_ENV:'production'});
 t.after(()=>{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}});
 // Execute the actual route body with Web Response instead of Next's wrapper.
 // Use real viewer-token validation; only the framework/BotID boundary is faked.
 const serverURL=moduleURL(`
  import {viewerAuthorized} from ${JSON.stringify(new URL('../lib/access.mjs',import.meta.url).href)};
  export const controls={botStatus:0,botCalls:0};
  export function authorized(req){return viewerAuthorized(req,process.env.OFFICE_ACCESS_KEY,process.env.OFFICE_PERSONAL_KEY);}
  export function sameOrigin(req){return req.headers.get('origin')===new URL(req.url).origin;}
  export async function botCheckResponse(){controls.botCalls++;return controls.botStatus?Response.json({error:'Browser verification failed'},{status:controls.botStatus}):null;}
 `);
 const {controls}=await import(serverURL);
 const nextURL=moduleURL('export const NextResponse={json:(value,options)=>Response.json(value,options)};');
 const source=stripTypeScriptTypes(await readFile(new URL('../app/api/studio/route.ts',import.meta.url),'utf8'))
  .replace("from 'next/server'",`from '${nextURL}'`)
  .replace("from '../../../lib/server'",`from '${serverURL}'`)
  .replace("from '../../../lib/studio-launch.mjs'",`from '${new URL('../lib/studio-launch.mjs',import.meta.url).href}'`);
 const {POST}=await import(moduleURL(source));
 const viewer=createViewerToken(process.env.OFFICE_ACCESS_KEY,process.env.OFFICE_PERSONAL_KEY);
 function request(body,{site=origin,requestOrigin=site,bearer=viewer,extra={},raw}={}){
  return new Request(`${site}/api/studio`,{method:'POST',headers:{origin:requestOrigin,authorization:`Bearer ${bearer}`,'content-type':'application/json',...extra},body:raw??JSON.stringify(body)});
 }

 await t.test('viewer, exact origin and bot verification precede ticket issuance',async()=>{
  assert.equal((await POST(request({action:'ticket'},{bearer:key}))).status,401);
  assert.equal(controls.botCalls,0,'the machine bridge credential cannot mint launch tickets');
  assert.equal((await POST(request({action:'ticket'},{requestOrigin:'https://attacker.test'}))).status,403);
  assert.equal((await POST(request({action:'ticket'},{site:'https://other.vercel.app'}))).status,403);
  assert.equal(controls.botCalls,0);
  controls.botStatus=403;assert.equal((await POST(request({action:'ticket'}))).status,403);controls.botStatus=0;
  const response=await POST(request({action:'ticket'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const body=await response.json();assert.deepEqual(Object.keys(body),['ticket']);assert.ok(verifyStudioTicket(body.ticket,key,origin,installation));
 });

 await t.test('missing setup and malformed or oversized requests fail without an alternate action',async()=>{
  delete process.env.OFFICE_STUDIO_INSTALLATION_ID;assert.equal((await POST(request({action:'ticket'}))).status,503);process.env.OFFICE_STUDIO_INSTALLATION_ID=installation;
  for(const body of [null,[],{action:'shell',command:'anything'},{action:'ticket',url:'https://attacker.test'},{action:'verify',ticket:'bad'}])assert.equal((await POST(request(body))).status,400);
  assert.equal((await POST(request({}, {raw:'{'}))).status,400);
  assert.equal((await POST(request({}, {raw:'x'.repeat(9000)}))).status,413,'stream bound applies without Content-Length');
  assert.equal((await POST(request({}, {extra:{'content-type':'text/plain'}}))).status,415);
 });

 await t.test('verification accepts only this installation receipt and returns a fixed URL or safe reason',async()=>{
  const ticket=issueStudioTicket(key,origin,installation),receipt=createStudioReceipt(ticket,key,{status:'ready'});
  const ready=await POST(request({action:'verify',ticket,receipt}));assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{status:'ready',url:STUDIO_URL});
  const unavailable=createStudioReceipt(ticket,key,{status:'unavailable',reason:'not-installed'});
  assert.deepEqual(await (await POST(request({action:'verify',ticket,receipt:unavailable}))).json(),{status:'unavailable',reason:'not-installed'});
  assert.equal((await POST(request({action:'verify',ticket,receipt:ticket}))).status,403);
  const other=issueStudioTicket(key,origin,'different-installation'),otherReceipt=createStudioReceipt(other,key,{status:'ready'});
  assert.equal((await POST(request({action:'verify',ticket:other,receipt:otherReceipt}))).status,403);
  process.env.OFFICE_STUDIO_INSTALLATION_ID='new-installation-id';assert.equal((await POST(request({action:'verify',ticket,receipt}))).status,403);process.env.OFFICE_STUDIO_INSTALLATION_ID=installation;
  assert.equal((await POST(request({action:'verify',ticket,receipt,url:'https://attacker.test'}))).status,400);
 });

 await t.test('loopback origins are available only in a development environment',async()=>{
  const local={site:'http://127.0.0.1:3100'};
  assert.equal((await POST(request({action:'ticket'},local))).status,403);
  process.env.NODE_ENV='development';assert.equal((await POST(request({action:'ticket'},local))).status,200);process.env.NODE_ENV='production';
 });
});
