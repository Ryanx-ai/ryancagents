function decodeXmlText(value){
 const cdata=/^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(value.trim());
 if(cdata)return cdata[1].trim();
 const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
 return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(entity,key)=>{
  if(key[0]!=='#')return named[key.toLowerCase()]||entity;
  const point=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
  return point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):entity;
 }).trim();
}

// Codex automations may finish with this data envelope instead of plain prose.
// Parse only its known fields; this is not an XML/HTML or instruction evaluator.
export function parseHeartbeatMessage(text){
 if(typeof text!=='string')return null;
 const outer=/^\s*<heartbeat>\s*([\s\S]*?)\s*<\/heartbeat>\s*$/.exec(text);
 if(!outer)return null;
 const fields=new Map();let duplicate=false;
 const remainder=outer[1].replace(/<(automation_id|decision|message)>([\s\S]*?)<\/\1>/g,(_,name,value)=>{
  if(fields.has(name))duplicate=true;fields.set(name,value);return '';
 });
 if(duplicate||remainder.trim()||fields.size!==3||!fields.get('automation_id').trim())return null;
 const decision=fields.get('decision').trim();
 if(decision!=='NOTIFY'&&decision!=='DONT_NOTIFY')return null;
 return {decision,message:decodeXmlText(fields.get('message'))};
}

export function normalizeMessageText(text){
 if(typeof text!=='string')return '';
 const normalized=parseHeartbeatMessage(text)?.message??text;
 return normalized.replace(/[\s\u200b-\u200d\ufeff]/g,'')?normalized:'';
}

// Unknown raw HTML/XML remains escaped, visible text, rather than disappearing
// under skipHtml. Markdown still works; scripts, images and directives never run.
export function remarkLiteralHtml(){
 return function visit(node){
  if(node.type==='html')node.type='text';
  for(const child of node.children||[])visit(child);
 };
}
