import { open, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LABELS, parseRecord, validateSnapshot } from '../lib/telemetry.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=process.env.OFFICE_BRIDGE_CONFIG||path.join(root,'.local/bridge.json');
let config;try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{console.error('Bridge configuration missing. See README.md for setup.');process.exit(1);}
const endpoint=new URL('/api/ingest',config.url);
if(endpoint.protocol!=='https:'&&endpoint.hostname!=='127.0.0.1'&&endpoint.hostname!=='localhost')throw new Error('Bridge requires HTTPS');
const sources=new Map();const history=new Map();
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
   for(const line of lines){let record;try{record=JSON.parse(line);}catch{continue;}const parsed=parseRecord(record);if(!parsed||!record.timestamp)continue;
    const at=Date.parse(record.timestamp);if(!Number.isFinite(at))continue;
    if(!state.last||at>=Date.parse(state.last)){state.last=record.timestamp;state.status=parsed.status;state.activity=LABELS[parsed.kind];}
    const id=createHash('sha256').update(agent.id+record.timestamp+parsed.kind).digest('hex').slice(0,24);
    history.set(id,{id,agentId:agent.id,at:record.timestamp,...parsed,label:LABELS[parsed.kind]});
   }
  }
  sources.set(agent.id,state);
  const old=state.last&&Date.now()-Date.parse(state.last)>10*60*1000;
  return {id:agent.id,status:old&&state.status==='working'?'waiting':state.status,activity:old&&state.status==='working'?LABELS.waiting:state.activity,updatedAt:state.last};
 }catch{ return {id:agent.id,status:'offline',activity:LABELS.idle,updatedAt:null}; }
}
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
await mkdir(path.join(root,'.local'),{recursive:true});
async function tick(){
 const agents=await Promise.all(config.agents.map(readAgent));
 const events=[...history.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,100);
 history.clear();events.forEach(e=>history.set(e.id,e));
 const snapshot=validateSnapshot({version:1,observedAt:new Date().toISOString(),agents,events});
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify(snapshot,null,2));return;}
 const response=await fetch(endpoint,{method:'POST',headers:{'Authorization':`Bearer ${config.bridgeKey}`,'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Office returned HTTP ${response.status}`);
 await writeFile(path.join(root,'.local/bridge-status.json'),JSON.stringify({lastSync:snapshot.observedAt,agents:agents.map(a=>({id:a.id,status:a.status}))}),{mode:0o600});
 console.log(`${snapshot.observedAt} synced ${agents.length} agents, ${events.length} recent events`);
}
do {try{await tick();}catch(e){console.error(`${new Date().toISOString()} ${e.message}`);}if(process.argv.includes('--once')||process.argv.includes('--dry-run'))break;if(!stopping)await new Promise(r=>setTimeout(r,20000));}while(!stopping);
