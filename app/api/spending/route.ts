import {NextResponse} from 'next/server';
import {enqueueOfficeMessage,storageErrorResponse} from '../../../lib/storage';
import {spendingMessage,verifiedSpendingSignature} from '../../../lib/spending.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const LIMIT=16384;

export async function POST(req:Request){
 const secret=process.env.OFFICE_SPENDING_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'Spending alerts are not configured'},{status:503,headers:{...headers,'Retry-After':'60'}});
 if(Number(req.headers.get('content-length'))>LIMIT)return NextResponse.json({error:'Event too large'},{status:413,headers});
 const reader=req.body?.getReader();if(!reader)return NextResponse.json({error:'Missing event'},{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return NextResponse.json({error:'Event too large'},{status:413,headers});}chunks.push(value);}}
 catch{return NextResponse.json({error:'Invalid event body'},{status:400,headers});}
 const raw=Buffer.concat(chunks);
 if(!verifiedSpendingSignature(raw,req.headers.get('x-vercel-signature'),secret))return NextResponse.json({error:'Invalid signature'},{status:401,headers});
 let message;try{message=spendingMessage(JSON.parse(raw.toString('utf8')));}catch{return NextResponse.json({error:'Invalid spending event'},{status:400,headers});}
 try{const result=await enqueueOfficeMessage(message);return NextResponse.json({ok:true,id:result.message.id,duplicate:!result.created},{status:result.created?202:200,headers});}
 catch(error){return storageErrorResponse(error,'Could not queue spending alert; retry later');}
}
