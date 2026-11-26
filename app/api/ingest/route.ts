import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { matches } from '../../../lib/server';
import { validateSnapshot } from '../../../lib/telemetry.mjs';
import { storageErrorResponse } from '../../../lib/storage';
export const runtime='nodejs';
export async function POST(req: Request) {
  if(!matches(req.headers.get('authorization')?.replace(/^Bearer /,'') || '',process.env.OFFICE_BRIDGE_KEY)) return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({error:'Storage is not configured'},{status:503});
  const raw=await req.text(); if(Buffer.byteLength(raw)>64000) return NextResponse.json({error:'Payload too large'},{status:413});
  let snapshot;try {snapshot=validateSnapshot(JSON.parse(raw));}catch{return NextResponse.json({error:'Invalid activity snapshot'},{status:400});}
  try { await put('office/snapshot.json',JSON.stringify(snapshot),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:60}); return NextResponse.json({ok:true}); }
  catch(error) { return storageErrorResponse(error,'Activity storage unavailable. The Mac will retry.'); }
}
