import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {commandInput,messageText} from '../lib/game-state.mjs';
import {planWithCodex} from './manager.mjs';
import {randomUUID} from 'node:crypto';
const run=promisify(execFile);
export class PromptRelay {
 constructor(config,journalPath,runner=run,planner=planWithCodex){this.config=config;this.path=journalPath;this.run=runner;this.plan=planner;this.entries={};this.pending=new Map();this.nextRecoveryAt=0;}
 async load(){try{this.entries=JSON.parse(await readFile(this.path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}for(const item of Object.values(this.entries))if(['dispatching','planning'].includes(item.status)){item.status='uncertain';item.dirty=true;}}
 async save(){const data=JSON.stringify(this.entries);this.saveChain=(this.saveChain||Promise.resolve()).catch(()=>{}).then(async()=>{await writeFile(this.path+'.tmp',data,{mode:0o600});await rename(this.path+'.tmp',this.path);});return this.saveChain;}
 async request(method,body,query){const url=new URL('/api/messages',this.config.url);if(query)url.search=new URLSearchParams(query).toString();const r=await fetch(url,{method,headers:{Authorization:`Bearer ${this.config.bridgeKey}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Message relay HTTP ${r.status}`);return r.json();}
 async dispatch(command){
  const input=commandInput(command);if(this.entries[input.id])return;
  if(input.agentId==='manager'&&!this.config.agents.some(a=>a.id==='manager'&&a.threadId)){
   if(this.managerTask)return;
   this.entries[input.id]={...input,createdAt:command.createdAt,pickedUpAt:new Date().toISOString(),status:'planning',dirty:true};await this.save();
   if(Date.now()-Date.parse(command.createdAt)>3600000){this.entries[input.id].status='expired';await this.save();return;}
   this.managerTask=this.runManager(input).catch(()=>{console.error('Manager journal could not be saved. Check the local bridge.');}).finally(()=>{this.managerTask=null;});return;
  }
  const agent=this.config.agents.find(a=>a.id===input.agentId);if(!agent?.threadId||!this.config.codexPath)throw new Error('Codex relay not configured');
  const expired=Date.now()-Date.parse(command.createdAt)>3600000;
  this.entries[input.id]={...input,createdAt:command.createdAt,pickedUpAt:new Date().toISOString(),status:expired?'expired':'dispatching',dirty:true};await this.save();
  if(expired)return;
  // At-most-once dispatch: a crash or ambiguous CLI result is never auto-retried.
  try{
   await this.run(this.config.codexPath,['queue','--thread',agent.threadId,'--message',input.prompt,'--resume'],{timeout:45000,maxBuffer:128*1024,env:{...process.env},windowsHide:true});
   this.entries[input.id].queuedAt=new Date().toISOString();
   if(this.entries[input.id].status==='dispatching')this.entries[input.id].status='queued';
  }catch{if(this.entries[input.id].status==='dispatching')this.entries[input.id].status='uncertain';}
  this.entries[input.id].dirty=true;await this.save();
 }
 async runManager(input){
  const entry=this.entries[input.id];
  try{
   const history=Object.values(this.entries).filter(e=>e.agentId==='manager'&&e.id!==input.id).slice(-5).map(e=>({request:e.prompt,response:e.reply||null}));
   const plan=await this.plan(this.config,input.prompt,{office:this.context,conversation:history});
   entry.plan=plan;entry.assignments=plan.assignments.map(a=>({...a,id:new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID()}));await this.save();
   for(const assignment of entry.assignments){await this.request('POST',{...assignment,parentId:input.id});assignment.queued=true;await this.save();}
   const names={scheduler:'Inbox Ryan',outreach:'Outreach Ryan',contacts:'Network Ryan'};
   entry.reply=(plan.summary+(entry.assignments.length?'\n\n'+entry.assignments.map(a=>`→ ${names[a.agentId]}: ${a.prompt}`).join('\n\n'):'')).slice(0,12000);
   entry.status='replied';entry.completedAt=new Date().toISOString();entry.repliedAt=entry.completedAt;entry.dirty=true;await this.save();
  }catch{entry.status='uncertain';entry.reply='I could not confirm the full request. Check the agent chats before retrying.';entry.dirty=true;await this.save();}
 }
 managerState(){const entries=Object.values(this.entries).filter(e=>e.agentId==='manager').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));const latest=entries[0];const completed=entries.find(e=>e.completedAt);return {id:'manager',status:latest?.status==='planning'?'working':latest?.status==='uncertain'?'waiting':'idle',activity:latest?.status==='planning'?'Planning next steps':latest?.status==='uncertain'?'Waiting for input':completed?'Work session finished':'Ready for the next task',updatedAt:latest?.completedAt||latest?.createdAt||null,completedAt:completed?.completedAt||null,result:latest?.reply?Buffer.from(latest.reply).subarray(0,4000).toString('utf8'):null};}
 observe(agentId,record){
  const text=messageText(record);if(!text)return;
  const candidates=Object.values(this.entries).filter(e=>e.agentId===agentId&&['dispatching','queued','delivered','uncertain'].includes(e.status)&&Date.parse(record.timestamp)>=Date.parse(e.createdAt));
  for(const e of candidates){
   if(text.role==='user'&&text.text.trim()===e.prompt.trim()){e.matchedAt=record.timestamp;e.deliveredAt=record.timestamp;e.status='delivered';e.dirty=true;}
   if(text.role==='assistant'&&e.matchedAt&&Date.parse(record.timestamp)>Date.parse(e.matchedAt)){e.reply=text.text.slice(0,12000);e.repliedAt=record.timestamp;e.status='replied';e.dirty=true;}
  }
 }
 receipt(e){return {id:e.id,status:e.status,reply:e.reply||null,pickedUpAt:e.pickedUpAt,queuedAt:e.queuedAt,deliveredAt:e.deliveredAt,repliedAt:e.repliedAt};}
 async flushReceipts(){
  await Promise.all(Object.values(this.entries).filter(e=>e.dirty&&e.status!=='dispatching').map(async e=>{
   const receipt=this.receipt(e);await this.request('PATCH',receipt);
   if(JSON.stringify(this.receipt(e))===JSON.stringify(receipt))e.dirty=false;
   await this.save();
  }));
 }
 async tick(){
  try {
   const recovery=Date.now()>=this.nextRecoveryAt;
   const response=await this.request('GET',undefined,{queue:'1',revision:this.queueRevision||'',...(recovery?{recover:'1'}:{})});
   if(!response.unchanged){
    for(const command of response.messages||[])if(command.status==='pending')this.pending.set(command.id,command);
    this.queueRevision=response.revision;
   }
   if(recovery)this.nextRecoveryAt=Date.now()+60000;
   for(const [id,command] of this.pending){await this.dispatch(command);if(this.entries[id])this.pending.delete(id);}
  }finally{await this.flushReceipts();}
 }
}
