import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createViewerToken,verifyViewerToken,viewerAuthorized,validateAccessPair,VIEWER_TOKEN_TTL} from '../lib/access.mjs';
const key='fixture-office-key',personalKey='fixture-personal-key',now=1800000000000;
const request=headers=>new Request('https://example.test/api/activity',{headers});

test('both credentials are required and missing configuration fails closed',()=>{
 assert.equal(validateAccessPair({key,personalKey},key,personalKey),'valid');
 for(const input of [{key},{personalKey},{key:'wrong',personalKey},{key,personalKey:'wrong'},{key:3,personalKey},null])assert.equal(validateAccessPair(input,key,personalKey),'invalid');
 assert.equal(validateAccessPair({key,personalKey},key,undefined),'unconfigured');
 assert.equal(validateAccessPair({key,personalKey},undefined,personalKey),'unconfigured');
 assert.throws(()=>createViewerToken(key,undefined,now));
});
test('each unlock creates a distinct signed capability with a bounded lifetime',()=>{
 const token=createViewerToken(key,personalKey,now),another=createViewerToken(key,personalKey,now);
 assert.notEqual(token,another);
 assert.equal(verifyViewerToken(token,key,personalKey,now),true);
 assert.equal(verifyViewerToken(token,key,personalKey,now+VIEWER_TOKEN_TTL-1),true);
 assert.equal(verifyViewerToken(token,key,personalKey,now+VIEWER_TOKEN_TTL),false);
 assert.equal(verifyViewerToken(token,key,personalKey,now-6000),false);
});
test('altered token contents and signatures cannot authenticate',()=>{
 const token=createViewerToken(key,personalKey,now),parts=token.split('.');
 const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));claims.exp+=VIEWER_TOKEN_TTL;
 const altered=[parts[0],Buffer.from(JSON.stringify(claims)).toString('base64url'),parts[2]].join('.');
 for(const value of [altered,token.slice(0,-1)+(token.endsWith('A')?'B':'A'),'invalid',token+'.extra','x'.repeat(1000),null])assert.equal(verifyViewerToken(value,key,personalKey,now),false);
});
test('rotating either configured credential invalidates old capabilities',()=>{
 const token=createViewerToken(key,personalKey,now);
 assert.equal(verifyViewerToken(token,key+'new',personalKey,now),false);
 assert.equal(verifyViewerToken(token,key,personalKey+'new',now),false);
 assert.equal(verifyViewerToken(token,key,undefined,now),false);
});
test('only an explicit viewer bearer can unlock APIs; legacy cookies and bridge keys cannot',()=>{
 const token=createViewerToken(key,personalKey,now);
 const legacy=createHmac('sha256',key).update('ryan-office-viewer-v1').digest('hex');
 assert.equal(viewerAuthorized(request({Authorization:`Bearer ${token}`}),key,personalKey,now),true);
 for(const headers of [{},{Cookie:`office_session=${legacy}`},{Authorization:'Bearer fixture-bridge-key'},{Authorization:token},{Authorization:`Basic ${token}`}])assert.equal(viewerAuthorized(request(headers),key,personalKey,now),false);
 // A previously issued cookie is ignored even alongside an invalid header.
 assert.equal(viewerAuthorized(request({Cookie:`office_session=${legacy}`,Authorization:'Bearer invalid'}),key,personalKey,now),false);
});
