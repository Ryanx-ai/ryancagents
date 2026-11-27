import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesignerVoiceController,MAX_VOICE_CHARS,VOICE_TIMEOUTS} from '../lib/designer-voice.mjs';

function harness({startThrows=false,stopThrows=false}={}){
 let now=0,next=0;const timers=new Map(),recognizers=[],changes=[];
 const controller=createDesignerVoiceController({
  createRecognizer(){const recognizer={starts:0,stops:0,aborts:0,start(){this.starts++;if(startThrows)throw new Error('start failed');},stop(){this.stops++;if(stopThrows)throw new Error('stop failed');},abort(){this.aborts++;}};recognizers.push(recognizer);return recognizer;},
  onChange:state=>changes.push(state),
  setTimeout(callback,delay){const id=++next;timers.set(id,{at:now+delay,callback});return id;},
  clearTimeout:id=>timers.delete(id),
 });
 function advance(ms){const end=now+ms;while(true){const entry=[...timers.entries()].filter(([,value])=>value.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].callback();}now=end;}
 return {controller,recognizers,changes,timers,advance,get recognition(){return recognizers.at(-1);}};
}
function result(...items){return {results:items.map(([text,final])=>Object.assign([{transcript:text}],{isFinal:final}))};}
function listen(h){assert.equal(h.controller.start(),true);h.recognition.onstart();}

test('voice does not acquire a recognizer until explicit start and never auto-restarts',()=>{
 const h=harness();assert.equal(h.recognizers.length,0);assert.equal(h.controller.getState().phase,'ready');
 assert.equal(h.controller.start(),true);assert.equal(h.controller.getState().phase,'starting');
 assert.equal(h.controller.start(),false);assert.equal(h.recognizers.length,1);
 assert.equal(h.recognition.lang,'en-SG');h.recognition.onstart();
 assert.equal(h.controller.getState().phase,'listening');
 h.recognition.onresult(result(['A short note.',true]));h.recognition.onend();
 assert.equal(h.controller.getState().phase,'review');h.advance(120000);
 assert.equal(h.recognizers.length,1);assert.equal(h.timers.size,0);
});

test('cumulative recognition results replace interim slots without duplicating text',()=>{
 const h=harness();listen(h);
 h.recognition.onresult(result(['Make',false]));assert.equal(h.controller.getState().interim,'Make');
 h.recognition.onresult(result(['Make the card blue.',true],['Then',false]));
 h.recognition.onresult(result(['Make the card blue.',true],['Then add padding.',true]));
 assert.equal(h.controller.getState().transcript,'Make the card blue. Then add padding.');
 assert.equal(h.controller.getState().interim,'');
 h.controller.stop();assert.equal(h.controller.getState().phase,'stopping');
 h.recognition.onresult(result(['Make the card blue.',true],['Then add padding.',true],['Keep it compact.',true]));
 h.recognition.onend();assert.equal(h.controller.getState().transcript,'Make the card blue. Then add padding. Keep it compact.');
 assert.equal(h.controller.getState().phase,'review');assert.equal(h.timers.size,0);
});

test('cancel clears text and invalidates late callbacks across a new recording',()=>{
 const h=harness();listen(h);const old=h.recognition;
 const late={result:old.onresult,error:old.onerror,end:old.onend,start:old.onstart};
 old.onresult(result(['Discard me.',true]));h.controller.cancel();
 assert.equal(old.aborts,1);assert.equal(h.controller.getState().transcript,'');
 assert.equal(h.controller.getState().phase,'ready');assert.equal(h.timers.size,0);
 listen(h);late.result(result(['Late private text.',true]));late.error({error:'network'});late.end();late.start();
 assert.equal(h.controller.getState().phase,'listening');assert.equal(h.controller.getState().transcript,'');
 h.recognition.onresult(result(['Keep me.',true]));h.recognition.onend();
 assert.equal(h.controller.getState().transcript,'Keep me.');
});

test('startup, clip, and stopping watchdogs terminate hung browser sessions',()=>{
 const waiting=harness();waiting.controller.start();waiting.advance(VOICE_TIMEOUTS.startup);
 assert.equal(waiting.controller.getState().phase,'error');assert.match(waiting.controller.getState().error,/did not start in time/);assert.equal(waiting.recognition.aborts,1);
 const h=harness();listen(h);h.recognition.onresult(result(['Completed text.',true],['Unfinished',false]));
 h.advance(VOICE_TIMEOUTS.clip);assert.equal(h.recognition.stops,1);assert.equal(h.controller.getState().phase,'stopping');
 h.advance(VOICE_TIMEOUTS.stopping);assert.equal(h.recognition.aborts,1);
 assert.equal(h.controller.getState().phase,'review');assert.equal(h.controller.getState().transcript,'Completed text.');assert.equal(h.controller.getState().interim,'');assert.equal(h.timers.size,0);
});

test('meaningful errors survive subsequent end callbacks and retain completed text for review',()=>{
 for(const code of ['not-allowed','service-not-allowed','network','audio-capture','no-speech','language-not-supported','aborted','unknown']){
  const h=harness();listen(h);h.recognition.onresult(result(['Already recognized.',true]));const end=h.recognition.onend;
  h.recognition.onerror({error:code});const message=h.controller.getState().error;end();
  assert.equal(h.controller.getState().phase,'error');assert.ok(message);assert.equal(h.controller.getState().error,message);
  assert.equal(h.controller.getState().transcript,'Already recognized.');assert.equal(h.timers.size,0);
 }
});

test('start exceptions and stop before listening remain bounded and retry is explicit',()=>{
 const bad=harness({startThrows:true});assert.equal(bad.controller.start(),false);assert.equal(bad.controller.getState().phase,'error');assert.equal(bad.recognition.aborts,1);assert.equal(bad.timers.size,0);
 const h=harness({stopThrows:true});h.controller.start();const start=h.recognition.onstart;
 h.controller.stop();start();assert.equal(h.controller.getState().phase,'error');assert.equal(h.recognition.aborts,2);assert.equal(h.timers.size,0);
});

test('transcripts stay within 4000 characters with visible limit notice and controlled edits',()=>{
 const h=harness();listen(h);
 h.recognition.onresult(result(['x'.repeat(MAX_VOICE_CHARS+50),true]));
 assert.equal(h.controller.getState().transcript.length,MAX_VOICE_CHARS);assert.match(h.controller.getState().notice,/4,000-character limit/);assert.equal(h.recognition.stops,1);
 assert.equal(h.controller.setTranscript('Not while recording'),false);h.recognition.onend();
 assert.equal(h.controller.setTranscript('Edited text.'),true);assert.equal(h.controller.getState().transcript,'Edited text.');
 assert.equal(h.controller.setTranscript('x'.repeat(MAX_VOICE_CHARS+1)),false);assert.equal(h.controller.getState().transcript,'Edited text.');
});

test('dispose aborts and silences callbacks, timers, and subsequent actions',()=>{
 const h=harness();listen(h);const late=h.recognition.onresult;const calls=h.changes.length;
 h.controller.dispose();h.controller.dispose();late(result(['Do not restore.',true]));h.advance(120000);
 h.controller.cancel();h.controller.stop();assert.equal(h.controller.start(),false);
 assert.equal(h.changes.length,calls);assert.equal(h.recognition.aborts,1);assert.equal(h.timers.size,0);assert.equal(h.controller.getState().transcript,'');
});

test('cancel and dispose actively abort microphone starts after a delayed permission grant',()=>{
 for(const action of ['cancel','dispose']){
  const h=harness();h.controller.start();const recognizer=h.recognition,capturedStart=recognizer.onstart;
  h.controller[action]();const changes=h.changes.length;
  assert.equal(recognizer.aborts,1);
  assert.equal(typeof recognizer.onstart,'function','late-start tombstone remains attached');
  recognizer.onstart();assert.equal(recognizer.aborts,2,'live late start is aborted');
  capturedStart();assert.equal(recognizer.aborts,3,'already queued start callback also aborts');
  assert.equal(h.changes.length,changes);assert.equal(h.controller.getState().phase,'ready');
  recognizer.onend();assert.equal(recognizer.onstart,null,'tombstone released when recognizer ends');
 }
});

test('Stop while starting reissues stop on a late start and stays within the stopping deadline',()=>{
 const h=harness();h.controller.start();h.controller.stop();
 assert.equal(h.recognition.stops,1);assert.equal(h.controller.getState().phase,'stopping');
 h.advance(2000);h.recognition.onstart();assert.equal(h.recognition.stops,2);
 assert.equal(h.controller.getState().phase,'stopping');
 h.advance(VOICE_TIMEOUTS.stopping-2000);assert.equal(h.recognition.aborts,1);
 assert.equal(h.controller.getState().phase,'error');assert.equal(h.timers.size,0);
});

test('the interim character limit does not split an emoji surrogate pair',()=>{
 const h=harness();listen(h);
 h.recognition.onresult(result(['x'.repeat(MAX_VOICE_CHARS-2),true],['😀',false]));
 assert.equal(h.controller.getState().interim,'');
 assert.equal(h.controller.getState().phase,'stopping');
 assert.ok(!/[\uD800-\uDBFF]$/.test(h.controller.getState().transcript));
});
