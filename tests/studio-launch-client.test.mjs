import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_URL,STUDIO_LAUNCH_URL,isMacDeviceHint,launchProposalStudio,createStudioLaunchController} from '../lib/studio-launch-client.mjs';

const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
function fixtures({localBody={receipt:'signed-receipt'},verifyBody={status:'ready',url:STUDIO_URL},open=true,navigate=true}={}){
 const calls=[],windows=[],changes=[];
 const request=async(url,init)=>{const body=JSON.parse(init.body);calls.push({kind:body.action,url,init,body});return response(body.action==='ticket'?{ticket:'short-lived-ticket'}:verifyBody);};
 const localFetch=async(url,init)=>{calls.push({kind:'local',url,init});return response(localBody);};
 const openWindow=()=>{calls.push({kind:'window'});if(!open)return null;const window={closes:0,urls:[],navigate(url){this.urls.push(url);return navigate;},close(){this.closes++;}};windows.push(window);return window;};
 return {calls,windows,changes,request,localFetch,openWindow,onChange:state=>changes.push(state)};
}

test('device detection is only a conservative Mac hint and excludes masquerading iPads',()=>{
 assert.equal(isMacDeviceHint({platform:'MacIntel',userAgent:'Macintosh',maxTouchPoints:0}),true);
 assert.equal(isMacDeviceHint({platform:'MacIntel',userAgent:'Macintosh',maxTouchPoints:5}),false);
 for(const device of [{platform:'Win32',userAgent:'Windows'},{platform:'Linux',userAgent:'Linux'},{platform:'iPhone',userAgent:'iPhone'},{platform:'',userAgent:'Android'}])assert.equal(isMacDeviceHint(device),false);
});

test('no request or window opens before click, and other devices never probe loopback',async()=>{
 const h=fixtures(),controller=createStudioLaunchController(h);assert.deepEqual(h.calls,[]);
 await controller.start({isMac:false});assert.deepEqual(h.calls,[]);
 assert.equal(controller.getState().reason,'other-device');controller.dispose();
});

test('launch uses scoped ticket, fixed loopback endpoint and HQ receipt verification before navigation',async()=>{
 const h=fixtures(),controller=createStudioLaunchController(h);await controller.start({isMac:true});
 assert.deepEqual(h.calls.map(call=>call.kind),['window','ticket','local','verify']);
 const local=h.calls.find(call=>call.kind==='local');assert.equal(local.url,STUDIO_LAUNCH_URL);
 assert.equal(local.init.headers.Authorization,'Bearer short-lived-ticket');assert.equal(local.init.body,'{}');
 assert.equal(local.init.credentials,'omit');assert.equal(local.init.redirect,'error');assert.equal(local.init.mode,'cors');assert.equal(local.init.targetAddressSpace,'loopback');assert.ok(local.init.signal instanceof AbortSignal);
 const verify=h.calls.find(call=>call.kind==='verify');assert.equal(verify.url,'/api/studio');assert.deepEqual(verify.body,{action:'verify',ticket:'short-lived-ticket',receipt:'signed-receipt'});
 assert.deepEqual(h.windows[0].urls,[STUDIO_URL]);assert.equal(h.windows[0].closes,0);
 assert.equal(controller.getState().phase,'ready');assert.equal(controller.getState().opened,true);
 controller.dispose();assert.equal(h.windows[0].closes,0,'opened Studio belongs to the user');
});

test('HTTP 200 from loopback without a receipt cannot claim readiness or open Studio',async()=>{
 const h=fixtures({localBody:{status:'ready',url:STUDIO_URL}}),controller=createStudioLaunchController(h);
 await controller.start({isMac:true});assert.equal(controller.getState().reason,'verification-failed');
 assert.equal(h.calls.some(call=>call.kind==='verify'),false);assert.deepEqual(h.windows[0].urls,[]);assert.equal(h.windows[0].closes,1);
});

test('unverified or arbitrary ready URLs and unknown reason text are never trusted',async()=>{
 for(const verifyBody of [{status:'ready',url:'https://example.com/private'},{status:'ready',url:STUDIO_URL+'/?ticket=secret'},{status:'ready'},{status:'unavailable',reason:'private-error-detail'}]){
  const h=fixtures({verifyBody}),controller=createStudioLaunchController(h);await controller.start({isMac:true});
  assert.equal(controller.getState().phase,'unavailable');assert.notEqual(controller.getState().reason,'private-error-detail');assert.deepEqual(h.windows[0].urls,[]);assert.equal(h.windows[0].closes,1);
 }
 const h=fixtures({verifyBody:{status:'unavailable',reason:'not-installed'}}),controller=createStudioLaunchController(h);await controller.start({isMac:true});assert.equal(controller.getState().reason,'not-installed');
});

test('a blocked or closed popup retains verified readiness for the explicit manual link',async()=>{
 for(const options of [{open:false},{navigate:false}]){
  const h=fixtures(options),controller=createStudioLaunchController(h);await controller.start({isMac:true});
  assert.equal(controller.getState().phase,'ready');assert.equal(controller.getState().opened,false);
  if(h.windows[0])assert.equal(h.windows[0].closes,1);
 }
});

test('primary Open after ready performs a new ticket, local launch and verification',async()=>{
 const h=fixtures(),controller=createStudioLaunchController(h);await controller.start({isMac:true});await controller.start({isMac:true});
 assert.deepEqual(h.calls.map(call=>call.kind),['window','ticket','local','verify','window','ticket','local','verify']);
 assert.equal(h.windows.length,2);assert.ok(h.windows.every(window=>window.urls[0]===STUDIO_URL));
});

test('duplicate click is ignored and cancel during ticket issue prevents all later local action',async()=>{
 const h=fixtures(),ticket=deferred();h.request=async()=>ticket.promise;
 const controller=createStudioLaunchController(h),running=controller.start({isMac:true});
 await controller.start({isMac:true});assert.equal(h.windows.length,1);
 controller.cancel();await running;ticket.resolve(response({ticket:'late-ticket'}));await flush();
 assert.equal(h.calls.some(call=>call.kind==='local'),false);assert.equal(h.windows[0].closes,1);assert.equal(controller.getState().phase,'idle');
});

test('unmount during local launch discards late receipt without verification or navigation',async()=>{
 const h=fixtures(),local=deferred(),entered=deferred();h.localFetch=async()=>{entered.resolve();return local.promise;};
 const controller=createStudioLaunchController(h),running=controller.start({isMac:true});await entered.promise;
 controller.dispose();const changes=h.changes.length;await running;local.resolve(response({receipt:'late-receipt'}));await flush();
 assert.equal(h.changes.length,changes);assert.equal(h.calls.some(call=>call.kind==='verify'),false);assert.deepEqual(h.windows[0].urls,[]);assert.equal(h.windows[0].closes,1);
});

test('cancel while HQ verifies cannot navigate even when a ready response arrives later',async()=>{
 const h=fixtures(),verify=deferred(),entered=deferred(),original=h.request;
 h.request=async(url,init)=>{if(JSON.parse(init.body).action==='verify'){entered.resolve();return verify.promise;}return original(url,init);};
 const controller=createStudioLaunchController(h),running=controller.start({isMac:true});await entered.promise;
 controller.cancel();await running;verify.resolve(response({status:'ready',url:STUDIO_URL}));await flush();
 assert.deepEqual(h.windows[0].urls,[]);assert.equal(h.windows[0].closes,1);assert.equal(controller.getState().phase,'idle');
});

test('bounded local timeout does not retry or verify an unresolved launch',async()=>{
 const h=fixtures();h.localFetch=()=>new Promise(()=>{});
 const result=await launchProposalStudio({...h,timeoutMs:5});assert.deepEqual(result,{status:'unavailable',reason:'timeout'});
 assert.equal(h.calls.some(call=>call.kind==='verify'),false);
});

test('invalid tickets fail before localhost and authorization failures remain fixed messages',async()=>{
 for(const ticket of ['',null,'x'.repeat(16385)]){
  const h=fixtures();h.request=async()=>response({ticket});
  const result=await launchProposalStudio(h);assert.equal(result.reason,'authorization');assert.equal(h.calls.length,0);
 }
 const h=fixtures();h.request=async()=>response({error:'private detail'},403);
 assert.deepEqual(await launchProposalStudio(h),{status:'unavailable',reason:'authorization'});
});
