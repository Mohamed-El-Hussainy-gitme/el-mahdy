import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeEgyptianPhone } from '@/utils/phoneUtils';

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

// ── RBAC Security Guard: Verify Caller is an Active Admin ──
async function verifyAdminCaller(request: NextRequest, supabaseAdmin: any) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { error: 'غير مصرح: يجب تسجيل الدخول بحساب مدير النظام (Admin)', status: 401 };
  }

  const { data: { user: callerUser }, error: callerAuthError } = await supabaseAdmin.auth.getUser(token);

  if (callerAuthError || !callerUser) {
    return { error: 'جلسة تسجيل الدخول غير صالحة أو منتهية', status: 401 };
  }

  // Check role in user_profiles
  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role, full_name')
    .eq('auth_user_id', callerUser.id)
    .maybeSingle();

  if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
    return {
      error: 'صلاحية مرفوضة: هذه العملية مقصورة حصراً على مدير النظام (Admin)',
      status: 403,
    };
  }

  return { callerProfile, callerUser };
}

// =============================================================================
// POST: Add new staff member
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyAdminCaller(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { fullName, email, phone, role, password } = body;

    if (!fullName?.trim() || !phone?.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'يرجى استكمال جميع البيانات المطلوبة (الاسم، الهاتف، كلمة المرور)' },
        { status: 400 }
      );
    }

    if (String(fullName).trim().length > 100) {
      return NextResponse.json({ success: false, error: 'الاسم لا يجب أن يتجاوز 100 حرف' }, { status: 400 });
    }
    if (String(phone).trim().length > 20) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف لا يجب أن يتجاوز 20 رقماً' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    const validRoles = ['admin', 'sales_agent', 'warehouse_preparer', 'warehouse'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ success: false, error: 'نوع الدور الوظيفي غير صالح' }, { status: 400 });
    }

    const normalizedRole = role === 'warehouse' ? 'warehouse_preparer' : role;
    const cleanPhone = normalizeEgyptianPhone(phone);
    const cleanEmail = (email?.trim() || `${cleanPhone}@elmahdy.com`).toLowerCase();
    const cleanName = fullName.trim();

    // Guard: Prevent hijacking or creating staff using admin@elmahdy.com
    if (cleanEmail === 'admin@elmahdy.com') {
      return NextResponse.json(
        {
          success: false,
          error: 'لا يمكن استخدام أو تكرار البريد الخاص بحساب مدير النظام الرئيسي (admin@elmahdy.com). يرجى استخدام بريد أو رقم هاتف آخر.',
        },
        { status: 400 }
      );
    }

    // Check if email or phone is already used in user_profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, phone, full_name, role')
      .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error: `البيانات مسجلة بالفعل للموظف (${existingProfile.full_name}) بريد: ${existingProfile.email}. يرجى استخدام بريد إلكتروني أو هاتف مختلف، أو تعديل حسابه القائم من جدول الموظفين.`,
        },
        { status: 400 }
      );
    }

    // 1. Create auth user in Supabase
    let authUserId: string | null = null;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        role: normalizedRole,
      },
    });

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: `فشل إنشاء حساب الموظف: ${authError.message}. إذا كان البريد مستخدماً مسبقاً، يرجى كتابة بريد آخر.`,
        },
        { status: 400 }
      );
    }

    authUserId = authData.user?.id || null;

    // 2. Fetch profile (which may have already been auto-created by the DB trigger) or insert it
    let profile: any = null;

    const { data: existingTriggerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingTriggerProfile) {
      // Update with exact values from the form to ensure complete consistency
      const { data: updatedProfile, error: updateErr } = await supabaseAdmin
        .from('user_profiles')
        .update({
          full_name: cleanName,
          phone: cleanPhone,
          role: normalizedRole,
          email: cleanEmail,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTriggerProfile.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: `فشل استكمال بيانات الموظف: ${updateErr.message}` },
          { status: 500 }
        );
      }
      profile = updatedProfile;
    } else {
      // If no trigger created it, insert profile cleanly
      const { data: insertedProfile, error: insertErr } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          auth_user_id: authUserId,
          full_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: normalizedRole,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) {
        if (authUserId) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        }
        return NextResponse.json(
          { success: false, error: `فشل حفظ ملف الموظف في قاعدة البيانات: ${insertErr.message}` },
          { status: 500 }
        );
      }
      profile = insertedProfile;
    }

    return NextResponse.json({
      success: true,
      message: 'تم إضافة الموظف بنجاح',
      staff: profile,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/staff:', error);
    return NextResponse.json({ success: false, error: error?.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}

// =============================================================================
// PATCH: Edit staff member details, role, and optionally password
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyAdminCaller(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { id, fullName, phone, role, password } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرّف الموظف مطلوب' }, { status: 400 });
    }

    // Lookup target profile
    const { data: targetProfile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ success: false, error: 'الموظف غير موجود في النظام' }, { status: 404 });
    }

    // Self-lockout prevention: Admin cannot remove admin role from themselves
    if (authCheck.callerProfile.id === id && role && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'لا يمكنك تغيير دورك من مدير نظام (Admin) لمنع إغلاق لوحة التحكم على نفسك' },
        { status: 400 }
      );
    }

    // Explicit protection for primary admin account
    if (targetProfile.email === 'admin@elmahdy.com' && role && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'لا يمكن تغيير دور حساب مدير النظام الرئيسي (admin@elmahdy.com)' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'sales_agent', 'warehouse_preparer', 'warehouse'];
    const newRole = role ? (role === 'warehouse' ? 'warehouse_preparer' : role) : targetProfile.role;
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ success: false, error: 'نوع الدور الوظيفي غير صالح' }, { status: 400 });
    }

    const cleanName = fullName !== undefined ? String(fullName).trim() : targetProfile.full_name;
    const cleanPhone = phone !== undefined ? normalizeEgyptianPhone(phone) : targetProfile.phone;

    // 1. Update user_profiles table
    const updatePayload: Record<string, any> = {
      full_name: cleanName,
      phone: cleanPhone,
      role: newRole,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: `فشل تحديث بيانات الموظف: ${updateError.message}` }, { status: 500 });
    }

    // 2. If target has an auth user, update password and metadata
    if (targetProfile.auth_user_id) {
      const authUpdates: Record<string, any> = {
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: newRole,
        },
      };

      if (password && String(password).trim().length >= 6) {
        authUpdates.password = String(password).trim();
      }

      await supabaseAdmin.auth.admin.updateUserById(targetProfile.auth_user_id, authUpdates);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات الموظف والصلاحيات بنجاح',
      staff: updatedProfile,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/staff:', error);
    return NextResponse.json({ success: false, error: error?.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}

// =============================================================================
// DELETE: Delete staff member and remove associated auth user
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyAdminCaller(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرّف الموظف مطلوب للحذف' }, { status: 400 });
    }

    // Self-deletion prevention
    if (authCheck.callerProfile.id === id) {
      return NextResponse.json(
        { success: false, error: 'لا يمكنك حذف حسابك الحالي الذي تستخدمه لتسجيل الدخول' },
        { status: 400 }
      );
    }

    // Check target exists
    const { data: targetProfile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ success: false, error: 'الموظف غير موجود أو تم حذفه مسبقاً' }, { status: 404 });
    }

    // 1. Unlink from assigned customers and orders safely
    await supabaseAdmin
      .from('user_profiles')
      .update({ assigned_sales_rep_id: null })
      .eq('assigned_sales_rep_id', id);

    await supabaseAdmin
      .from('orders')
      .update({ sales_agent_id: null })
      .eq('sales_agent_id', id);

    // 2. Delete auth user if exists
    if (targetProfile.auth_user_id) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(targetProfile.auth_user_id);
      } catch (authDelErr) {
        console.warn('Notice: auth user deletion warning:', authDelErr);
      }
    }

    // 3. Delete profile from user_profiles
    const { error: deleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ success: false, error: `فشل حذف الموظف من قاعدة البيانات: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف الموظف (${targetProfile.full_name}) وحسابه بنجاح`,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/staff:', error);
    return NextResponse.json({ success: false, error: error?.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
