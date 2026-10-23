-- Migration 00028: Add deposit/advance payment fields to orders table
-- Run this in Supabase SQL Editor Dashboard

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_notes TEXT,
  ADD COLUMN IF NOT EXISTS deposit_recorded_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS deposit_recorded_at TIMESTAMPTZ;

-- Comment on new columns
COMMENT ON COLUMN orders.deposit_amount IS 'مبلغ العربون / الدفعة المقدمة المسجلة على هذا الطلب';
COMMENT ON COLUMN orders.deposit_notes IS 'ملاحظات تفاصيل الدفعة المقدمة';
COMMENT ON COLUMN orders.deposit_recorded_by IS 'موظف تسجيل الدفعة (مندوب أو أدمن)';
COMMENT ON COLUMN orders.deposit_recorded_at IS 'تاريخ ووقت تسجيل الدفعة المقدمة';
