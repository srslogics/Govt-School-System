import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const siteUrl =
  new URL(
    process.env.SITE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'https://govt-school-system.onrender.com/',
  ).origin + '/';
const previewImage = `${siteUrl}ss49-school-erp-preview.jpg`;
const erpUrl = `${siteUrl}erp`;

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
  title: 'Shiksha-Setu | School ERP by SS49',
  description:
    'Shiksha-Setu connects school operations, families, staff and education officers.',
  alternates: { canonical: erpUrl },
  openGraph: {
    title: 'Shiksha-Setu | School ERP by SS49',
    description:
      'Connected school operations for families, staff and education officers.',
    url: erpUrl,
    siteName: 'Shiksha-Setu',
    type: 'website',
    images: [
      {
        url: previewImage,
        secureUrl: previewImage,
        type: 'image/jpeg',
        width: 1200,
        height: 630,
        alt: 'Shiksha-Setu School ERP by SS49 D1T1TECH (OPC) PRIVATE LIMITED',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shiksha-Setu | School ERP by SS49',
    description:
      'Connected school operations for families, staff and education officers.',
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
        {children}
      </body>
    </html>
  );
}
