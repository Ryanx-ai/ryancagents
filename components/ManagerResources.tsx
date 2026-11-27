import {ArrowUpRight,Calculator,ChevronDown,FileText,Pin} from 'lucide-react';
import IntegrationLogo from './IntegrationLogo';
import {MANAGER_RESOURCES,PROPOSAL_STUDIO_LAUNCHER} from '../lib/manager-resources';
import styles from './ManagerResources.module.css';

export default function ManagerResources(){
 return <details className={styles.resources} open>
  <summary className={styles.heading}><Pin size={13} aria-hidden="true"/><span>Pinned resources</span><small>{MANAGER_RESOURCES.length}</small><ChevronDown size={15} className={styles.chevron} aria-hidden="true"/></summary>
  <div className={styles.scroll}>
   <nav className={styles.links} aria-label="Manager Ryan pinned resources">{MANAGER_RESOURCES.map(resource=><a key={resource.id} href={resource.href} target="_blank" rel="noopener noreferrer" className={styles.resource} aria-label={`${resource.label}${resource.local?' · Local Mac':''} (opens in a new tab)`}>
    <span className={styles.icon}>{resource.icon==='calculator'?<Calculator size={19} aria-hidden="true"/>:resource.icon==='quotations'?<FileText size={19} aria-hidden="true"/>:<IntegrationLogo name={resource.icon} size={20} decorative/>}</span>
    <span className={styles.label}>{resource.label}{resource.local&&<small>Local Mac</small>}</span><ArrowUpRight size={12} className={styles.external} aria-hidden="true"/>
   </a>)}</nav>
   <details className={styles.localHelp}><summary>Start Proposal Studio on the Mac<ChevronDown size={12} aria-hidden="true"/></summary><p>Open <strong>Start Proposal Editor.command</strong> in Finder, then open Proposal Studio. The web link cannot start the app, and only works on the Mac running Studio.</p><code>{PROPOSAL_STUDIO_LAUNCHER}</code></details>
  </div>
 </details>;
}
