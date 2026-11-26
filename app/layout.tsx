import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Ryan HQ',description:'A living office for Ryan’s Codex agents. Manage email, outreach and contacts with Manager Ryan.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
