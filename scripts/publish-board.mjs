import {readFile,writeFile,rename,mkdir,open,unlink,stat,chmod} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCalendarSnapshot} from '../lib/board.mjs';
import {boardPublishDecision,boardPublishFailure} from './board-publisher.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),privateDir=path.join(root,'.local');
const scope={accountId:process.env.OFFICE_BOARD_CALENDAR_ACCOUNT||'ryanchin@verticalinstitute.com',calendarId:process.env.OFFICE_BOARD_CALENDAR_ID||'ryanchin@verticalinstitute.com'};
const inputPath=path.join(privateDir,'board-calendar-input.json'),journalPath=path.join(privateDir,'board-publish-state.json'),lockPath=path.join(privateDir,'board-publish.lock');
await mkdir(privateDir,{recursive:true,mode:0o700});
async function atomic(file,value){const temporary=`${file}.${process.pid}.tmp`;await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,file);await chmod(file,0o600);}
async function journal(){try{return JSON.parse(await readFile(journalPath,'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw new Error('Board publisher journal could not be read. Existing state was kept.');}}
async function acquire(){
 try{const handle=await open(lockPath,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));return handle;}
 catch(error){if(error.code!=='EEXIST')throw error;
  const info=await stat(lockPath);let alive=true;
  try{const owner=JSON.parse(await readFile(lockPath,'utf8'));if(!Number.isSafeInteger(owner.pid)||owner.pid<1)alive=false;else try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}}catch{alive=false;}
  if(!alive&&Date.now()-info.mtimeMs>120000){await unlink(lockPath);return acquire();}
  return null;
 }
}
let lock;
try{
 const size=(await stat(inputPath)).size;if(size>750000)throw new Error('Calendar display input is too large.');
 let parsed;try{parsed=JSON.parse(await readFile(inputPath,'utf8'));}catch{throw new Error('Calendar display input could not be read.');}
 const input=validateCalendarSnapshot(parsed,scope);
 await chmod(inputPath,0o600);
 const coverage={rangeStart:input.rangeStart??input.day,rangeEnd:input.rangeEnd??input.day};
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify({valid:true,version:input.version,day:input.day,...coverage,status:input.status||'ok',events:input.events?.length||0}));process.exit(0);}
 lock=await acquire();if(!lock){console.log(JSON.stringify({published:false,reason:'publisher-busy'}));process.exit(0);}
 const state=await journal(),decision=boardPublishDecision(input,state);
 if(!decision.publish){console.log(JSON.stringify({published:false,reason:decision.reason,day:input.day}));}
 else{
  let config;try{config=JSON.parse(await readFile(process.env.OFFICE_BRIDGE_CONFIG||path.join(privateDir,'bridge.json'),'utf8'));}catch{throw new Error('The existing bridge configuration could not be read.');}
  let endpoint;try{endpoint=new URL('/api/board/calendar',config.url);}catch{throw new Error('The bridge URL is invalid.');}
  if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw new Error('Board publishing requires HTTPS.');
  if(typeof config.bridgeKey!=='string'||!config.bridgeKey)throw new Error('The existing bridge key is unavailable.');
  let response;
  try{response=await fetch(endpoint,{method:'PUT',headers:{Authorization:`Bearer ${config.bridgeKey}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});}
  catch{await atomic(journalPath,boardPublishFailure(state));throw new Error('Board publishing is unavailable. The next cycle will retry with backoff.');}
  if(!response.ok){await atomic(journalPath,boardPublishFailure(state,response.status,response.headers.get('retry-after')));throw new Error(`Board publishing failed (HTTP ${response.status}). No source event was changed.`);}
  const receipt=await response.json().catch(()=>null);if(receipt?.ok!==true){await atomic(journalPath,boardPublishFailure(state));throw new Error('Board publish receipt was unreadable.');}
  await atomic(journalPath,{fingerprint:decision.fingerprint,publishedAt:Date.now(),failures:0,retryAt:0});
  console.log(JSON.stringify({published:true,version:input.version,day:input.day,...coverage,status:input.status||'ok',events:input.events?.length||0}));
 }
}catch(error){console.error(error instanceof Error?error.message:'Board publishing failed.');process.exitCode=1;}
finally{if(lock){await lock.close();await unlink(lockPath).catch(()=>{});}}
