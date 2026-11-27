import test from 'node:test';
import assert from 'node:assert/strict';
import {WARDROBE_KEY,WARDROBE_AGENT_IDS,CLOTHING_PARTS,COLOR_PRESETS,DEFAULT_PALETTES,defaultPalette,normalizePalette,palettesEqual,readWardrobePreferences,resetWardrobePreference,saveWardrobePreference,validatePalette,wardrobeOutfit} from '../lib/wardrobe.mjs';
const palette={jacket:'#465575',shirt:'#eee7d6',pants:'#303741'};
function memory(initial={}){const values=new Map(Object.entries(initial));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};}

test('clothing palette accepts only complete six-digit hex colors and normalizes case',()=>{
 assert.deepEqual(validatePalette({jacket:'#ABCDEF',shirt:'#112233',pants:'#445566'}),{jacket:'#abcdef',shirt:'#112233',pants:'#445566'});
 for(const invalid of [null,undefined,[],{},'#ffffff',{...palette,jacket:'#fff'},{...palette,shirt:'red'},{...palette,pants:'url(https://invalid.test/image)'},{...palette,jacket:'#12345678'},{...palette,pants:3},{...palette,extra:'#ffffff'},{jacket:'#000000',shirt:'#ffffff'}]){assert.equal(normalizePalette(invalid),null);assert.throws(()=>validatePalette(invalid));}
 assert.equal(palettesEqual(palette,{...palette,jacket:'#465575'}),true);assert.equal(palettesEqual(palette,null),false);
});

test('each outfit retains its own original palette and presets are valid',()=>{
 assert.equal(wardrobeOutfit('manager'),'manager');assert.equal(wardrobeOutfit('designer'),'designer');assert.equal(wardrobeOutfit('scheduler'),'standard');
 assert.deepEqual(defaultPalette('manager'),{jacket:'#29292c',shirt:'#f0ece4',pants:'#303034'});
 assert.deepEqual(defaultPalette('designer'),{jacket:'#946b45',shirt:'#e8dfc9',pants:'#42414a'});
 const copy=defaultPalette();copy.jacket='#000000';assert.equal(DEFAULT_PALETTES.standard.jacket,'#b8b6b9');
 assert.deepEqual(defaultPalette('__proto__'),defaultPalette('standard'));
 for(const part of CLOTHING_PARTS)for(const swatch of COLOR_PRESETS[part])assert.ok(normalizePalette({...palette,[part]:swatch.color}));
});

test('preferences save and reset only the targeted agent, preserving the other agents and unrelated keys',()=>{
 const storage=memory({'other-setting':'keep-me'});
 for(const agentId of WARDROBE_AGENT_IDS)saveWardrobePreference(agentId,palette,storage);
 const changed={...palette,shirt:'#faf7f0'};saveWardrobePreference('manager',changed,storage);
 const saved=readWardrobePreferences(storage);assert.equal(saved.error,null);assert.equal(Object.keys(saved.palettes).length,6);assert.deepEqual(saved.palettes.manager,changed);assert.deepEqual(saved.palettes.designer,palette);
 resetWardrobePreference('manager',storage);const remaining=readWardrobePreferences(storage).palettes;assert.equal(Object.hasOwn(remaining,'manager'),false);assert.equal(Object.keys(remaining).length,5);assert.equal(storage.values.get('other-setting'),'keep-me');
});

test('save rereads current storage so independent agent updates do not overwrite each other',()=>{
 const storage=memory();saveWardrobePreference('scheduler',palette,storage);saveWardrobePreference('contacts',{...palette,jacket:'#4b6b59'},storage);
 saveWardrobePreference('scheduler',{...palette,shirt:'#faf7f0'},storage);
 assert.equal(readWardrobePreferences(storage).palettes.contacts.jacket,'#4b6b59');
});

test('corrupt, future-version, unknown-agent and unknown-field data are preserved on writes and resets',()=>{
 for(const raw of ['bad JSON',JSON.stringify({version:2,agents:{}}),JSON.stringify({version:1,agents:{manager:palette},future:{keep:true}}),JSON.stringify({version:1,agents:{stranger:palette}}),JSON.stringify({version:1,agents:{manager:{...palette,extra:'keep'}}}),JSON.stringify({version:1,agents:{manager:{...palette,jacket:'invalid'}}})]){
  const storage=memory({[WARDROBE_KEY]:raw});assert.ok(readWardrobePreferences(storage).error);assert.throws(()=>saveWardrobePreference('manager',palette,storage));assert.throws(()=>resetWardrobePreference('manager',storage));assert.equal(storage.values.get(WARDROBE_KEY),raw);
 }
});

test('invalid agent IDs and failed storage never claim a successful update',()=>{
 const storage=memory();for(const agentId of ['__proto__','constructor','unknown','']){assert.throws(()=>saveWardrobePreference(agentId,palette,storage));assert.throws(()=>resetWardrobePreference(agentId,storage));}assert.equal(storage.values.size,0);
 const raw=JSON.stringify({version:1,agents:{manager:palette}}),blocked={getItem:()=>raw,setItem:()=>{throw new Error('Quota exceeded');}};
 assert.throws(()=>saveWardrobePreference('designer',palette,blocked),/Previous preferences were kept/);assert.deepEqual(readWardrobePreferences(blocked).palettes,{manager:palette});
 assert.ok(readWardrobePreferences({getItem:()=>{throw new Error('Blocked');},setItem:()=>{}}).error);
});
