'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {BoardResponse,BoardNote,BoardNoteDraft,BoardUpdate} from '../lib/board.mjs';

type Request=(url:string,init?:RequestInit)=>Promise<Response>;
export function useBlackboard(session:string|null,day:string,request:Request,open=false){
 const [data,setData]=useState<BoardResponse|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 const [busyIds,setBusyIds]=useState<ReadonlySet<string>>(new Set());
 const active=useRef(session),activeDay=useRef(day),refreshCurrent=useRef<()=>Promise<void>>(async()=>{}),etag=useRef(''),sequence=useRef(0),lastRead=useRef(0),busy=useRef(new Set<string>());
 active.current=session;activeDay.current=day;
 const refresh=useCallback(async(force=true)=>{
  if(!session||active.current!==session||!day)return;
  if(!force&&performance.now()-lastRead.current<10000)return;
  lastRead.current=performance.now();const run=++sequence.current;setLoading(true);
  try{
   const response=await request(`/api/board?day=${encodeURIComponent(day)}`,{cache:'no-store',headers:etag.current?{'If-None-Match':etag.current}:{}});
   const body=response.status===304?null:await response.json();
   if(active.current!==session||run!==sequence.current)return;
   if(response.status!==304){if(!response.ok)throw new Error(body?.error||'The board could not be loaded. Try again.');if(body?.version!==1||body?.day!==day||!Array.isArray(body.notes))throw new Error('The board returned an unreadable response. Try again.');setData(body);etag.current=response.headers.get('etag')||'';}
   setError(null);
  }catch(cause){if(active.current===session&&run===sequence.current)setError(cause instanceof Error?cause.message:'The board could not be loaded.');}
  finally{if(active.current===session&&run===sequence.current)setLoading(false);}
 },[session,day,request]);
 refreshCurrent.current=refresh;
 useEffect(()=>{
  sequence.current++;etag.current='';lastRead.current=0;busy.current.clear();setBusyIds(new Set());setData(null);setError(null);setLoading(false);
  if(!session)return;
  void refresh();const visible=()=>{if(!document.hidden)void refresh(false);};
  document.addEventListener('visibilitychange',visible);return()=>{document.removeEventListener('visibilitychange',visible);sequence.current++;};
 },[session,day,refresh]);
 useEffect(()=>{
  if(!session||!open)return;
  let stopped=false,timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{clearTimeout(timer);if(!stopped&&!document.hidden)timer=setTimeout(tick,120000);};
  const tick=async()=>{if(stopped||document.hidden)return;try{await refresh(false);}finally{schedule();}};
  const visible=()=>{if(document.hidden)clearTimeout(timer);else schedule();};
  schedule();document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[session,open,refresh]);
 async function mutate(method:'POST'|'PATCH',input:BoardNoteDraft|BoardUpdate):Promise<BoardNote>{
  if(!session||active.current!==session)throw new Error('Unlock the office first.');
  if(busy.current.has(input.id))throw new Error('This note is still saving.');
  busy.current.add(input.id);setBusyIds(new Set(busy.current));sequence.current++;setLoading(false);
  try{
   const response=await request('/api/board',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const body=await response.json();if(active.current!==session)throw new Error('The office was locked.');
   if(!response.ok){const failure=Object.assign(new Error(body?.error||'The note could not be saved.'),{status:response.status,code:body?.code,current:body?.current});throw failure;}
   if(!body?.note?.id)throw new Error('The save receipt could not be read. Refresh before retrying.');
   etag.current='';
   // A save can finish across SGT midnight. Reload the active day instead of
   // cancelling its read and leaving the newly cleared board empty.
   if(activeDay.current!==day){void refreshCurrent.current();return body.note;}
   sequence.current++;setLoading(false);setError(null);
   setData(current=>current?{...current,notes:[...current.notes.filter(note=>note.id!==body.note.id),body.note]}:current);
   return body.note;
  }finally{if(active.current===session){busy.current.delete(input.id);setBusyIds(new Set(busy.current));}}
 }
 return {data,loading,error,busyIds,refresh,create:(input:BoardNoteDraft)=>mutate('POST',input),update:(input:BoardUpdate)=>mutate('PATCH',input)};
}
