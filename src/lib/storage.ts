import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Compresses an image file using the Canvas API before upload.
 * - Converts to ultra-efficient WebP format (or JPEG fallback).
 * - Resizes to max 1000px on the longest side (optimal for high-DPI product display).
 * - Compresses with quality 0.78 (visually sharp, ~30-50KB size).
 * - Falls back to the original file if Canvas is unavailable (SSR / Node env).
 */
async function compressImage(file: File, maxPx = 1000, quality = 0.78): Promise<File> {
  // Guard: only run in browser with Canvas support
  if (typeof window === 'undefined' || !('HTMLCanvasElement' in window)) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if either dimension exceeds maxPx
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Canvas ctx unavailable, keep original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Check if browser supports WebP canvas export
      const supportsWebp = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      const targetMime = supportsWebp ? 'image/webp' : 'image/jpeg';
      const targetExt = supportsWebp ? '.webp' : '_c.jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // toBlob failed, keep original
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedName = `${baseName}${targetExt}`;
          resolve(new File([blob], compressedName, { type: targetMime }));
        },
        targetMime,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Image failed to load, keep original
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads an image file to Supabase Storage bucket ('product-images').
 * Routes through the server API (/api/admin/upload) with Service Role & Sharp optimization
 * to completely eliminate client-side RLS permission issues.
 */
export async function uploadImage(file: File, folder: string = 'general'): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { url: URL.createObjectURL(file), error: null };
  }

  try {
    // ── Step 1: Compress client-side first for fast transfer ────────────────
    const compressedFile = await compressImage(file);

    // ── Step 2: Upload via Server API (Service Role) ────────────────────────
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('folder', folder);

    // Attach staff session header if available in localStorage
    const headers: Record<string, string> = {};
    try {
      const stored = localStorage.getItem('mh_mahdy_staff');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) headers['x-staff-id'] = parsed.id;
      }
    } catch {}

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (res.ok && data.success && data.url) {
      return { url: data.url, error: null };
    }

    // If server upload failed, fallback to client-side direct upload attempt
    console.warn('Server upload failed, falling back to direct upload:', data.error);
    const fileExt = compressedFile.name.split('.').pop() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, compressedFile, {
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      return { url: null, error: data.error || uploadError.message };
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return { url: urlData.publicUrl, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الصورة';
    return { url: null, error: message };
  }
}

/**
 * Backward compatibility alias for uploading product or folder images.
 */
export async function uploadProductImage(file: File, folder: string = 'products'): Promise<{ url: string | null; error: string | null }> {
  return uploadImage(file, folder);
}

