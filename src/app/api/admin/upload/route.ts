import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Initialize Supabase with service role key for guaranteed storage access without RLS restrictions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dsoweayuqbdceymsuiii.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'products';

    if (!file) {
      return NextResponse.json({ success: false, error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }

    // Verify staff header or authorization if provided
    const staffId = req.headers.get('x-staff-id');
    if (staffId) {
      const { data: staff, error: staffErr } = await supabaseAdmin
        .from('user_profiles')
        .select('id, role, is_active')
        .eq('id', staffId)
        .maybeSingle();

      if (staffErr || !staff || staff.is_active === false || staff.role === 'customer') {
        return NextResponse.json({ success: false, error: 'غير مصرح لك برفع الصور' }, { status: 403 });
      }
    }

    // Convert file to buffer for Sharp processing
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Compress & convert to WebP using Sharp
    let outputBuffer: Buffer;
    try {
      outputBuffer = await sharp(inputBuffer)
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch (sharpErr) {
      console.warn('Sharp compression failed, using original buffer:', sharpErr);
      outputBuffer = inputBuffer;
    }

    // Generate unique filename
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const fileName = `${folder}/${Date.now()}-${cleanBase || 'img'}.webp`;

    // Upload using Supabase Admin client (Service Role - No RLS block)
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from('product-images')
      .upload(fileName, outputBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
        upsert: true,
      });

    if (uploadErr) {
      console.error('Admin storage upload error:', uploadErr);
      return NextResponse.json({ success: false, error: uploadErr.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('product-images').getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: fileName,
    });
  } catch (err: any) {
    console.error('Server upload exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ أثناء معالجة الصورة على الخادم' },
      { status: 500 }
    );
  }
}
