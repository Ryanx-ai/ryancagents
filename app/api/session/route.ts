import { NextResponse } from 'next/server';
import { sameOrigin,botCheckResponse } from '../../../lib/server';
import {createViewerToken,validateAccessPair} from '../../../lib/access.mjs';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({error:'Origin rejected'},{status:403,headers});
  const denied=await botCheckResponse();if(denied)return denied;
  let body;try {body=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
  const result=validateAccessPair(body,process.env.OFFICE_ACCESS_KEY,process.env.OFFICE_PERSONAL_KEY);
  if(result==='unconfigured')return NextResponse.json({error:'Office access needs configuration.'},{status:503,headers});
  if(result!=='valid')return NextResponse.json({error:'The access keys don’t match.'},{status:401,headers});
  const token=createViewerToken(process.env.OFFICE_ACCESS_KEY,process.env.OFFICE_PERSONAL_KEY);
  const res=NextResponse.json({ok:true,token},{headers});
  res.cookies.delete('office_session');
  return res;
}
export async function DELETE() { const res=NextResponse.json({ok:true},{headers});res.cookies.delete('office_session');return res; }
