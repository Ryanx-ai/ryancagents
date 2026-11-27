import {createHash} from 'node:crypto';
export const BOARD_CHECKIN_MS=60*60*1000;
export function calendarFingerprint(snapshot){
 const value={...snapshot};delete value.observedAt;
 if(Array.isArray(value.events))value.events=[...value.events].sort((a,b)=>a.eventId.localeCompare(b.eventId));
 return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function boardPublishDecision(snapshot,journal={},now=Date.now()){
 const fingerprint=calendarFingerprint(snapshot);
 if(Number.isFinite(journal.retryAt)&&journal.retryAt>now)return {publish:false,reason:'backoff',fingerprint};
 if(journal.fingerprint===fingerprint&&now-journal.publishedAt<BOARD_CHECKIN_MS)return {publish:false,reason:'unchanged',fingerprint};
 return {publish:true,reason:journal.fingerprint===fingerprint?'freshness':'changed',fingerprint};
}
export function boardPublishFailure(journal={},status=0,retryAfter=null,now=Date.now()){
 const failures=Math.min(8,(journal.failures||0)+1),seconds=Number(retryAfter);
 const requested=retryAfter?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-now):0;
 const delay=[401,403].includes(status)?3600000:Math.max(Math.min(3600000,300000*2**(failures-1)),Math.min(3600000,Math.max(0,requested)||0));
 return {...journal,failures,retryAt:now+delay};
}
