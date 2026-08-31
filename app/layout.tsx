import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { DemoAuthGate } from '@/components/demo-auth';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Shikshan Setu | Nagpur School Command Centre',
  description: 'A unified governance and decision platform for every government school in Nagpur district.',
  openGraph: {
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description: 'One governance and decision platform for every government school in Nagpur.',
    images: [{ url: '/og.png', width: 1792, height: 1024, alt: 'Shikshan Setu — Nagpur School Command Centre' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description: 'One governance and decision platform for every government school in Nagpur.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DemoAuthGate>{children}</DemoAuthGate>
      </body>
    </html>
  );
}
