const formatter=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',numberingSystem:'latn',
});

/** @param {number | Date} [at] */
export function getOfficeTime(at=Date.now()) {
 const time=formatter.format(at);
 const hour=Number(time.slice(0,2));
 return {time,night:hour<7||hour>=19};
}
