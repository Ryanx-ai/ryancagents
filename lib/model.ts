export type AgentId = 'scheduler' | 'outreach' | 'contacts';
export type Status = 'working' | 'idle' | 'waiting' | 'error' | 'offline';
export type Activity = { id: string; agentId: AgentId; at: string; kind: string; label: string; status: Status };
export type AgentState = { id: AgentId; status: Status; activity: string; updatedAt: string | null; sessionStartedAt?: string | null };
export type Snapshot = { version: 1; observedAt: string; agents: AgentState[]; events: Activity[] };
export const agents = [
  { id: 'scheduler' as const, name: 'Inbox Ryan', role: 'Email & calendar', color: '#a6b5ff', short: 'IR', integrations: ['Gmail', 'Google Calendar'], description: 'Keeps the inbox moving and finds a time that works.', steps: ['Read inbox', 'Check availability', 'Reply & schedule'], thread: '01a2104e-4bb2-7da2-a3e7-2255cc8de59c' },
  { id: 'outreach' as const, name: 'Outreach Ryan', role: 'Email outreach', color: '#efb66d', short: 'OR', integrations: ['Gmail', 'Contact map'], description: 'Turns approved contacts into thoughtful outreach.', steps: ['Pick contacts', 'Prepare outreach', 'Send & record'], thread: '01a1e8ac-499f-7e32-83db-904f2ad4e591' },
  { id: 'contacts' as const, name: 'Network Ryan', role: 'Contacts & GoHighLevel', color: '#8bc6aa', short: 'NR', integrations: ['Contact map', 'GoHighLevel'], description: 'Researches the right people and keeps your CRM in sync.', steps: ['Research contacts', 'Check GoHighLevel', 'Update contact map'], thread: '01a1e798-e941-74f3-9e0b-4bab573ba6c4' },
];
export const emptyAgents: AgentState[] = agents.map(a => ({ id: a.id, status: 'offline', activity: 'Waiting for the local bridge', updatedAt: null }));
export function demoSnapshot(tick: number): Snapshot {
  const now = Date.now();
  const actions = [['Reading inbox', 'Checking calendar', 'Preparing a reply'], ['Selecting approved contacts', 'Preparing outreach', 'Recording outreach result'], ['Researching contacts', 'Checking GoHighLevel', 'Updating contact map']];
  return { version: 1, observedAt: new Date(now).toISOString(), agents: agents.map((a, i) => ({ id: a.id, status: i === 1 && tick % 4 === 0 ? 'idle' : 'working', activity: actions[i][tick % 3], updatedAt: new Date(now).toISOString() })), events: Array.from({length: 12}, (_,i) => ({id: `demo-${tick}-${i}`, agentId: agents[i%3].id, at: new Date(now - i * 45000).toISOString(), kind: 'demo', label: actions[i%3][(tick+i)%3], status: i%4 === 0 ? 'idle' : 'working'})) };
}
