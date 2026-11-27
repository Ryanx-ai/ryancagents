// Only these captions may leave the bridge. Visible commentary is classified
// locally; its names, addresses, links and other free text are never returned.
export const CAPTIONS=Object.freeze({
 debugging:'Debugging…', checks:'Running checks', checksPassed:'Checks pass', inboxChecksPassed:'Inbox checks pass',
 publishing:'Publishing update', bridge:'Syncing office bridge', inbox:'Checking inbox', scheduling:'Scheduling events',
 unsubscribe:'Checking unsubscribes', sending:'Sending emails', drafting:'Drafting emails',
 contactResearch:'Researching contacts', contactCompare:'Comparing contacts', contactSync:'Syncing contacts',
 proposalImport:'Importing proposal', proposalDraft:'Drafting proposal', proposalReview:'Reviewing proposal',
 delegation:'Delegating tasks', planning:'Planning next steps',
});
export const PROGRESS_LABELS=Object.freeze(Object.values(CAPTIONS));

const around=(action,topic)=>new RegExp(`\\b(?:${action})\\b[^.;!\\n]{0,80}\\b(?:${topic})\\b|\\b(?:${topic})\\b[^.;!\\n]{0,80}\\b(?:${action})\\b`,'i');
const contacts='contacts?|leads?|crm|ghl|gohighlevel|contact list|contact map';
const proposals='proposals?|briefs?|proposal studio|decks?';
const rules=[
 [CAPTIONS.debugging,/\b(?:debug(?:ging)?|troubleshoot(?:ing)?|investigating|isolating|fixing|diagnosing)\b/i],
 [CAPTIONS.publishing,/\b(?:publish(?:ing)?|deploy(?:ing)?|releasing|shipping)\b/i],
 [CAPTIONS.bridge,around('sync(?:ing|hronizing)?|refresh(?:ing)?|restart(?:ing)?|reconnect(?:ing)?|check(?:ing)?|verifying','(?:mac )?bridge|relay')],
 [CAPTIONS.unsubscribe,around('check(?:ing)?|review(?:ing)?|process(?:ing)?|updat(?:e|ing)|handl(?:e|ing)|remov(?:e|ing)','unsubscribes?|opt[ -]?outs?|suppression list')],
 [CAPTIONS.proposalImport,around('import(?:ing)?|load(?:ing)?|pull(?:ing)?',proposals)],
 [CAPTIONS.proposalDraft,around('draft(?:ing)?|writ(?:e|ing)|creat(?:e|ing)|build(?:ing)?|prepar(?:e|ing)',proposals)],
 [CAPTIONS.proposalReview,around('review(?:ing)?|check(?:ing)?|proofread(?:ing)?|verify(?:ing)?|verifying|revis(?:e|ing)',proposals)],
 [CAPTIONS.contactCompare,around('compar(?:e|ing)|cross[ -]?check(?:ing)?|reconcil(?:e|ing)|deduplicat(?:e|ing)|match(?:ing)?',contacts)],
 [CAPTIONS.contactSync,around('sync(?:ing|hronizing)?|updat(?:e|ing)|merg(?:e|ing)|import(?:ing)?|writ(?:e|ing)',contacts)],
 [CAPTIONS.contactResearch,around('research(?:ing)?|enrich(?:ing)?|find(?:ing)?|looking up|check(?:ing)?|verify(?:ing)?|verifying',contacts)],
 [CAPTIONS.sending,around('send(?:ing)?|dispatch(?:ing)?','emails?|e-mails?|outreach|messages?|follow[ -]?ups?')],
 [CAPTIONS.drafting,around('draft(?:ing)?|writ(?:e|ing)|prepar(?:e|ing)','emails?|e-mails?|replies|responses?|outreach|follow[ -]?ups?')],
 [CAPTIONS.scheduling,around('schedul(?:e|ing)|book(?:ing)?|reschedul(?:e|ing)|check(?:ing)?|review(?:ing)?|find(?:ing)?','calendar|events?|meetings?|availability|time slots?')],
 [CAPTIONS.inbox,around('check(?:ing)?|review(?:ing)?|scan(?:ning)?|triag(?:e|ing)|read(?:ing)?|sort(?:ing)?','inbox|emails?|e-mails?|mail')],
 [CAPTIONS.checks,around('run(?:ning)?|checking|verif(?:y|ying)|testing','tests?|checks?|suite|build|validation|regressions?')],
 [CAPTIONS.checks,/\b(?:testing|validating)\b/i],
 [CAPTIONS.delegation,/\b(?:delegat(?:e|ing)|assign(?:ing)?|routing tasks|handing off)\b/i],
 [CAPTIONS.planning,/\b(?:planning|prioritizing|prioritising|organizing tasks|organising tasks|mapping out)\b/i],
];

function commentaryText(record){
 if(!record||typeof record!=='object')return null;
 if(record.type==='response_item'){
  const p=record.payload;
  if(!p||p.type!=='message'||p.role!=='assistant'||p.phase!=='commentary'||!Array.isArray(p.content))return null;
  return p.content.filter(part=>part?.type==='output_text'&&typeof part.text==='string').map(part=>part.text.slice(0,12000)).join('\n').slice(0,12000);
 }
 if(record.type==='event_msg'){
  const p=record.payload;
  if(!p||p.type!=='agent_message'||p.phase!=='commentary'||(p.role!=null&&p.role!=='assistant'))return null;
  return typeof p.message==='string'?p.message.slice(0,12000):null;
 }
 return null;
}

export function isPublicCommentaryRecord(record){
 return commentaryText(record)!==null;
}

function visibleProse(text){
 return text.replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g,' ')
  .replace(/`[^`\n]*(?:`|$)/g,' ')
  .replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|(?<!\w)'[^'\n]*'(?!\w)/g,' ')
  .split('\n').filter(line=>!/^\s*(?:>|\$\s)/.test(line)).join('\n')
  .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/\bhttps?:\/\/\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,' ')
  .replace(/[‘’]/g,"'");
}

export function progressFromRecord(record){
 const text=commentaryText(record);
 if(!text)return null;
 let best=null,bestScore=-1;
 const clauses=visibleProse(text).split(/[.!?;\n]+|,?\s+\b(?:but|and)\b\s+(?=(?:i|we|am|now|currently)\b)/i);
 for(let clause of clauses){
  // A narrated next step after "then" is not the current action.
  clause=clause.split(/\b(?:and\s+)?then\b|\bafter that\b/i)[0].trim();
  if(!clause)continue;
  const announcements=[...clause.matchAll(/\b(?:i(?:'m| am|'ll| will)|we(?:'re| are|'ll| will))\s+/gi)];
  const announcement=announcements.at(-1);
  if(announcement)clause=clause.slice(announcement.index+announcement[0].length);
  clause=clause.split(/\bbefore\b|\bso (?:i|we) (?:can|will)\b/i)[0].trim();
  if(/\b(?:phrase|wording|instruction|example)\b|\bhow\b.+\bworks?\b/i.test(clause))continue;
  // Fail closed on negation, hypothetical or delayed plans. Status fallback is
  // preferable to claiming an email is being sent when it is only proposed.
  if(/\b(?:not|never|cannot|can't|won't|don't|isn't|aren't|haven't|hasn't|can|could|would|might|maybe|tomorrow|later|eventually|waiting|blocked|awaiting|supports?|allows?)\b|\b(?:ready|need|set) to\b|\b(?:may|should) (?:i|we|you)\b|\bnext (?:week|month|day)\b|\b(?:after|pending) (?:your )?approval\b|\b(?:when|once) approved\b/i.test(clause))continue;
  if(/\b(?:has|have|is|are|was|were)\s+(?:failed|complete|completed|finished|done)\b|\b\w+ing\s+(?:failed|finished|completed)\b/i.test(clause))continue;
  const finished=/\b(?:finished|completed|done|stopped|paused)\s+(?:\w+\s+){0,2}(?:debugging|checking|publishing|deploying|syncing|refreshing|sending|drafting|reviewing|researching|scheduling|planning|testing)\b/i.test(clause);
  let caption=finished?null:rules.find(([,pattern])=>pattern.test(clause))?.[0];
  let score=announcement||/\b(?:now|currently)\b/i.test(clause)?30:15;
  if(!caption&&/\b(?:tests?|checks?|suite|sweep|validation)\b/i.test(clause)&&/\b(?:pass(?:ed|ing)?|green|successful|succeeded)\b/i.test(clause)){
   caption=/\binbox\b/i.test(clause)?CAPTIONS.inboxChecksPassed:CAPTIONS.checksPassed;score=5;
  }
  if(caption&&score>=bestScore){best=caption;bestScore=score;}
 }
 return best;
}
