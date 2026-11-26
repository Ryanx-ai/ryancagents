import {NextResponse} from 'next/server';
import {authorized,sameOrigin,botCheckResponse} from '../../../lib/server';
import {readJSON,readOfficeStateConditional,acknowledgeOfficeReview,storageErrorResponse} from '../../../lib/storage';
import {completionKey,knownCompletion,reviewWatermarks} from '../../../lib/completions.mjs';
const headers={'Cache-Control':'private, no-store'};
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!await authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 try{
  const result=await readOfficeStateConditional(req.headers.get('if-none-match')||undefined);
  const responseHeaders={...headers,ETag:result.etag};
  if(result.notModified)return new NextResponse(null,{status:304,headers:responseHeaders});
  const {completed}=result.state;const reviewed=reviewWatermarks({},completed);
  return NextResponse.json(new URL(req.url).searchParams.get('details')==='1'?{reviewed,completed}:reviewed,{headers:responseHeaders});
 }catch(error){return storageErrorResponse(error,'Reviews unavailable. Retrying shortly.');}
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
  return NextResponse.json(await acknowledgeOfficeReview(key),{headers});
 }catch(error){return storageErrorResponse(error,'Could not save review. Try again shortly.');}
}
