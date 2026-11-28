import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const moduleURL=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const same=(a,b)=>!!a&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const day='2026-11-29';
function response(date=day,etag='"board-one"',status=200){return {status,ok:status===200,headers:new Headers({etag}),json:async()=>{
 assert.notEqual(status,304,'an unchanged response has no JSON body');
 return {version:1,day:date,timeZone:'Asia/Singapore',notes:[],calendar:{status:'current',observedAt:null,lastAttemptAt:null,day:date}};
}};}

// Run the actual hook with deterministic lifecycle, visibility and timer boundaries.
// The hook's fetch/sequence/ETag implementation is not copied into this fixture.
async function mount(t,request,{session='fixture-session',date=day,open=false}={}){
 const slots=[],effects=[];let cursor=0,elapsed=100000,wall=Date.parse('2026-11-28T16:00:00Z');
 const hooks={
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial} );},
  useState(initial){const i=cursor++;const slot=slots[i]??={value:typeof initial==='function'?initial():initial};return [slot.value,next=>{slot.value=typeof next==='function'?next(slot.value):next;}];},
  useCallback(value,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={value,deps};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++;if(same(slots[i]?.deps,deps))return;const previous=slots[i];const slot=slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{slot.cleanup?.();slot.cleanup=effect();});},
 };
 const key=`__boardHooks_${crypto.randomUUID().replaceAll('-','')}`;
 globalThis[key]=hooks;
 const reactURL=moduleURL(['useRef','useState','useCallback','useEffect'].map(name=>`export const ${name}=(...args)=>globalThis[${JSON.stringify(key)}].${name}(...args);`).join('\n'));
 const source=stripTypeScriptTypes(await readFile(new URL('../components/useBlackboard.ts',import.meta.url),'utf8')).replace("from 'react'",`from '${reactURL}'`);
 const {useBlackboard}=await import(moduleURL(source));
 const previousDocument=globalThis.document;
 const document=new EventTarget();document.hidden=false;globalThis.document=document;
 t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(performance,'now',()=>elapsed);
 t.mock.method(Date,'now',()=>wall);
 let disposed=false,args={session,date,open};
 function render(next={}){args={...args,...next};cursor=0;const result=useBlackboard(args.session,args.date,request,args.open);for(const effect of effects.splice(0))effect();return result;}
 function dispose(){if(disposed)return;disposed=true;for(const slot of slots)slot.cleanup?.();}
 t.after(()=>{dispose();delete globalThis[key];if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 render();await settle();
 return {read:()=>render(),render,dispose,rollback:ms=>{wall-=ms;},
  async advance(ms){elapsed+=ms;wall+=ms;t.mock.timers.tick(ms);await settle();},
  async hide(value){document.hidden=value;document.dispatchEvent(new Event('visibilitychange'));await settle();},
 };
}

test('board refreshes conditionally every two visible open minutes, with no closed/hidden polling',async t=>{
 const calls=[];
 const h=await mount(t,async(url,init)=>{calls.push({url,init});return response(day,'"board-one"',calls.length===1?200:304);});
 assert.equal(calls.length,1,'unlock still performs its normal initial read');
 const snapshot=h.read().data;
 await h.advance(240000);assert.equal(calls.length,1,'a closed board has no recurring reads');
 h.render({open:true});h.rollback(3600000);
 await h.advance(119999);assert.equal(calls.length,1);
 await h.advance(1);assert.equal(calls.length,2,'wall-clock rollback does not suppress the monotonic refresh');
 assert.equal(calls[1].init.headers['If-None-Match'],'"board-one"');
 assert.equal(h.read().data,snapshot,'304 retains the current board');
 await h.hide(true);await h.advance(360000);assert.equal(calls.length,2,'hidden tabs do not poll');
 await h.hide(false);assert.equal(calls.length,3,'the existing focus refresh still runs');
 await h.advance(120000);assert.equal(calls.length,4,'visible polling resumes after focus');
 h.render({open:false});await h.advance(240000);assert.equal(calls.length,4);
 await h.hide(true);await h.hide(false);assert.equal(calls.length,5,'closing the board preserves existing focus refresh behavior');
 h.dispose();await h.advance(240000);await h.hide(true);await h.hide(false);assert.equal(calls.length,5,'unmount removes timers and visibility listeners');
});

test('an in-flight poll cannot replace a new calendar day or restart after locking',async t=>{
 const calls=[];
 const h=await mount(t,(url,init)=>new Promise(resolve=>calls.push({url,init,resolve})),{open:true});
 calls[0].resolve(response());await settle();
 assert.equal(h.read().data.day,day);
 await h.advance(120000);assert.equal(calls.length,2);
 const nextDay='2026-11-30';h.render({date:nextDay});assert.equal(calls.length,3);
 calls[2].resolve(response(nextDay,'"board-next-day"'));await settle();
 calls[1].resolve(response(day,'"late-old-day"'));await settle();
 assert.equal(h.read().data.day,nextDay,'the old-day response is ignored');
 await h.advance(120000);assert.equal(calls.length,4,'only the new-day timer remains');
 assert.equal(calls[3].init.headers['If-None-Match'],'"board-next-day"');
 assert.match(calls[3].url,/day=2026-11-30$/);
 h.render({session:null});calls[3].resolve(response(nextDay));await settle();
 assert.equal(h.read().data,null,'a late authenticated response cannot repopulate a locked board');
 await h.advance(360000);assert.equal(calls.length,4,'locking also stops recurring reads');
});
