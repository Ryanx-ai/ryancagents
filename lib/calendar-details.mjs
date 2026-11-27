// Display-only extraction. No DOM, network, commands, or external dependencies:
// the repository publisher can use this module without node_modules.
export const CALENDAR_LINK_LIMIT=8;
const MAX_INPUT=100000;
const controls=/[\u0000-\u001f\u007f-\u009f]/;
const names={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ensp:' ',emsp:' ',thinsp:' ',ndash:'–',mdash:'—',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',bull:'•',middot:'·',copy:'©',reg:'®'};
function decode(value){return value.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|[a-z]+);/gi,(entity,key)=>{
 if(key[0]!=='#')return names[key]??entity;
 const point=parseInt(key.slice(key[1].toLowerCase()==='x'?2:1),key[1].toLowerCase()==='x'?16:10);
 return point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):'�';
});}
const clean=value=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();

export function safeCalendarDetailUrl(value){
 if(typeof value!=='string'||value.length>2000||controls.test(value)||/\\|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value))return null;
 const input=value.trim();if(!/^https:\/\//i.test(input))return null;
 try{const url=new URL(input);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password&&url.href.length<=2000?url.href:null;}catch{return null;}
}

export function normalizeCalendarLinks(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>CALENDAR_LINK_LIMIT)throw new TypeError('Calendar details allow at most 8 links.');
 const links=[],seen=new Set();
 for(const link of value){
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['label','url'].includes(key))||typeof link.label!=='string'||!link.label.trim()||link.label.length>100||controls.test(link.label))throw new TypeError('Calendar link labels must contain 1–100 readable characters.');
  const url=safeCalendarDetailUrl(link.url);if(!url)throw new TypeError('Calendar detail links must be HTTPS without credentials or control characters.');
  const label=clean(link.label);if(!label)throw new TypeError('Calendar link labels must contain readable text.');
  if(!seen.has(url)){seen.add(url);links.push({label,url});}
 }
 return links;
}

function* descriptionTags(input){
 let cursor=0;
 while(cursor<input.length){
  const start=input.indexOf('<',cursor);if(start<0)return;
  if(input.startsWith('<!--',start)){const close=input.indexOf('-->',start+4),end=close<0?input.length:close+3;yield {index:start,end,tag:'',name:null,closing:false};cursor=end;continue;}
  let index=start+1;const closing=input[index]==='/';if(closing)index++;
  const nameStart=index;
  if(!/[a-z]/i.test(input[index]??'')){cursor=start+1;continue;}
  while(index<input.length&&/[a-z0-9:-]/i.test(input[index]))index++;
  const name=input.slice(nameStart,index).toLowerCase();
  if(index<input.length&&!/[\s/>]/.test(input[index])){cursor=start+1;continue;}
  // Each byte is visited once. In particular, an unterminated quoted attribute
  // cannot trigger regex backtracking or repeatedly scan the remaining input.
  let quote=null;
  while(index<input.length){const char=input[index++];if(quote){if(char===quote)quote=null;}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;}
  yield {index:start,end:index,tag:input.slice(start,index),name,closing};cursor=index;
 }
}
function readableDescription(description){
 const input=typeof description==='string'?description.slice(0,MAX_INPUT):'';
 const links=[],parts=[];let cursor=0,blocked=null,anchor=null;
 // Recognize tags with quoted > characters; script/style raw text is discarded
 // until its matching close, including an unterminated block. Output is text,
 // never sanitized HTML and must never be passed to dangerouslySetInnerHTML.
 const append=text=>{if(blocked)return;const decoded=decode(text);parts.push(decoded);if(anchor)anchor.text+=decoded;};
 const finishAnchor=()=>{if(anchor){links.push({url:anchor.url,label:clean(anchor.text)});anchor=null;}};
 for(const match of descriptionTags(input)){
  append(input.slice(cursor,match.index));cursor=match.end;
  const {tag,name,closing}=match;
  if(blocked){if(closing&&name===blocked)blocked=null;continue;}
  if(!name)continue;
  if(['script','style','iframe','object','template','svg'].includes(name)&&!closing){blocked=name;continue;}
  if(name==='a'){
   finishAnchor();
   if(!closing){
    const attributes=tag.slice(1+name.length,-1);
    for(const attribute of attributes.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))if(attribute[1].toLowerCase()==='href'){
     anchor={url:decode(attribute[2]??attribute[3]??attribute[4]??''),text:''};break;
    }
   }
  }
  if(['br','p','div','li','ul','ol','h1','h2','h3','h4','tr','blockquote','hr'].includes(name))append('\n');
 }
 append(input.slice(cursor));finishAnchor();return {body:clean(parts.join('')),links};
}
function trimUrlPunctuation(value){
 let result=value.replace(/[.,;:!?]+$/g,'');
 for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
  let excess=0,end=result.length;for(const char of result){if(char===close)excess++;else if(char===open)excess--;}
  while(excess>0&&end>0&&result[end-1]===close){end--;excess--;}
  result=result.slice(0,end);
 }
 return result;
}

export function extractCalendarDetails(event){
 const source=event&&typeof event==='object'&&!Array.isArray(event)?event:{};
 const description=readableDescription(source.description),links=[],seen=new Set();
 const add=(value,label='')=>{const url=safeCalendarDetailUrl(value);if(!url||seen.has(url)||links.length>=CALENDAR_LINK_LIMIT)return;seen.add(url);const host=new URL(url).hostname;links.push({label:clean(label).slice(0,100)||(host==='meet.google.com'?'Google Meet':host),url});};
 for(const link of description.links)add(link.url,link.label);
 for(const match of description.body.matchAll(/https:\/\/[^\s<>"'\u201c\u201d]+/gi)){
  if(links.length>=CALENDAR_LINK_LIMIT)break;
  if(match[0].length>2000)continue;
  // Preserve a short literal label immediately before the URL, on this line or
  // the previous line. Do not infer a join action from a booking/cancel URL.
  const before=description.body.slice(Math.max(0,match.index-205),match.index),lines=before.split('\n'),inline=lines.at(-1).trim(),previous=inline||lines.at(-2)?.trim()||'';
  const label=previous.length<=100&&/[:：]\s*-?\s*$/.test(previous)&&!previous.includes('https://')?previous.replace(/[:：]\s*-?\s*$/,'').trim():'';
  add(trimUrlPunctuation(match[0]),label);
 }
 // Location is projected only when the entire field is a valid HTTPS URL.
 add(source.location);
 add(source.hangout_link);add(source.hangoutLink);
 if(Array.isArray(source.conferenceData?.entryPoints))for(const entry of source.conferenceData.entryPoints.slice(0,32)){
  if(entry&&['video','more'].includes(entry.entryPointType))add(entry.uri);
 }
 return {body:description.body.slice(0,2000),links};
}
