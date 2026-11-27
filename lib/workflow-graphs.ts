import type {AgentId} from './model';

export type WorkflowPort='left'|'right'|'top'|'bottom';
export type WorkflowRouteKind='flow'|'review'|'hold'|'handoff'|'context'|'projection';
export type WorkflowRoute={source:string;target:string;label:string;kind:WorkflowRouteKind;sourcePort:WorkflowPort;targetPort:WorkflowPort};
export type WorkflowGraph={summary:string;positions:Record<string,{x:number;y:number}>;routes:WorkflowRoute[]};
const route=(source:string,target:string,label='',kind:WorkflowRouteKind='flow',sourcePort:WorkflowPort='right',targetPort:WorkflowPort='left'):WorkflowRoute=>({source,target,label,kind,sourcePort,targetPort});
const graph=(summary:string,positions:Record<string,[number,number]>,routes:WorkflowRoute[]):WorkflowGraph=>({summary,positions:Object.fromEntries(Object.entries(positions).map(([id,[x,y]])=>[id,{x,y}])),routes});

/** Documented routes, never an executable graph or node-level telemetry. */
export const workflowGraphs:Record<AgentId,WorkflowGraph>={
 manager:graph('Status questions return directly. Requested work routes to the appropriate existing chat; results are used when reported, not automatically awaited.',{
  'manager-trigger':[0,170],'manager-context':[260,170],'manager-plan':[520,170],'manager-delegate':[780,170],
  'manager-scheduler':[0,350],'manager-outreach':[210,350],'manager-contacts':[420,350],'manager-designer':[630,350],'manager-proposal':[840,350],
  'manager-reports':[420,540],'manager-review':[700,540],'manager-output':[260,0],
 },[
  route('manager-trigger','manager-context'),route('manager-context','manager-plan','Requested work'),route('manager-plan','manager-delegate','Within scope'),
  route('manager-context','manager-output','Status only','flow','top','bottom'),route('manager-delegate','manager-output','Queued handoff','context','top','right'),
  ...(['scheduler','outreach','contacts','designer','proposal'] as const).flatMap(id=>[
   route('manager-delegate',`manager-${id}`,'Requested assignment','handoff','bottom','top'),
   route(`manager-${id}`,'manager-reports','When reported','context','bottom','top'),
  ]),
  route('manager-reports','manager-review','Decision needed','review'),
 ]),
 scheduler:graph('Triage branches by intent. Calendar-to-Blackboard is a separate read-only projection; board acknowledgement never resolves a meeting issue.',{
  'scheduler-trigger':[0,180],'scheduler-read':[260,180],'scheduler-exclusions':[520,0],'scheduler-availability':[520,180],'scheduler-book':[780,180],
  'scheduler-attention':[520,370],'scheduler-reminders':[780,370],'scheduler-output':[1040,180],
  'scheduler-calendar':[0,420],'scheduler-board':[260,610],
 },[
  route('scheduler-trigger','scheduler-read'),route('scheduler-read','scheduler-exclusions','Opt-out','flow','top','left'),
  route('scheduler-read','scheduler-availability','Scheduling'),route('scheduler-availability','scheduler-book','Eligible slot'),
  route('scheduler-read','scheduler-attention','Meeting change','review','bottom','left'),
  route('scheduler-availability','scheduler-attention','Needs Ryan','review','bottom','top'),
  route('scheduler-exclusions','scheduler-output','Verified update','flow','right','top'),route('scheduler-book','scheduler-output','Verified outcome'),
  route('scheduler-read','scheduler-reminders','Selected meetings only','review','bottom','top'),route('scheduler-reminders','scheduler-output','Reminder or hold','flow','right','bottom'),
  route('scheduler-attention','scheduler-output','Unresolved alerts','context','top','bottom'),
  route('scheduler-trigger','scheduler-calendar','Existing cycle','projection','bottom','top'),route('scheduler-calendar','scheduler-board','Full-day snapshot','projection','bottom','left'),
 ]),
 contacts:graph('Research is screened before map updates. This research batch stays in Review until released; duplicate and uncertain routes remain held.',{
  'contacts-trigger':[0,180],'contacts-research':[260,180],'contacts-deduplicate':[520,180],'contacts-enrich':[780,0],
  'contacts-map':[1040,0],'contacts-review':[1040,220],'contacts-handoff':[780,440],'contacts-held':[520,440],
 },[
  route('contacts-trigger','contacts-research'),route('contacts-research','contacts-deduplicate'),route('contacts-deduplicate','contacts-enrich','Screened','flow','top','left'),
  route('contacts-deduplicate','contacts-held','Duplicate / excluded','hold','bottom','top'),route('contacts-enrich','contacts-map','Evidenced routes'),
  route('contacts-enrich','contacts-held','Unverified','hold','bottom','right'),route('contacts-map','contacts-review','Pending review','review','bottom','top'),
  route('contacts-review','contacts-handoff','Explicit batch release','handoff','bottom','right'),route('contacts-review','contacts-held','Keep on hold','hold','left','right'),
 ]),
 outreach:graph('Standing eligible work and scoped releases share the same guard. A single due follow-up is checked afresh; uncertain sends are reconciled, never blindly replayed.',{
  'outreach-cycle':[0,0],'outreach-trigger':[0,370],'outreach-followup':[520,0],'outreach-guard':[260,200],
  'outreach-checks':[520,200],'outreach-draft':[780,0],'outreach-send':[1040,0],'outreach-verify':[1040,200],
  'outreach-held':[520,440],'outreach-output':[780,440],
 },[
  route('outreach-cycle','outreach-guard','Authorized work','flow','bottom','left'),route('outreach-guard','outreach-followup','Due follow-up','review','top','left'),
  route('outreach-followup','outreach-checks','One only · fresh checks','review','bottom','top'),route('outreach-trigger','outreach-guard','Specific authority','review','right','bottom'),
  route('outreach-guard','outreach-checks','Initial candidates'),route('outreach-guard','outreach-held','Paused / quota / uncertainty','hold','bottom','left'),
  route('outreach-checks','outreach-draft','Eligible now','flow','right','bottom'),route('outreach-checks','outreach-held','Reply / exclusion / hold','hold','bottom','top'),
  route('outreach-draft','outreach-send','Within authority'),route('outreach-send','outreach-verify','Accepted → read back','flow','bottom','top'),
  route('outreach-send','outreach-held','Rejected / uncertain','hold','right','top'),route('outreach-verify','outreach-output','Verified evidence','flow','bottom','right'),
  route('outreach-verify','outreach-held','Evidence unresolved','hold','left','right'),route('outreach-held','outreach-output','Actionable report only','context'),
 ]),
 proposal:graph('Save an editable draft first. Review can refine that same proposal; PDF export requires an explicit request and does not send anything.',{
  'proposal-trigger':[0,0],'proposal-template':[260,0],'proposal-draft':[520,0],'proposal-save':[780,0],
  'proposal-review':[780,230],'proposal-output':[1040,230],
 },[
  route('proposal-trigger','proposal-template'),route('proposal-template','proposal-draft'),route('proposal-draft','proposal-save','Revision checked'),
  route('proposal-save','proposal-review','In review','review','bottom','top'),route('proposal-review','proposal-output','Export requested','review'),
  route('proposal-review','proposal-template','Refine same draft','review','left','bottom'),
 ]),
 designer:graph('Inspect, implement and verify within the brief. Publish only when authorized; failures and requested refinements return through implementation and checks.',{
  'designer-trigger':[0,0],'designer-inspect':[260,0],'designer-build':[520,0],'designer-check':[780,0],
  'designer-output':[1040,0],'designer-review':[1040,240],
 },[
  route('designer-trigger','designer-inspect'),route('designer-inspect','designer-build'),route('designer-build','designer-check','Validate'),
  route('designer-check','designer-build','Fix observed issues','review','bottom','bottom'),route('designer-check','designer-output','Authorized publish','review'),
  route('designer-check','designer-review','Reviewable handoff','context','bottom','left'),route('designer-output','designer-review','Review result','review','bottom','top'),
  route('designer-review','designer-build','Scoped refinements','review','bottom','bottom'),
 ]),
};

export function workflowOutgoing(graph:WorkflowGraph,id:string){return graph.routes.filter(route=>route.source===id);}
export function workflowRouteMoves(kind:WorkflowRouteKind,online:boolean,status:string,paused:boolean){return online&&status==='working'&&!paused&&!['handoff','context','projection'].includes(kind);}

// Compact diagram captions fit between cards. Full conditions remain in the
// shared route labels used by mobile and the inspector.
const diagramLabels:Record<string,string>={
 'Requested work':'Requested','Within scope':'In scope','Decision needed':'Review',
 'Scheduling':'Schedule','Eligible slot':'Eligible','Verified outcome':'Verified','Verified update':'Verified',
 'Meeting change':'Changes','Selected meetings only':'Selected','Reminder or hold':'Outcome','Existing cycle':'Cycle','Full-day snapshot':'Snapshot',
 'Duplicate / excluded':'Held','Evidenced routes':'Verified','Keep on hold':'Hold','Pending review':'Review',
 'Due follow-up':'Due','One only · fresh checks':'One due','Specific authority':'Scoped','Initial candidates':'Initial',
 'Paused / quota / uncertainty':'Gated','Reply / exclusion / hold':'Held','Within authority':'Scoped','Accepted → read back':'Read back',
 'Rejected / uncertain':'Reconcile','Verified evidence':'Verified','Actionable report only':'Report',
 'Revision checked':'Checked','Export requested':'Requested','Refine same draft':'Refine',
 'Fix observed issues':'Fix','Authorized publish':'Allowed','Reviewable handoff':'Handoff','Review result':'Review','Scoped refinements':'Refine',
};
export function workflowDiagramLabel(route:WorkflowRoute){return diagramLabels[route.label]??route.label;}
