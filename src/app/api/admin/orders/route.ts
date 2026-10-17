import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dsoweayuqbdceymsuiii.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, items, editReason, staffId } = body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'بيانات الطلبية غير مكتملة' }, { status: 400 });
    }

    // 1. Fetch current order
    const { data: currentOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !currentOrder) {
      return NextResponse.json({ success: false, error: 'لم يتم العثور على الطلبية' }, { status: 404 });
    }

    // 2. Permission check: Only allow modifying pending or preparation orders
    if (currentOrder.status === 'shipping' || currentOrder.status === 'delivered') {
      // Check if user is admin
      let isAllowed = false;
      if (staffId) {
        const { data: staff } = await supabaseAdmin
          .from('user_profiles')
          .select('role')
          .eq('id', staffId)
          .maybeSingle();
        if (staff?.role === 'admin') isAllowed = true;
      }
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: 'لا يمكن تعديل الطلبيات التي تم شحنها أو تسليمها إلا بصلاحية المدير العام.' },
          { status: 403 }
        );
      }
    }

    // 3. Compute authoritative total amount from items
    let calculatedTotal = 0;
    const validatedItems = items.map((it: any) => {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const unitPrice = Math.max(0, parseFloat(it.unit_price) || 0);
      const subtotal = qty * unitPrice;
      calculatedTotal += subtotal;

      return {
        id: it.id && !it.id.startsWith('new-') ? it.id : undefined,
        order_id: orderId,
        product_id: it.product_id,
        model_id: it.model_id || null,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: subtotal,
      };
    });

    // 4. Delete old order_items and insert updated items
    const { error: delErr } = await supabaseAdmin
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (delErr) {
      console.error('Delete order_items error:', delErr);
      return NextResponse.json({ success: false, error: 'فشل تحديث بنود الطلبية' }, { status: 500 });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('order_items')
      .insert(validatedItems);

    if (insertErr) {
      console.error('Insert order_items error:', insertErr);
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    // 5. Update orders table with exact recalculated total
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      total_amount: calculatedTotal,
      updated_at: nowIso,
    };

    if (editReason) {
      const existingNotes = currentOrder.notes ? `${currentOrder.notes}\n` : '';
      updatePayload.notes = `${existingNotes}[تعديل فاتورة ${nowIso.slice(0, 10)}]: ${editReason}`;
    }

    const { error: updateOrderErr } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateOrderErr) {
      console.error('Update order total error:', updateOrderErr);
      return NextResponse.json({ success: false, error: updateOrderErr.message }, { status: 500 });
    }

    // 6. Record Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'order_items_updated',
        actor_id: staffId || null,
        metadata: {
          order_id: orderId,
          order_number: currentOrder.order_number,
          previous_total: currentOrder.total_amount,
          new_total: calculatedTotal,
          previous_items_count: currentOrder.items?.length,
          new_items_count: validatedItems.length,
          edit_reason: editReason || 'تعديل فاتورة من لوحة التحكم',
        },
        severity: 'info',
      });
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث الفاتورة وإعادة حساب الإجمالي بنجاح',
      total_amount: calculatedTotal,
    });
  } catch (err: any) {
    console.error('Order PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
