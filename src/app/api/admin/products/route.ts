import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper: Verify caller has product management permissions (Admin or Custom Role with can_manage_products)
async function verifyProductManager(request: NextRequest, supabaseAdmin: any) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { error: 'غير مصرح: يرجى تسجيل الدخول', status: 401 };
  }

  const { data: { user: callerUser }, error: callerAuthError } = await supabaseAdmin.auth.getUser(token);

  if (callerAuthError || !callerUser) {
    return { error: 'جلسة تسجيل الدخول غير صالحة أو منتهية', status: 401 };
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('*, custom_role:custom_roles(*)')
    .eq('auth_user_id', callerUser.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile) {
    return { error: 'تعذر العثور على ملف تعريف المستخدم', status: 403 };
  }

  let customRole = callerProfile.custom_role;
  if (!customRole && callerProfile.custom_role_id) {
    const { data: crData } = await supabaseAdmin
      .from('custom_roles')
      .select('*')
      .eq('id', callerProfile.custom_role_id)
      .maybeSingle();
    if (crData) customRole = crData;
  }

  const isAdmin = callerProfile.role === 'admin';
  const hasCustomPerm = customRole?.can_manage_products === true;

  if (!isAdmin && !hasCustomPerm) {
    return {
      error: 'صلاحية مرفوضة: حسابك لا يملك صلاحية إدارة أو مسح المنتجات',
      status: 403,
    };
  }

  return { callerProfile, callerUser };
}

// ── DELETE: Delete Product ──────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyProductManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ success: false, error: 'معرف المنتج مطلوب (id)' }, { status: 400 });
    }

    // 1. Unlink categories
    await supabaseAdmin.from('product_categories').delete().eq('product_id', productId);

    // 2. Unlink matrix items
    await supabaseAdmin.from('product_model_matrix').delete().eq('product_id', productId);

    // 3. Unlink inventory adjustments
    await supabaseAdmin.from('inventory_adjustments').delete().eq('product_id', productId);

    // 4. Handle order_items referencing this product
    // First try setting product_id to null (works after migration 00022)
    const { error: setNullErr } = await supabaseAdmin
      .from('order_items')
      .update({ product_id: null })
      .eq('product_id', productId);

    if (setNullErr) {
      // If setting null failed due to NOT NULL constraint (migration 00022 not run yet),
      // delete the order_items referencing this product so the admin deletion can succeed
      await supabaseAdmin.from('order_items').delete().eq('product_id', productId);
    }

    // 5. Delete product itself
    const { error: delErr } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

    if (delErr) {
      return NextResponse.json({
        success: false,
        error: `فشل مسح المنتج من قاعدة البيانات: ${delErr.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف المنتج نهائياً من النظام',
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحذف',
    }, { status: 500 });
  }
}
