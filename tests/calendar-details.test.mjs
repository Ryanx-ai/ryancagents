import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {extractCalendarDetails,normalizeCalendarLinks,safeCalendarDetailUrl} from '../lib/calendar-details.mjs';

test('HTML descriptions become readable notes with accurate anchor labels and decoded URLs',()=>{
 const input={description:'<p>Plan &amp; review &#x2014; Q4</p><div>Owner: fixture@example.com<br>Phone already in description: 1234</div><a title="2 > 1" href="https://docs.example.com/agenda?a=1&amp;b=2"><b>Agenda</b> &amp; notes</a>'};
 const before=JSON.stringify(input),result=extractCalendarDetails(input);
 assert.equal(result.body,'Plan & review — Q4\n\nOwner: fixture@example.com\nPhone already in description: 1234\nAgenda & notes');
 assert.deepEqual(result.links,[{label:'Agenda & notes',url:'https://docs.example.com/agenda?a=1&b=2'}]);assert.equal(JSON.stringify(input),before);
});
test('active blocks, comments, image attributes and fake href attributes never supply notes or links',()=>{
 const result=extractCalendarDetails({description:'Visible<!-- https://hidden.example --><script>https://script.example</script><style>https://style.example</style><iframe>https://frame.example</iframe><svg><a href="https://svg.example">hidden</a></svg><img src="https://image.example" onerror="alert(1)"><a data-href="https://data.example" title="href=\'https://quoted.example\'">Text</a><script>unterminated https://hidden.example'});
 assert.equal(result.body,'VisibleText');assert.deepEqual(result.links,[]);
});
test('HTTPS validation rejects unsafe schemes, credentials, encoded and literal controls',()=>{
 for(const value of ['http://example.com','javascript:alert(1)','data:text/html,hi','//example.com','https://user:password@example.com','https://user@example.com','https:\\example.com','https://example.com/\npath','https://example.com/%0aattack','https://example.com/'+'x'.repeat(2000),null])assert.equal(safeCalendarDetailUrl(value),null,String(value));
 assert.equal(safeCalendarDetailUrl('https://EXAMPLE.com:443/agenda'),'https://example.com/agenda');
 const extracted=extractCalendarDetails({description:'<a href="javascript:alert(1)">Unsafe</a><a href="https://u:p@example.com">Credentials</a><a href="https://example.com/&#10;path">Control</a>'});assert.deepEqual(extracted.links,[]);
});
test('plain text preserves booking labels and safely strips surrounding URL punctuation',()=>{
 const result=extractCalendarDetails({description:'Reschedule:-\nhttps://msgsndr.com/widget/booking/fixture\nCancel:-\nhttps://msgsndr.com/widget/cancel-booking?event=fixture\nAgenda: https://docs.example.com/plan(v2).\nOther (https://example.com/x).'});
 assert.deepEqual(result.links,[{label:'Reschedule',url:'https://msgsndr.com/widget/booking/fixture'},{label:'Cancel',url:'https://msgsndr.com/widget/cancel-booking?event=fixture'},{label:'Agenda',url:'https://docs.example.com/plan(v2)'},{label:'example.com',url:'https://example.com/x'}]);
 assert.ok(result.links.every(link=>link.label!=='Join meeting'));
});
test('only documented link fields are extracted, never attendees, phones or physical locations',()=>{
 const event={description:'Meeting notes',location:'Room 2 https://location.example',hangout_link:'https://meet.google.com/fixture',hangoutLink:'https://meet.google.com/fixture',attendees:[{email:'https://attendee.example'}],phone:'https://phone.example',conferenceData:{entryPoints:[{entryPointType:'phone',uri:'https://phone-entry.example'},{entryPointType:'video',uri:'https://video.example/room'},{entryPointType:'more',uri:'https://more.example/info'},{entryPointType:'sip',uri:'sip:room@example.com'}]}};
 assert.deepEqual(extractCalendarDetails(event),{body:'Meeting notes',links:[{label:'Google Meet',url:'https://meet.google.com/fixture'},{label:'video.example',url:'https://video.example/room'},{label:'more.example',url:'https://more.example/info'}]});
 assert.deepEqual(extractCalendarDetails({location:'https://location.example'}).links,[{label:'location.example',url:'https://location.example/'}]);
});
test('extraction is bounded and deduplicated, while wire validation fails closed on malformed links',()=>{
 const result=extractCalendarDetails({description:'<p>'+'n'.repeat(2100)+'</p>'+Array.from({length:12},(_,i)=>`<a href="https://example.com/${i}">${'Label'.repeat(30)}</a>`).join('')});
 assert.equal(result.body.length,2000);assert.equal(result.links.length,8);assert.ok(result.links.every(link=>link.label.length===100));
 assert.deepEqual(normalizeCalendarLinks([{label:' First ',url:'https://EXAMPLE.com:443'},{label:'Duplicate',url:'https://example.com/'}]),[{label:'First',url:'https://example.com/'}]);
 for(const invalid of [null,{},Array(9).fill({label:'x',url:'https://example.com'}),[{label:'',url:'https://example.com'}],[{label:'x'.repeat(101),url:'https://example.com'}],[{label:'x\ny',url:'https://example.com'}],[{label:'x',url:'http://example.com'}],[{label:'x',url:'https://example.com',token:'discard'}]])assert.throws(()=>normalizeCalendarLinks(invalid));
 assert.deepEqual(extractCalendarDetails(null),{body:'',links:[]});assert.deepEqual(normalizeCalendarLinks(undefined),[]);
});
test('malformed long HTML finishes within a bounded worker lifetime',async()=>{
 const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');import(workerData.url).then(({extractCalendarDetails})=>{for(const description of ['<a '+' '.repeat(1000)+'"','<a '+' '.repeat(90000)+'"','<a href="'+'x'.repeat(90000),'<'.repeat(90000),'https://example.com/'+')'.repeat(90000),('https://u:p@example.com/invalid ').repeat(3000)])extractCalendarDetails({description});parentPort.postMessage('done');});`,{eval:true,workerData:{url:new URL('../lib/calendar-details.mjs',import.meta.url).href}});
 let timer;
 try{await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Calendar extraction exceeded the malformed-input time bound')),2000);worker.once('message',value=>value==='done'?resolve():reject(new Error('Unexpected worker result')));worker.once('error',reject);});}
 finally{clearTimeout(timer);await worker.terminate();}
});
