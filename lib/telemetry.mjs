import {parseHeartbeatMessage} from './message-content.mjs';
export const IDS = ['scheduler', 'outreach', 'contacts', 'manager', 'designer', 'proposal'];
export const LABELS = {
  started: 'Started a work session', completed: 'Work session finished', interrupted: 'Session interrupted',
  mail: 'Working with email', calendar: 'Checking calendar', contacts: 'Researching contacts',
  crm: 'Working with GoHighLevel', sheet: 'Updating contact map', research: 'Researching sources',
  tool: 'Running a task', thinking: 'Planning next steps', waiting: 'Waiting for input', error: 'A tool reported an error', idle: 'Ready for the next task',
};
export function classifyTool(name = '') {
  const n = name.toLowerCase();
  if (/calendar|availability/.test(n)) return 'calendar';
  if (/gmail|mail|draft/.test(n)) return 'mail';
  if (/gohighlevel|highlevel|ghl/.test(n)) return 'crm';
  if (/sheet/.test(n)) return 'sheet';
  if (/contact/.test(n)) return 'contacts';
  if (/search|browse|web|fetch/.test(n)) return 'research';
  if (/request_user_input|approval/.test(n)) return 'waiting';
  return 'tool';
}
// Activity categories are fixed labels. Final answers are handled separately for private chat/review.
export function parseRecord(record) {
  const p = record.payload || {};
  if (record.type === 'event_msg') {
    if (p.type === 'task_started') return {kind:'started', status:'working'};
    if (p.type === 'task_complete') {
      const heartbeat=parseHeartbeatMessage(p.last_agent_message);
      if(heartbeat?.decision==='DONT_NOTIFY')return {kind:'idle',status:'idle'};
      const message=heartbeat?.message??p.last_agent_message??'';
      if (/waiting for (your|you|approval)|need you to|please (approve|confirm|provide)|cannot proceed|access required|paused[^.\n]*pending/i.test(message))return {kind:'waiting',status:'waiting'};
      return {kind:'completed', status:'idle'};
    }
    if (p.type === 'turn_aborted') return {kind:'interrupted', status:'idle'};
    if (p.type === 'item_completed') {
      const item = p.item || {};
      if (item.type === 'McpToolCall') {
        // Summary and app coordination aren't business activities.
        if (/update_running_summary|list_threads|read_thread/.test(item.tool || '')) return null;
        if (item.status === 'failed' || item.result?.isError) return {kind:'error', status:'error'};
        const kind = classifyTool(item.tool); return {kind, status:kind === 'waiting' ? 'waiting' : 'working'};
      }
      if (item.type === 'CommandExecution') return {kind:item.exit_code ? 'error' : 'tool',status:item.exit_code ? 'error':'working'};
    }
  }
  if (record.type === 'response_item' && p.type === 'function_call') {
    const kind=classifyTool(p.name); return {kind,status:kind==='waiting'?'waiting':'working'};
  }
  return null;
}
export function validateSnapshot(value, now = Date.now()) {
  if (!value || value.version !== 1 || !Number.isFinite(Date.parse(value.observedAt)) || Math.abs(now-Date.parse(value.observedAt))>120000) throw new Error('Invalid snapshot timestamp');
  if (!Array.isArray(value.agents) || (value.agents.length<3||value.agents.length>IDS.length) || new Set(value.agents.map(a=>a.id)).size!==value.agents.length || !['scheduler','outreach','contacts'].every(id=>value.agents.some(a=>a.id===id))) throw new Error('Expected distinct office agents');
  const statuses=['working','idle','waiting','error','offline'];
  const validTime = t => t === null || (typeof t==='string' && Number.isFinite(Date.parse(t)) && Date.parse(t)<=now+60000);
  const agents=value.agents.map(a=>{
    if (!IDS.includes(a.id) || !statuses.includes(a.status) || !validTime(a.updatedAt) || !Object.values(LABELS).includes(a.activity)) throw new Error('Invalid agent');
    if (!validTime(a.completedAt??null)||!validTime(a.attentionAt??null)) throw new Error('Invalid milestone');
    if(a.result!=null&&(typeof a.result!=='string'||a.result.length>6000))throw new Error('Invalid result');
    return {id:a.id,status:a.status,activity:a.activity,updatedAt:a.updatedAt,completedAt:a.completedAt??null,attentionAt:a.attentionAt??null,result:a.result??null};
  });
  if (!Array.isArray(value.events) || value.events.length>100) throw new Error('Invalid event count');
  const events=value.events.map(e=>{
    if (!IDS.includes(e.agentId)||!statuses.includes(e.status)||!Object.hasOwn(LABELS,e.kind)||!validTime(e.at)||!e.at||typeof e.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(e.id)) throw new Error('Invalid event');
    return {id:e.id,agentId:e.agentId,at:e.at,kind:e.kind,status:e.status,label:LABELS[e.kind]};
  });
  return {version:1,observedAt:value.observedAt,agents,events};
}
