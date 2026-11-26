import { open, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LABELS, parseRecord, validateSnapshot } from '../lib/telemetry.mjs';
import { PromptRelay } from './prompt-relay.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=process.env.OFFICE_BRIDGE_CONFIG||path.join(root,'.local/bridge.json');
let config;try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{console.error('Bridge configuration missing. See README.md for setup.');process.exit(1);}
const endpoint=new URL('/api/ingest',config.url);
if(endpoint.protocol!=='https:'&&endpoint.hostname!=='127.0.0.1'&&endpoint.hostname!=='localhost')throw new Error('Bridge requires HTTPS');
const sources=new Map();const history=new Map();
const relay=new PromptRelay(config,path.join(root,'.local/prompt-journal.json'));
await relay.load();
async function readAgent(agent){
 let state=sources.get(agent.id)||{offset:0,carry:'',last:null,status:'offline',activity:LABELS.idle};
 try {
  const info=await stat(agent.file);if(info.size<state.offset){state={offset:0,carry:'',last:null,status:'offline',activity:LABELS.idle};}
  if(info.size!==state.offset){
   const initial=state.offset===0;
   // Read a bounded tail on first connection. Later reads are incremental.
   let start=initial?Math.max(0,info.size-4*1024*1024):state.offset;
   const length=Math.min(info.size-start,8*1024*1024);const file=await open(agent.file,'r');const buffer=Buffer.alloc(length);
   try{await file.read(buffer,0,length,start);}finally{await file.close();}
   let text=(initial?'':state.carry)+buffer.toString('utf8');if(initial&&start>0)text=text.slice(text.indexOf('\n')+1);
   const lines=text.split('\n');state.carry=lines.pop()||'';state.offset=start+length;
   for(const line of lines){let record;try{record=JSON.parse(line);}catch{continue;}relay.observe(agent.id,record);const parsed=parseRecord(record);if(!parsed||!record.timestamp)continue;
    const at=Date.parse(record.timestamp);if(!Number.isFinite(at))continue;
    if(!state.last||at>=Date.parse(state.last)){state.last=record.timestamp;state.status=parsed.status;state.activity=LABELS[parsed.kind];}
    if(parsed.kind==='completed')state.completedAt=record.timestamp;
    if(record.type==='event_msg'&&record.payload?.type==='task_complete')state.result=Buffer.from(String(record.payload.last_agent_message||''),'utf8').subarray(0,4000).toString('utf8');
    if(parsed.status==='waiting'||parsed.status==='error')state.attentionAt=record.timestamp;
    const id=createHash('sha256').update(agent.id+record.timestamp+parsed.kind).digest('hex').slice(0,24);
    history.set(id,{id,agentId:agent.id,at:record.timestamp,...parsed,label:LABELS[parsed.kind]});
   }
  }
  sources.set(agent.id,state);
  const old=state.last&&Date.now()-Date.parse(state.last)>10*60*1000;
  return {id:agent.id,status:old&&state.status==='working'?'waiting':state.status,activity:old&&state.status==='working'?LABELS.waiting:state.activity,updatedAt:state.last,completedAt:state.completedAt||null,attentionAt:state.attentionAt||null,result:state.result||null};
 }catch{ return {id:agent.id,status:'offline',activity:LABELS.idle,updatedAt:null}; }
}
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
await mkdir(path.join(root,'.local'),{recursive:true});
let lastPublished=0,lastFingerprint='',publishing=null;
async function tick(force=false){
 const agents=await Promise.all(config.agents.map(readAgent));
 relay.context={agents,events:[...history.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,25)};
 if(!agents.some(a=>a.id==='manager'))agents.push(relay.managerState());
 const events=[...history.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,100);
 history.clear();events.forEach(e=>history.set(e.id,e));
 const snapshot=validateSnapshot({version:1,observedAt:new Date().toISOString(),agents,events});
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify(snapshot,null,2));return;}
 if(Object.values(relay.entries).some(e=>e.dirty))await relay.save();
 const fingerprint=JSON.stringify({agents,events});
 if(!force&&fingerprint===lastFingerprint&&Date.now()-lastPublished<20000)return;
 if(publishing)return;
 // One upload at a time; sampling keeps running while the network is busy.
 // The next tick publishes the latest state if it changed during this upload.
 publishing=publish(snapshot,fingerprint,agents).catch(e=>console.error(`${new Date().toISOString()} ${e.message}`)).finally(()=>{publishing=null;});
 if(force)await publishing;
}
async function publish(snapshot,fingerprint,agents){
 const response=await fetch(endpoint,{method:'POST',headers:{'Authorization':`Bearer ${config.bridgeKey}`,'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Office returned HTTP ${response.status}`);
 lastPublished=Date.now();lastFingerprint=fingerprint;
 await writeFile(path.join(root,'.local/bridge-status.json'),JSON.stringify({lastSync:snapshot.observedAt,agents:agents.map(a=>({id:a.id,status:a.status}))}),{mode:0o600});
 console.log(`${snapshot.observedAt} synced ${agents.length} agents, ${events.length} recent events`);
}
async function safely(task){try{await task();}catch(e){console.error(`${new Date().toISOString()} ${e.message}`);}}
async function loop(task,interval){
 while(!stopping){const started=Date.now();await safely(task);if(!stopping)await new Promise(r=>setTimeout(r,Math.max(250,interval-(Date.now()-started))));}
}
// Observe local logs every two seconds and publish changes immediately; unchanged
// snapshots keep a twenty-second heartbeat. Prompt pickup never waits for ingest.
await safely(()=>tick(true));
if(process.argv.includes('--dry-run'))process.exit(0);
if(process.argv.includes('--once'))await safely(()=>relay.tick());
else await Promise.all([loop(()=>tick(),2000),loop(()=>relay.tick(),2000)]);
