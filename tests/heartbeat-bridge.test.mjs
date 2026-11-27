import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseRecord,IDS} from '../lib/telemetry.mjs';
import {completionRows,completionKey} from '../lib/completions.mjs';
const run=promisify(execFile);
const heartbeat=(decision,message)=>`<heartbeat>\n<automation_id>fixture-heartbeat</automation_id>\n<decision>${decision}</decision>\n<message>${message}</message>\n</heartbeat>`;
const complete=(timestamp,message)=>({type:'event_msg',timestamp,payload:{type:'task_complete',last_agent_message:message}});

test('quiet heartbeat completion is idle even if its diagnostic text contains attention words',()=>{
 const quiet=parseRecord(complete(new Date().toISOString(),heartbeat('DONT_NOTIFY','No changes; waiting for your input is not needed.')));
 assert.deepEqual(quiet,{kind:'idle',status:'idle'});
 assert.deepEqual(parseRecord(complete(new Date().toISOString(),heartbeat('NOTIFY','Please approve the proposed time.'))),{kind:'waiting',status:'waiting'});
});

test('bridge preserves actionable work through quiet runs and exposes meaningful notifications',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'quiet-heartbeat-bridge-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const subdir of ['lib','scripts','.local'])await mkdir(path.join(directory,subdir));
 // Execute the real bridge in dry-run mode, isolated from user journals/config.
 // No server request or Codex command runs in this fixture.
 for(const name of ['scripts/bridge.mjs','scripts/prompt-relay.mjs','scripts/manager.mjs','scripts/backoff.mjs','lib/telemetry.mjs','lib/game-state.mjs','lib/message-content.mjs','lib/progress.mjs'])await copyFile(new URL(`../${name}`,import.meta.url),path.join(directory,name));
 const now=Date.now(),old=new Date(now-30000).toISOString(),started=new Date(now-2000).toISOString(),at=new Date(now).toISOString();
 const start={type:'event_msg',timestamp:started,payload:{type:'task_started'}};
 const logs={
  scheduler:[complete(old,'Earlier calendar work is ready.'),start,complete(at,heartbeat('DONT_NOTIFY','No new work.'))],
  outreach:[],
  contacts:[start,complete(at,heartbeat('DONT_NOTIFY','No contact changes.'))],
  manager:[complete(at,heartbeat('NOTIFY','Please approve the proposed calendar time.'))],
  designer:[complete(at,'**Layout complete.** Review the preview.')],
  proposal:[complete(at,heartbeat('NOTIFY','The **proposal** is ready &amp; saved for review.'))],
 };
 const agents=[];for(const id of IDS){const file=path.join(directory,`${id}.jsonl`);await writeFile(file,logs[id].map(r=>JSON.stringify(r)).join('\n')+'\n');agents.push({id,file});}
 await writeFile(path.join(directory,'.local/bridge.json'),JSON.stringify({url:'https://fixture.invalid',bridgeKey:'fixture-only',agents}));
 const {stdout}=await run(process.execPath,[path.join(directory,'scripts/bridge.mjs'),'--dry-run'],{env:{...process.env,OFFICE_BRIDGE_CONFIG:path.join(directory,'.local/bridge.json')},timeout:10000});
 const snapshot=JSON.parse(stdout);const byId=Object.fromEntries(snapshot.agents.map(a=>[a.id,a]));
 assert.equal(byId.scheduler.status,'idle');assert.equal(byId.scheduler.updatedAt,at);assert.equal(byId.scheduler.completedAt,old);assert.equal(byId.scheduler.result,'Earlier calendar work is ready.');
 assert.equal(byId.contacts.status,'idle');assert.equal(byId.contacts.completedAt,null);assert.equal(byId.contacts.result,null);
 assert.equal(snapshot.events.some(e=>['scheduler','contacts'].includes(e.agentId)&&e.at===at),false);
 const reviewed={[completionKey('scheduler',old)]:true};const rows=completionRows(snapshot.agents,snapshot.events,{},reviewed);
 assert.equal(rows.filter(r=>r.agentId==='scheduler').length,1);assert.equal(rows.find(r=>r.agentId==='scheduler').done,true);assert.equal(rows.some(r=>r.agentId==='contacts'),false);
 assert.equal(byId.manager.status,'waiting');assert.equal(byId.manager.attentionAt,at);assert.equal(byId.manager.result,'Please approve the proposed calendar time.');
 assert.equal(byId.proposal.completedAt,at);assert.equal(byId.proposal.result,'The **proposal** is ready & saved for review.');
 assert.equal(byId.designer.result,'**Layout complete.** Review the preview.');assert.equal(byId.designer.completedAt,at);
 assert.equal(snapshot.events.filter(e=>e.kind==='completed').length,3);
});
