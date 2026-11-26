import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const SPENDING_TEAM='team_0V7YbyeIfevX0daNFOIuI2Ob';
export const SPENDING_PROJECT='prj_Hik7T5JoTsf3NxoY9Sq5hsw5hZ6F';
const WEEK=7*24*60*60*1000;

export function verifiedSpendingSignature(raw,signature,secret){
 if(!secret||typeof signature!=='string'||! /^[a-f\d]{40}$/i.test(signature))return false;
 const expected=createHmac('sha1',secret).update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}

export function spendingMessage(event,now=Date.now()){
 const p=event?.payload;
 if(event?.type!=='budget.reached'||typeof event.id!=='string'||! /^[a-z\d_-]{8,128}$/i.test(event.id)||
  !Number.isFinite(event.createdAt)||event.createdAt<now-WEEK||event.createdAt>now+300000||
  p?.teamId!==SPENDING_TEAM||p.scope!=='project'||p.scopeId!==SPENDING_PROJECT||
  !Number.isFinite(p.budgetAmount)||p.budgetAmount<=0||p.budgetAmount>1000000||
  !Number.isFinite(p.currentSpend)||p.currentSpend<0||p.currentSpend>1000000000||
  ![50,75,100,200,300,400,500,600,700,800,900,1000].includes(p.thresholdPercent))throw new Error('Invalid spending event');
 const hash=createHash('sha256').update(`${SPENDING_TEAM}:${SPENDING_PROJECT}:${event.id}`).digest('hex').slice(0,32);
 const id=new Date(event.createdAt).toISOString().slice(0,10).replaceAll('-','')+'-'+[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20)].join('-');
 const test=event.test===true;
 const prompt=[
  test?'TEST ONLY: verify the Ryan HQ spending-alert connection. The amounts below are synthetic and do not represent actual spend.':'Vercel spending alert for Ryan HQ.',
  `Project usage has reached US$${p.currentSpend.toFixed(2)} against a US$${p.budgetAmount.toFixed(2)} budget (${p.thresholdPercent}% alert).`,
  `Event time: ${new Date(event.createdAt).toISOString()}. This project budget measures usage before credits; the US$20 Pro subscription is separate.`,
  test?'Acknowledge this test in one sentence. Do not inspect accounts, delegate, or make any changes.':'Review this usage alert and report a short summary with recommended next steps to Ryan. Treat the figures as an alert snapshot, not a live balance. You may inspect Vercel usage read-only if available. Do not change plans, budgets, credentials, project availability, or agent schedules, and do not delegate changes without Ryan’s approval.',
 ].join('\n\n');
 return {id,agentId:'manager',prompt,createdAt:new Date(now).toISOString(),status:'pending',source:'vercel-spending',spending:{eventId:event.id,createdAt:event.createdAt,budgetAmount:p.budgetAmount,currentSpend:p.currentSpend,thresholdPercent:p.thresholdPercent,test}};
}
