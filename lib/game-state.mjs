import {PROGRESS_LABELS} from './progress.mjs';
export function needsReview(agent,reviewed={}) {
 const completed=Date.parse(agent.completedAt);
 return Number.isFinite(completed)&&(!reviewed[agent.id]||Date.parse(reviewed[agent.id])<completed);
}
export function avatarMode(agent,reviewed={},online=true) {
 if(online&&(agent.status==='waiting'||agent.status==='error'))return 'attention';
 if(online&&agent.status==='working')return 'working';
 if(!online||agent.status==='offline')return 'offline';
 if(needsReview(agent,reviewed))return 'review';
 return 'idle';
}
// First observation is a baseline, not a new completion. Polls/reconnects cannot
// restart a burst, and an older snapshot cannot move the watermark backwards.
export function nextCompletionCue(previous,completedAt,now) {
 const stamp=Number.isFinite(Date.parse(completedAt))?completedAt:null;
 if(!previous)return {seen:stamp,until:0};
 if(stamp&&Date.parse(stamp)>(Date.parse(previous.seen)||0))return {seen:stamp,until:now+6000};
 return previous;
}
export function ambientStep(index,step,currentX) {
 const phases=['idle','walk','look-up','idle','wave','walk','look-down','idle'];
 const phase=(step+([0,1,3,5,6,2][index]??0))%phases.length;
 const pose=phases[phase];const duration=[4800,4200,3400,6500,1800,4200,3800,5000][phase]+index*170;
 const home=[19,39,59,29,69,79][index]??49;
 const target=home-7+((step*7+index*5)%15);
 return {pose:pose==='walk'?target>currentX?'walk-right':'walk-left':pose,x:pose==='walk'?target:currentX,duration};
}
export function activityBubble(agent,online=true) {
 if(!online||agent.status!=='working')return null;
 if(Object.values(PROGRESS_LABELS).includes(agent.progress))return agent.progress;
 const labels={'Started a work session':'Getting started','Working with email':'Working with email','Checking calendar':'Checking the calendar','Researching contacts':'Researching contacts','Working with GoHighLevel':'Checking GoHighLevel','Updating contact map':'Updating the contact map','Researching sources':'Researching sources','Running a task':'Running a task','Planning next steps':'Planning next steps'};
 return labels[agent.activity]||'Working on your request';
}
export function mergeReviews(current,incoming) {
 const result={...current};for(const [id,at] of Object.entries(incoming))if(typeof at==='string'&&Number.isFinite(Date.parse(at))&&(!result[id]||Date.parse(at)>Date.parse(result[id])))result[id]=at;
 return result;
}
export function commandInput(value) {
 if(!value||!['scheduler','outreach','contacts','manager','designer','proposal'].includes(value.agentId)||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>4000||typeof value.id!=='string'||!/^\d{8}-[a-f0-9-]{36}$/.test(value.id))throw new Error('Invalid message');
 return {id:value.id,agentId:value.agentId,prompt:value.prompt.trim()};
}
export function messageText(record) {
 const p=record.payload||{};
 if(record.type==='event_msg'&&p.type==='user_message')return {role:'user',text:typeof p.message==='string'?p.message:''};
 if(record.type==='response_item'&&p.type==='message'&&(p.role==='user'||p.role==='assistant'&&p.phase==='final_answer'))return {role:p.role,text:(p.content||[]).map(c=>c.text||'').join('\n').trim()};
 if(record.type==='event_msg'&&p.type==='task_complete'&&typeof p.last_agent_message==='string')return {role:'assistant',text:p.last_agent_message};
 return null;
}
