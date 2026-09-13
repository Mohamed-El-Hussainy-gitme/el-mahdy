-- Migration 00006: Inventory Adjustments (تسويات جردية)
-- Audit trail for manual stock corrections by admin

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  model_id        UUID REFERENCES master_models(id) ON DELETE SET NULL,
  adjusted_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN ('surplus', 'deficit', 'damage', 'correction', 'return_stock')
  ),
  quantity_before INT  NOT NULL,
  quantity_change INT  NOT NULL,  -- positive = add, negative = remove
  quantity_after  INT  NOT NULL,
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_model   ON inventory_adjustments(model_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_date    ON inventory_adjustments(created_at DESC);

-- RLS: admin only
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_adjustments" ON inventory_adjustments;
CREATE POLICY "admin_manage_adjustments" ON inventory_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
