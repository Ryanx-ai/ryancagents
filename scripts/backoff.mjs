/** A local circuit breaker: healthy polling stays fast, failures stop hammering. */
export class RequestBackoff {
 constructor({now=Date.now,random=Math.random}={}){this.now=now;this.random=random;this.failures=0;this.until=0;}
 ready(){return this.now()>=this.until;}
 success(){this.failures=0;this.until=0;}
 fail(error){
  this.failures++;
  const base=Math.min(300000,5000*2**Math.min(6,this.failures-1));
  const delay=Math.max(Math.min(300000,base+Math.floor(base*0.15*this.random())),Math.min(3600000,error?.retryAfterMs||0),[401,403].includes(error?.status)?60000:0);
  this.until=this.now()+delay;return delay;
 }
}
export async function responseError(response,label){
 let body;try{body=await response.json();}catch{}
 const header=response.headers.get('retry-after');const seconds=Number(header);
 const retryAfterMs=header?(Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(header)-Date.now())):0;
 const error=new Error(`${label} HTTP ${response.status}${typeof body?.code==='string'?` (${body.code})`:''}`);
 error.status=response.status;error.retryAfterMs=retryAfterMs;return error;
}
