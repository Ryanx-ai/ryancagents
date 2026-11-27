import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {normalizeMessageText,parseHeartbeatMessage,remarkLiteralHtml} from '../lib/message-content.mjs';

const heartbeat=(message,decision='DONT_NOTIFY')=>`<heartbeat>\n<automation_id>fixture-id</automation_id>\n<decision>${decision}</decision>\n<message>${message}</message>\n</heartbeat>`;
const render=text=>renderToStaticMarkup(createElement(Markdown,{skipHtml:true,remarkPlugins:[remarkGfm,remarkLiteralHtml]},normalizeMessageText(text)));

test('heartbeat human messages remain visible with their Markdown formatting',()=>{
 const text=heartbeat('Review **one draft**.\n\n- [Open draft](https://mail.google.com/mail/u/0/#drafts)','NOTIFY');
 assert.deepEqual(parseHeartbeatMessage(text),{decision:'NOTIFY',message:'Review **one draft**.\n\n- [Open draft](https://mail.google.com/mail/u/0/#drafts)'});
 const html=render(text);
 assert.match(html,/<strong>one draft<\/strong>/);assert.match(html,/<a href="https:\/\/mail.google.com\/mail\/u\/0\/#drafts">Open draft<\/a>/);
 assert.doesNotMatch(html,/automation_id|fixture-id|<heartbeat>|<decision>/);
});
test('quiet heartbeat decisions are preserved for telemetry without discarding their useful status text',()=>{
 assert.deepEqual(parseHeartbeatMessage(heartbeat('No changes to report.')),{decision:'DONT_NOTIFY',message:'No changes to report.'});
 assert.equal(normalizeMessageText(heartbeat('No changes to report.')),'No changes to report.');
});
test('only complete known heartbeat envelopes are unwrapped',()=>{
 for(const text of [heartbeat('Text','UNKNOWN'),heartbeat('Text').replace('</heartbeat>','<message>Extra</message></heartbeat>'),heartbeat('Text').replace('<decision>','<unexpected>'),`Before\n${heartbeat('Text')}`]){
  assert.equal(parseHeartbeatMessage(text),null);assert.equal(normalizeMessageText(text),text);
 }
});
test('decoded XML message text cannot execute HTML or tracking pixels',()=>{
 const text=heartbeat('Email &amp; calendar: &lt;img src="https://example.com/pixel" onerror="bad()"&gt; &#65;');
 assert.match(normalizeMessageText(text),/^Email & calendar:/);
 const html=render(text);
 assert.doesNotMatch(html,/<img\b|<script\b/);assert.match(html,/&lt;img/);assert.match(html,/ A/);
 assert.equal(normalizeMessageText(heartbeat('<![CDATA[Keep **this** text.]]>')),'Keep **this** text.');
});
test('unknown HTML is visible escaped text, while ordinary Markdown and code are unchanged',()=>{
 const raw='<section>Result details</section>\n<script>alert(1)</script>';
 const html=render(raw);
 assert.match(html,/Result details/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script\b|<section\b/);
 const markdown='## Result\n\n**Ready.**\n\n```html\n<div>sample</div>\n```';
 assert.equal(normalizeMessageText(markdown),markdown);assert.match(render(markdown),/<h2>Result<\/h2>/);
});
test('blank summaries and automation directives are not treated as executable content',()=>{
 for(const blank of [null,undefined,'',' \n\t','\u200b',heartbeat('')])assert.equal(normalizeMessageText(blank),'');
 const directive='::inbox-item{title="Example" summary="Display only"}';
 assert.equal(normalizeMessageText(directive),directive);assert.match(render(directive),/::inbox-item/);
});
