import {NextResponse} from 'next/server';
import {authorized,sameOrigin,botCheckResponse} from '../../../lib/server';
import {allowedStudioOrigin,issueStudioTicket,verifyStudioTicket,verifyStudioReceipt} from '../../../lib/studio-launch.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const LIMIT=8192;

export async function POST(req:Request){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const origin=req.headers.get('origin')||'';
 if(!sameOrigin(req)||!allowedStudioOrigin(origin,process.env.NODE_ENV!=='production'))return NextResponse.json({error:'Origin rejected'},{status:403,headers});
 const denied=await botCheckResponse();if(denied)return denied;
 const key=process.env.OFFICE_BRIDGE_KEY,installationId=process.env.OFFICE_STUDIO_INSTALLATION_ID;
 if(!key||!installationId||!/^[A-Za-z0-9_-]{16,128}$/.test(installationId))return NextResponse.json({error:'Studio launch is not configured.',code:'STUDIO_NOT_CONFIGURED'},{status:503,headers});
 if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return NextResponse.json({error:'JSON required'},{status:415,headers});
 if(Number(req.headers.get('content-length'))>LIMIT)return NextResponse.json({error:'Request too large'},{status:413,headers});
 const reader=req.body?.getReader();if(!reader)return NextResponse.json({error:'Invalid request'},{status:400,headers});
 let body;
 try{
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return NextResponse.json({error:'Request too large'},{status:413,headers});}chunks.push(value);}
  body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
 if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Invalid request'},{status:400,headers});
 if(body.action==='ticket'&&Object.keys(body).length===1)return NextResponse.json({ticket:issueStudioTicket(key,origin,installationId)},{headers});
 if(body.action!=='verify'||Object.keys(body).length!==3||!Object.hasOwn(body,'ticket')||!Object.hasOwn(body,'receipt'))return NextResponse.json({error:'Invalid request'},{status:400,headers});
 // Pin the configured installation on both legs, including verification after
 // an environment change. Never accept a caller-supplied destination URL.
 if(!verifyStudioTicket(body.ticket,key,origin,installationId))return NextResponse.json({error:'Studio launch verification failed.'},{status:403,headers});
 const result=verifyStudioReceipt(body.ticket,body.receipt,key,origin);
 if(!result)return NextResponse.json({error:'Studio launch verification failed.'},{status:403,headers});
 return NextResponse.json(result,{headers});
}
