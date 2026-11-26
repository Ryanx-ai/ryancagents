import {NextResponse} from 'next/server';
import {authorized,bridgeAuthorized,sameOrigin,botCheckResponse} from '../../../lib/server';
import {readJSON,readOfficeStateConditional,enqueueOfficeMessage,recordOfficeReceipt,storageErrorResponse} from '../../../lib/storage';
import {commandInput} from '../../../lib/game-state.mjs';
const headers={'Cache-Control':'private, no-store'};
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const bridge=bridgeAuthorized(req);if(!bridge&&!await authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 try{
  const result=await readOfficeStateConditional(req.headers.get('if-none-match')||undefined);
  const responseHeaders={...headers,ETag:result.etag};
  if(result.notModified)return new NextResponse(null,{status:304,headers:responseHeaders});
  const state=result.state;const params=new URL(req.url).searchParams;
  if(bridge&&params.get('queue')==='1'){
   if(params.get('recover')!=='1'&&params.get('revision')===state.queueRevision)return NextResponse.json({revision:state.queueRevision,unchanged:true},{headers:responseHeaders});
   // Queue membership and revision commit together. Recovery is this same known
   // object read, never a LIST scan, even after a lost response or bridge restart.
   return NextResponse.json({revision:state.queueRevision,messages:state.messages.filter(m=>m.status==='pending')},{headers:responseHeaders});
  }
  const messages=[...state.messages].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  return NextResponse.json({messages:bridge?messages.filter(m=>!['replied','failed','uncertain','expired'].includes(m.status)):messages.slice(-50)},{headers:responseHeaders});
 }catch(error){return storageErrorResponse(error,'Messages unavailable. Retrying shortly.');}
}
export async function POST(req:Request) {
 const bridge=bridgeAuthorized(req);
 if(!bridge&&(!await authorized(req)||!sameOrigin(req)))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 if(!bridge){const denied=await botCheckResponse();if(denied)return denied;}
 let input,body;try{body=await req.json();input=commandInput(body);}catch{return NextResponse.json({error:'Enter a message (up to 4,000 characters).'},{status:400,headers});}
 const today=new Date().toISOString().slice(0,10).replaceAll('-','');if(!input.id.startsWith(today+'-'))return NextResponse.json({error:'Refresh and try again.'},{status:400,headers});
 if(bridge&&(typeof body.parentId!=='string'||!/^\d{8}-[a-f0-9-]{36}$/.test(body.parentId)||input.agentId==='manager'))return NextResponse.json({error:'Invalid assignment'},{status:400,headers});
 try{
  const snapshot=await readJSON('office/snapshot.json');
  const bridgeReady=Boolean(snapshot&&Date.now()-Date.parse(snapshot.observedAt)<=150000);
  const result=await enqueueOfficeMessage({...input,createdAt:new Date().toISOString(),status:'pending',...(bridge?{parentId:body.parentId}:{})},bridge,bridgeReady);
  return NextResponse.json(result.message,{status:result.created?201:200,headers});
 }catch(error){return storageErrorResponse(error,'Could not queue message. Retry with the same request.');}
}
export async function PATCH(req:Request) {
 if(!bridgeAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 let data;try{data=await req.json();}catch{return NextResponse.json({error:'Invalid receipt'},{status:400,headers});}
 if(!/^\d{8}-[a-f0-9-]{36}$/.test(data.id)||!['planning','queued','delivered','replied','failed','uncertain','expired'].includes(data.status)||typeof(data.reply??'')!=='string'||(data.reply||'').length>12000)return NextResponse.json({error:'Invalid receipt'},{status:400,headers});
 const timings:Record<string,string>={};for(const field of ['pickedUpAt','queuedAt','deliveredAt','repliedAt'])if(data[field]!=null){if(typeof data[field]!=='string'||!Number.isFinite(Date.parse(data[field]))||Date.parse(data[field])>Date.now()+60000)return NextResponse.json({error:'Invalid receipt timing'},{status:400,headers});timings[field]=data[field];}
 try{await recordOfficeReceipt(data.id,{status:data.status,reply:data.reply||null,...timings,updatedAt:new Date().toISOString()});return NextResponse.json({ok:true},{headers});}
 catch(error){return storageErrorResponse(error,'Receipt storage unavailable. The Mac will retry.');}
}
