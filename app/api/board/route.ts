import {NextResponse} from 'next/server';
import {authorized,sameOrigin,botCheckResponse} from '../../../lib/server';
import {storageErrorResponse} from '../../../lib/storage';
import {readBoardConditional,mutateBoardState} from '../../../lib/board-storage';
import {boardView,createBoardNote,updateBoardNote,validateBoardCreate,validateBoardUpdate,singaporeDay,validDay} from '../../../lib/board.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function failure(error:unknown,fallback:string){
 const e=error as {code?:string;message?:string;status?:number;current?:unknown};
 if(e.current&&e.status===409)return NextResponse.json({error:e.message,code:e.code,current:e.current},{status:409,headers});
 return storageErrorResponse(error,fallback);
}
async function browserWrite(req:Request){
 if(!authorized(req)||!sameOrigin(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 return botCheckResponse();
}
async function body(req:Request){const raw=await req.text();if(Buffer.byteLength(raw)>12000)throw new Error('Payload too large');return JSON.parse(raw);}
function inputError(error:unknown){return error instanceof Error&&error.name==='OfficeStorageError'?error.message:'Enter valid note JSON within the size limit.';}
export async function GET(req:Request){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const day=new URL(req.url).searchParams.get('day')||singaporeDay();
 if(!validDay(day))return NextResponse.json({error:'Choose a valid Singapore date.'},{status:400,headers});
 try{
  const now=Date.now(),result=await readBoardConditional(req.headers.get('if-none-match')||undefined,day,now),responseHeaders={...headers,ETag:result.etag};
  if(result.notModified)return new NextResponse(null,{status:304,headers:responseHeaders});
  return NextResponse.json(boardView(result.state,day,now),{headers:responseHeaders});
 }catch(error){return failure(error,'The board could not be loaded. Try refreshing shortly.');}
}
export async function POST(req:Request){
 const denied=await browserWrite(req);if(denied)return denied;
 let input;try{input=validateBoardCreate(await body(req));}catch(error){return NextResponse.json({error:inputError(error)},{status:400,headers});}
 try{const result=await mutateBoardState(state=>createBoardNote(state,input));return NextResponse.json({note:result.note},{status:result.created?201:200,headers});}
 catch(error){return failure(error,'The note could not be saved. Retry with the same note ID.');}
}
export async function PATCH(req:Request){
 const denied=await browserWrite(req);if(denied)return denied;
 let input;try{input=validateBoardUpdate(await body(req));}catch(error){return NextResponse.json({error:inputError(error)},{status:400,headers});}
 try{const note=await mutateBoardState(state=>updateBoardNote(state,input));return NextResponse.json({note},{headers});}
 catch(error){return failure(error,'The note could not be updated. Refresh before retrying.');}
}
