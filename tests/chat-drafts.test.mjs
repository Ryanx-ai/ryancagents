import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSubmittedDraft} from '../lib/chat-drafts.mjs';

test('a send acknowledgement clears only the exact submitted draft',()=>{
 const submitted='  Review this proposal  ';
 const drafts={proposal:submitted,manager:'Summarize today'};
 assert.deepEqual(clearSubmittedDraft(drafts,'proposal',submitted),{proposal:'',manager:'Summarize today'});
 assert.equal(drafts.proposal,submitted,'input state is not mutated');
});

test('typing or replacing a draft during an in-flight send survives its late acknowledgement',async()=>{
 const submitted='Review this proposal';
 let acknowledge;
 const response=new Promise(resolve=>{acknowledge=resolve;});
 let drafts={proposal:submitted,manager:'Summarize today'};
 const pending=response.then(()=>{drafts=clearSubmittedDraft(drafts,'proposal',submitted);});
 drafts={...drafts,proposal:'Review this proposal\nAlso check the pricing'};
 acknowledge();await pending;
 assert.equal(drafts.proposal,'Review this proposal\nAlso check the pricing');
 assert.equal(drafts.manager,'Summarize today');
});
