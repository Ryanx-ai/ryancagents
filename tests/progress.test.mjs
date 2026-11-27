import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPTIONS,PROGRESS_LABELS,isPublicCommentaryRecord,progressFromRecord} from '../lib/progress.mjs';
import {activityBubble} from '../lib/game-state.mjs';

const commentary=text=>({type:'response_item',payload:{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text}]}});
const caption=text=>progressFromRecord(commentary(text));

test('visible task updates become concise fixed captions',()=>{
 const cases=[
  ["I'm debugging the bridge.",'debugging'],['Running regression checks.','checks'],['Inbox checks pass.','inboxChecksPassed'],['The test suite passed.','checksPassed'],
  ["I'm publishing the update.",'publishing'],['Refreshing the Mac bridge.','bridge'],['Checking the inbox.','inbox'],['Scheduling calendar events.','scheduling'],
  ['Checking unsubscribes before outreach.','unsubscribe'],['Sending outreach emails.','sending'],['Drafting email replies.','drafting'],
  ['Researching contacts.','contactResearch'],['Comparing contact records.','contactCompare'],['Syncing the contact list with GHL.','contactSync'],
  ['Importing the proposal brief.','proposalImport'],['Drafting a proposal.','proposalDraft'],['Reviewing the proposal.','proposalReview'],
  ['Delegating tasks to the right agent.','delegation'],['Planning the next steps.','planning'],
 ];
 for(const [text,key] of cases)assert.equal(caption(text),CAPTIONS[key],text);
 assert.ok(Object.isFrozen(PROGRESS_LABELS));assert.ok(Object.isFrozen(CAPTIONS));
 assert.equal(new Set(PROGRESS_LABELS).size,PROGRESS_LABELS.length);
});

test('the user example prioritizes publishing over completed checks and the later bridge refresh',()=>{
 const example="The sweep is passing: Inbox text is visible, ‘Mark done’ works, profiles close cleanly, and the six-agent layout fits small phones. Proposal Ryan’s real chat is reporting active work. I’m publishing the update, then refreshing the Mac bridge so the live dashboard picks up the sixth agent and quieter heartbeat handling.";
 assert.equal(caption(example),CAPTIONS.publishing);
 assert.equal(caption("Inbox checks pass. I'm publishing the update, then refreshing the Mac bridge."),CAPTIONS.publishing);
 assert.equal(caption("I finished debugging and am publishing the update."),CAPTIONS.publishing);
 assert.equal(caption("After checking the inbox, I'm drafting email replies."),CAPTIONS.drafting);
 assert.equal(caption("I'm checking the inbox before sending emails."),CAPTIONS.inbox);
 assert.equal(caption("I'm reviewing the proposal before publishing it."),CAPTIONS.proposalReview);
 assert.equal(caption("I'm checking the inbox so I can draft replies."),CAPTIONS.inbox);
});

test('negated, hypothetical and delayed actions never claim active email sending',()=>{
 for(const text of ["I'm not sending emails.","I won’t send outreach emails.","I'll send emails tomorrow.","I will do this tomorrow: send emails.",'I might send emails.','Sending emails after approval.','I finished sending emails.','Inbox checks are not passing.','Ready to send emails.','Would you like me to send emails?','Can I send emails?','I need to send emails after approval.',"I'm blocked from sending emails."])assert.equal(caption(text),null,text);
 assert.equal(caption("I'll send the emails now."),CAPTIONS.sending);
 assert.equal(caption("I won't send emails. I'm checking the inbox."),CAPTIONS.inbox);
 assert.equal(caption("I'm publishing the update. Then I'll sync contacts."),CAPTIONS.publishing);
 for(const text of ["I'm waiting for approval to send emails.",'Publishing failed.','Publishing is complete.','The app supports sending emails.'])assert.equal(caption(text),null,text);
});

test('office bubbles use only allowlisted progress while actually working',()=>{
 const agent={status:'working',activity:'Working with email',progress:CAPTIONS.inboxChecksPassed};
 assert.equal(activityBubble(agent),CAPTIONS.inboxChecksPassed);
 assert.equal(activityBubble({...agent,progress:'private@example.com'}),'Working with email');
 assert.equal(activityBubble({...agent,progress:null}),'Working with email');
 for(const status of ['idle','offline','waiting','error'])assert.equal(activityBubble({...agent,status}),null);
 assert.equal(activityBubble(agent,false),null);
});

test('only explicitly public assistant commentary is read',()=>{
 const unread={get content(){throw new Error('Private content was accessed');},get message(){throw new Error('Private content was accessed');}};
 const privatePayload=(fields)=>Object.assign(Object.create(unread),fields);
 const records=[
  {type:'response_item',payload:privatePayload({type:'reasoning'})},
  {type:'response_item',payload:privatePayload({type:'message',role:'assistant',phase:'analysis'})},
  {type:'response_item',payload:privatePayload({type:'message',role:'assistant',phase:'final_answer'})},
  {type:'response_item',payload:privatePayload({type:'message',role:'assistant'})},
  {type:'response_item',payload:privatePayload({type:'message',role:'user',phase:'commentary'})},
  {type:'response_item',payload:privatePayload({type:'function_call',arguments:'Sending emails'})},
  {type:'response_item',payload:privatePayload({type:'function_call_output',output:'Sending emails'})},
  {type:'event_msg',payload:privatePayload({type:'agent_reasoning',phase:'commentary'})},
  {type:'event_msg',payload:privatePayload({type:'agent_message'})},
  {type:'event_msg',payload:privatePayload({type:'agent_message',phase:'analysis'})},
  {type:'event_msg',payload:privatePayload({type:'agent_message',phase:'commentary',role:'user'})},
 ];
 for(const record of records){assert.equal(progressFromRecord(record),null);assert.equal(isPublicCommentaryRecord(record),false);}
 assert.equal(progressFromRecord({type:'event_msg',payload:{type:'agent_message',phase:'commentary',message:'Checking the inbox.'}}),CAPTIONS.inbox);
 for(const record of [null,undefined,{},commentary(''),commentary('Everything looks interesting.')])assert.equal(progressFromRecord(record),null);
 assert.equal(isPublicCommentaryRecord(commentary('I cannot proceed until you approve.')),true);
 assert.equal(isPublicCommentaryRecord(commentary('')),true);
});

test('names, emails, links and raw commands cannot become captions',()=>{
 const raw="I'm checking the inbox for SECRET_PERSON at private@example.com, https://example.com/private.";
 assert.equal(caption(raw),CAPTIONS.inbox);assert.ok(PROGRESS_LABELS.includes(caption(raw)));
 assert.doesNotMatch(caption(raw),/SECRET_PERSON|private|example|https/);
 for(const text of ['```sh\npublish update\n```','`send emails`','> I am sending emails.','$ publish update'])assert.equal(caption(text),null,text);
 for(const text of ['Your instruction was "I am sending emails"; I am checking it first.',"I'm reviewing the phrase 'publish update'.","I'm checking how sending emails works."])assert.equal(caption(text),null,text);
 assert.equal(caption('```sh\npublish update\n```\nChecking the inbox.'),CAPTIONS.inbox);
 const record=commentary('Nothing to report.');record.payload.content.push({type:'reasoning_text',text:'Sending emails.'});
 assert.equal(progressFromRecord(record),null);
});
