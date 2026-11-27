export function parseHeartbeatMessage(text:unknown):{decision:'NOTIFY'|'DONT_NOTIFY';message:string}|null;
export function normalizeMessageText(text:unknown):string;
export function remarkLiteralHtml(): (node:any)=>void;
