import {NextResponse} from 'next/server';
import {authorized,sameOrigin,botCheckResponse} from '../../../lib/server';
import {readJSON,writeJSON,completedReviews} from '../../../lib/storage';
import {completionKey,knownCompletion,reviewWatermarks} from '../../../lib/completions.mjs';
const headers={'Cache-Control':'private, no-store'};
export const dynamic='force-dynamic';
const ids=['scheduler','outreach','contacts','manager'];
export async function GET(req:Request){
 if(!await authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 try{
  const [values,completed]=await Promise.all([
   Promise.all(ids.map(async id=>[id,(await readJSON(`office/reviews/${id}.json`))?.completedAt||null])),completedReviews(),
  ]);
  for(const [id,at] of values){const key=completionKey(id,at);if(key)completed[key]=true;}
  const reviewed=reviewWatermarks(Object.fromEntries(values),completed);
  return NextResponse.json(new URL(req.url).searchParams.get('details')==='1'?{reviewed,completed}:reviewed,{headers});
 }catch{return NextResponse.json({error:'Reviews unavailable'},{status:503,headers});}
}
export async function POST(req:Request){
 if(!await authorized(req)||!sameOrigin(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const denied=await botCheckResponse();if(denied)return denied;
 let data;try{data=await req.json();}catch{return NextResponse.json({error:'Invalid review'},{status:400,headers});}
 const key=typeof data?.completedAt==='string'?completionKey(data.agentId,data.completedAt):null;
 if(!key)return NextResponse.json({error:'Invalid review'},{status:400,headers});
 try{
  const snapshot=await readJSON('office/snapshot.json');
  if(!knownCompletion(snapshot,data.agentId,data.completedAt))return NextResponse.json({error:'This completion is no longer in the activity list. Refresh and review the latest result.'},{status:409,headers});
  // Independent, deterministic keys make repeats idempotent and concurrent
  // acknowledgements safe; no last-writer-wins list can lose a completion.
  await writeJSON(`office/completion-reviews/${key}.json`,{agentId:data.agentId,completedAt:new Date(data.completedAt).toISOString()});
  return NextResponse.json({ok:true,id:key},{headers});
 }catch{return NextResponse.json({error:'Could not save review'},{status:503,headers});}
}
