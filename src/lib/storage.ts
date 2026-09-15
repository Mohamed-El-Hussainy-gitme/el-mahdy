import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Uploads an image file to Supabase Storage bucket ('product-images').
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(file: File, folder: string = 'general'): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    // If Supabase is not configured, create a local object URL for preview
    return { url: URL.createObjectURL(file), error: null };
  }

  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, {
        cacheControl: '3600',
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

