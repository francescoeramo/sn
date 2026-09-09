import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
export const metadata: Metadata = {
  title: 'SN · Ci troviamo qui',
  description: 'Uno spazio per parlare, condividere e ritrovare i tuoi amici.',
  robots: { index: false, follow: false },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await headers();
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
