import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {NextResponse} from 'next/server';
import {OFFICE_STATE_PATH,checkedState,atomicOfficeUpdate,queueOfficeMessage,saveOfficeReceipt,saveOfficeReview} from './office-store.mjs';
export async function readJSON(name:string) {const blob=await get(name,{access:'private',useCache:false});if(!blob||blob.statusCode!==200)return null;return new Response(blob.stream).json();}
export async function writeJSON(name:string,value:unknown,overwrite=true) {return put(name,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:overwrite,contentType:'application/json',cacheControlMaxAge:60});}
const adapter={
 async read(){const blob=await get(OFFICE_STATE_PATH,{access:'private',useCache:false});if(!blob||blob.statusCode!==200)return null;return {value:await new Response(blob.stream).json(),etag:blob.blob.etag};},
 async write(state:unknown,etag:string){await put(OFFICE_STATE_PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',cacheControlMaxAge:60});},
 isConflict(error:unknown){return error instanceof BlobPreconditionFailedError;},
};
export async function getOfficeState(){return checkedState((await adapter.read())?.value);}
export async function readOfficeStateConditional(ifNoneMatch?:string){
 const blob=await get(OFFICE_STATE_PATH,{access:'private',useCache:false,...(ifNoneMatch?{ifNoneMatch}:{})});
 if(!blob){checkedState(null);throw new Error('Unreachable');}
 const etag=blob.blob.etag;
 if(blob.statusCode===304)return {notModified:true,etag,state:null};
 return {notModified:false,etag,state:checkedState(await new Response(blob.stream).json())};
}
export async function mutateOfficeState(mutate:(state:any)=>{value?:any;changed?:boolean}){return atomicOfficeUpdate(adapter,mutate);}
export async function enqueueOfficeMessage(message:any,requireManagerParent=false,bridgeReady=true){return mutateOfficeState(state=>queueOfficeMessage(state,message,requireManagerParent,bridgeReady));}
export async function recordOfficeReceipt(id:string,receipt:any){return mutateOfficeState(state=>saveOfficeReceipt(state,id,receipt));}
export async function acknowledgeOfficeReview(key:string){return mutateOfficeState(state=>saveOfficeReview(state,key));}
export function storageErrorResponse(error:unknown,fallback='Office storage unavailable. Retrying shortly.'){
 const e=error as {name?:string;code?:string;message?:string;status?:number;retryAfter?:number};
 const known=e?.name==='OfficeStorageError';
 const paused=e?.name==='BlobStoreSuspendedError'||/quota|usage limit|store.+suspend/i.test(e?.message||'');
 const code=known?e.code:paused?'STORAGE_LIMIT':'STORAGE_UNAVAILABLE';
 const message=known?e.message:paused?'Office storage is paused or has reached its usage limit. Check Vercel storage usage.':fallback;
 const status=known?e.status:503;
 return NextResponse.json({error:message,code},{status:status||503,headers:{'Cache-Control':'private, no-store',...((status||503)>=500?{'Retry-After':String(Math.max(5,Math.min(3600,e?.retryAfter||30)))}:{})}});
}
