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
  const hasCustomPerm = customRole?.can_manage_categories === true;

  if (!isAdmin && !hasCustomPerm) {
    return {
      error: 'صلاحية مرفوضة: حسابك لا يملك صلاحية إدارة أو تعديل التصنيفات والكتالوجات',
      status: 403,
    };
  }

  return { callerProfile, callerUser };
}

// ── POST: Create New Category / Catalog ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyCategoryManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { id, name_ar, slug, parent_id, icon, image_url, sort_order, is_active } = body;

    if (!name_ar || !name_ar.trim()) {
      return NextResponse.json({ success: false, error: 'اسم التصنيف مطلوب' }, { status: 400 });
    }

    const insertPayload: Record<string, any> = {
      id: id || crypto.randomUUID(),
      name_ar: name_ar.trim(),
      slug: slug || 'cat-' + Date.now(),
      parent_id: parent_id || null,
      icon: icon || '',
      image_url: image_url || null,
      sort_order: typeof sort_order === 'number' ? sort_order : 1,
      is_active: is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: `فشل حفظ التصنيف: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}

// ── PATCH: Update Category / Catalog ────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyCategoryManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف التصنيف مطلوب (id)' }, { status: 400 });
    }

    const patchPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name_ar !== undefined) patchPayload.name_ar = String(updates.name_ar).trim();
    if (updates.slug !== undefined) patchPayload.slug = String(updates.slug).trim();
    if (updates.parent_id !== undefined) patchPayload.parent_id = updates.parent_id || null;
    if (updates.icon !== undefined) patchPayload.icon = updates.icon;
    if (updates.image_url !== undefined) patchPayload.image_url = updates.image_url || null;
    if (updates.sort_order !== undefined) patchPayload.sort_order = Number(updates.sort_order);
    if (updates.is_active !== undefined) patchPayload.is_active = !!updates.is_active;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patchPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: `فشل تحديث التصنيف: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
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

