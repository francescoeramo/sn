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
  await headers();
  return (
    <html lang="it" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
