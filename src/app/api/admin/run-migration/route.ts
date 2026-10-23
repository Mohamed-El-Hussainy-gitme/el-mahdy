import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Record<string, string> = {};

    // Test if column already exists
    const { error: testErr } = await supabaseAdmin
      .from('orders')
      .select('deposit_amount')
      .limit(1);

    if (!testErr) {
      return NextResponse.json({ success: true, message: 'Columns already exist', results });
    }

    // Column doesn't exist — use pg directly via connection string in env
    // Since no exec_sql RPC, we'll use direct pg connection
    const { Client } = await import('pg');
    const pgUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

    if (!pgUrl) {
      return NextResponse.json({
        success: false,
        message: 'No DATABASE_URL in env. Please run the SQL manually in Supabase SQL editor:',
        sql: `ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_notes TEXT,
  ADD COLUMN IF NOT EXISTS deposit_recorded_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS deposit_recorded_at TIMESTAMPTZ;`
      });
    }

    const client = new Client({ connectionString: pgUrl });
    await client.connect();

    await client.query(`
      ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS deposit_notes TEXT,
        ADD COLUMN IF NOT EXISTS deposit_recorded_by UUID REFERENCES user_profiles(id),
        ADD COLUMN IF NOT EXISTS deposit_recorded_at TIMESTAMPTZ;
    `);

    await client.end();

    return NextResponse.json({ success: true, message: 'Migration completed successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
