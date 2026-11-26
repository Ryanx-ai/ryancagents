export function pollRetryDelay(failures,retryAfter,now=Date.now()){
 const seconds=Number(retryAfter);
 const requested=retryAfter?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-now):0;
 const exponent=Math.min(Math.max(0,Number.isFinite(failures)?failures-1:0),5);
 const backoff=Math.min(300000,10000*2**exponent);
 // Bound normal exponential polling at five minutes, but respect a provider's
 // longer Retry-After (up to one hour, matching the server and Mac bridge).
 return Math.max(backoff,Number.isFinite(requested)?Math.min(3600000,Math.max(0,requested)):0);
}
