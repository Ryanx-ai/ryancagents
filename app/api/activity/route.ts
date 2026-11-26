import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { authorized } from '../../../lib/server';
import { storageErrorResponse } from '../../../lib/storage';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const headers={'Cache-Control':'private, no-store'};
  if(!authorized(req)) return NextResponse.json({error:'Unlock your office to view live activity'},{status:401,headers});
  if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({snapshot:null,connection:'unconfigured'},{headers});
  try {
    const ifNoneMatch=req.headers.get('if-none-match')||undefined;
    const blob=await get('office/snapshot.json',{access:'private',useCache:false,...(ifNoneMatch?{ifNoneMatch}:{})});
    if(!blob)return NextResponse.json({snapshot:null,connection:'waiting'},{headers});
    const responseHeaders={...headers,ETag:blob.blob.etag};
    if(blob.statusCode===304)return new NextResponse(null,{status:304,headers:responseHeaders});
    const snapshot=await new Response(blob.stream).json();return NextResponse.json({snapshot,connection:Date.now()-Date.parse(snapshot.observedAt)>150000?'stale':'connected'},{headers:responseHeaders});
  }
  catch(error){return storageErrorResponse(error,'Could not load activity. Retrying shortly.');}
}
