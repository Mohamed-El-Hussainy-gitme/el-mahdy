import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';


const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-cairo',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0099DD',
};

export const metadata: Metadata = {
  title: 'متجر MH EL MAHDY | منصة التجارة والتوزيع',
  description: 'المتجر الرسمي للعلامة التجارية MH EL MAHDY - إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية',
  applicationName: 'MH EL MAHDY',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MH EL MAHDY',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body className={`${cairo.className} min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-mahdy-500 selection:text-white`}>
        <StoreProvider>
          <ServiceWorkerRegister />
          <ErrorBoundary context="RootLayout">
            {children}
          </ErrorBoundary>
        </StoreProvider>
      </body>
    </html>
  );
}

