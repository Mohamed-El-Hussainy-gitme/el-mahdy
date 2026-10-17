'use client';

import React, { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';

interface SafeProductImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string | null;
  fallbackSrc?: string;
}

const FALLBACK_DEFAULT = '/placeholder.svg';

// List of known blocked or dead storage domains from old Supabase migrations
const BLOCKED_DOMAINS = [
  'dxkkeilasmafqvpveldi.supabase.co',
];

export const SafeProductImage: React.FC<SafeProductImageProps> = ({
  src,
  alt,
  fallbackSrc = FALLBACK_DEFAULT,
  className = '',
  fill,
  width,
  height,
  ...rest
}) => {
  const [imgSrc, setImgSrc] = useState<string>(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      return fallbackSrc;
    }
    // If the image URL is pointing to a known blocked/expired Supabase project,
    // immediately use the fallback so users don't see broken image errors.
    const isBlocked = BLOCKED_DOMAINS.some((domain) => src.includes(domain));
    if (isBlocked) {
      return fallbackSrc;
    }
    return src;
  });

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      setImgSrc(fallbackSrc);
      return;
    }
    const isBlocked = BLOCKED_DOMAINS.some((domain) => src.includes(domain));
    if (isBlocked) {
      setImgSrc(fallbackSrc);
    } else {
      setImgSrc(src);
      setHasError(false);
    }
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <Image
      src={imgSrc}
      alt={alt || 'صورة المنتج'}
      className={className}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      onError={handleError}
      {...rest}
    />
  );
};

export default SafeProductImage;
