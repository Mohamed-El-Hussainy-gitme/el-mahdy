import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Compresses an image file using the Canvas API before upload.
 * - Resizes to max 1600px on the longest side.
 * - Re-encodes as JPEG at 82% quality (good balance for B2B product images).
 * - Falls back to the original file if Canvas is unavailable (SSR / Node env).
 */
async function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<File> {
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

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // toBlob failed, keep original
            return;
          }
          // Use .jpg extension for the compressed output
          const compressedName = file.name.replace(/\.[^/.]+$/, '') + '_c.jpg';
          resolve(new File([blob], compressedName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
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
 * Automatically compresses large images client-side before uploading.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(file: File, folder: string = 'general'): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    // If Supabase is not configured, create a local object URL for preview
    return { url: URL.createObjectURL(file), error: null };
  }

  try {
    // ── Step 1: Compress before upload ──────────────────────────────────────
    const fileToUpload = await compressImage(file);

    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, fileToUpload, {
        cacheControl: '31536000', // 1 year cache for static product images
        upsert: false,
      });

    if (uploadError) {
      console.warn('Storage upload error:', uploadError.message);
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return { url: data.publicUrl, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown upload error';
    return { url: null, error: message };
  }
}

/**
 * Backward compatibility alias for uploading product or folder images.
 */
export async function uploadProductImage(file: File, folder: string = 'products'): Promise<{ url: string | null; error: string | null }> {
  return uploadImage(file, folder);
}
