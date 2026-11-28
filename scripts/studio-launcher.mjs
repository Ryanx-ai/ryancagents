import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {access,readFile,stat,mkdir,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {verifyStudioTicket,createStudioReceipt} from '../lib/studio-launch.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=reason=>Object.assign(new Error(reason),{reason});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const defaultLog=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/studio-launcher.log');

async function responseBytes(response,maximum){
 if(Number(response.headers.get('content-length'))>maximum)throw fail('port-in-use');
 const reader=response.body?.getReader();if(!reader)throw fail('port-in-use');
 const chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maximum)throw fail('port-in-use');chunks.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}

/** Fixed local app runner. Alternate ports and dependencies are fixture-only seams. */
export function createStudioRunner({studioDirectory,nodePath=process.execPath,platform=process.platform,studioPort=4174,logPath=defaultLog,readinessTimeoutMs=10000,pollIntervalMs=200,probeTimeoutMs=1000,spawnProcess=spawn,fetchRequest=fetch}={}){
 let inFlight=null;
 const origin=`http://127.0.0.1:${studioPort}`;
 async function run(){
  if(platform!=='darwin')throw fail('unsupported-platform');
  if(typeof studioDirectory!=='string'||!path.isAbsolute(studioDirectory)||typeof nodePath!=='string'||!path.isAbsolute(nodePath))throw fail('not-configured');
  const serverPath=path.join(studioDirectory,'server.mjs');let expected;
  try{
   if(!(await stat(studioDirectory)).isDirectory()||!(await stat(serverPath)).isFile())throw Error();
   await access(nodePath,constants.X_OK);
   const file=path.join(studioDirectory,'public/index.html');if((await stat(file)).size>1024*1024)throw Error();
   expected=hash(await readFile(file));
  }catch{throw fail('not-installed');}
  async function identify(){
   let response;
   try{response=await fetchRequest(origin+'/',{redirect:'manual',signal:AbortSignal.timeout(probeTimeoutMs)});}
   catch(error){if(error?.cause?.code==='ECONNREFUSED'||error?.code==='ECONNREFUSED')return false;throw fail('port-in-use');}
   try{
    if(response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'')||hash(await responseBytes(response,1024*1024))!==expected)throw fail('port-in-use');
    const config=await fetchRequest(origin+'/api/config',{redirect:'manual',signal:AbortSignal.timeout(probeTimeoutMs)});
    if(config.status!==200||!/^application\/json(?:;|$)/i.test(config.headers.get('content-type')||''))throw fail('port-in-use');
    const value=JSON.parse((await responseBytes(config,1024)).toString('utf8'));
    if(!value||Array.isArray(value)||Object.keys(value).length!==1||typeof value.aiReady!=='boolean')throw fail('port-in-use');
    return true;
   }catch{throw fail('port-in-use');}
  }
  if(await identify())return {outcome:'already-running'};
  let log,child;let exited=false,spawnFailed=false;
  try{
   await mkdir(path.dirname(logPath),{recursive:true,mode:0o700});
   log=await open(logPath,'a',0o600);await log.chmod(0o600);
   // Do not inherit caller-selected ports, data directories, Node preload flags,
   // or API credentials. Studio can load its own existing local configuration.
   const env={PATH:`${path.dirname(nodePath)}:/usr/bin:/bin:/usr/sbin:/sbin`,PORT:String(studioPort),PROPOSAL_DATA_DIR:path.join(studioDirectory,'data')};
   for(const key of ['HOME','TMPDIR','LANG'])if(process.env[key])env[key]=process.env[key];
   child=spawnProcess(nodePath,[serverPath],{cwd:studioDirectory,env,detached:true,stdio:['ignore',log.fd,log.fd],windowsHide:true});
   child.once('error',()=>{spawnFailed=true;});child.once('exit',()=>{exited=true;});
  }catch{throw fail('start-failed');}
  finally{await log?.close().catch(()=>{});}
  const deadline=Date.now()+readinessTimeoutMs;
  try{
   while(Date.now()<deadline){
    if(spawnFailed||exited)throw fail('start-failed');
    if(await identify()){
     if(spawnFailed||exited)throw fail('start-failed');
     child.unref();return {outcome:'started'};
    }
    await pause(Math.min(pollIntervalMs,Math.max(1,deadline-Date.now())));
   }
   throw fail('start-timeout');
  }catch(error){
   // Only the child from this attempt is ours to terminate. An existing listener
   // is never killed, even when its identity is wrong or startup loses a race.
   if(!exited)try{child.kill('SIGTERM');}catch{}
   throw error;
  }
 }
 return ()=>{if(inFlight)return inFlight;inFlight=run().finally(()=>{inFlight=null;});return inFlight;};
}

async function emptyBody(req){
 if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']||''))throw Object.assign(Error(),{status:415});
 if(Number(req.headers['content-length'])>1024)throw Object.assign(Error(),{status:413});
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>1024)throw Object.assign(Error(),{status:413});chunks.push(chunk);}
 let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(Error(),{status:400});}
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length)throw Object.assign(Error(),{status:400});
}

/** The only action is starting the locally configured Proposal Studio. */
export async function startStudioLauncher({bridgeKey,origins,installationId,studioDirectory,nodePath=process.execPath,port=4175,platform=process.platform,runStudio}={}){
 if(typeof bridgeKey!=='string'||!bridgeKey||typeof installationId!=='string'||!Array.isArray(origins)||!origins.length)throw Error('Invalid Studio launcher configuration');
 const allowedOrigins=new Set(origins);
 for(const origin of allowedOrigins)if(typeof origin!=='string'||new URL(origin).origin!==origin)throw Error('Invalid Studio launcher origin');
 const runner=runStudio||createStudioRunner({studioDirectory,nodePath,platform});
 const cache=new Map();let launching=null;
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const boundPort=server.address()?.port;
  if(req.headers.host!==`127.0.0.1:${boundPort}`)return send(403,{error:'Forbidden'});
  const origin=req.headers.origin;
  if(typeof origin!=='string'||!allowedOrigins.has(origin))return send(403,{error:'Forbidden'});
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  if(req.url!=='/studio/launch')return send(404,{error:'Not found'});
  if(req.method==='OPTIONS'){
   const requested=(req.headers['access-control-request-headers']||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
   if(req.headers['access-control-request-method']!=='POST'||requested.some(value=>!['authorization','content-type'].includes(value)))return send(403,{error:'Forbidden'});
   res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','authorization, content-type');res.setHeader('Access-Control-Max-Age','0');
   if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
   res.writeHead(204,{'Cache-Control':'no-store'});return res.end();
  }
  if(req.method!=='POST')return send(405,{error:'Method not allowed'});
  const ticket=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization||'')?.[1];
  const verified=ticket&&verifyStudioTicket(ticket,bridgeKey,origin,installationId);
  if(!verified)return send(403,{error:'Forbidden'});
  try{
   await emptyBody(req);
   const now=Date.now();for(const [nonce,entry]of cache)if(entry.expiresAt<now&&!entry.pending)cache.delete(nonce);
   let entry=cache.get(verified.nonce);
   if(entry&&entry.ticketHash!==hash(ticket))return send(403,{error:'Forbidden'});
   if(!entry){
    if(cache.size>=256)return send(429,{error:'Try again later'});
    entry={ticketHash:hash(ticket),expiresAt:now+180000,pending:true,promise:null};
    if(!launching)launching=Promise.resolve().then(()=>platform==='darwin'?runner():Promise.reject(fail('unsupported-platform'))).then(()=>({status:'ready'}),error=>({status:'unavailable',reason:['not-configured','not-installed','port-in-use','start-failed','start-timeout','unsupported-platform'].includes(error?.reason)?error.reason:'start-failed'})).finally(()=>{launching=null;});
    entry.promise=launching.then(result=>createStudioReceipt(ticket,bridgeKey,result)).finally(()=>{entry.pending=false;});cache.set(verified.nonce,entry);
   }
   return send(200,{receipt:await entry.promise});
  }catch(error){return send(error?.status||400,{error:'Invalid launch request'});}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return server;
}
