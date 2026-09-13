import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'متجر MH EL MAHDY | منصة التجارة والتوزيع',
    short_name: 'MH EL MAHDY',
    description: 'المتجر الرسمي للعلامة التجارية MH EL MAHDY - إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0F172A',
    theme_color: '#0099DD',
    lang: 'ar',
    dir: 'rtl',
    categories: ['shopping', 'business'],
    // PWA screenshots for install prompt
    screenshots: [],
    // Complete icon set for all devices
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      // Fallback to logo.png if specific sizes not generated yet
      {
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    // Shortcuts for quick actions from home screen
    shortcuts: [
      {
        name: 'كتالوج المنتجات',
        short_name: 'الكتالوج',
        description: 'تصفح المنتجات المتاحة',
        url: '/?ref=shortcut',
        icons: [{ src: '/logo.png', sizes: 'any' }],
      },
    ],
  };
}
