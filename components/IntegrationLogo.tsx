/** Service identity only: a logo does not assert an authenticated connection.
 * Shared by workflow steps and dashboard shortcuts. All assets are local.
 * Names: gmail, calendar, contacts, sheets, gohighlevel, codex, studio.
 */
export type IntegrationName='gmail'|'calendar'|'contacts'|'sheets'|'gohighlevel'|'codex'|'studio';
export const integrationMeta:Record<IntegrationName,{label:string;href:string;src:string}>={
 gmail:{label:'Gmail',href:'https://mail.google.com/',src:'/assets/integrations/gmail.svg'},
 calendar:{label:'Google Calendar',href:'https://calendar.google.com/',src:'/assets/integrations/calendar.svg'},
 contacts:{label:'Google Contacts',href:'https://contacts.google.com/',src:'/assets/integrations/contacts.png'},
 sheets:{label:'Google Sheets',href:'https://sheets.google.com/',src:'/assets/integrations/sheets.svg'},
 gohighlevel:{label:'GoHighLevel',href:'https://app.gohighlevel.com/',src:'/assets/integrations/gohighlevel.png'},
 studio:{label:'Proposal Studio · this Mac',href:'http://127.0.0.1:4174',src:'/assets/integrations/proposal-studio.svg'},
 codex:{label:'Codex',href:'https://chatgpt.com/codex',src:'/assets/integrations/codex.svg'},
};
export default function IntegrationLogo({name,size=22,className='',decorative=false}:{name:IntegrationName;size?:number;className?:string;decorative?:boolean}){
 const service=integrationMeta[name];
 return <img className={`integration-logo ${className}`} src={service.src} width={size} height={size} alt={decorative?'':service.label} aria-hidden={decorative||undefined} draggable={false} style={{width:size,height:size,objectFit:'contain',display:'block',flexShrink:0}}/>;
}
