import { Order } from '@/types';

/**
 * Generates and triggers printable picking slip (إذن صرف مخزني) for the warehouse preparer.
 */
export function printPickingSlip(order: Order): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }

  const itemsRows = order.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">
        ${item.product_title}
        <div style="font-size: 10px; color: #64748b; font-family: monospace;">SKU: ${item.product_sku}</div>
      </td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background: #f8fafc;">
        ${item.model_name ? item.model_name : '—'}
      </td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-size: 14px; font-weight: 800;">
        ${item.quantity} قطعة
      </td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; color: #94a3b8;">
        [ &nbsp; &nbsp; &nbsp; ]
      </td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>إذن صرف مخزني - ${order.order_number}</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 900; color: #0284c7; }
        .badge { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        th { background: #0f172a; color: white; padding: 8px; text-align: right; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #94a3b8; font-size: 12px; }
        @media print {
          body { margin: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">MH EL MAHDY — إذن صرف وتجهيز مخزني</div>
          <div style="font-size: 11px; color: #64748b;">مستودع البضائع المركزي | دورة حياة التجهيز</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 14px; font-weight: bold; font-family: monospace;">${order.order_number}</div>
          <div style="font-size: 11px; color: #64748b;">${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <strong>العميل التجاري:</strong> ${order.customer_name} ${order.customer_company ? `(${order.customer_company})` : ''}<br>
          <strong>الهاتف:</strong> <span style="font-family: monospace;">${order.customer_phone}</span><br>
          <strong>عنوان الشحن:</strong> ${order.shipping_address || 'استلام مباشر من المستودع'}
        </div>
        <div>
          <strong>المندوب المعتمد:</strong> ${order.sales_agent_name || 'إدارة المبيعات المركزية'}<br>
          <strong>طريقة الشحن / الناقل:</strong> ${order.carrier_name || 'غير محدد'}<br>
          <strong>بوليصة الشحن:</strong> ${order.waybill_number || '—'}
        </div>
      </div>

      ${order.notes ? `<div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px; border-radius: 6px; font-size: 11px; margin-bottom: 16px;"><strong>ملاحظات العميل:</strong> ${order.notes}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>المنتج وكود SKU</th>
            <th style="text-align: center; width: 220px;">الموديل المتوافق</th>
            <th style="text-align: center; width: 100px;">الكمية المطلوبة</th>
            <th style="text-align: center; width: 60px;">تم التجهيز</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="signatures">
        <div><strong>توقيع مسؤول التجهيز:</strong> ______________________</div>
        <div><strong>توقيع مراجع المستودع:</strong> ______________________</div>
        <div><strong>توقيع السائق / المندوب:</strong> ______________________</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generates and triggers printable commercial delivery invoice (فاتورة تسليم بضاعة) for customer/carrier.
 */
export function printDeliveryInvoice(order: Order): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }

  const itemsRows = order.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #e2e8f0; padding: 8px;">${idx + 1}</td>
      <td style="border: 1px solid #e2e8f0; padding: 8px;">
        <span style="font-weight: bold;">${item.product_title}</span>
        <span style="font-size: 10px; color: #64748b; font-family: monospace;">(${item.product_sku})</span>
      </td>
      <td style="text-align: center; border: 1px solid #e2e8f0; padding: 8px; font-weight: 600;">
        ${item.model_name ? item.model_name : '—'}
      </td>
      <td style="text-align: center; border: 1px solid #e2e8f0; padding: 8px; font-weight: 800;">
        ${item.quantity}
      </td>
      <td style="text-align: left; border: 1px solid #e2e8f0; padding: 8px; font-family: monospace;">
        ${item.unit_price.toFixed(2)} ج.م
      </td>
      <td style="text-align: left; border: 1px solid #e2e8f0; padding: 8px; font-weight: bold; font-family: monospace; color: #0284c7;">
        ${item.subtotal.toFixed(2)} ج.م
      </td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>فاتورة تسليم بضاعة - ${order.order_number}</title>
      <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 25px; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0099DD; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-text { font-size: 22px; font-weight: 900; color: #0099DD; letter-spacing: 0.5px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background: #0f172a; color: white; padding: 10px; text-align: right; }
        .total-box { margin-right: auto; width: 280px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; font-size: 13px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .grand-total { font-size: 16px; font-weight: 900; color: #0099DD; border-top: 1px solid #bae6fd; padding-top: 6px; margin-top: 6px; }
        .footer { margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-text">MH EL MAHDY</div>
          <div style="font-size: 12px; color: #475569; font-weight: bold;">فاتورة تسليم بضاعة تجارية</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #0f172a;">${order.order_number}</div>
          <div style="font-size: 11px; color: #64748b;">تاريخ الفاتورة: ${new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
        </div>
      </div>

      <div class="info-card">
        <div>
          <div style="color: #64748b; margin-bottom: 4px;">بيانات العميل:</div>
          <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${order.customer_name}</div>
          ${order.customer_company ? `<div>${order.customer_company}</div>` : ''}
          <div>الهاتف: <span style="font-family: monospace;">${order.customer_phone}</span></div>
          <div>العنوان: ${order.shipping_address || 'استلام من المقر'}</div>
        </div>
        <div>
          <div style="color: #64748b; margin-bottom: 4px;">بيانات المندوب والتوصيل:</div>
          <div><strong>المندوب المعتمد:</strong> ${order.sales_agent_name || 'إدارة المبيعات المركزية'}${order.sales_agent_phone ? ` (${order.sales_agent_phone})` : ''}</div>
          ${order.carrier_name ? `<div><strong>شركة الشحن:</strong> ${order.carrier_name}</div>` : ''}
          ${order.waybill_number ? `<div><strong>رقم البوليصة:</strong> <span style="font-family: monospace;">${order.waybill_number}</span></div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>الصنف</th>
            <th style="text-align: center;">الموديل</th>
            <th style="text-align: center; width: 80px;">الكمية</th>
            <th style="text-align: left; width: 100px;">سعر الوحدة</th>
            <th style="text-align: left; width: 110px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end;">
        <div class="total-box">
          <div class="total-row">
            <span>عدد الأصناف:</span>
            <strong>${order.items.length} صنف</strong>
          </div>
          <div class="total-row">
            <span>إجمالي القطع:</span>
            <strong>${order.items.reduce((acc, it) => acc + it.quantity, 0)} قطعة</strong>
          </div>
          <div class="total-row grand-total">
            <span>إجمالي الفاتورة:</span>
            <span>${order.total_amount.toFixed(2)} ج.م</span>
          </div>
        </div>
      </div>

      <div class="footer">
        بضائع معتمدة من MH EL MAHDY — للاستفسارات والمتابعة، يرجى التواصل مباشرة مع المندوب المعتمد عبر واتساب.
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
