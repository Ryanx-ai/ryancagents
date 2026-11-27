import type {IntegrationName} from '../components/IntegrationLogo';

export type ManagerResource={id:string;label:string;href:string;icon:IntegrationName|'calculator'|'quotations';local?:boolean};
export const MANAGER_RESOURCES:readonly ManagerResource[]=[
 {id:'email',label:'Email',href:'https://mail.google.com/mail/u/0/#inbox/QgrcJHsTfQgVhPpLPrVHnRZDGDtCSPZpqWl',icon:'gmail'},
 {id:'calendar',label:'Work Calendar',href:'https://calendar.google.com/calendar/u/0/r?authuser=ryanchin%40verticalinstitute.com',icon:'calendar'},
 {id:'grant-calculator',label:'Grant Calculator',href:'https://grantcalc.vercel.app/?course=training&subsidy=70&local=21&foreign=0',icon:'calculator'},
 {id:'contact-map',label:'Contact Map',href:'https://docs.google.com/spreadsheets/d/18EkrmHEdCp-XMJt1r2Xp1POWAYsJYluzNaJY9brhWnM/edit?gid=0#gid=0',icon:'sheets'},
 {id:'vi-ghl',label:'VI GHL',href:'https://app.gohighlevel.com/v2/location/pHGrcS9BRPcsy9XTmUU2/calendars/appointments',icon:'gohighlevel'},
 {id:'pipeline',label:'Pipeline Tracker',href:'https://docs.google.com/spreadsheets/d/15gRttxWhiurKiWVgOF0Ar4FYNt1fi3GSbiclGh4Ik9c/edit?gid=367418877#gid=367418877',icon:'sheets'},
 {id:'proposal-studio',label:'Proposal Studio',href:'http://127.0.0.1:4174',icon:'studio',local:true},
 {id:'quotations',label:'VI Dashboard — Quotations',href:'https://elearn.verticalinstitute.com/sales/b2b',icon:'quotations'},
];
export const PROPOSAL_STUDIO_LAUNCHER='/Users/ryanc/Documents/ChatGPT/Vertical Institute/proposal-editor/Start Proposal Editor.command';
