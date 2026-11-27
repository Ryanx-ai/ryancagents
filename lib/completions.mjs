const agentIds=new Set(['scheduler','outreach','contacts','manager','designer','proposal']);

export function completionKey(agentId,at) {
 const time=Date.parse(at);
 return agentIds.has(agentId)&&Number.isFinite(time)?`${agentId}-${time}`:null;
}

export function knownCompletion(snapshot,agentId,at) {
 const key=completionKey(agentId,at);
 if(!key)return false;
 return (snapshot?.agents||[]).some(a=>completionKey(a.id,a.completedAt)===key)||
  (snapshot?.events||[]).some(e=>e.kind==='completed'&&completionKey(e.agentId,e.at)===key);
}

export function completionOwnsLatestResult(agent) {
 return Number.isFinite(Date.parse(agent?.completedAt))&&!(Date.parse(agent?.attentionAt)>Date.parse(agent.completedAt));
}

// Each completion has its own acknowledgement. A newer review must never hide
// an older unreviewed item, or acknowledge future work by the same agent.
export function completionRows(states,events,reviewed={},completed={}) {
 const rows=new Map();
 for(const e of events){
  const id=completionKey(e.agentId,e.at);
  if(e.kind==='completed'&&id)rows.set(id,{id,agentId:e.agentId,completedAt:e.at,title:e.label,current:false});
 }
 for(const a of states){
  const id=completionKey(a.id,a.completedAt);
  // The latest agent result may be a newer request for input, not the text of
  // this completion. Keep that request out of an older completion's receipt.
  if(id)rows.set(id,{...rows.get(id),id,agentId:a.id,completedAt:a.completedAt,title:rows.get(id)?.title||'Completed task',result:completionOwnsLatestResult(a)?a.result||null:null,current:true});
 }
 return [...rows.values()].map(r=>({...r,done:!!completed[r.id]||completionKey(r.agentId,reviewed[r.agentId])===r.id})).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
}

export function reviewSheetState(states,events,reviewed={},completed={},online=true,filter='review') {
 const rows=completionRows(states,events,reviewed,completed);
 const attention=online?states.filter(a=>a.status==='waiting'||a.status==='error'):[];
 return {
  rows,toReview:rows.filter(row=>!row.done),attention,
  visible:rows.filter(row=>filter==='all'||(filter==='done'?row.done:!row.done)),
  // Acknowledging completed work never acknowledges a current input request.
  visibleAttention:filter==='done'?[]:attention,
 };
}

export function reviewWatermarks(legacy,completed) {
 const result={...legacy};
 for(const key of Object.keys(completed)){
  const match=/^(scheduler|outreach|contacts|manager|designer|proposal)-(\d+)$/.exec(key);
  if(!match)continue;
  const [,agentId,stamp]=match;const ms=Number(stamp);
  if(!Number.isFinite(ms)||!Number.isFinite(new Date(ms).getTime()))continue;
  if(!result[agentId]||Date.parse(result[agentId])<ms)result[agentId]=new Date(ms).toISOString();
 }
 return result;
}
