// One-time, explicit import. Run after stopping the old bridge and deploying the
// new API, with BLOB_READ_WRITE_TOKEN in the environment. Old blobs are preserved.
import {get,put,list} from '@vercel/blob';
import {OFFICE_STATE_PATH,newOfficeState,checkedState} from '../lib/office-store.mjs';
import {completionKey} from '../lib/completions.mjs';
async function read(name){const result=await get(name,{access:'private',useCache:false});return result?.statusCode===200?new Response(result.stream).json():null;}
async function paths(prefix){const result=[];let cursor;do{const page=await list({prefix,limit:1000,cursor});result.push(...page.blobs.map(b=>b.pathname));cursor=page.hasMore?page.cursor:undefined;}while(cursor);return result;}
try{
 const existing=await read(OFFICE_STATE_PATH);
 if(existing){checkedState(existing);console.log(JSON.stringify({status:'already-migrated',messages:existing.messages.length,reviews:Object.keys(existing.completed).length}));process.exit(0);}
 const dates=Array.from({length:7},(_,day)=>new Date(Date.now()-day*86400000).toISOString().slice(0,10).replaceAll('-',''));
 const messagePaths=(await Promise.all(dates.map(date=>paths(`office/messages/${date}-`)))).flat();
 // Limit requests during migration; this is deliberately outside routine APIs.
 const messages=[];
 for(const pathname of messagePaths){const message=await read(pathname);if(!message)continue;const receipt=await read(`office/receipts/${message.id}.json`);messages.push({...message,...receipt});}
 messages.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const completed={};
 for(const pathname of await paths('office/completion-reviews/')){
  const match=/^office\/completion-reviews\/((?:scheduler|outreach|contacts|manager|designer)-\d+)\.json$/.exec(pathname);if(match)completed[match[1]]=true;
 }
 for(const id of ['scheduler','outreach','contacts','manager','designer']){const legacy=await read(`office/reviews/${id}.json`);const key=completionKey(id,legacy?.completedAt);if(key)completed[key]=true;}
 const state=newOfficeState(messages,completed);
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'dry-run',messages:messages.length,reviews:Object.keys(completed).length,next:'Stop the old bridge, deploy the new API, then rerun with --apply.'}));process.exit(0);}
 await put(OFFICE_STATE_PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60});
 const verified=checkedState(await read(OFFICE_STATE_PATH));
 if(verified.revision!==state.revision)throw new Error('Migration verification failed');
 console.log(JSON.stringify({status:'migrated',messages:verified.messages.length,reviews:Object.keys(verified.completed).length,legacyObjects:'preserved'}));
}catch(error){console.error(`Storage migration failed (${error.name||'Error'}). No legacy objects were deleted.`);process.exitCode=1;}
