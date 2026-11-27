// Clothing material masks for the registered 192×208 Ryan animation cells.
// The source atlas, alpha, faces, hair, outlines and animation timing stay intact.
import {defaultPalette} from './wardrobe.mjs';
export const SPRITE_SHEETS={standard:'/assets/maple-ryan.png',manager:'/assets/manager-ryan-sheet.png',designer:'/assets/designer-ryan.png'};
const FRAMES=[6,8,8,4,5,8,6,6,6,8,8];
const NECK=[
 [138,133,138,138,138,137],[135,135,130,128,130,136,130,130],
 [135,135,130,128,130,136,130,130],[133,133,133,133],[148,124,107,123,147],
 [135,135,137,137,141,141,135,135],[144,144,145,144,147,144],
 [135,134,152,133,135,135],[137,147,142,143,147,137],
 [135,135,133,134,136,138,140,142],[143,143,142,140,138,136,135,135],
];
const BASE={standard:[195,54,108],manager:[38,234,31],designer:[126,230,84]};

export function garmentAt(kind,row,col,x,y,r,g,b,a){
 if(a<40||col>=FRAMES[row]||row<0||row>10)return -1;
 const neck=NECK[row][col];
 const waist=row===4?neck+25:row===1||row===2?neck+29:row===7?Math.min(neck+21,175):168;
 const center=row===2?88:row===7?89:103;
 // Never touch the head. Arms outside the torso are recoloured only below it.
 if(y<neck-4||y>Math.min(201,waist+22)||x<55||x>140)return -1;
 const lum=(r+g+b)/3,spread=Math.max(r,g,b)-Math.min(r,g,b);
 if(lum<19)return -1; // preserve inked outlines
 const neutral=spread<Math.max(17,lum*.18);
 const torso=y<waist;
 const shirt=torso&&x>=center-8&&x<=center+7&&y>=neck+1;
 if(kind==='standard'){
  if(!neutral)return -1;
  if(!torso)return lum>48&&lum<155?2:-1;
  if(shirt&&lum<112)return 1;
  return lum>115&&lum<235?0:-1;
 }
 if(kind==='manager'){
  if(!neutral)return -1;
  if(!torso)return lum<85?2:-1;
  if(shirt&&lum>150)return 1;
  return lum<95?0:-1;
 }
 if(!torso)return neutral&&lum>28&&lum<137?2:-1;
 if(shirt&&r>170&&g>155&&b>130&&r-b<65)return 1;
 // Brown fabric below the face; orange skin and the purple/gold work effect are excluded.
 return r>65&&r<213&&r>g*1.23&&g>b*1.18&&r-g<95&&b<125?0:-1;
}

function checkAtlas(data,width,height,kind){
 if(!Object.hasOwn(SPRITE_SHEETS,kind)||width!==1536||height!==2288||data.length!==width*height*4)throw new Error('Unexpected Ryan sprite atlas.');
}
function materials(kind,palette){
 const colors=['jacket','shirt','pants'].map(part=>{
  const value=palette?.[part];if(!/^#[0-9a-f]{6}$/i.test(value||''))throw new Error('Invalid clothing colour.');
  return [1,3,5].map(start=>parseInt(value.slice(start,start+2),16));
 });
 const original=defaultPalette(kind);
 const changed=['jacket','shirt','pants'].map(part=>palette[part].toLowerCase()!==original[part]);
 return {colors,changed};
}
function paintPixel(data,sourceIndex,result,targetIndex,kind,material,colors){
 const light=(data[sourceIndex]+data[sourceIndex+1]+data[sourceIndex+2])/3/BASE[kind][material];
 for(let channel=0;channel<3;channel++){
  const target=colors[material][channel];
  result[targetIndex+channel]=Math.round(light<=1?target*light:target+(255-target)*Math.min(.65,(light-1)*.7));
 }
}
export function recolorSprite(data,width,height,kind,palette){
 checkAtlas(data,width,height,kind);
 const {colors,changed}=materials(kind,palette),result=new Uint8ClampedArray(data);
 for(let row=0;row<11;row++)for(let col=0;col<FRAMES[row];col++)for(let y=Math.max(0,NECK[row][col]-4);y<204;y++)for(let x=55;x<=140;x++){
  const i=((row*208+y)*width+col*192+x)*4;
  const material=garmentAt(kind,row,col,x,y,data[i],data[i+1],data[i+2],data[i+3]);
  if(material<0||!changed[material])continue;
  paintPixel(data,i,result,i,kind,material,colors);
 }
 return result;
}

// Static portraits need only the first cell of their active animation row.
// Copy and recolor that cell directly, without allocating a second full atlas.
export function recolorSpriteFrame(data,width,height,kind,palette,row=0){
 checkAtlas(data,width,height,kind);
 if(!Number.isInteger(row)||row<0||row>=FRAMES.length)throw new Error('Invalid Ryan animation row.');
 const {colors,changed}=materials(kind,palette),result=new Uint8ClampedArray(192*208*4);
 for(let y=0;y<208;y++){
  const start=((row*208+y)*width)*4;
  result.set(data.subarray(start,start+192*4),y*192*4);
 }
 for(let y=Math.max(0,NECK[row][0]-4);y<204;y++)for(let x=55;x<=140;x++){
  const sourceIndex=((row*208+y)*width+x)*4;
  const material=garmentAt(kind,row,0,x,y,data[sourceIndex],data[sourceIndex+1],data[sourceIndex+2],data[sourceIndex+3]);
  if(material<0||!changed[material])continue;
  paintPixel(data,sourceIndex,result,(y*192+x)*4,kind,material,colors);
 }
 return result;
}
