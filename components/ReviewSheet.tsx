'use client';
import {useState} from 'react';
import {ArrowUpRight,Check,ChevronRight,RefreshCw,TriangleAlert,MessageSquare,GitBranch,Activity} from 'lucide-react';
import {agents,type AgentId,type AgentState,type Activity as AgentActivity} from '../lib/model';
import {completionRows} from '../lib/completions.mjs';
import {extractMessageLinks} from '../lib/message-links.mjs';
import MessageContent from './MessageContent';
import IntegrationLogo,{integrationMeta,type IntegrationName} from './IntegrationLogo';
import './review-sheet.css';

type Completion={id:string;agentId:AgentId;completedAt:string;title:string;result?:string|null;current:boolean;done:boolean};
const services:IntegrationName[]=['gmail','calendar','contacts','sheets','gohighlevel'];
const serviceLabels:Record<string,string>={gmail:'Gmail',calendar:'Calendar',contacts:'Contacts',sheets:'Sheets',gohighlevel:'GHL'};
function timestamp(at:string){return new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(at));}
function preview(text:string){const first=text.trim().split(/\n\s*\n/)[0].replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/(^|\s)#{1,6}\s/g,'$1').replace(/[*_`]/g,'').replace(/\s+/g,' ');return first.length>240?first.slice(0,237)+'…':first;}

export default function ReviewSheet({states,events,reviewed,completed,online,pending,onDone,onSelect,onPanel}:{states:AgentState[];events:AgentActivity[];reviewed:Record<string,string>;completed:Record<string,boolean>;online:boolean;pending:Record<string,boolean>;onDone:(id:AgentId,at:string)=>void;onSelect:(id:AgentId)=>void;onPanel:(panel:'activity'|'workflow')=>void}){
 const [filter,setFilter]=useState<'review'|'done'|'all'>('review');
 const rows=completionRows(states,events,reviewed,completed) as Completion[];
 const toReview=rows.filter(r=>!r.done);
 const attention=online?states.filter(a=>a.status==='waiting'||a.status==='error'):[];
 const visible=rows.filter(r=>filter==='all'||(filter==='done'?r.done:!r.done));
 return <div className="review-sheet">
  <div className="review-overview" aria-label="Office overview"><span><b>{toReview.length}</b> To review</span><span><b>{attention.length}</b> Attention</span><span><b>{online?states.filter(a=>a.status==='working').length:0}</b> Working</span></div>
  <nav className="review-links" aria-label="Quick links">
   {services.map(name=><a key={name} href={integrationMeta[name].href} title={integrationMeta[name].label} aria-label={integrationMeta[name].label} target="_blank" rel="noopener noreferrer"><IntegrationLogo name={name} size={21} decorative/><span>{serviceLabels[name]}</span></a>)}
   <button onClick={()=>onPanel('workflow')}><GitBranch size={19}/><span>Workflows</span><ChevronRight size={13}/></button>
   <button onClick={()=>onPanel('activity')}><Activity size={19}/><span>Activity</span><ChevronRight size={13}/></button>
  </nav>
  <nav className="review-agents" aria-label="Agent shortcuts">{agents.map(a=><button key={a.id} onClick={()=>onSelect(a.id)}><i style={{background:a.color}}/>{a.name.replace(' Ryan','')}<MessageSquare size={12}/></button>)}</nav>
  <div className="review-tabs" role="group" aria-label="Filter completions">{(['review','done','all'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='review'?'To review':value==='done'?'Done':'All'}<span>{value==='review'?toReview.length:value==='done'?rows.length-toReview.length:rows.length}</span></button>)}</div>
  <div className="review-list">
   {filter!=='done'&&attention.filter(a=>!visible.some(r=>r.agentId===a.id&&r.current)).map(a=><article className="review-item attention-item" key={`attention-${a.id}`}><div className="review-item-heading"><strong>{agents.find(agent=>agent.id===a.id)?.name}</strong><span className="review-state attention"><TriangleAlert size={12}/>Needs attention</span></div><p className="review-summary">{preview(a.result||a.activity)}</p><div className="review-actions"><button onClick={()=>onSelect(a.id)}>Open Ryan<ChevronRight size={14}/></button></div></article>)}
   {visible.map(row=>{const agent=agents.find(a=>a.id===row.agentId)!;const links=extractMessageLinks(row.result||'');const needsAttention=attention.some(a=>a.id===row.agentId)&&row.current;
    return <article className={`review-item ${row.done?'is-done':''}`} key={row.id}>
     <div className="review-item-heading"><strong><i style={{background:agent.color}}/>{agent.name}</strong><span className={`review-state ${needsAttention?'attention':''}`}>{row.done?<><Check size={12}/>Done</>:needsAttention?<><TriangleAlert size={12}/>Needs attention</>:'To review'}</span></div>
     <time dateTime={row.completedAt}>{timestamp(row.completedAt)}</time>
     <p className="review-summary">{row.result?preview(row.result):row.title}</p>
     {row.result&&<details className="review-result"><summary>Read result<ChevronRight size={13}/></summary><MessageContent text={row.result}/></details>}
     {links.length>0&&<nav className="result-quicklinks" aria-label={`${agent.name} result links`}>{links.map(link=><a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={12}/></a>)}</nav>}
     <div className="review-actions">{row.current&&<button onClick={()=>onSelect(row.agentId)}>Open Ryan<ChevronRight size={14}/></button>}<a href={`codex://threads/${agent.thread}`}>Codex<ArrowUpRight size={13}/></a>{!row.done&&<button className="mark-done" disabled={pending[row.id]} onClick={()=>onDone(row.agentId,row.completedAt)}>{pending[row.id]?<RefreshCw className="spin" size={14}/>:<Check size={14}/>}Mark done</button>}</div>
    </article>;
   })}
   {!visible.length&&!(filter!=='done'&&attention.length>0)&&<div className="review-empty"><Check size={25}/><strong>{filter==='done'?'Nothing marked done yet':filter==='all'?'No completions yet':'All reviewed'}</strong></div>}
  </div>
 </div>;
}
