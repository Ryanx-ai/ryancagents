'use client';
import {useEffect,useState} from 'react';
import {recolorSprite,recolorSpriteFrame,SPRITE_SHEETS,type SpriteKind} from '../lib/sprite-colors.mjs';
import type {Palette} from '../lib/wardrobe.mjs';

type RyanSheet={url:string;cropped:boolean};
const sources=new Map<SpriteKind,Promise<ImageData>>();
// Static portraits have their own small cache; they never retain a colored atlas.
// Data URLs remain valid for mounted sprites after their cache entry is evicted.
const sheets=new Map<string,Promise<string>>();
const thumbnails=new Map<string,Promise<string>>();
function source(kind:SpriteKind){
 let pending=sources.get(kind);
 if(!pending){pending=new Promise<ImageData>((resolve,reject)=>{
  const image=new Image();image.onload=()=>{
   const canvas=document.createElement('canvas');
   try{canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable');ctx.drawImage(image,0,0);resolve(ctx.getImageData(0,0,canvas.width,canvas.height));}
   catch(error){reject(error);}finally{canvas.width=0;canvas.height=0;}
  };
  image.onerror=()=>reject(new Error('Ryan sprite unavailable'));image.src=SPRITE_SHEETS[kind];
 });sources.set(kind,pending);pending.catch(()=>{if(sources.get(kind)===pending)sources.delete(kind);});}
 return pending;
}
async function colorSheet(kind:SpriteKind,palette:Palette,key:string,still:boolean,row:number){
 const cache=still?thumbnails:sheets;
 let pending=cache.get(key);if(pending)return pending;
 pending=(async()=>{
  const original=await source(kind);const canvas=document.createElement('canvas');
  try{
   canvas.width=still?192:original.width;canvas.height=still?208:original.height;
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
   const frame=ctx.createImageData(canvas.width,canvas.height);
   frame.data.set(still?recolorSpriteFrame(original.data,original.width,original.height,kind,palette,row):recolorSprite(original.data,original.width,original.height,kind,palette));
   ctx.putImageData(frame,0,0);return canvas.toDataURL('image/png');
  }finally{canvas.width=0;canvas.height=0;}
 })();
 cache.set(key,pending);if(cache.size>(still?64:24))cache.delete(cache.keys().next().value!);
 pending.catch(()=>{if(cache.get(key)===pending)cache.delete(key);});return pending;
}
export function useRyanSheet(kind:SpriteKind,palette?:Palette|null,still=false,row=0):RyanSheet{
 const jacket=palette?.jacket,shirt=palette?.shirt,pants=palette?.pants;
 const frameRow=still?row:0;
 const key=jacket&&shirt&&pants?`${kind}:${still?`frame-${frameRow}`:'atlas'}:${jacket}:${shirt}:${pants}`:'';
 const [rendered,setRendered]=useState<{key:string;url:string}|null>(null);
 useEffect(()=>{
  if(!key||!jacket||!shirt||!pants)return;
  let cancelled=false;const timer=setTimeout(()=>{void colorSheet(kind,{jacket,shirt,pants},key,still,frameRow).then(url=>{if(!cancelled)setRendered({key,url});}).catch(()=>{if(!cancelled)setRendered(null);});},75);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[kind,key,jacket,shirt,pants,still,frameRow]);
 return rendered?.key===key?{url:rendered.url,cropped:still}:{url:SPRITE_SHEETS[kind],cropped:false};
}
