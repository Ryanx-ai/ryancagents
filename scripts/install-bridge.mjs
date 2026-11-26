import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if(process.platform!=='darwin')throw new Error('This installer is for macOS. Run npm run bridge on other systems.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await readFile(path.join(root,'.local/bridge.json'),'utf8');
// LaunchAgents must not depend on access to macOS-protected Documents folders.
const runtime=path.join(homedir(),'Library/Application Support/RyanHQ');
for(const dir of ['scripts','lib','.local'])await mkdir(path.join(runtime,dir),{recursive:true,mode:0o700});
for(const file of ['scripts/bridge.mjs','scripts/prompt-relay.mjs','scripts/manager.mjs','scripts/manager-schema.json','lib/telemetry.mjs','lib/game-state.mjs','.local/bridge.json']) {
 await copyFile(path.join(root,file),path.join(runtime,file));
 await chmod(path.join(runtime,file),0o600);
}
const label='com.ryanc.agent-office';const domain=`gui/${process.getuid()}`;
const directory=path.join(homedir(),'Library/LaunchAgents');const destination=path.join(directory,`${label}.plist`);
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
try {const old=await readFile(destination,'utf8');if(!old.includes(xml(root))&&!old.includes(xml(runtime)))throw new Error('A bridge is already installed from a different checkout. Stop it before replacing it.');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(directory,{recursive:true});
const plist=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(runtime,'scripts/bridge.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(runtime)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${xml(path.join(runtime,'.local/bridge.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(runtime,'.local/bridge-error.log'))}</string>
</dict></plist>`;
await writeFile(destination,plist,{mode:0o600});
try{execFileSync('launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'});}catch{}
// bootout unloads asynchronously; allow the old process to finish before loading.
for(let attempt=0;;attempt++) {
 try {execFileSync('launchctl',['bootstrap',domain,destination],{stdio:'pipe'});break;}
 catch(e) {if(attempt>=24)throw e;await new Promise(resolve=>setTimeout(resolve,1000));}
}
console.log(`Installed ${label}. The bridge starts at login and is running now.`);
