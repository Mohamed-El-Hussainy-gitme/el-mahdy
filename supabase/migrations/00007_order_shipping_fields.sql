-- Migration 00007: Order Shipping & Return Fields
-- Adds carrier_name, waybill_number, return_reason, and return_notes

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS return_reason TEXT CHECK (
    return_reason IS NULL OR return_reason IN ('customer_refused', 'damaged_in_transit', 'wrong_order', 'wrong_model', 'other')
  ),
  ADD COLUMN IF NOT EXISTS return_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill_number) WHERE waybill_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_return_reason ON orders(return_reason) WHERE return_reason IS NOT NULL;

COMMENT ON COLUMN orders.carrier_name IS 'Name of shipping company or manual delivery method';
COMMENT ON COLUMN orders.waybill_number IS 'Independent consignment/waybill tracking number';
COMMENT ON COLUMN orders.return_reason IS 'Reason for return if order status is returned';
COMMENT ON COLUMN orders.return_notes IS 'Detailed notes or explanation for return';
