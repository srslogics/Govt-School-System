import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { DemoAuthGate } from '@/components/demo-auth';
import './globals.css';

const siteUrl = 'https://govt-school-system.onrender.com/';
const previewImage = `${siteUrl}og.png?v=2`;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Shikshan Setu | Nagpur School Command Centre',
  description: 'A unified governance and decision platform for every government school in Nagpur district.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description: 'One governance and decision platform for every government school in Nagpur.',
    url: siteUrl,
    siteName: 'Shikshan Setu',
    type: 'website',
    images: [{ url: previewImage, secureUrl: previewImage, type: 'image/png', width: 1792, height: 1024, alt: 'Shikshan Setu — Nagpur School Command Centre' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description: 'One governance and decision platform for every government school in Nagpur.',
    images: [previewImage],
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
