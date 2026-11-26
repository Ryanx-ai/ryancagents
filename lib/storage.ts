import {get,put,list} from '@vercel/blob';
export async function readJSON(name:string) {const blob=await get(name,{access:'private',useCache:false});if(!blob||blob.statusCode!==200)return null;return new Response(blob.stream).json();}
export async function writeJSON(name:string,value:unknown,overwrite=true) {return put(name,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:overwrite,contentType:'application/json',cacheControlMaxAge:60});}
export async function recentCommands() {
 const paths:string[]=[];
 // Seven days, paginated. Never silently drop a pending message after page one.
 await Promise.all(Array.from({length:7},async(_,day)=>{
  const date=new Date(Date.now()-day*86400000).toISOString().slice(0,10).replaceAll('-','');let cursor:string|undefined;
  do {const page=await list({prefix:`office/messages/${date}-`,limit:1000,cursor});paths.push(...page.blobs.map(b=>b.pathname));cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 }));
 const messages=await Promise.all(paths.map(async p=>{const m=await readJSON(p);if(!m)return null;const receipt=await readJSON(`office/receipts/${m.id}.json`);return {...m,...receipt};}));
 return messages.filter(Boolean).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
}
