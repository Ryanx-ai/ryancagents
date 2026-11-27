export const MAX_VOICE_CHARS=4000;
export const VOICE_TIMEOUTS=Object.freeze({startup:10000,clip:60000,stopping:5000});
const activePhases=new Set(['starting','listening','stopping']);
const fresh=()=>({phase:'ready',transcript:'',interim:'',error:null,notice:null});
const errors={
 'not-allowed':'Microphone permission was denied. Allow it in your browser settings or keep typing.',
 'service-not-allowed':'Speech recognition is not allowed by this browser. You can keep typing.',
 'audio-capture':'The microphone is unavailable. Check that it is connected and not in use.',
 network:'The browser speech service could not be reached. Check your connection or keep typing.',
 'no-speech':'No speech was recognized. Try again when you are ready.',
 'language-not-supported':'This browser does not support the selected speech language. You can keep typing.',
 aborted:'Recording was interrupted. You can try again or keep typing.',
};
function bounded(text,limit=MAX_VOICE_CHARS){const clipped=text.slice(0,limit);return /[\uD800-\uDBFF]$/.test(clipped)?clipped.slice(0,-1):clipped;}
function abortRecognizer(recognizer){try{recognizer.abort();}catch{}}
function retireRecognizer(recognizer,abort){
 // A permission prompt can resolve after abort(). Keep a minimal tombstone until
 // end so a late microphone start is actively stopped, not merely hidden.
 recognizer.onstart=()=>abortRecognizer(recognizer);
 recognizer.onresult=null;recognizer.onerror=null;
 recognizer.onend=()=>{recognizer.onstart=null;recognizer.onend=null;};
 if(abort)abortRecognizer(recognizer);
}

// Browser APIs and clocks are injected so cancellation races are testable without a microphone.
export function createDesignerVoiceController({createRecognizer,onChange=()=>{},setTimeout:schedule=globalThis.setTimeout,clearTimeout:unschedule=globalThis.clearTimeout,lang='en-SG'}={}){
 let state=fresh(),recognizer=null,generation=0,disposed=false;
 const timers=new Set();
 function emit(patch){if(disposed)return;state={...state,...patch};onChange({...state});}
 function clearTimers(){for(const timer of timers)unschedule(timer);timers.clear();}
 function later(callback,ms){const timer=schedule(()=>{timers.delete(timer);callback();},ms);timers.add(timer);return timer;}
 function detach(abort=false){
  generation++;clearTimers();const previous=recognizer;recognizer=null;
  if(!previous)return;
  retireRecognizer(previous,abort);
 }
 function fail(message){detach(true);emit({phase:'error',interim:'',error:message});}
 function finish(abort=false){
  detach(abort);
  emit({phase:state.transcript.trim()?'review':'error',interim:'',error:state.transcript.trim()?null:errors['no-speech']});
 }
 function stop(){
  if(disposed||!recognizer||!['starting','listening'].includes(state.phase))return;
  clearTimers();emit({phase:'stopping',error:null});
  const current=recognizer,run=generation;
  later(()=>{if(!disposed&&generation===run){emit({notice:'The browser took too long to finish. Only completed text was kept.'});finish(true);}},VOICE_TIMEOUTS.stopping);
  try{current.stop();}catch{if(!disposed&&generation===run)finish(true);}
 }
 function start(){
  if(disposed||activePhases.has(state.phase))return false;
  detach(true);state=fresh();emit({phase:'starting'});
  let current;
  try{current=createRecognizer();if(!current)throw new Error();}catch{fail('Voice input could not start in this browser. You can keep typing.');return false;}
  recognizer=current;const run=generation;
  const valid=()=>!disposed&&recognizer===current&&generation===run;
  current.lang=lang;current.continuous=true;current.interimResults=true;current.maxAlternatives=1;
  current.onstart=()=>{
   if(!valid()){abortRecognizer(current);return;}
   if(state.phase==='stopping'){
    try{current.stop();}catch{if(valid())finish(true);}
    return;
   }
   if(state.phase!=='starting')return;
   clearTimers();emit({phase:'listening'});
   later(()=>{if(valid()){emit({notice:'The 60-second recording limit was reached. Review your text.'});stop();}},VOICE_TIMEOUTS.clip);
  };
  current.onresult=event=>{
   if(!valid()||!activePhases.has(state.phase))return;
   const final=[],interim=[];let finalLength=0,interimLength=0,clipped=false;const results=event?.results;
   if(!results||!Number.isInteger(results.length))return;
   // The result list is cumulative; interim slots may be replaced or removed.
   for(let index=0;index<Math.min(results.length,MAX_VOICE_CHARS);index++){
    const result=results[index],raw=result?.[0]?.transcript;
    if(typeof raw!=='string')continue;
    const length=result.isFinal?finalLength:interimLength,room=Math.max(0,MAX_VOICE_CHARS+1-length);
    if(raw.length>room)clipped=true;
    const text=raw.slice(0,room).trim();if(!text)continue;
    (result.isFinal?final:interim).push(text);
    if(result.isFinal)finalLength+=text.length+1;else interimLength+=text.length+1;
   }
   const completed=final.filter(Boolean).join(' '),partial=interim.filter(Boolean).join(' ');
   const transcript=bounded(completed),room=Math.max(0,MAX_VOICE_CHARS-transcript.length-(transcript&&partial?1:0));
   emit({transcript,interim:bounded(partial,room),error:null});
   if(clipped||completed.length+(completed&&partial?1:0)+partial.length>=MAX_VOICE_CHARS){
    emit({notice:'The 4,000-character limit was reached. Recording stopped; review the text.'});stop();
   }
  };
  current.onerror=event=>{if(valid())fail(errors[event?.error]||'Speech recognition failed. You can try again or keep typing.');};
  current.onend=()=>{if(valid())finish();};
  later(()=>{if(valid())fail('The microphone did not start in time. Try again when you are ready.');},VOICE_TIMEOUTS.startup);
  try{current.start();return true;}catch{if(valid())fail('Voice input could not start. Check microphone permission or keep typing.');return false;}
 }
 function cancel(){if(disposed)return;detach(true);state=fresh();onChange({...state});}
 function setTranscript(text){
  if(disposed||!['review','error'].includes(state.phase)||typeof text!=='string'||text.length>MAX_VOICE_CHARS)return false;
  emit({transcript:text});return true;
 }
 function dispose(){if(disposed)return;disposed=true;detach(true);state=fresh();}
 return {start,stop,cancel,setTranscript,dispose,getState:()=>({...state})};
}
