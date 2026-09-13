import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeEgyptianPhone } from '@/utils/phoneUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, role, password } = body;

    if (!fullName?.trim() || !phone?.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'يرجى استكمال جميع البيانات المطلوبة (الاسم، الهاتف، كلمة المرور)' },
        { status: 400 }
      );
    }

    // ── Input Length Guards ─────────────────────────────────────────────────
    if (String(fullName).trim().length > 100) {
      return NextResponse.json({ success: false, error: 'الاسم لا يجب أن يتجاوز 100 حرف' }, { status: 400 });
    }
    if (String(phone).trim().length > 20) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف لا يجب أن يتجاوز 20 رقماً' }, { status: 400 });
    }
    if (email && String(email).trim().length > 254) {
      return NextResponse.json({ success: false, error: 'البريد الإلكتروني طويل جداً' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
    }
    if (String(password).length > 128) {
      return NextResponse.json({ success: false, error: 'كلمة المرور لا يجب أن تتجاوز 128 حرفاً' }, { status: 400 });
    }

    const validRoles = ['admin', 'sales_agent', 'warehouse_preparer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'نوع الدور الوظيفي غير صالح' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' },
        { status: 500 }
      );
    }

    // Isolated server-side Supabase client with authentic service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ── RBAC Security Guard: Verify Caller is an Active Admin ──
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح: يجب تسجيل الدخول بحساب مدير النظام (Admin)' },
        { status: 401 }
      );
    }

    const { data: { user: callerUser }, error: callerAuthError } = await supabaseAdmin.auth.getUser(token);

    if (callerAuthError || !callerUser) {
      return NextResponse.json(
        { success: false, error: 'جلسة تسجيل الدخول غير صالحة أو منتهية' },
        { status: 401 }
      );
    }

    // Check role in user_profiles
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', callerUser.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'صلاحية مرفوضة: إضافة وتعيين الموظفين مقصورة حصراً على مدير النظام (Admin)' },
        { status: 403 }
      );
    }

    const cleanPhone = normalizeEgyptianPhone(phone);
    const cleanEmail = (email?.trim() || `${cleanPhone}@elmahdy.com`).toLowerCase();
    const cleanName = fullName.trim();

    // 1. Create auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        role: role,
      },
    });

    let authUserId: string | null = null;

    if (authError) {
      // If user already registered in auth, look up existing user ID
      if (
        authError.message.toLowerCase().includes('already been registered') ||
        authError.message.toLowerCase().includes('already exists')
      ) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuth = existingUsers?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (existingAuth) {
          authUserId = existingAuth.id;
        } else {
          return NextResponse.json(
            { success: false, error: `البريد الإلكتروني مسجل بالفعل: ${authError.message}` },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: `فشل إنشاء حساب الموظف: ${authError.message}` },
          { status: 400 }
        );
      }
    } else {
      authUserId = authData.user?.id || null;
    }

    // 2. Create or update profile in user_profiles
    const profilePayload: any = {
      auth_user_id: authUserId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: role,
    };

    let { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ ...profilePayload, is_active: true }, { onConflict: 'email' })
      .select()
      .single();

    // Fallback if is_active column is not yet present in schema
    if (profileError && profileError.message.includes('is_active')) {
      const fallback = await supabaseAdmin
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'email' })
        .select()
        .single();
      profile = fallback.data;
      profileError = fallback.error;
    }

    if (profileError) {
      return NextResponse.json(
        { success: false, error: `فشل حفظ ملف الموظف في قاعدة البيانات: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إضافة الموظف بنجاح',
      staff: profile,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/staff:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ غير متوقع في الخادم' },
      { status: 500 }
    );
  }
}
