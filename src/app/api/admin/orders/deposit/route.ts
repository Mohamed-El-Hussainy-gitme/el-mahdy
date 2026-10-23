import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dsoweayuqbdceymsuiii.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, notes, staffId } = body;

    if (!orderId || amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json({ success: false, error: 'بيانات الدفعة غير مكتملة' }, { status: 400 });
    }

    const depositAmount = Math.max(0, parseFloat(amount));

    // Verify order exists
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, total_amount')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'لم يتم العثور على الطلبية' }, { status: 404 });
    }

    // Verify staff permissions: must be sales_agent or admin
    if (staffId) {
      const { data: staff } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', staffId)
        .maybeSingle();

      const allowedRoles = ['admin', 'sales_agent'];
      if (!staff || !allowedRoles.includes(staff.role)) {
        return NextResponse.json({ success: false, error: 'ليس لديك صلاحية تسجيل الدفعات' }, { status: 403 });
      }
    }

    // Validate deposit doesn't exceed total
    if (depositAmount > order.total_amount) {
      return NextResponse.json(
        { success: false, error: `الدفعة (${depositAmount} ج.م) تتجاوز إجمالي الفاتورة (${order.total_amount} ج.م)` },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // Update orders table
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        deposit_amount: depositAmount,
        deposit_notes: notes || null,
        deposit_recorded_by: staffId || null,
        deposit_recorded_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', orderId);

    if (updateErr) {
      console.error('Deposit update error:', updateErr);
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'order_deposit_recorded',
        actor_id: staffId || null,
        metadata: {
          order_id: orderId,
          order_number: order.order_number,
          deposit_amount: depositAmount,
          total_amount: order.total_amount,
          remaining: order.total_amount - depositAmount,
          notes: notes || null,
        },
        severity: 'info',
      });
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `تم تسجيل دفعة ${depositAmount.toFixed(2)} ج.م بنجاح`,
      deposit_amount: depositAmount,
      deposit_notes: notes || null,
      deposit_recorded_at: nowIso,
    });
  } catch (err: any) {
    console.error('Deposit POST error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
