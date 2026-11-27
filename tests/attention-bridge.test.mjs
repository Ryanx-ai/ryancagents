import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {IDS} from '../lib/telemetry.mjs';
import {avatarMode} from '../lib/game-state.mjs';
import {completionRows,completionKey} from '../lib/completions.mjs';

const run=promisify(execFile);
const stamp=offset=>new Date(Date.now()+offset).toISOString();
const lifecycle=(type,at,turn,message)=>({type:'event_msg',timestamp:at,payload:{type,turn_id:turn,...(message?{last_agent_message:message}:{})}});
const command=(at,turn,exit=137)=>({type:'event_msg',timestamp:at,payload:{type:'item_completed',turn_id:turn,item:{type:'CommandExecution',status:exit?'failed':'completed',exit_code:exit}}});
const approval=(at,turn)=>({type:'event_msg',timestamp:at,payload:{type:'item_completed',turn_id:turn,item:{type:'McpToolCall',tool:'request_user_input_async',status:'completed'}}});

async function bridgeFixture(t,logs){
 const directory=await mkdtemp(path.join(tmpdir(),'attention-bridge-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const subdir of ['lib','scripts','.local'])await mkdir(path.join(directory,subdir));
 for(const name of ['scripts/bridge.mjs','scripts/prompt-relay.mjs','scripts/manager.mjs','scripts/backoff.mjs','lib/telemetry.mjs','lib/game-state.mjs','lib/message-content.mjs','lib/progress.mjs'])await copyFile(new URL(`../${name}`,import.meta.url),path.join(directory,name));
 const agents=[];for(const id of IDS){const file=path.join(directory,`${id}.jsonl`);await writeFile(file,(logs[id]||[]).map(record=>JSON.stringify(record)).join('\n')+'\n');agents.push({id,file});}
 const config=path.join(directory,'.local/bridge.json');await writeFile(config,JSON.stringify({url:'https://fixture.invalid',bridgeKey:'fixture-only',agents}));
 // Real bridge parser, isolated source files/journal, no HTTP or Codex dispatch.
 const {stdout}=await run(process.execPath,[path.join(directory,'scripts/bridge.mjs'),'--dry-run'],{env:{...process.env,OFFICE_BRIDGE_CONFIG:config},timeout:10000});
 const snapshot=JSON.parse(stdout);return {snapshot,states:Object.fromEntries(snapshot.agents.map(agent=>[agent.id,agent]))};
}

test('late background exit from a completed turn stays historical without reopening Proposal attention',async t=>{
 const start=stamp(-6*3600000),end=stamp(-5*3600000),late=stamp(-1000);
 const {snapshot,states}=await bridgeFixture(t,{proposal:[lifecycle('task_started',start,'proposal-turn'),lifecycle('task_complete',end,'proposal-turn','The proposal is saved for review.'),command(late,'proposal-turn')]});
 assert.equal(states.proposal.status,'idle');assert.equal(states.proposal.updatedAt,end);
 assert.equal(states.proposal.completedAt,end);assert.equal(states.proposal.result,'The proposal is saved for review.');assert.equal(states.proposal.attentionAt,null);
 assert.equal(avatarMode(states.proposal),'review');assert.equal(avatarMode(states.proposal,{proposal:end}),'idle');
 assert.ok(snapshot.events.some(event=>event.agentId==='proposal'&&event.at===late&&event.kind==='error'),'the real process failure remains in activity history');
});

test('new-turn failures and genuine input requests remain attention despite late closed-turn results',async t=>{
 const oldStart=stamp(-30000),oldEnd=stamp(-25000),start=stamp(-15000),attention=stamp(-10000),late=stamp(-1000);
 const previous=[lifecycle('task_started',oldStart,'old'),lifecycle('task_complete',oldEnd,'old','Previous task complete.')];
 const {states}=await bridgeFixture(t,{
  proposal:[...previous,lifecycle('task_started',start,'new'),lifecycle('task_complete',attention,'new','Please confirm which template to use.'),command(late,'old')],
  designer:[...previous,lifecycle('task_started',start,'new'),command(attention,'new'),command(late,'old',0)],
  contacts:[...previous,lifecycle('task_started',start,'new'),approval(attention,'new'),command(late,'old')],
  scheduler:[...previous,command(attention,'unknown-turn')],
  outreach:[...previous,command(attention,undefined)],
  manager:[lifecycle('task_started',start,'aborted'),lifecycle('turn_aborted',attention,'aborted'),command(late,'aborted')],
 });
 assert.equal(states.proposal.status,'waiting');assert.equal(states.proposal.attentionAt,attention);assert.equal(states.proposal.result,'Please confirm which template to use.');
 assert.equal(states.designer.status,'error');assert.equal(states.designer.attentionAt,attention);
 assert.equal(states.contacts.status,'waiting');assert.equal(states.contacts.attentionAt,attention);
 assert.equal(states.scheduler.status,'error','an unknown turn must not have its failure silently dismissed');
 assert.equal(states.outreach.status,'error','legacy records without turn IDs retain failure semantics');
 assert.equal(states.manager.status,'idle');assert.equal(states.manager.updatedAt,attention);
});

test('older appended completions and attention cannot regress current milestones or hide independent reviews',async t=>{
 const old=stamp(-30000),newer=stamp(-10000),late=stamp(-5000);
 const {snapshot,states}=await bridgeFixture(t,{
  proposal:[lifecycle('task_complete',newer,'new','Latest proposal is ready.'),lifecycle('task_complete',old,'old','Earlier proposal is ready.'),command(late,'old')],
  designer:[lifecycle('task_complete',newer,'new','Latest design is ready.'),lifecycle('task_complete',old,'old','Please approve the earlier change.')],
  contacts:[lifecycle('task_complete',newer,'new','Please confirm the contact identity.'),command(old,'old')],
 });
 assert.equal(states.proposal.completedAt,newer);assert.equal(states.proposal.result,'Latest proposal is ready.');assert.equal(states.proposal.status,'idle');
 assert.equal(states.designer.completedAt,newer);assert.equal(states.designer.result,'Latest design is ready.');assert.equal(states.designer.attentionAt,null);
 assert.equal(states.contacts.attentionAt,newer);assert.equal(states.contacts.result,'Please confirm the contact identity.');
 const reviewed={[completionKey('proposal',newer)]:true};
 const rows=completionRows(snapshot.agents,snapshot.events,{},reviewed).filter(row=>row.agentId==='proposal');
 assert.equal(rows.length,2);assert.equal(rows.find(row=>row.completedAt===newer).done,true);assert.equal(rows.find(row=>row.completedAt===old).done,false);
});
