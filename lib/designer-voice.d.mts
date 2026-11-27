export type VoicePhase='ready'|'starting'|'listening'|'stopping'|'review'|'error';
export type VoiceState={phase:VoicePhase;transcript:string;interim:string;error:string|null;notice:string|null};
export type VoiceRecognitionResult={isFinal:boolean;[index:number]:{transcript:string}};
export type VoiceRecognizer={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onstart:(()=>void)|null;onresult:((event:{results:ArrayLike<VoiceRecognitionResult>})=>void)|null;
 onerror:((event:{error?:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
export type DesignerVoiceController={start:()=>boolean;stop:()=>void;cancel:()=>void;setTranscript:(text:string)=>boolean;dispose:()=>void;getState:()=>VoiceState};
export const MAX_VOICE_CHARS:number;
export const VOICE_TIMEOUTS:Readonly<{startup:number;clip:number;stopping:number}>;
export function createDesignerVoiceController(options:{createRecognizer:()=>VoiceRecognizer;onChange?:(state:VoiceState)=>void;setTimeout?:(callback:()=>void,ms:number)=>any;clearTimeout?:(timer:any)=>void;lang?:string}):DesignerVoiceController;
