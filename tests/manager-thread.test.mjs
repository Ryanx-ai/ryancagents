import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PromptRelay} from '../scripts/prompt-relay.mjs';

test('mapped manager uses the persistent chat, correlates replies, and never invokes the ephemeral planner',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'manager-thread-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const config={codexPath:'/fixture/codex',agents:[{id:'manager',threadId:'persistent-manager'}]};
 const calls=[];
 const relay=new PromptRelay(config,path.join(dir,'journal.json'),async(...args)=>calls.push(args),async()=>assert.fail('ephemeral planner invoked'));
 await relay.load();
 const at=new Date().toISOString();
 const command={id:'20261126-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',agentId:'manager',prompt:'Summarize the office',createdAt:at};
 await relay.dispatch(command);
 await relay.dispatch(command);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0][1],['queue','--thread','persistent-manager','--message',command.prompt,'--resume']);
 assert.equal(relay.entries[command.id].status,'queued');
 relay.observe('manager',{type:'event_msg',timestamp:at,payload:{type:'user_message',message:command.prompt}});
 assert.equal(relay.entries[command.id].status,'delivered');
 relay.observe('manager',{type:'event_msg',timestamp:new Date(Date.parse(at)+1000).toISOString(),payload:{type:'task_complete',last_agent_message:'All three agents are idle.'}});
 assert.equal(relay.entries[command.id].status,'replied');
 assert.equal(relay.entries[command.id].reply,'All three agents are idle.');
});
