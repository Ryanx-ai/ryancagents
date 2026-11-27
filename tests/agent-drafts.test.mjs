import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_DRAFTS_KEY,MAX_AGENT_DRAFTS,canActivateAgentDraft,createAgentDraft,deleteAgentDraft,exportAgentDraft,importAgentDraft,readAgentDrafts,saveAgentDraft,validateAgentDraft} from '../lib/agent-drafts.mjs';

const input=()=>({name:'Research Ryan',description:'Prepare a research summary for review.',workflow:{trigger:'When requested',input:'A research question',steps:['Read the question','Gather relevant information','Prepare a summary'],output:'A summary for review'},outfit:'standard',requestedConnectors:['codex']});
function memory(initial={}){const values=new Map(Object.entries(initial));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};}

test('draft creation and validation are inactive, normalized and independent of editable input',()=>{
 const source=input();source.name=' Research Ryan ';const draft=createAgentDraft(source);
 assert.equal(draft.name,'Research Ryan');assert.equal(draft.status,'draft');assert.equal(draft.activation,'unavailable');assert.equal(draft.connectorVerification,'not_verified');assert.equal(canActivateAgentDraft(draft),false);
 source.workflow.steps[0]='Changed';assert.equal(draft.workflow.steps[0],'Read the question');
 assert.deepEqual(validateAgentDraft(draft),draft);assert.ok(Date.parse(draft.createdAt)<=Date.parse(draft.updatedAt));
});

test('JSON export and import create a validated new copy rather than replacing the source ID',()=>{
 const draft=createAgentDraft(input());const imported=importAgentDraft(exportAgentDraft(draft));
 assert.notEqual(imported.id,draft.id);assert.equal(imported.name,draft.name);assert.deepEqual(imported.workflow,draft.workflow);assert.equal(imported.activation,'unavailable');
 const storage=memory();saveAgentDraft(draft,storage);saveAgentDraft(imported,storage);assert.equal(readAgentDrafts(storage).drafts.length,2);
});

test('active states, claimed connector verification, executable fields and unsupported formats are rejected',()=>{
 const draft=createAgentDraft(input());
 for(const replacement of [{status:'active'},{activation:'enabled'},{connectorVerification:'verified'},{schemaVersion:2},{apiKey:'not-a-real-key'},{threadId:'not-a-real-chat'}])assert.throws(()=>validateAgentDraft({...draft,...replacement}));
 assert.throws(()=>validateAgentDraft({...draft,workflow:{...draft.workflow,execute:'send'}}));
 for(const value of [undefined,null,{},draft,{status:'active'},true])assert.equal(canActivateAgentDraft(value),false);
 assert.throws(()=>importAgentDraft(JSON.stringify({kind:'ryan-agent-draft',version:1,draft:{...draft,status:'active'}})),/inactive drafts/);
 assert.throws(()=>importAgentDraft(JSON.stringify({kind:'ryan-agent-draft',version:2,draft})),/exported Ryan/);
});

test('draft shape, connector IDs, sizes and timestamps are bounded',()=>{
 const draft=createAgentDraft(input());
 for(const replacement of [{id:'existing-agent-id'},{name:''},{name:'x'.repeat(61)},{description:'x'.repeat(2001)},{outfit:'uploaded-code'},{requestedConnectors:['unknown']},{requestedConnectors:['gmail','gmail']},{createdAt:'not-a-date'},{createdAt:'2030-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z'}])assert.throws(()=>validateAgentDraft({...draft,...replacement}));
 for(const steps of [[],Array(13).fill('Read'),[''],[null]])assert.throws(()=>validateAgentDraft({...draft,workflow:{...draft.workflow,steps}}));
 assert.throws(()=>importAgentDraft('{oops'),/valid JSON/);assert.throws(()=>importAgentDraft(' '.repeat(65537)),/64 KB/);
});

test('save, edit and delete preserve other drafts and unrelated browser data',()=>{
 const storage=memory({'other-setting':'leave-me'});const first=createAgentDraft(input()),second=createAgentDraft({...input(),name:'Second Ryan'});
 saveAgentDraft(first,storage);saveAgentDraft(second,storage);
 const edited=createAgentDraft({...input(),name:'Revised Ryan'},first);saveAgentDraft(edited,storage);
 const saved=readAgentDrafts(storage);assert.equal(saved.error,null);assert.equal(saved.drafts.length,2);assert.equal(saved.drafts.find(draft=>draft.id===first.id).name,'Revised Ryan');assert.equal(edited.createdAt,first.createdAt);
 deleteAgentDraft(first.id,storage);assert.deepEqual(readAgentDrafts(storage).drafts,[second]);assert.equal(storage.values.get('other-setting'),'leave-me');
});

test('corrupt, duplicate, future-version and partly invalid stores are preserved, never partially overwritten',()=>{
 const draft=createAgentDraft(input());
 for(const raw of ['broken JSON',JSON.stringify({version:2,drafts:[]}),JSON.stringify({version:1,drafts:[draft],futureImportantField:{keep:true}}),JSON.stringify({version:1,drafts:[draft,draft]}),JSON.stringify({version:1,drafts:[draft,{...draft,id:'broken'}]})]){
  const storage=memory({[AGENT_DRAFTS_KEY]:raw});assert.ok(readAgentDrafts(storage).error);assert.throws(()=>saveAgentDraft(draft,storage),/Existing data was kept/);assert.throws(()=>deleteAgentDraft(draft.id,storage),/Existing data was kept/);assert.equal(storage.values.get(AGENT_DRAFTS_KEY),raw);
 }
});

test('quota and unavailable storage errors remain recoverable through JSON export',()=>{
 const first=createAgentDraft(input()),next=createAgentDraft({...input(),name:'Next Ryan'}),raw=JSON.stringify({version:1,drafts:[first]});
 const storage={getItem:()=>raw,setItem:()=>{throw new Error('Quota exceeded');}};
 assert.throws(()=>saveAgentDraft(next,storage),/export your draft/);assert.deepEqual(readAgentDrafts(storage).drafts,[first]);assert.doesNotThrow(()=>exportAgentDraft(next));
 assert.ok(readAgentDrafts({getItem:()=>{throw new Error('Blocked');},setItem:()=>{}}).error);
});

test('full library blocks new drafts but still permits updates and deletion',()=>{
 const drafts=Array.from({length:MAX_AGENT_DRAFTS},(_,index)=>createAgentDraft({...input(),name:`Draft ${index+1}`}));const storage=memory({[AGENT_DRAFTS_KEY]:JSON.stringify({version:1,drafts})});
 assert.throws(()=>saveAgentDraft(createAgentDraft(input()),storage),/50 drafts/);assert.equal(readAgentDrafts(storage).drafts.length,MAX_AGENT_DRAFTS);
 saveAgentDraft(createAgentDraft({...input(),name:'Updated'},drafts[0]),storage);assert.equal(readAgentDrafts(storage).drafts.length,MAX_AGENT_DRAFTS);
 deleteAgentDraft(drafts[1].id,storage);assert.equal(readAgentDrafts(storage).drafts.length,MAX_AGENT_DRAFTS-1);
});

test('unfinished tab recovery restores partial input independently of the saved library',async()=>{
 const {AGENT_DRAFT_RECOVERY_KEY,saveAgentDraftRecovery,readAgentDraftRecovery,clearAgentDraftRecovery}=await import('../lib/agent-drafts.mjs');
 const storage=memory({'other-setting':'keep'});storage.removeItem=key=>storage.values.delete(key);
 const form={...input(),name:'',description:'An unfinished task  ',workflow:{trigger:'',input:'',steps:['','',''],output:''}};
 const recovery={version:1,form,editing:null,step:0,unlocked:1};saveAgentDraftRecovery(recovery,storage);
 assert.deepEqual(readAgentDraftRecovery(storage),{recovery,error:null});assert.equal(storage.getItem(AGENT_DRAFTS_KEY),null);assert.equal(canActivateAgentDraft(recovery),false);
 clearAgentDraftRecovery(storage);assert.equal(storage.getItem(AGENT_DRAFT_RECOVERY_KEY),null);assert.equal(storage.getItem('other-setting'),'keep');
});

test('recovery preserves source draft metadata but rejects active, oversized and unknown data',async()=>{
 const {AGENT_DRAFT_RECOVERY_KEY,saveAgentDraftRecovery,readAgentDraftRecovery}=await import('../lib/agent-drafts.mjs');
 const editing=createAgentDraft(input()),recovery={version:1,form:input(),editing,step:3,unlocked:3},storage=memory();
 saveAgentDraftRecovery(recovery,storage);assert.equal(readAgentDraftRecovery(storage).recovery.editing.id,editing.id);
 for(const invalid of [{...recovery,step:4},{...recovery,unlocked:2},{...recovery,form:{...input(),name:'x'.repeat(61)}},{...recovery,form:{...input(),activation:'enabled'}},{...recovery,editing:{...editing,status:'active'}},{...recovery,unsupported:true}])assert.throws(()=>saveAgentDraftRecovery(invalid,storage));
 const raw=JSON.stringify({...recovery,version:2});storage.setItem(AGENT_DRAFT_RECOVERY_KEY,raw);assert.ok(readAgentDraftRecovery(storage).error);assert.throws(()=>saveAgentDraftRecovery(recovery,storage));assert.equal(storage.getItem(AGENT_DRAFT_RECOVERY_KEY),raw);
});

test('existing version-one drafts and checkpoints remain valid without clothing colors',async()=>{
 const {readAgentDraftRecovery}=await import('../lib/agent-drafts.mjs');
 const draft=createAgentDraft(input());assert.equal(Object.hasOwn(draft,'palette'),false);assert.equal(Object.hasOwn(validateAgentDraft(draft),'palette'),false);
 const imported=importAgentDraft(exportAgentDraft(draft));assert.equal(Object.hasOwn(imported,'palette'),false);
 const storage=memory({'ryan-agent-draft-recovery-v1':JSON.stringify({version:1,form:input(),editing:draft,step:2,unlocked:2})});
 const restored=readAgentDraftRecovery(storage);assert.equal(restored.error,null);assert.equal(Object.hasOwn(restored.recovery.form,'palette'),false);
});

test('optional clothing colors survive save, edit, export, import and unfinished recovery',async()=>{
 const {saveAgentDraftRecovery,readAgentDraftRecovery}=await import('../lib/agent-drafts.mjs');
 const palette={jacket:'#465575',shirt:'#EEE7D6',pants:'#303741'},draft=createAgentDraft({...input(),palette});
 assert.deepEqual(draft.palette,{...palette,shirt:'#eee7d6'});
 const storage=memory();saveAgentDraft(draft,storage);assert.deepEqual(readAgentDrafts(storage).drafts[0].palette,draft.palette);
 assert.deepEqual(importAgentDraft(exportAgentDraft(draft)).palette,draft.palette);
 const form={...input(),name:'',palette};saveAgentDraftRecovery({version:1,form,editing:draft,step:2,unlocked:2},storage);
 assert.deepEqual(readAgentDraftRecovery(storage).recovery.form.palette,draft.palette);
 const reset=createAgentDraft(input(),draft);assert.equal(Object.hasOwn(reset,'palette'),false);assert.equal(reset.id,draft.id);
 for(const invalid of [null,{jacket:'red',shirt:'#ffffff',pants:'#000000'},{...palette,extra:'#ffffff'}])assert.throws(()=>createAgentDraft({...input(),palette:invalid}));
});
