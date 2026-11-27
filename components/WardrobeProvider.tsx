'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {WARDROBE_KEY,readWardrobePreferences,resetWardrobePreference,saveWardrobePreference,type Palette,type WardrobePreferences} from '../lib/wardrobe.mjs';

type Actions={setPalette:(agentId:string,palette:Palette)=>boolean;resetPalette:(agentId:string)=>boolean;error:string|null;ready:boolean};
const PaletteContext=createContext<WardrobePreferences>({});
const ActionsContext=createContext<Actions>({setPalette:()=>false,resetPalette:()=>false,error:'The wardrobe is unavailable.',ready:false});

export function WardrobeProvider({children}:{children:ReactNode}){
 const [palettes,setPalettes]=useState<WardrobePreferences>({});
 const [error,setError]=useState<string|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{
  const sync=()=>{const saved=readWardrobePreferences();if(!saved.error)setPalettes(saved.palettes);setError(saved.error);setReady(true);};
  const onStorage=(event:StorageEvent)=>{if(event.key===WARDROBE_KEY||event.key===null)sync();};
  sync();window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
 },[]);
 const setPalette=useCallback((agentId:string,palette:Palette)=>{
  try{const next=saveWardrobePreference(agentId,palette);setPalettes(next);setError(null);return true;}
  catch(e){setError(e instanceof Error?e.message:'Clothing colors could not be saved.');return false;}
 },[]);
 const resetPalette=useCallback((agentId:string)=>{
  try{const next=resetWardrobePreference(agentId);setPalettes(next);setError(null);return true;}
  catch(e){setError(e instanceof Error?e.message:'Original colors could not be restored.');return false;}
 },[]);
 const actions=useMemo(()=>({setPalette,resetPalette,error,ready}),[setPalette,resetPalette,error,ready]);
 return <ActionsContext value={actions}><PaletteContext value={palettes}>{children}</PaletteContext></ActionsContext>;
}

export function useWardrobe(agentId?:string):Palette|undefined{
 const palettes=useContext(PaletteContext);
 return agentId&&Object.hasOwn(palettes,agentId)?palettes[agentId as keyof WardrobePreferences]:undefined;
}
export function useWardrobeActions(){return useContext(ActionsContext);}
export default WardrobeProvider;
