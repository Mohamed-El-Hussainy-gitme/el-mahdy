import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elmahdy.com';
  const now = new Date().toISOString();

  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];
}
