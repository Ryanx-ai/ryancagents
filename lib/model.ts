export type AgentId = 'scheduler' | 'outreach' | 'contacts' | 'manager';
export type Status = 'working' | 'idle' | 'waiting' | 'error' | 'offline';
export type Activity = { id: string; agentId: AgentId; at: string; kind: string; label: string; status: Status };
export type AgentState = { id: AgentId; status: Status; activity: string; updatedAt: string | null; completedAt?: string | null; attentionAt?: string | null; result?: string | null; sessionStartedAt?: string | null };
export type Snapshot = { version: 1; observedAt: string; agents: AgentState[]; events: Activity[] };
export const agents = [
  { id: 'scheduler' as const, name: 'Inbox Ryan', role: 'Email & calendar', color: '#a6b5ff', short: 'IR', integrations: ['Gmail', 'Google Calendar'], description: 'Keeps the inbox moving and finds a time that works.', steps: ['Read inbox', 'Check availability', 'Reply & schedule'], thread: '01a2104e-4bb2-7da2-a3e7-2255cc8de59c' },
  { id: 'outreach' as const, name: 'Outreach Ryan', role: 'Email outreach', color: '#efb66d', short: 'OR', integrations: ['Gmail', 'Contact map'], description: 'Turns approved contacts into thoughtful outreach.', steps: ['Pick contacts', 'Prepare outreach', 'Send & record'], thread: '01a1e8ac-499f-7e32-83db-904f2ad4e591' },
  { id: 'contacts' as const, name: 'Network Ryan', role: 'Contacts & GoHighLevel', color: '#8bc6aa', short: 'NR', integrations: ['Contact map', 'GoHighLevel'], description: 'Researches the right people and keeps your CRM in sync.', steps: ['Research contacts', 'Check GoHighLevel', 'Update contact map'], thread: '01a1e798-e941-74f3-9e0b-4bab573ba6c4' },
  { id: 'manager' as const, name: 'Manager Ryan', role: 'Office manager', color: '#efdab0', short: 'MR', integrations: ['Codex', 'All agents'], description: 'Summarizes the office and delegates your requests.', steps: ['Review the office', 'Plan assignments', 'Delegate'], thread: '01a216eb-566e-7dd1-ab32-f5adc3c57f89' },
];
export const emptyAgents: AgentState[] = agents.map(a => ({ id: a.id, status: 'offline', activity: 'Waiting for the local bridge', updatedAt: null }));
