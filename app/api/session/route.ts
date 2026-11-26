import { NextResponse } from 'next/server';
import { matches, sessionToken } from '../../../lib/server';
export async function POST(req: Request) {
  let sameOrigin=false;
  try { const origin=new URL(req.headers.get('origin') || ''); sameOrigin=origin.host===req.headers.get('host') && (process.env.NODE_ENV!=='production'||origin.protocol==='https:'); } catch {}
  if (!sameOrigin) return NextResponse.json({error:'Origin rejected'},{status:403});
  let key; try { const body=await req.json(); key=body.key; } catch { return NextResponse.json({error:'Invalid request'},{status:400}); }
  if (typeof key!=='string'||!matches(key,process.env.OFFICE_ACCESS_KEY)) return NextResponse.json({error:'That access key doesn’t match. Use the key saved on your Mac.'},{status:401});
  const res=NextResponse.json({ok:true}); res.cookies.set('office_session',sessionToken(key),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:60*60*24*30}); return res;
}
export async function DELETE() { const res=NextResponse.json({ok:true});res.cookies.delete('office_session');return res; }
