import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStudioRunner,startStudioLauncher} from '../scripts/studio-launcher.mjs';
import {issueStudioTicket,verifyStudioReceipt} from '../lib/studio-launch.mjs';

const key='fixture-studio-key-'.repeat(4),origin='https://ryancagents.vercel.app',installationId='fixture-installation-1234';
const html='<!doctype html><title>Fixture Studio</title><main id="library"></main>';
const fixtureSource=`import http from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';const root=path.dirname(fileURLToPath(import.meta.url));await mkdir(process.env.PROPOSAL_DATA_DIR,{recursive:true});http.createServer(async(req,res)=>{if(req.url==='/api/config'){res.writeHead(200,{'content-type':'application/json'});return res.end('{"aiReady":false}');}res.writeHead(200,{'content-type':'text/html'});res.end(await readFile(path.join(root,'public/index.html')));}).listen(Number(process.env.PORT),'127.0.0.1');`;
async function listen(server){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server.address().port;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
async function unusedPort(){const server=http.createServer();const port=await listen(server);await close(server);return port;}
async function fixture(t,source=fixtureSource){
 const directory=await mkdtemp(path.join(tmpdir(),'office-studio-launch-'));await mkdir(path.join(directory,'public'));await writeFile(path.join(directory,'public/index.html'),html);await writeFile(path.join(directory,'server.mjs'),source);
 t.after(()=>rm(directory,{recursive:true,force:true}));return directory;
}
function trackedSpawn(t,calls){return (...args)=>{calls.push(args);const child=spawn(...args);t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.ref();const ended=once(child,'exit').catch(()=>{});child.kill('SIGTERM');await ended;}});return child;};}

test('isolated stopped Studio starts once, concurrent starts share work and later starts reuse it',async t=>{
 const studioDirectory=await fixture(t),studioPort=await unusedPort(),calls=[];
 const logPath=path.join(studioDirectory,'private/launcher.log');
 const run=createStudioRunner({studioDirectory,studioPort,logPath,platform:'darwin',spawnProcess:trackedSpawn(t,calls),pollIntervalMs:20});
 const results=await Promise.all([run(),run(),run()]);
 assert.deepEqual(results.map(value=>value.outcome),['started','started','started']);assert.equal(calls.length,1);
 assert.equal((await run()).outcome,'already-running');assert.equal(calls.length,1);
 assert.deepEqual(await readdir(path.join(studioDirectory,'data')),[],'launch does not create a proposal or template');
 const [command,args,options]=calls[0];assert.equal(command,process.execPath);assert.deepEqual(args,[path.join(studioDirectory,'server.mjs')]);
 assert.equal(options.cwd,studioDirectory);assert.equal(options.detached,true);assert.equal(options.shell,undefined);
 assert.equal(options.env.PORT,String(studioPort));assert.equal(options.env.PROPOSAL_DATA_DIR,path.join(studioDirectory,'data'));
 assert.deepEqual(Object.keys(options.env).filter(name=>!['PATH','PORT','PROPOSAL_DATA_DIR','HOME','TMPDIR','LANG'].includes(name)),[],'caller Node flags and API credentials are not inherited');
 assert.equal((await stat(logPath)).mode&0o777,0o600);
});

test('foreign pages, redirects and invalid config occupy the port and never trigger a spawn',async t=>{
 const studioDirectory=await fixture(t);
 for(const mode of ['foreign','redirect','invalid-config']){
  const server=http.createServer((req,res)=>{if(mode==='redirect'){res.writeHead(302,{location:'http://127.0.0.1:9/'});return res.end();}if(req.url==='/api/config'){res.writeHead(200,{'content-type':'application/json'});return res.end('{"aiReady":false,"command":"unexpected"}');}res.writeHead(200,{'content-type':'text/html'});res.end(mode==='foreign'?'different app':html);});
  const studioPort=await listen(server);let spawned=false;
  try{await assert.rejects(createStudioRunner({studioDirectory,studioPort,platform:'darwin',spawnProcess:()=>{spawned=true;throw Error();}}),error=>error.reason==='port-in-use');assert.equal(spawned,false);assert.equal(server.listening,true);}
  finally{await close(server);}
 }
});

test('unsupported platform and missing app paths fail before any process starts',async t=>{
 const studioDirectory=await fixture(t);let spawned=false;const spawnProcess=()=>{spawned=true;throw Error();};
 await assert.rejects(createStudioRunner({studioDirectory,platform:'linux',spawnProcess}),error=>error.reason==='unsupported-platform');
 await assert.rejects(createStudioRunner({studioDirectory:path.join(studioDirectory,'missing'),platform:'darwin',spawnProcess}),error=>error.reason==='not-installed');
 await assert.rejects(createStudioRunner({studioDirectory,platform:'darwin',nodePath:path.join(studioDirectory,'missing-node'),spawnProcess}),error=>error.reason==='not-installed');
 assert.equal(spawned,false);
});

test('an unresponsive occupied port is refused without spawning or stopping its listener',async t=>{
 const studioDirectory=await fixture(t),server=http.createServer(()=>{}),studioPort=await listen(server);let spawned=false;
 try{
  await assert.rejects(createStudioRunner({studioDirectory,studioPort,platform:'darwin',probeTimeoutMs:50,spawnProcess:()=>{spawned=true;throw Error();}}),error=>error.reason==='port-in-use');
  assert.equal(spawned,false);assert.equal(server.listening,true);
 }finally{await close(server);}
});

test('startup timeout and early process exit return bounded failures',async t=>{
 for(const [source,reason]of [['setInterval(()=>{},1000);','start-timeout'],['process.exit(2);','start-failed']]){
  const studioDirectory=await fixture(t,source),calls=[];
  // A deliberately hung child needs a short deadline. An actual Node process
  // needs the production allowance to start and report its exit under CPU load.
  const readinessTimeoutMs=reason==='start-timeout'?300:10000;
  const run=createStudioRunner({studioDirectory,studioPort:await unusedPort(),platform:'darwin',logPath:path.join(studioDirectory,'launcher.log'),readinessTimeoutMs,pollIntervalMs:20,probeTimeoutMs:100,spawnProcess:trackedSpawn(t,calls)});
  await assert.rejects(run,error=>error.reason===reason);assert.equal(calls.length,1);
 }
});

async function launcher(t,{runStudio=async()=>{},platform='darwin'}={}){
 const server=await startStudioLauncher({bridgeKey:key,origins:[origin],installationId,studioDirectory:'/fixture/studio',port:0,platform,runStudio});t.after(()=>close(server));
 const url=`http://127.0.0.1:${server.address().port}/studio/launch`;
 const request=(ticket,options={})=>fetch(url,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${ticket}`,'Content-Type':'application/json',...options.headers},body:options.body??'{}',...Object.fromEntries(Object.entries(options).filter(([name])=>!['headers','body'].includes(name)))});
 return {server,url,request};
}

test('valid signed launches coalesce and replay the same receipt without another action',{timeout:5000},async t=>{
 let release,calls=0;const gate=new Promise(resolve=>{release=resolve;});
 const {request,server}=await launcher(t,{runStudio:async()=>{calls++;await gate;}});
 let received=0,allReceived;const arrived=new Promise(resolve=>{allReceived=resolve;});
 server.on('request',req=>req.once('end',()=>{if(++received===3)allReceived();}));
 const ticket=issueStudioTicket(key,origin,installationId),other=issueStudioTicket(key,origin,installationId);
 const pending=[request(ticket),request(ticket),request(other)];
 await arrived;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);release();
 const responses=await Promise.all(pending);assert.ok(responses.every(response=>response.status===200));
 const receipts=await Promise.all(responses.map(response=>response.json()));
 assert.equal(receipts[0].receipt,receipts[1].receipt);assert.equal(verifyStudioReceipt(ticket,receipts[0].receipt,key,origin).status,'ready');
 assert.equal(verifyStudioReceipt(other,receipts[2].receipt,key,origin).status,'ready');
 assert.equal((await (await request(ticket)).json()).receipt,receipts[0].receipt);assert.equal(calls,1);
});

test('origin, host, signature, audience, expiration and body cannot select any executable action',async t=>{
 let calls=0;const {request,server,url}=await launcher(t,{runStudio:async()=>{calls++;}});
 const valid=issueStudioTicket(key,origin,installationId);
 const wrongHost=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{Host:`localhost:${server.address().port}`,Origin:origin,Authorization:`Bearer ${valid}`,'Content-Type':'application/json'}},response=>{response.resume();resolve(response.statusCode);});req.once('error',reject);req.end('{}');});
 assert.equal(wrongHost,403);
 for(const [ticket,options,status]of [
  [valid,{headers:{Origin:'https://untrusted.example'}},403],
  [issueStudioTicket(key,origin,'different-installation-1234'),{},403],
  [issueStudioTicket(key,origin,installationId,Date.now()-100000),{},403],
  [valid.slice(0,-4)+'xxxx',{},403],
  [valid,{body:'{"command":"open","url":"https://untrusted.example"}'},400],
  [valid,{body:'[]'},400],[valid,{body:'{}'+' '.repeat(1024)},413],
  [valid,{headers:{'Content-Type':'text/plain'}},415],
 ])assert.equal((await request(ticket,options)).status,status,JSON.stringify({headers:options.headers,body:options.body}));
 assert.equal(calls,0);
});

test('preflight is origin-scoped and only permits the fixed POST headers',async t=>{
 const {url}=await launcher(t);
 const allowed=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type','Access-Control-Request-Private-Network':'true'}});
 assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),origin);assert.equal(allowed.headers.get('access-control-allow-private-network'),'true');
 for(const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Headers':'x-shell-command'},{Origin:'https://untrusted.example'}]){
  const response=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST',...headers}});assert.equal(response.status,403);
 }
});

test('non-Mac and startup errors return signed bounded receipts without exposing paths',async t=>{
 for(const mode of ['non-mac','failed']){
  let calls=0;const {request}=await launcher(t,{platform:mode==='non-mac'?'linux':'darwin',runStudio:async()=>{calls++;throw Object.assign(Error('/private/path and credentials'),{reason:'start-timeout'});}});
  const ticket=issueStudioTicket(key,origin,installationId);const response=await request(ticket);assert.equal(response.status,200);
  const body=await response.json();const result=verifyStudioReceipt(ticket,body.receipt,key,origin);
  assert.equal(result.status,'unavailable');assert.equal(result.reason,mode==='non-mac'?'unsupported-platform':'start-timeout');assert.equal(calls,mode==='non-mac'?0:1);
  assert.equal(JSON.stringify(body).includes('/private/path'),false);
 }
});
