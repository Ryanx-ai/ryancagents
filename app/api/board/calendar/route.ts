import {NextResponse} from 'next/server';
import {bridgeAuthorized} from '../../../../lib/server';
import {storageErrorResponse} from '../../../../lib/storage';
import {boardCalendarScope,mutateBoardState} from '../../../../lib/board-storage';
import {validateCalendarSnapshot,ingestBoardCalendar} from '../../../../lib/board.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function PUT(req:Request){
 if(!bridgeAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const raw=await req.text();if(Buffer.byteLength(raw)>750000)return NextResponse.json({error:'Calendar snapshot is too large.'},{status:413,headers});
 let input;try{input=validateCalendarSnapshot(JSON.parse(raw),boardCalendarScope());}
 catch(error){return NextResponse.json({error:error instanceof Error&&error.name==='OfficeStorageError'?error.message:'Enter valid calendar snapshot JSON.'},{status:400,headers});}
 try{return NextResponse.json(await mutateBoardState(state=>ingestBoardCalendar(state,input)),{headers});}
 catch(error){return storageErrorResponse(error,'Calendar publication failed. Existing board data was kept.');}
}
