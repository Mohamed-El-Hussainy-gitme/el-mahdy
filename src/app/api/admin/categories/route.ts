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

// Helper: Verify caller has category management permissions (Admin or Custom Role with can_manage_categories)
async function verifyCategoryManager(request: NextRequest, supabaseAdmin: any) {
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

  const isAdmin = callerProfile.role === 'admin';
  const hasCustomPerm = callerProfile.custom_role?.can_manage_categories === true;

  if (!isAdmin && !hasCustomPerm) {
    return {
      error: 'صلاحية مرفوضة: حسابك لا يملك صلاحية إدارة أو مسح التصنيفات والكتالوجات',
      status: 403,
    };
  }

  return { callerProfile, callerUser };
}

// ── DELETE: Delete Category / Catalog ───────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyCategoryManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'معرف التصنيف مطلوب (id)' }, { status: 400 });
    }

    // 1. Unlink child categories (set parent_id = null)
    await supabaseAdmin
      .from('categories')
      .update({ parent_id: null })
      .eq('parent_id', categoryId);

    // 2. Unlink product relationships
    await supabaseAdmin
      .from('product_categories')
      .delete()
      .eq('category_id', categoryId);

    // 3. Delete category
    const { error: delErr } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (delErr) {
      return NextResponse.json({
        success: false,
        error: `فشل مسح التصنيف: ${delErr.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف التصنيف بنجاح',
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'حدث خطأ أثناء حذف التصنيف',
    }, { status: 500 });
  }
}
