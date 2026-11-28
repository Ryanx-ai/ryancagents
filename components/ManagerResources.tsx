import {ArrowUpRight,Calculator,ChevronDown,FileText,Pin} from 'lucide-react';
import IntegrationLogo from './IntegrationLogo';
import {MANAGER_RESOURCES} from '../lib/manager-resources';
import StudioLaunchControl from './StudioLaunchControl';
import type {StudioRequest} from '../lib/studio-launch-client.mjs';
import styles from './ManagerResources.module.css';

export default function ManagerResources({request,disabled=false,isAuthorized}:{request:StudioRequest;disabled?:boolean;isAuthorized?:()=>boolean}){
 return <details className={styles.resources} open>
  <summary className={styles.heading}><Pin size={13} aria-hidden="true"/><span>Pinned resources</span><small>{MANAGER_RESOURCES.length}</small><ChevronDown size={15} className={styles.chevron} aria-hidden="true"/></summary>
  <div className={styles.scroll}>
   <nav className={styles.links} aria-label="Manager Ryan pinned resources">{MANAGER_RESOURCES.map(resource=>resource.id==='proposal-studio'?<StudioLaunchControl key={resource.id} request={request} disabled={disabled} isAuthorized={isAuthorized} compact/>:<a key={resource.id} href={resource.href} target="_blank" rel="noopener noreferrer" className={styles.resource} aria-label={`${resource.label}${resource.local?' · Local Mac':''} (opens in a new tab)`}>
    <span className={styles.icon}>{resource.icon==='calculator'?<Calculator size={19} aria-hidden="true"/>:resource.icon==='quotations'?<FileText size={19} aria-hidden="true"/>:<IntegrationLogo name={resource.icon} size={20} decorative/>}</span>
    <span className={styles.label}>{resource.label}{resource.local&&<small>Local Mac</small>}</span><ArrowUpRight size={12} className={styles.external} aria-hidden="true"/>
   </a>)}</nav>
  </div>
 </details>;
}
