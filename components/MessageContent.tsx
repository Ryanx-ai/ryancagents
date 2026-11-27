'use client';

import {Children, memo} from 'react';
import Markdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {messageLinkLabel, safeMessageUrl} from '../lib/message-links.mjs';
import {normalizeMessageText,remarkLiteralHtml} from '../lib/message-content.mjs';
import './message-content.css';

const components: Components = {
  a({href, children, title}) {
    const safe=safeMessageUrl(href);
    if(!safe)return <span>{children}</span>;
    const parts=Children.toArray(children);
    const rawLabel=parts.every(part=>typeof part==='string')?parts.join(''):'';
    const label=rawLabel&&safeMessageUrl(rawLabel)?messageLinkLabel(safe):children;
    return <a className="message-content-link" href={safe} title={title||safe} target={safe.startsWith('mailto:')?undefined:'_blank'} rel="noopener noreferrer" referrerPolicy="no-referrer">{label}</a>;
  },
  // Agent output must not load tracking pixels or arbitrary remote images.
  img({alt}) {return alt?<span className="message-image-alt">{alt}</span>:null;},
  table({children}) {return <div className="message-table-scroll" tabIndex={0} role="region" aria-label="Message table"><table>{children}</table></div>;},
  input({checked}) {return <input type="checkbox" checked={!!checked} disabled readOnly aria-label={checked?'Completed item':'Incomplete item'}/>;},
};

const MessageContent=memo(function MessageContent({text}:{text:string}) {
  const content=normalizeMessageText(text);
  return <div className="message-content">{content?<Markdown skipHtml remarkPlugins={[remarkGfm,remarkLiteralHtml]} urlTransform={safeMessageUrl} components={components}>{content}</Markdown>:<p className="message-content-empty">No summary was included. Open the original Codex chat for details.</p>}</div>;
});

export default MessageContent;
