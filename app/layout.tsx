import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/ibm-plex-sans/wght.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'SN · Ci troviamo qui',
  description: 'Uno spazio per parlare, condividere e ritrovare i tuoi amici.',
  robots: { index: false, follow: false },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('sn-theme')||'system';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch{}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
