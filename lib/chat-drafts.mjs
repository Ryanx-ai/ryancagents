/** A late send acknowledgement must not erase text edited while it was in flight. */
export function clearSubmittedDraft(drafts,agentId,submittedDraft) {
 if(drafts[agentId]!==submittedDraft)return drafts;
 return {...drafts,[agentId]:''};
}
