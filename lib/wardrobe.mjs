export const WARDROBE_KEY='ryan-wardrobe-v1';
export const WARDROBE_AGENT_IDS=Object.freeze(['scheduler','outreach','contacts','manager','designer','proposal']);
export const CLOTHING_PARTS=Object.freeze(['jacket','shirt','pants']);
export const DEFAULT_PALETTES=Object.freeze({
 standard:Object.freeze({jacket:'#b8b6b9',shirt:'#424347',pants:'#656469'}),
 manager:Object.freeze({jacket:'#29292c',shirt:'#f0ece4',pants:'#303034'}),
 designer:Object.freeze({jacket:'#946b45',shirt:'#e8dfc9',pants:'#42414a'}),
});
export const COLOR_PRESETS=Object.freeze({
 jacket:Object.freeze([{name:'Navy',color:'#465575'},{name:'Forest',color:'#4b6b59'},{name:'Clay',color:'#94664f'},{name:'Plum',color:'#6f5b79'},{name:'Slate',color:'#667984'},{name:'Black',color:'#25272d'}]),
 shirt:Object.freeze([{name:'Ivory',color:'#eee7d6'},{name:'White',color:'#faf7f0'},{name:'Sand',color:'#d0bc98'},{name:'Sage',color:'#9bac92'},{name:'Blue',color:'#93aabd'},{name:'Blush',color:'#c7978c'}]),
 pants:Object.freeze([{name:'Charcoal',color:'#303741'},{name:'Navy',color:'#35485b'},{name:'Denim',color:'#536f8c'},{name:'Brown',color:'#625247'},{name:'Olive',color:'#62674d'},{name:'Stone',color:'#969387'}]),
});
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hex=/^#[\da-f]{6}$/i;
export function normalizePalette(value){
 if(!record(value)||Object.keys(value).length!==3||Object.keys(value).some(key=>!CLOTHING_PARTS.includes(key))||CLOTHING_PARTS.some(key=>typeof value[key]!=='string'||!hex.test(value[key])))return null;
 return {jacket:value.jacket.toLowerCase(),shirt:value.shirt.toLowerCase(),pants:value.pants.toLowerCase()};
}
export function validatePalette(value){const palette=normalizePalette(value);if(!palette)throw new Error('Choose a six-digit hex color for the jacket, shirt and trousers.');return palette;}
export function wardrobeOutfit(agentId){return agentId==='manager'?'manager':agentId==='designer'?'designer':'standard';}
export function defaultPalette(outfit='standard'){return {...DEFAULT_PALETTES[Object.hasOwn(DEFAULT_PALETTES,outfit)?outfit:'standard']};}
export function palettesEqual(a,b){const left=normalizePalette(a),right=normalizePalette(b);return !!left&&!!right&&CLOTHING_PARTS.every(part=>left[part]===right[part]);}
function agentIdOrThrow(agentId){if(!WARDROBE_AGENT_IDS.includes(agentId))throw new Error('This agent does not have a wardrobe.');return agentId;}
function storageOrThrow(storage){if(storage)return storage;try{if(globalThis.localStorage)return globalThis.localStorage;}catch{}throw new Error('Browser storage is unavailable.');}
export function readWardrobePreferences(storage){
 try{
  const raw=storageOrThrow(storage).getItem(WARDROBE_KEY);if(raw===null)return {palettes:{},error:null};
  if(typeof raw!=='string'||raw.length>8192)throw new Error();
  const value=JSON.parse(raw);
  if(!record(value)||value.version!==1||Object.keys(value).some(key=>!['version','agents'].includes(key))||!record(value.agents)||Object.keys(value.agents).length>WARDROBE_AGENT_IDS.length)throw new Error();
  const palettes={};
  for(const [agentId,palette] of Object.entries(value.agents))palettes[agentIdOrThrow(agentId)]=validatePalette(palette);
  return {palettes,error:null};
 }catch{return {palettes:{},error:'Saved clothing colors could not be read. Existing preferences were kept.'};}
}
function writePreferences(palettes,storage){
 try{storageOrThrow(storage).setItem(WARDROBE_KEY,JSON.stringify({version:1,agents:palettes}));}
 catch{throw new Error('Clothing colors could not be saved in this browser. Previous preferences were kept.');}
 return palettes;
}
export function saveWardrobePreference(agentId,value,storage){
 agentIdOrThrow(agentId);const palette=validatePalette(value),current=readWardrobePreferences(storage);
 if(current.error)throw new Error(current.error);
 return writePreferences({...current.palettes,[agentId]:palette},storage);
}
export function resetWardrobePreference(agentId,storage){
 agentIdOrThrow(agentId);const current=readWardrobePreferences(storage);if(current.error)throw new Error(current.error);
 const palettes={...current.palettes};delete palettes[agentId];return writePreferences(palettes,storage);
}
