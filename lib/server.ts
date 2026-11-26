import {matchesSecret,viewerAuthorized} from './access.mjs';
import {checkBotId} from 'botid/server';
import {NextResponse} from 'next/server';
export const matches=matchesSecret;
export function authorized(req:Request) {return viewerAuthorized(req,process.env.OFFICE_ACCESS_KEY,process.env.OFFICE_PERSONAL_KEY);}
export function sameOrigin(req:Request) {try {const origin=new URL(req.headers.get('origin')||'');return origin.host===req.headers.get('host')&&(process.env.NODE_ENV!=='production'||origin.protocol==='https:');}catch{return false;}}
export function bridgeAuthorized(req:Request) {return matches(req.headers.get('authorization')?.replace(/^Bearer /,'')||'',process.env.OFFICE_BRIDGE_KEY);}
export async function botCheckResponse() {
 const headers={'Cache-Control':'private, no-store'};
 try {
  const verification=await checkBotId({advancedOptions:{checkLevel:'basic'}});
  if(verification.isBot||!verification.isHuman||verification.isVerifiedBot)return NextResponse.json({error:'Browser verification failed. Refresh and try again.'},{status:403,headers});
  return null;
 }catch{return NextResponse.json({error:'Browser verification is unavailable. Try again shortly.'},{status:503,headers});}
}
