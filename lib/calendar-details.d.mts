export type CalendarDetailLink={label:string;url:string};
export const CALENDAR_LINK_LIMIT:number;
export function safeCalendarDetailUrl(value:unknown):string|null;
export function normalizeCalendarLinks(value:unknown):CalendarDetailLink[];
export function extractCalendarDetails(event:unknown):{body:string;links:CalendarDetailLink[]};
