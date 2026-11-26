import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMessageLinks,safeMessageUrl,messageLinkLabel} from '../lib/message-links.mjs';

test('result links preserve account selectors and message hashes without displaying a long URL',()=>{
 const url='https://mail.google.com/mail/u/?authuser=demo%40example.com#all/123456789';
 assert.equal(safeMessageUrl(url),url);
 assert.deepEqual(extractMessageLinks(`[Email](${url})\n\n${url}`),[{label:'Email',href:url}]);
 assert.equal(messageLinkLabel(url),'Open in Gmail');
});
test('result links reject executable URLs and credential-bearing destinations',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hello','file:///private/report','https://user:password@example.com','https://example.com/\npath','//example.com'])assert.equal(safeMessageUrl(url),'');
 assert.deepEqual(extractMessageLinks('[bad](javascript:alert%281%29) ![pixel](https://example.com/track.png)'),[]);
});
test('reference links and GFM autolinks become usable quicklinks',()=>{
 assert.deepEqual(extractMessageLinks('[Calendar][cal]\n\n[cal]: https://calendar.google.com/\n\nhttps://contacts.google.com/'),[{label:'Calendar',href:'https://calendar.google.com/'},{label:'https://contacts.google.com/',href:'https://contacts.google.com/'}]);
});
