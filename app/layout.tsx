import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Ryan HQ — A little office. A lot happening.',description:'A living office for Ryan’s Codex agents. Follow email, outreach and contacts in real time.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
