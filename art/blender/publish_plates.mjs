// Publish only the completed, registered high-resolution pair. Sharp is supplied
// by this Next.js installation; no remote optimizer or image service is used.
import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=path.join(root,'.local/office-renders');
const destination=path.join(root,'public/office');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const plates=await Promise.all(['day','night'].map(async mode=>{
 const name=`ryan-hq-${mode}`,png=await readFile(path.join(source,`${name}.png`));
 const [pngStat,blendStat]=await Promise.all([stat(path.join(source,`${name}.png`)),stat(path.join(source,`${name}.blend`))]);
 if(pngStat.mtimeMs<blendStat.mtimeMs)throw Error(`${mode}: this scene has not finished rendering`);
 const metadata=await sharp(png).metadata();
 if(metadata.width!==2200||metadata.height!==1600)throw Error(`${mode}: final 2200 × 1600 render required`);
 const blend=await readFile(path.join(source,`${name}.blend`));
 const webp=await sharp(png).webp({quality:88,effort:6}).toBuffer();
 return {mode,name,blend,webp,sourceSha256:hash(png)};
}));
await mkdir(destination,{recursive:true});
for(const plate of plates){
 await writeFile(path.join(destination,`${plate.name}.webp`),plate.webp);
 await writeFile(path.join(root,'art/blender',`${plate.name}.blend`),plate.blend);
}
const manifest={renderer:'Blender 4.5.17 LTS / Cycles CPU',logicalSize:[1100,800],renderSize:[2200,1600],spriteLayers:'Runtime only; never baked into renders',
 plates:plates.map(({mode,name,webp,sourceSha256})=>({mode,file:`${name}.webp`,bytes:webp.length,sha256:hash(webp),sourceSha256}))};
await writeFile(path.join(root,'art/blender/render-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
