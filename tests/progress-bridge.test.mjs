import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {IDS,LABELS,validateSnapshot} from '../lib/telemetry.mjs';
const run=promisify(execFile);
const stamp=offset=>new Date(Date.now()+offset).toISOString();
const lifecycle=(type,at,message)=>({type:'event_msg',timestamp:at,payload:{type,...(message?{last_agent_message:message}:{})}});
const commentary=(at,text,phase='commentary')=>({type:'response_item',timestamp:at,payload:{type:'message',role:'assistant',phase,content:[{type:'output_text',text}]}});
async function bridgeFixture(t,logs){
 const directory=await mkdtemp(path.join(tmpdir(),'progress-bridge-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const subdir of ['lib','scripts','.local'])await mkdir(path.join(directory,subdir));
 for(const name of ['scripts/bridge.mjs','scripts/prompt-relay.mjs','scripts/manager.mjs','scripts/backoff.mjs','lib/telemetry.mjs','lib/game-state.mjs','lib/message-content.mjs','lib/progress.mjs'])await copyFile(new URL(`../${name}`,import.meta.url),path.join(directory,name));
 const agents=[];for(const id of IDS){const file=path.join(directory,`${id}.jsonl`);await writeFile(file,(logs[id]||[]).map(record=>JSON.stringify(record)).join('\n')+'\n');agents.push({id,file});}
 const config=path.join(directory,'.local/bridge.json');await writeFile(config,JSON.stringify({url:'https://fixture.invalid',bridgeKey:'fixture-only',agents}));
 const {stdout}=await run(process.execPath,[path.join(directory,'scripts/bridge.mjs'),'--dry-run'],{env:{...process.env,OFFICE_BRIDGE_CONFIG:config},timeout:10000});
 return JSON.parse(stdout);
}

test('working captions come from ordered public commentary without changing lifecycle or history',async t=>{
 const started=stamp(-30000),recent=stamp(-5000),older=stamp(-10000);
 const snapshot=await bridgeFixture(t,{
  scheduler:[lifecycle('task_started',started),commentary(recent,'Inbox checks pass.')],
  designer:[lifecycle('task_started',started),commentary(recent,"I'm publishing the update, then refreshing the Mac bridge."),commentary(older,"I'm debugging the bridge.")],
  contacts:[lifecycle('task_started',started),commentary(recent,"I'm debugging the bridge.",'analysis')],
  outreach:[commentary(recent,"I'm debugging the bridge.")],
 });
 const byId=Object.fromEntries(snapshot.agents.map(agent=>[agent.id,agent]));
 assert.equal(byId.scheduler.progress,'Inbox checks pass');assert.equal(byId.scheduler.status,'working');assert.equal(byId.scheduler.updatedAt,started);
 assert.equal(byId.designer.progress,'Publishing update');assert.equal(byId.designer.updatedAt,started);
 assert.equal(byId.contacts.progress,null);assert.equal(byId.contacts.activity,LABELS.started);
 assert.equal(byId.outreach.progress,null);assert.equal(byId.outreach.status,'offline');
 assert.equal(snapshot.events.length,3);assert.equal(snapshot.events.every(event=>event.kind==='started'),true);
 assert.equal(JSON.stringify(snapshot).includes("I'm debugging"),false);
});

test('new public blockers clear prior captions without private or delayed records restoring them',async t=>{
 const start=stamp(-30000),hint=stamp(-20000),blocked=stamp(-10000),later=stamp(-5000);
 const publishing="I'm publishing the update, then refreshing the Mac bridge.";
 const snapshot=await bridgeFixture(t,{
  scheduler:[lifecycle('task_started',start),commentary(hint,publishing),commentary(blocked,'I cannot proceed until you approve.')],
  contacts:[lifecycle('task_started',start),commentary(blocked,'I cannot proceed until you approve.'),commentary(hint,publishing)],
  designer:[lifecycle('task_started',start),commentary(hint,publishing),commentary(later,'I cannot proceed until you approve.','analysis')],
  outreach:[lifecycle('task_started',start),commentary(hint,publishing),commentary(later,'I cannot proceed until you approve.','final_answer')],
 });
 const byId=Object.fromEntries(snapshot.agents.map(agent=>[agent.id,agent]));
 assert.equal(byId.scheduler.progress,null);assert.equal(byId.contacts.progress,null);
 assert.equal(byId.designer.progress,'Publishing update');assert.equal(byId.outreach.progress,'Publishing update');
 assert.equal(byId.scheduler.status,'working');assert.equal(byId.scheduler.updatedAt,start);assert.equal(snapshot.events.length,4);
});

test('stale, invalid and future commentary falls back without reviving old activity',async t=>{
 const start=stamp(-300000),fresh=stamp(-1000);
 const snapshot=await bridgeFixture(t,{
  scheduler:[lifecycle('task_started',start),commentary(stamp(-240000),'Inbox checks pass.')],
  contacts:[lifecycle('task_started',stamp(-660000)),commentary(fresh,'Inbox checks pass.')],
  designer:[lifecycle('task_started',start),commentary('not-a-date',"I'm debugging the bridge."),commentary(stamp(120000),"I'm debugging the bridge.")],
 });
 const byId=Object.fromEntries(snapshot.agents.map(agent=>[agent.id,agent]));
 assert.equal(byId.scheduler.progress,null);assert.equal(byId.scheduler.status,'working');assert.equal(byId.scheduler.activity,LABELS.started);
 assert.equal(byId.contacts.progress,null);assert.equal(byId.contacts.status,'waiting');
 assert.equal(byId.designer.progress,null);assert.equal(byId.designer.updatedAt,start);
});

test('lifecycle boundaries clear captions and quiet endings still create no review',async t=>{
 const start=stamp(-30000),hint=stamp(-20000),end=stamp(-10000),later=stamp(-5000);
 const quiet='<heartbeat><automation_id>fixture</automation_id><decision>DONT_NOTIFY</decision><message>No changes.</message></heartbeat>';
 const snapshot=await bridgeFixture(t,{
  scheduler:[lifecycle('task_started',start),commentary(hint,'Inbox checks pass.'),lifecycle('task_complete',end,quiet),commentary(later,'Inbox checks pass.')],
  outreach:[lifecycle('task_started',start),commentary(hint,"I'm debugging the bridge."),lifecycle('task_complete',end,'The requested work is complete.')],
  contacts:[lifecycle('task_started',start),commentary(hint,"I'm debugging the bridge."),lifecycle('turn_aborted',end)],
  designer:[lifecycle('task_started',start),commentary(hint,"I'm debugging the bridge."),lifecycle('task_started',end)],
  proposal:[lifecycle('task_started',end),commentary(later,"I'm publishing the update, then refreshing the Mac bridge."),lifecycle('task_complete',start,'Older completed turn.')],
 });
 const byId=Object.fromEntries(snapshot.agents.map(agent=>[agent.id,agent]));
 for(const id of ['scheduler','outreach','contacts','designer'])assert.equal(byId[id].progress,null,id);
 assert.equal(byId.scheduler.status,'idle');assert.equal(byId.scheduler.completedAt,null);assert.equal(snapshot.events.some(event=>event.agentId==='scheduler'&&event.kind==='completed'),false);
 assert.equal(byId.outreach.completedAt,end);assert.equal(byId.contacts.status,'idle');assert.equal(byId.designer.status,'working');
 assert.equal(byId.proposal.status,'working');assert.equal(byId.proposal.progress,'Publishing update');
});

test('snapshot validation rejects arbitrary progress text and strips captions outside working states',()=>{
 const make=()=>({version:1,observedAt:new Date().toISOString(),agents:IDS.map(id=>({id,status:'working',activity:LABELS.tool,updatedAt:null,progress:'Debugging…'})),events:[]});
 assert.equal(validateSnapshot(make()).agents[0].progress,'Debugging…');
 for(const progress of ['private transcript',{},42]){const input=make();input.agents[0].progress=progress;assert.throws(()=>validateSnapshot(input),/Invalid progress/);}
 const idle=make();idle.agents[0].status='idle';assert.equal(validateSnapshot(idle).agents[0].progress,null);
 const legacy=make();delete legacy.agents[0].progress;assert.equal(validateSnapshot(legacy).agents[0].progress,null);
});
