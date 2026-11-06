import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const siteUrl =
  new URL(
    process.env.SITE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'https://govt-school-system.onrender.com/',
  ).origin + '/';
const previewImage = `${siteUrl}og.png?v=3`;

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
  description:
    'Shiksha-Setu school operations pilot with fictional records and separate reference previews.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description:
      'School operations pilot with fictional records and reference previews.',
    url: siteUrl,
    siteName: 'Shikshan Setu',
    type: 'website',
    images: [
      {
        url: previewImage,
        secureUrl: previewImage,
        type: 'image/png',
        width: 1731,
        height: 909,
        alt: 'Shikshan Setu — Nagpur School Command Centre',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shikshan Setu | Nagpur School Command Centre',
    description:
      'School operations pilot with fictional records and reference previews.',
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
