import test from 'node:test';
import assert from 'node:assert/strict';
import {garmentAt,recolorSprite,recolorSpriteFrame} from '../lib/sprite-colors.mjs';
const palette={jacket:'#2b8291',shirt:'#e5a14f',pants:'#724c91'};
test('clothing masks exclude heads, warm skin, transparent pixels and outlines',()=>{
 for(const kind of ['standard','manager','designer']){
  assert.equal(garmentAt(kind,0,0,90,90,150,100,60,255),-1);
  assert.equal(garmentAt(kind,0,0,90,148,245,165,95,255),-1);
  assert.equal(garmentAt(kind,0,0,90,148,150,150,150,0),-1);
  assert.equal(garmentAt(kind,0,0,90,148,10,10,10,255),-1);
 }
 assert.equal(garmentAt('standard',4,2,90,100,180,180,180,255),-1,'jumping head stays outside the clothing mask');
});

test('static portraits crop one cell and preserve faces, alpha, source data and original colors',()=>{
 const width=1536,height=2288,source=new Uint8ClampedArray(width*height*4),row=7;
 const sourceIndex=(x,y)=>((row*208+y)*width+x)*4;
 const frameIndex=(x,y)=>(y*192+x)*4;
 source.set([205,198,198,252],sourceIndex(85,150));
 source.set([205,198,198,249],sourceIndex(85,90));
 source.set([10,10,10,140],sourceIndex(90,155));
 source.set([90,50,30,0],sourceIndex(100,190));
 const output=recolorSpriteFrame(source,width,height,'standard',palette,row);
 assert.equal(output.byteLength,192*208*4);
 assert.deepEqual([...source.slice(sourceIndex(85,150),sourceIndex(85,150)+4)],[205,198,198,252]);
 assert.notDeepEqual([...output.slice(frameIndex(85,150),frameIndex(85,150)+3)],[205,198,198]);
 for(const [x,y] of [[85,90],[90,155],[100,190]])assert.deepEqual(output.slice(frameIndex(x,y),frameIndex(x,y)+4),source.slice(sourceIndex(x,y),sourceIndex(x,y)+4));
 for(let y=0;y<208;y++)for(let x=0;x<192;x++)assert.equal(output[frameIndex(x,y)+3],source[sourceIndex(x,y)+3]);
 for(const invalid of [-1,11,1.5,NaN])assert.throws(()=>recolorSpriteFrame(source,width,height,'standard',palette,invalid),/animation row/);
 assert.throws(()=>recolorSpriteFrame(source,width,height,'standard',{...palette,jacket:'url(bad)'},row));
 assert.throws(()=>recolorSpriteFrame(source,100,height,'standard',palette,row));
});

test('static frame colors exactly match the full atlas for every outfit and animation row',()=>{
 const width=1536,height=2288,source=new Uint8ClampedArray(width*height*4);
 const samples=[[205,198,198],[53,51,51],[112,104,103],[40,40,39],[248,247,246],[31,31,31],[164,99,53],[241,240,238],[89,79,76],[245,165,95],[10,10,10]];
 // Fill only the first cell of each row with a mix of material, skin and outline
 // colors, including transparent and translucent pixels throughout the cell.
 for(let row=0;row<11;row++)for(let y=0;y<208;y++)for(let x=0;x<192;x++){
  const i=((row*208+y)*width+x)*4,rgb=samples[(x+y+row)%samples.length];
  source.set([...rgb,[0,16,140,255][(x*3+y)%4]],i);
 }
 for(const kind of ['standard','manager','designer']){
  const full=recolorSprite(source,width,height,kind,palette);
  for(let row=0;row<11;row++){
   const frame=recolorSpriteFrame(source,width,height,kind,palette,row),expected=new Uint8ClampedArray(192*208*4);
   for(let y=0;y<208;y++){const start=((row*208+y)*width)*4;expected.set(full.subarray(start,start+192*4),y*192*4);}
   assert.deepEqual(frame,expected,`${kind} row ${row}`);
  }
 }
});
test('all three outfits expose independent clothing materials',()=>{
 const samples={standard:[[205,198,198],[53,51,51],[112,104,103]],manager:[[40,40,39],[248,247,246],[31,31,31]],designer:[[164,99,53],[241,240,238],[89,79,76]]};
 for(const [kind,colors] of Object.entries(samples)){
  assert.equal(garmentAt(kind,0,0,85,150,...colors[0],252),0,kind+' jacket');
  assert.equal(garmentAt(kind,0,0,103,150,...colors[1],252),1,kind+' shirt');
  assert.equal(garmentAt(kind,0,0,90,178,...colors[2],252),2,kind+' trousers');
 }
});
test('recolouring preserves input, alpha and all pixels outside clothing regions',()=>{
 const width=1536,height=2288,source=new Uint8ClampedArray(width*height*4);
 const clothing=(150*width+85)*4,head=(90*width+85)*4;
 source.set([205,198,198,252],clothing);source.set([205,198,198,249],head);
 const output=recolorSprite(source,width,height,'standard',palette);
 assert.deepEqual([...source.slice(clothing,clothing+4)],[205,198,198,252]);
 assert.notDeepEqual([...output.slice(clothing,clothing+3)],[205,198,198]);
 assert.deepEqual([...output.slice(head,head+4)],[205,198,198,249]);
 for(let i=3;i<source.length;i+=4)assert.equal(output[i],source[i]);
 assert.throws(()=>recolorSprite(source,width,height,'standard',{...palette,jacket:'url(bad)'}));
 assert.throws(()=>recolorSprite(source,100,height,'standard',palette));
});
