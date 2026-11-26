import {NextResponse} from 'next/server';
import {authorized,bridgeAuthorized,sameOrigin} from '../../../lib/server';
import {readJSON,writeJSON,recentCommands} from '../../../lib/storage';
import {commandInput} from '../../../lib/game-state.mjs';
const headers={'Cache-Control':'private, no-store'};
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const bridge=bridgeAuthorized(req);if(!bridge&&!await authorized())return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 try{const messages=await recentCommands();return NextResponse.json({messages:bridge?messages.filter(m=>!['replied','failed','uncertain','expired'].includes(m.status)):messages.slice(-50)},{headers});}catch{return NextResponse.json({error:'Messages unavailable'},{status:503,headers});}
}
export async function POST(req:Request) {
 const bridge=bridgeAuthorized(req);
 if(!bridge&&(!await authorized()||!sameOrigin(req)))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 let input,body;try{body=await req.json();input=commandInput(body);}catch{return NextResponse.json({error:'Enter a message (up to 4,000 characters).'},{status:400,headers});}
 const today=new Date().toISOString().slice(0,10).replaceAll('-','');if(!input.id.startsWith(today+'-'))return NextResponse.json({error:'Refresh and try again.'},{status:400,headers});
 try{
  if(bridge){if(typeof body.parentId!=='string'||!/^\d{8}-[a-f0-9-]{36}$/.test(body.parentId)||input.agentId==='manager')return NextResponse.json({error:'Invalid assignment'},{status:400,headers});const parent=await readJSON(`office/messages/${body.parentId}.json`);if(parent?.agentId!=='manager')return NextResponse.json({error:'Manager request required'},{status:403,headers});}
  const existing=await readJSON(`office/messages/${input.id}.json`);if(existing){if(existing.agentId!==input.agentId||existing.prompt!==input.prompt)return NextResponse.json({error:'Message ID already used'},{status:409,headers});return NextResponse.json(existing,{headers});}
  const snapshot=await readJSON('office/snapshot.json');if(!snapshot||Date.now()-Date.parse(snapshot.observedAt)>90000)return NextResponse.json({error:'Mac bridge offline. Open Codex and try again.'},{status:503,headers});
  const message={...input,createdAt:new Date().toISOString(),status:'pending',...(bridge?{parentId:body.parentId}:{})};await writeJSON(`office/messages/${input.id}.json`,message,false);return NextResponse.json(message,{status:201,headers});
 }catch{return NextResponse.json({error:'Could not queue message. Try again.'},{status:503,headers});}
}
export async function PATCH(req:Request) {
 if(!bridgeAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 let data;try{data=await req.json();}catch{return NextResponse.json({error:'Invalid receipt'},{status:400,headers});}
 if(!/^\d{8}-[a-f0-9-]{36}$/.test(data.id)||!['planning','queued','delivered','replied','failed','uncertain','expired'].includes(data.status)||typeof(data.reply??'')!=='string'||(data.reply||'').length>12000)return NextResponse.json({error:'Invalid receipt'},{status:400,headers});
 try{if(!await readJSON(`office/messages/${data.id}.json`))return NextResponse.json({error:'Unknown message'},{status:404,headers});await writeJSON(`office/receipts/${data.id}.json`,{status:data.status,reply:data.reply||null,updatedAt:new Date().toISOString()});return NextResponse.json({ok:true},{headers});}catch{return NextResponse.json({error:'Receipt unavailable'},{status:503,headers});}
}
