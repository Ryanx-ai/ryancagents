import {ArrowUpRight,Shield} from 'lucide-react';
import type {WorkflowStage} from '../lib/workflow-catalog';
import type {WorkflowRule} from '../lib/workflow-rules';
import styles from './WorkflowRules.module.css';

type Props={rules:WorkflowRule[];stages:WorkflowStage[];stageId:string|null;onAll:()=>void;onSelectStage:(id:string)=>void};
const groups=[{kind:'check',label:'Checks'},{kind:'review',label:'Review gates'},{kind:'scope',label:'Scope'}] as const;

export default function WorkflowRules({rules,stages,stageId,onAll,onSelectStage}:Props){
 const selected=stages.find(stage=>stage.id===stageId);
 const visible=selected?rules.filter(rule=>rule.stageIds.includes(selected.id)):rules;
 return <section className={styles.rules} aria-label="Documented workflow rules">
  <header className={styles.header}><h4><Shield size={17} aria-hidden="true"/>Rules <span>{visible.length}</span></h4><p>Documented requirements. These are not live check results.</p></header>
  {selected?<div className={styles.context}><span>For this step</span><strong>{selected.label}</strong><button type="button" onClick={onAll}>All rules <span>{rules.length}</span></button></div>:<p className={styles.all}>All workflow rules</p>}
  {!visible.length&&<p className={styles.empty}>No separate rules are mapped to this step. <button type="button" onClick={onAll}>View all workflow rules</button></p>}
  {groups.map(group=>{const items=visible.filter(rule=>rule.kind===group.kind);return items.length>0&&<section className={styles.group} key={group.kind} aria-label={group.label}><h5>{group.label}</h5><div className={styles.cards}>{items.map(rule=><article className={styles.card} key={rule.id}><h6>{rule.title}</h6><p className={styles.requirement}>{rule.requirement}</p><div className={styles.hold}><span>Hold if</span><p>{rule.hold}</p></div><div className={styles.steps} aria-label="Related workflow steps">{rule.stageIds.map(id=>{const stage=stages.find(item=>item.id===id);return stage&&<button key={id} type="button" onClick={()=>onSelectStage(id)} aria-label={`Inspect ${stage.label}`}><span>{stage.label}</span><ArrowUpRight size={12} aria-hidden="true"/></button>;})}</div><details className={styles.source}><summary>Source</summary><code>{rule.source}</code></details></article>)}</div></section>;})}
 </section>;
}
