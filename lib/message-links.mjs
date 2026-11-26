import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const parser=unified().use(remarkParse).use(remarkGfm);

// Strict protocol allowlist. Return the original URL so signed query strings,
// Gmail account selectors, and thread hashes are not rewritten.
export function safeMessageUrl(raw) {
 if(typeof raw!=='string'||!raw||/[\u0000-\u0020\u007f]/.test(raw))return '';
 try {
  const url=new URL(raw);
  if(!['https:','http:','mailto:'].includes(url.protocol)||url.username||url.password)return '';
  if(url.protocol==='mailto:'&&!url.pathname)return '';
  return raw;
 }catch{return '';}
}

export function messageLinkLabel(href) {
 const safe=safeMessageUrl(href);if(!safe)return 'Link';
 const url=new URL(safe);
 if(url.protocol==='mailto:')return url.pathname;
 if(url.hostname==='mail.google.com')return /draft/i.test(url.hash)?'Open Gmail draft':'Open in Gmail';
 if(url.hostname==='docs.google.com')return url.pathname.startsWith('/spreadsheets/')?'Open spreadsheet':url.pathname.startsWith('/document/')?'Open document':'Open in Google Docs';
 if(url.hostname==='drive.google.com')return 'Open in Google Drive';
 if(url.hostname==='calendar.google.com')return 'Open in Google Calendar';
 if(safe.length<=58)return safe;
 return url.hostname.replace(/^www\./,'')+(url.pathname==='/'?'':url.pathname.slice(0,30)+'…');
}

function plainText(node) {
 if(typeof node.value==='string')return node.value;
 return (node.children||[]).map(plainText).join('');
}

export function extractMessageLinks(text) {
 if(typeof text!=='string'||!text)return [];
 const tree=parser.parse(text);const definitions=new Map();
 const collectDefinitions=node=>{if(node.type==='definition')definitions.set(node.identifier,node.url);for(const child of node.children||[])collectDefinitions(child);};
 collectDefinitions(tree);
 const seen=new Set();const links=[];
 const visit=node=>{
  if(node.type==='link'||node.type==='linkReference'){
   const href=safeMessageUrl(node.type==='link'?node.url:definitions.get(node.identifier));
   if(href&&!seen.has(href)){
    const content=plainText(node).trim();
    const label=!content||safeMessageUrl(content)||content===href.replace(/^mailto:/,'')?messageLinkLabel(href):content;
    links.push({label,href});seen.add(href);
   }
  }
  for(const child of node.children||[])visit(child);
 };
 visit(tree);return links;
}
