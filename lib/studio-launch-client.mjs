export const STUDIO_URL='http://127.0.0.1:4174';
export const STUDIO_LAUNCH_URL='http://127.0.0.1:4175/studio/launch';
export const STUDIO_LAUNCH_TIMEOUT=20000;
const busyPhases=new Set(['checking','launching','verifying']);
const serverReasons=new Set(['not-configured','not-installed','port-in-use','start-failed','start-timeout','unsupported-platform']);
export const STUDIO_LAUNCH_MESSAGES=Object.freeze({
 'other-device':'Studio runs on the office Mac. Open Ryan HQ there, or continue in Proposal Ryan here.',
 'not-configured':'The local Studio launcher is not configured. Use the manual launcher on the office Mac.',
 'not-installed':'Proposal Studio was not found on this Mac. Use its existing launcher in Finder.',
 'port-in-use':'Another app is using Studio’s local port. Close that app or use the manual launcher.',
 'start-failed':'Studio could not start. Open the existing launcher on the Mac to check it.',
 'start-timeout':'Studio did not become ready in time. It may still be starting; try the local link or check the launcher.',
 'unsupported-platform':'The local launcher requires macOS. Continue here or open Ryan HQ on the office Mac.',
 'local-unreachable':'The browser could not reach the local launcher. Allow local network access if prompted, or use the manual launcher.',
 'authorization':'Launch access could not be confirmed. Unlock the office again and retry.',
 'verification-failed':'HQ could not verify that Studio is ready on this Mac. No Studio page was opened.',
 'timeout':'The launch could not be confirmed in time. Studio may still be starting on the Mac.',
 'unavailable':'Studio launch is unavailable. Try again or use the manual launcher.',
});
const initial=()=>({phase:'idle',reason:null,opened:false});
class LaunchError extends Error{constructor(reason){super(reason);this.reason=reason;}}
export function isMacDeviceHint({platform='',userAgent='',maxTouchPoints=0}={}){
 if(/iPad|iPhone|iPod|Android/i.test(userAgent)||maxTouchPoints>1&&/Mac/i.test(platform||userAgent))return false;
 return /Mac/i.test(platform)||!platform&&/Macintosh|Mac OS X/i.test(userAgent);
}
function active(signal){if(signal?.aborted)throw new LaunchError('cancelled');}
function token(value){return typeof value==='string'&&value.length>0&&value.length<=16384;}
async function bounded(operation,parent,timeoutMs){
 active(parent);const controller=new AbortController();
 const abort=()=>controller.abort();parent?.addEventListener('abort',abort,{once:true});
 let rejectAbort;const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(new LaunchError(parent?.aborted?'cancelled':'timeout'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
 const timer=setTimeout(abort,timeoutMs);
 try{const result=await Promise.race([operation(controller.signal),aborted]);active(parent);return result;}
 finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);}
}
async function json(response,failure){
 if(!response?.ok)throw new LaunchError(response?.status===401||response?.status===403?'authorization':failure);
 const raw=await response.text();if(raw.length>65536)throw new LaunchError(failure);
 try{return JSON.parse(raw);}catch{throw new LaunchError(failure);}
}

/** A local HTTP success is not readiness. Only HQ's verified receipt may unlock the fixed URL. */
export async function launchProposalStudio({request,localFetch=globalThis.fetch,signal,onPhase=()=>{},timeoutMs=STUDIO_LAUNCH_TIMEOUT}){
 let phase='checking';
 try{
  active(signal);onPhase(phase);
  const issued=await bounded(async scoped=>json(await request('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ticket'}),signal:scoped}),'unavailable'),signal,timeoutMs);
  if(!token(issued?.ticket))throw new LaunchError('authorization');
  active(signal);phase='launching';onPhase(phase);
  const launched=await bounded(async scoped=>json(await localFetch(STUDIO_LAUNCH_URL,{method:'POST',headers:{Authorization:`Bearer ${issued.ticket}`,'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',mode:'cors',targetAddressSpace:'loopback',signal:scoped}),'local-unreachable'),signal,timeoutMs);
  if(!token(launched?.receipt))throw new LaunchError('verification-failed');
  active(signal);phase='verifying';onPhase(phase);
  const verified=await bounded(async scoped=>json(await request('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',ticket:issued.ticket,receipt:launched.receipt}),signal:scoped}),'verification-failed'),signal,timeoutMs);
  active(signal);
  if(verified?.status==='ready'&&verified.url===STUDIO_URL)return {status:'ready',url:STUDIO_URL};
  if(verified?.status==='unavailable')return {status:'unavailable',reason:serverReasons.has(verified.reason)?verified.reason:'unavailable'};
  throw new LaunchError('verification-failed');
 }catch(error){
  if(signal?.aborted||error?.reason==='cancelled')throw new LaunchError('cancelled');
  return {status:'unavailable',reason:error instanceof LaunchError?error.reason:phase==='launching'?'local-unreachable':phase==='verifying'?'verification-failed':'unavailable'};
 }
}

/** Owns only a pending blank tab; the opened Studio tab is released to the user. */
export function createStudioLaunchController({request,localFetch,onChange=()=>{},openWindow=()=>null,timeoutMs}){
 let state=initial(),generation=0,disposed=false,controller=null,pendingWindow=null;
 function emit(patch){if(disposed)return;state={...state,...patch};onChange({...state});}
 function clearPending(){const pending=pendingWindow;pendingWindow=null;if(pending)try{pending.close();}catch{}}
 function invalidate(){generation++;controller?.abort();controller=null;clearPending();}
 async function start({isMac=false}={}){
  if(disposed||busyPhases.has(state.phase))return;
  invalidate();state=initial();
  if(!isMac){emit({phase:'unavailable',reason:'other-device'});return;}
  const run=generation;controller=new AbortController();const signal=controller.signal;
  try{pendingWindow=openWindow();}catch{pendingWindow=null;}
  emit({phase:'checking',reason:null,opened:false});
  try{
   const result=await launchProposalStudio({request,localFetch,signal,timeoutMs,onPhase:phase=>{if(!disposed&&generation===run)emit({phase});}});
   if(disposed||generation!==run||signal.aborted)return;
   controller=null;
   if(result.status!=='ready'){clearPending();emit({phase:'unavailable',reason:result.reason});return;}
   let opened=false;try{opened=!!pendingWindow?.navigate(STUDIO_URL);}catch{}
   if(!opened)clearPending();else pendingWindow=null;
   emit({phase:'ready',reason:null,opened});
  }catch{if(!disposed&&generation===run){clearPending();emit({phase:'unavailable',reason:'unavailable'});}}
 }
 function cancel(){if(disposed)return;invalidate();state=initial();onChange({...state});}
 function dispose(){if(disposed)return;disposed=true;invalidate();state=initial();}
 return {start,cancel,dispose,getState:()=>({...state})};
}
