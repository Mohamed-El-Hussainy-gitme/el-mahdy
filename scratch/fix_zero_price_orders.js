const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Checking for zero-price order items ---');

  // 1. Fetch zero-price order items
  const { data: zeroItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, quantity, unit_price, subtotal')
    .lte('unit_price', 0);

  if (itemsErr) {
    console.error('Error fetching order items:', itemsErr);
    return;
  }

  console.log(`Found ${zeroItems.length} order items with price <= 0`);

  const affectedOrderIds = new Set();

  for (const item of zeroItems) {
    console.log(`Item ID: ${item.id}, Order ID: ${item.order_id}, Product ID: ${item.product_id}, Qty: ${item.quantity}`);
    affectedOrderIds.add(item.order_id);

    // Look up the actual product price
    const { data: prod, error: prodErr } = await supabase
      .from('products')
      .select('id, title_ar, price')
      .eq('id', item.product_id)
      .single();

    if (prodErr || !prod) {
      console.warn(`Could not find product ${item.product_id}:`, prodErr);
      continue;
    }

    const correctPrice = Number(prod.price) > 0 ? Number(prod.price) : 8; // fallback to 8 if product price was 0
    const correctSubtotal = correctPrice * Number(item.quantity);

    console.log(`Updating item ${item.id} (${prod.title_ar}): unit_price ${item.unit_price} -> ${correctPrice}, subtotal ${item.subtotal} -> ${correctSubtotal}`);

    const { error: updateErr } = await supabase
      .from('order_items')
      .update({
        unit_price: correctPrice,
        subtotal: correctSubtotal
      })
      .eq('id', item.id);

    if (updateErr) {
      console.error(`Failed to update item ${item.id}:`, updateErr);
    } else {
      console.log(`Successfully updated item ${item.id}`);
    }
  }

  // 2. Recalculate total_amount for all affected orders
  for (const orderId of affectedOrderIds) {
    const { data: allItems, error: allItemsErr } = await supabase
      .from('order_items')
      .select('subtotal')
      .eq('order_id', orderId);

    if (allItemsErr || !allItems) {
      console.error(`Failed to fetch items for order ${orderId}:`, allItemsErr);
      continue;
    }

    const newTotal = allItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);

    console.log(`Updating order ${orderId} total_amount to ${newTotal}`);

    const { error: orderUpdateErr } = await supabase
      .from('orders')
      .update({ total_amount: newTotal })
      .eq('id', orderId);

    if (orderUpdateErr) {
      console.error(`Failed to update order ${orderId}:`, orderUpdateErr);
    } else {
      console.log(`Order ${orderId} updated successfully to ${newTotal} EGP`);
    }
  }

  // 3. Also check if "واصله دولفين مستورده" product itself has price > 0
  const { data: dolphinProd } = await supabase
    .from('products')
    .select('id, title_ar, price')
    .eq('id', 'f4a2ff1a-a002-4e19-9638-8712d228737e')
    .single();

  if (dolphinProd) {
    console.log(`Dolphin product price in DB: ${dolphinProd.price}`);
    if (dolphinProd.price <= 0) {
      await supabase.from('products').update({ price: 8 }).eq('id', dolphinProd.id);
      console.log('Fixed dolphin product price to 8 EGP');
    }
  }

  console.log('Done!');
}

run().catch(console.error);
