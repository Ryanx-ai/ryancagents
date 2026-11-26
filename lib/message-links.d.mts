export function safeMessageUrl(raw: unknown): string;
export function messageLinkLabel(href: string): string;
export function extractMessageLinks(text: string): {label: string; href: string}[];
