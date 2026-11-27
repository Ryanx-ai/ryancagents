import type {Palette} from './wardrobe.mjs';
export type SpriteKind='standard'|'manager'|'designer';
export const SPRITE_SHEETS:Record<SpriteKind,string>;
export function garmentAt(kind:SpriteKind,row:number,col:number,x:number,y:number,r:number,g:number,b:number,a:number):number;
export function recolorSprite(data:Uint8ClampedArray,width:number,height:number,kind:SpriteKind,palette:Palette):Uint8ClampedArray;
export function recolorSpriteFrame(data:Uint8ClampedArray,width:number,height:number,kind:SpriteKind,palette:Palette,row?:number):Uint8ClampedArray;
