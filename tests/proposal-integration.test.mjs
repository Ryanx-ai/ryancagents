import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {commandInput} from '../lib/game-state.mjs';
import {IDS,LABELS,parseRecord,validateSnapshot} from '../lib/telemetry.mjs';
import {completionKey,knownCompletion,completionRows,reviewWatermarks} from '../lib/completions.mjs';
import {validatePlan} from '../scripts/manager.mjs';
import {PromptRelay} from '../scripts/prompt-relay.mjs';
const proposalChat='01a2171e-4186-74d2-a950-e074cd6f060b';
const id='20261127-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const snapshot=at=>({version:1,observedAt:at,agents:IDS.map(agentId=>({id:agentId,status:'idle',activity:LABELS.idle,updatedAt:null})),events:[]});
async function journal(t){const dir=await mkdtemp(path.join(tmpdir(),'proposal-relay-'));t.after(()=>rm(dir,{recursive:true,force:true}));return path.join(dir,'journal.json');}

test('six-agent telemetry accepts Proposal session lifecycle and keeps its review independent',()=>{
 const at=new Date().toISOString();const earlier=new Date(Date.parse(at)-1000).toISOString();
 // These event_msg shapes are emitted by the existing Proposal Agent session.
 const started=parseRecord({type:'event_msg',timestamp:earlier,payload:{type:'task_started'}});
 const completed=parseRecord({type:'event_msg',timestamp:at,payload:{type:'task_complete',last_agent_message:'Proposal draft is ready.'}});
 assert.deepEqual(started,{kind:'started',status:'working'});assert.deepEqual(completed,{kind:'completed',status:'idle'});
 const raw=snapshot(at);raw.agents.find(a=>a.id==='proposal').status=started.status;
 assert.equal(validateSnapshot(raw).agents.find(a=>a.id==='proposal').status,'working');
 Object.assign(raw.agents.find(a=>a.id==='proposal'),{status:completed.status,activity:LABELS.completed,updatedAt:at,completedAt:at});
 raw.events=[{id:'proposal-finished',agentId:'proposal',at,...completed,label:'Untrusted label is replaced'}];
 const result=validateSnapshot(raw);assert.equal(result.agents.length,6);assert.equal(result.events[0].label,LABELS.completed);
 assert.equal(knownCompletion(result,'proposal',at),true);assert.equal(knownCompletion(result,'proposal',earlier),false);
 const key=completionKey('proposal',at);const reviewed=reviewWatermarks({designer:earlier},{[key]:true});
 assert.equal(reviewed.proposal,at);assert.equal(reviewed.designer,earlier);
 assert.equal(completionRows(result.agents,result.events,{},{}).find(r=>r.agentId==='proposal').done,false);
 assert.equal(completionRows(result.agents,result.events,reviewed,{[key]:true}).find(r=>r.agentId==='proposal').done,true);
 const legacy=snapshot(at);legacy.agents=legacy.agents.filter(a=>a.id!=='proposal');assert.equal(validateSnapshot(legacy).agents.length,5);
 raw.agents.push({...raw.agents[0]});assert.throws(()=>validateSnapshot(raw));
});

test('Proposal prompts dispatch once to the existing chat and correlate only its own final answer',async t=>{
 const file=await journal(t);const calls=[];const config={codexPath:'/fixture/codex',agents:[{id:'proposal',threadId:proposalChat}]};
 const relay=new PromptRelay(config,file,async(...args)=>calls.push(args),async()=>assert.fail('Proposal must not create an ephemeral worker'));
 await relay.load();const at=new Date().toISOString();const prompt='Draft the requested proposal in Proposal Studio; do not send it.';
 const command={...commandInput({id,agentId:'proposal',prompt}),createdAt:at};
 await relay.dispatch(command);await relay.dispatch(command);
 assert.equal(calls.length,1);assert.deepEqual(calls[0][1],['queue','--thread',proposalChat,'--message',prompt,'--resume']);
 relay.observe('proposal',{type:'event_msg',timestamp:at,payload:{type:'user_message',message:prompt}});
 relay.observe('designer',{type:'event_msg',timestamp:new Date(Date.parse(at)+500).toISOString(),payload:{type:'task_complete',last_agent_message:'Unrelated design result'}});
 assert.equal(relay.entries[id].status,'delivered');assert.equal(relay.entries[id].reply,undefined);
 relay.observe('proposal',{type:'event_msg',timestamp:new Date(Date.parse(at)+1000).toISOString(),payload:{type:'task_complete',last_agent_message:'Proposal draft is ready for review.'}});
 assert.equal(relay.entries[id].status,'replied');assert.equal(relay.entries[id].reply,'Proposal draft is ready for review.');await relay.save();
 const restored=new PromptRelay(config,file,async()=>assert.fail('Duplicate dispatch after restart'));
 await restored.load();await restored.dispatch(command);assert.equal(restored.entries[id].status,'replied');
});

test('fallback manager can delegate a Proposal Studio request with parent correlation and a named receipt',async t=>{
 const file=await journal(t);const assignment={agentId:'proposal',prompt:'Draft the requested proposal in Proposal Studio.'};
 const plan=validatePlan({summary:'I will ask Proposal Ryan to draft it.',assignments:[assignment]});
 const schema=JSON.parse(await readFile(new URL('../scripts/manager-schema.json',import.meta.url),'utf8'));
 assert.ok(schema.properties.assignments.items.properties.agentId.enum.includes('proposal'));
 assert.throws(()=>validatePlan({summary:'Invalid',assignments:[{agentId:'unknown-agent',prompt:'Draft'}]}));
 const relay=new PromptRelay({agents:[]},file,async()=>assert.fail('No direct worker dispatch from planner'),async()=>plan);
 await relay.load();const posted=[];relay.request=async(method,body)=>{posted.push({method,body});return {ok:true};};
 await relay.dispatch({id,agentId:'manager',prompt:'Ask Proposal Ryan to draft the proposal.',createdAt:new Date().toISOString()});await relay.managerTask;
 assert.equal(posted.length,1);assert.equal(posted[0].method,'POST');assert.equal(posted[0].body.agentId,'proposal');assert.equal(posted[0].body.parentId,id);
 assert.match(relay.entries[id].reply,/→ Proposal Ryan:/);assert.equal(relay.entries[id].status,'replied');
});
