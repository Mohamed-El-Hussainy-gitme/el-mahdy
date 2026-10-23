const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: buckets, error: bErr } = await sb.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name), bErr);

  const { data, error } = await sb.storage.from('product-images').list('products', { limit: 100 });
  if (error) {
    console.error('List error:', error);
  } else {
    console.log(`Found ${data.length} files in 'product-images/products':`, data.slice(0, 10).map(f => f.name));
  }
}

check();
