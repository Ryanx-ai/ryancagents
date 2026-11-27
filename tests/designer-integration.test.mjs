import test from 'node:test';
import assert from 'node:assert/strict';
import {commandInput} from '../lib/game-state.mjs';
import {validateSnapshot,IDS,LABELS} from '../lib/telemetry.mjs';
import {completionKey,knownCompletion,reviewWatermarks} from '../lib/completions.mjs';
import {validatePlan} from '../scripts/manager.mjs';
const id='20261126-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('Designer Ryan is accepted consistently through prompts, manager assignments, telemetry and reviews',()=>{
 const at=new Date().toISOString();
 assert.equal(commandInput({id,agentId:'designer',prompt:'Review this layout'}).agentId,'designer');
 assert.equal(validatePlan({summary:'Design review',assignments:[{agentId:'designer',prompt:'Review this layout'}]}).assignments[0].agentId,'designer');
 const snapshot=validateSnapshot({version:1,observedAt:at,agents:IDS.map(agentId=>({id:agentId,status:'idle',activity:LABELS.idle,updatedAt:at,completedAt:agentId==='designer'?at:null})),events:[]});
 assert.equal(snapshot.agents.length,6);assert.equal(knownCompletion(snapshot,'designer',at),true);
 const key=completionKey('designer',at);assert.equal(reviewWatermarks({},{[key]:true}).designer,at);
 assert.throws(()=>validatePlan({summary:'Invalid',assignments:[{agentId:'unknown-agent',prompt:'Review'}]}));
});
test('human prompt input cannot forge a trusted spending source or parent assignment',()=>{
 const parsed=commandInput({id,agentId:'manager',prompt:'Summarize',source:'vercel-spending',parentId:'forged',spending:{test:true}});
 assert.deepEqual(parsed,{id,agentId:'manager',prompt:'Summarize'});
});
