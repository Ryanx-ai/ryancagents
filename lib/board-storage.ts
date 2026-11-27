import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {BOARD_PATH,newBoardState,checkedBoardState,atomicBoardUpdate,singaporeDay} from './board.mjs';
import {OfficeStorageError,requireStrongETag} from './office-store.mjs';

type Stored={value:any;etag:string};
const globals=globalThis as typeof globalThis&{__ryanBoardDev?:Stored};
const developmentStore=()=>process.env.NODE_ENV==='development'&&process.env.OFFICE_BOARD_DEV_STORE==='1';
export function boardCalendarScope(){return {accountId:process.env.OFFICE_BOARD_CALENDAR_ACCOUNT||'ryanchin@verticalinstitute.com',calendarId:process.env.OFFICE_BOARD_CALENDAR_ID||'ryanchin@verticalinstitute.com'};}
const adapter={
 async read():Promise<Stored|null>{
  if(developmentStore())return globals.__ryanBoardDev?structuredClone(globals.__ryanBoardDev):null;
  const blob=await get(BOARD_PATH,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
  if(!blob)return null;if(blob.statusCode!==200)throw new OfficeStorageError('BOARD_STORAGE_READ','The board could not be read.',503);
  return {value:checkedBoardState(await new Response(blob.stream).json()),etag:requireStrongETag(blob.blob.etag)};
 },
 async write(value:any,etag:string|null){
  if(developmentStore()){
   const current=globals.__ryanBoardDev;
   if((current?.etag??null)!==etag)throw new BlobPreconditionFailedError();
   globals.__ryanBoardDev={value:structuredClone(value),etag:`"dev-${value.revision}"`};return;
  }
  await put(BOARD_PATH,JSON.stringify(value),{access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60,...(etag?{allowOverwrite:true,ifMatch:etag}:{allowOverwrite:false})});
 },
 isConflict(error:unknown){return error instanceof BlobPreconditionFailedError;},
};
export function mutateBoardState(mutate:(state:any)=>any){return atomicBoardUpdate(adapter,mutate);}

// Freshness is part of this representation. A one-minute bucket prevents a
// body-free 304 from keeping yesterday's day/current status indefinitely.
function representationETag(etag:string,day:string,now:number){return `"board.${Buffer.from(etag).toString('base64url')}.${day}.${Math.floor(now/60000)}"`;}
function providerETag(value:string|undefined,day:string,now:number){
 if(!value||value.length>512)return null;
 const match=/^"board\.([A-Za-z0-9_-]+)\.(\d{4}-\d{2}-\d{2})\.(\d+)"$/.exec(value);
 if(!match||match[2]!==day||Number(match[3])!==Math.floor(now/60000))return null;
 const decoded=Buffer.from(match[1],'base64url').toString();return decoded.length<=256?decoded:null;
}
export async function readBoardConditional(ifNoneMatch?:string,day=singaporeDay(),now=Date.now()){
 const conditional=providerETag(ifNoneMatch,day,now);
 if(developmentStore()){
  const current=await adapter.read(),etag=representationETag(current?.etag||'missing',day,now);
  return {notModified:ifNoneMatch===etag,etag,state:current?.value??newBoardState()};
 }
 const blob=await get(BOARD_PATH,{access:'private',useCache:false,...(conditional&&conditional!=='missing'?{ifNoneMatch:conditional}:{})});
 const etag=representationETag(blob?.blob.etag||'missing',day,now);
 if(blob?.statusCode===304||ifNoneMatch===etag)return {notModified:true,etag,state:null};
 return {notModified:false,etag,state:blob?checkedBoardState(await new Response(blob.stream).json()):newBoardState()};
}
