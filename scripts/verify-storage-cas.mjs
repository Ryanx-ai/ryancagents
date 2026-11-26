// Isolated provider contract check. Never touches the office state or queue.
import {get,put,del,BlobPreconditionFailedError} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
const name=`office/verification/${randomUUID()}.json`;
const options={access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60};
// Large enough to exercise CDN compression and its weak HTTP validators.
const body=value=>JSON.stringify({value,padding:'synthetic fixture data only '.repeat(800)});
let created=false;
try{
 await put(name,body(0),{...options,allowOverwrite:false});created=true;
 const original=await get(name,{access:'private',useCache:false});if(original?.statusCode!==200)throw new Error('Fixture could not be read');
 await new Response(original.stream).json();
 const unchanged=await get(name,{access:'private',useCache:false,ifNoneMatch:original.blob.etag});
 if(unchanged?.statusCode!==304||unchanged.stream!==null)throw new Error('Conditional read downloaded unchanged content');
 const identity=await get(name,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
 if(identity?.statusCode!==200||!identity.blob.etag||identity.blob.etag.startsWith('W/'))throw new Error('Strong mutation validator unavailable');
 await new Response(identity.stream).json();
 const results=await Promise.allSettled([1,2].map(value=>put(name,body(value),{...options,allowOverwrite:true,ifMatch:identity.blob.etag})));
 const wins=results.filter(result=>result.status==='fulfilled');const conflicts=results.filter(result=>result.status==='rejected'&&result.reason instanceof BlobPreconditionFailedError);
 if(wins.length!==1||conflicts.length!==1)throw new Error('Conditional-write concurrency contract failed');
 const stored=await get(name,{access:'private',useCache:false});if(stored?.statusCode!==200)throw new Error('Committed fixture unavailable');
 const value=await new Response(stored.stream).json();if(![1,2].includes(value.value))throw new Error('Committed fixture invalid');
 console.log(JSON.stringify({ok:true,concurrentWrites:2,commits:1,conflicts:1,conditionalRead:304,fixtureBytes:Buffer.byteLength(body(0)),compressedReadWeak:original.blob.etag.startsWith('W/'),strongMutationValidator:true,officeQueueTouched:false}));
}catch(error){console.error(`Storage concurrency check failed (${error.name||'Error'}).`);process.exitCode=1;}
finally{if(created)try{await del(name);}catch{console.error('Fixture cleanup failed. The isolated office/verification object can be deleted later.');process.exitCode=1;}}
