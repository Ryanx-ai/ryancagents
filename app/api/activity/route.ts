import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { authorized } from '../../../lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const headers={'Cache-Control':'private, no-store'};
  if(!authorized(req)) return NextResponse.json({error:'Unlock your office to view live activity'},{status:401,headers});
  if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({snapshot:null,connection:'unconfigured'},{headers});
  try {const blob=await get('office/snapshot.json',{access:'private',useCache:false});if(!blob||blob.statusCode!==200) return NextResponse.json({snapshot:null,connection:'waiting'},{headers});const snapshot=await new Response(blob.stream).json();return NextResponse.json({snapshot,connection:Date.now()-Date.parse(snapshot.observedAt)>90000?'stale':'connected'},{headers});}
  catch{return NextResponse.json({error:'Could not load activity. Retrying shortly.'},{status:503,headers});}
}
