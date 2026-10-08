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
  const staffId = request.headers.get('x-staff-id');

  // Case 1: Bearer token is provided
  if (token) {
    const { data: { user: callerUser }, error: callerAuthError } = await supabaseAdmin.auth.getUser(token);
    if (!callerAuthError && callerUser) {
      let { data: callerProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('*, custom_role:custom_roles(*)')
        .eq('auth_user_id', callerUser.id)
        .maybeSingle();

      if (!callerProfile && callerUser.email) {
        const { data: byEmail } = await supabaseAdmin
          .from('user_profiles')
          .select('*, custom_role:custom_roles(*)')
          .eq('email', callerUser.email)
          .maybeSingle();
        if (byEmail) {
          callerProfile = byEmail;
          await supabaseAdmin
            .from('user_profiles')
            .update({ auth_user_id: callerUser.id })
            .eq('id', byEmail.id);
        }
      }

      if (callerProfile) {
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
        if (isAdmin || hasCustomPerm) {
          return { callerProfile, callerUser };
        }
      }
    }
  }

  // Case 2: x-staff-id header fallback (for staff session persistence)
  if (staffId) {
    const { data: staffProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*, custom_role:custom_roles(*)')
      .eq('id', staffId)
      .eq('is_active', true)
      .maybeSingle();

    if (staffProfile) {
      let customRole = staffProfile.custom_role;
      if (!customRole && staffProfile.custom_role_id) {
        const { data: crData } = await supabaseAdmin
          .from('custom_roles')
          .select('*')
          .eq('id', staffProfile.custom_role_id)
          .maybeSingle();
        if (crData) customRole = crData;
      }

      const isAdmin = staffProfile.role === 'admin';
      const hasCustomPerm = customRole?.can_manage_products === true;
      if (isAdmin || hasCustomPerm) {
        return { callerProfile: staffProfile, callerUser: null };
      }
    }
  }

  return {
    error: 'صلاحية مرفوضة: حسابك لا يملك صلاحية إدارة أو تعديل المنتجات',
    status: 403,
  };
}

// ── POST: Create New Product ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyProductManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const {
      id,
      sku,
      title_ar,
      description_ar,
      price,
      cost_price,
      image_url,
      gallery_urls,
      is_exchange_only,
      is_featured,
      is_active,
      has_compatibility_matrix,
      category_ids,
    } = body;

    if (!sku?.trim() || !title_ar?.trim() || price === undefined) {
      return NextResponse.json({ success: false, error: 'يرجى استكمال البيانات الإلزامية للمنتج (SKU، الاسم، السعر)' }, { status: 400 });
    }

    const insertPayload: Record<string, any> = {
      sku: String(sku).trim(),
      title_ar: String(title_ar).trim(),
      description_ar: description_ar?.trim() || null,
      price: Number(price) || 0,
      cost_price: Number(cost_price) || 0,
      image_url: image_url || '/logo.png',
      gallery_urls: Array.isArray(gallery_urls) ? gallery_urls : [],
      is_exchange_only: Boolean(is_exchange_only),
      is_featured: Boolean(is_featured),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      has_compatibility_matrix: Boolean(has_compatibility_matrix),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      insertPayload.id = id;
    }

    const { data: newProduct, error: insertErr } = await supabaseAdmin
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: `فشل إنشاء المنتج: ${insertErr.message}` }, { status: 500 });
    }

    // Link categories in product_categories
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const links = category_ids.map((catId: string) => ({
        product_id: newProduct.id,
        category_id: catId,
      }));
      await supabaseAdmin.from('product_categories').insert(links);
    }

    return NextResponse.json({
      success: true,
      message: 'تم إضافة المنتج بنجاح',
      product: newProduct,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء إضافة المنتج',
    }, { status: 500 });
  }
}

// ── PATCH: Update Existing Product ──────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'إعدادات قاعدة البيانات غير مكتملة في الخادم' }, { status: 500 });
    }

    const authCheck = await verifyProductManager(request, supabaseAdmin);
    if ('error' in authCheck) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف المنتج مطلوب (id)' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.sku !== undefined) updatePayload.sku = String(updates.sku).trim();
    if (updates.title_ar !== undefined) updatePayload.title_ar = String(updates.title_ar).trim();
    if (updates.description_ar !== undefined) updatePayload.description_ar = updates.description_ar?.trim() || null;
    if (updates.price !== undefined) updatePayload.price = Number(updates.price) || 0;
    if (updates.cost_price !== undefined) updatePayload.cost_price = Number(updates.cost_price) || 0;
    if (updates.image_url !== undefined) updatePayload.image_url = updates.image_url || '/logo.png';
    if (updates.gallery_urls !== undefined) updatePayload.gallery_urls = Array.isArray(updates.gallery_urls) ? updates.gallery_urls : [];
    if (updates.is_exchange_only !== undefined) updatePayload.is_exchange_only = Boolean(updates.is_exchange_only);
    if (updates.is_featured !== undefined) updatePayload.is_featured = Boolean(updates.is_featured);
    if (updates.is_active !== undefined) updatePayload.is_active = Boolean(updates.is_active);
    if (updates.has_compatibility_matrix !== undefined) updatePayload.has_compatibility_matrix = Boolean(updates.has_compatibility_matrix);

    const { data: updatedProduct, error: updateErr } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: `فشل تعديل المنتج: ${updateErr.message}` }, { status: 500 });
    }

    // Update categories if provided
    if (Array.isArray(updates.category_ids)) {
      await supabaseAdmin.from('product_categories').delete().eq('product_id', id);
      if (updates.category_ids.length > 0) {
        const links = updates.category_ids.map((catId: string) => ({
          product_id: id,
          category_id: catId,
        }));
        await supabaseAdmin.from('product_categories').insert(links);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث المنتج بنجاح',
      product: updatedProduct,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء تعديل المنتج',
    }, { status: 500 });
  }
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
    const { error: setNullErr } = await supabaseAdmin
      .from('order_items')
      .update({ product_id: null })
      .eq('product_id', productId);

    if (setNullErr) {
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
