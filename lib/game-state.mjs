export function avatarMode(agent,reviewed={},online=true) {
 if(online&&(agent.status==='waiting'||agent.status==='error'))return 'attention';
 if(online&&agent.status==='working')return 'working';
 if(agent.completedAt&&(!reviewed[agent.id]||Date.parse(reviewed[agent.id])<Date.parse(agent.completedAt)))return 'celebrate';
 if(!online||agent.status==='offline')return 'offline';
 return 'idle';
}
export function commandInput(value) {
 if(!value||!['scheduler','outreach','contacts','manager'].includes(value.agentId)||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>4000||typeof value.id!=='string'||!/^\d{8}-[a-f0-9-]{36}$/.test(value.id))throw new Error('Invalid message');
 return {id:value.id,agentId:value.agentId,prompt:value.prompt.trim()};
}
export function messageText(record) {
 const p=record.payload||{};
 if(record.type==='event_msg'&&p.type==='user_message')return {role:'user',text:typeof p.message==='string'?p.message:''};
 if(record.type==='response_item'&&p.type==='message'&&(p.role==='user'||p.role==='assistant'&&p.phase==='final_answer'))return {role:p.role,text:(p.content||[]).map(c=>c.text||'').join('\n').trim()};
 if(record.type==='event_msg'&&p.type==='task_complete'&&typeof p.last_agent_message==='string')return {role:'assistant',text:p.last_agent_message};
 return null;
}
