-- Migration 00005: Product Enhancements
-- Adds cost_price (internal admin-only) and gallery_urls (multi-image support)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';

-- Index for cost_price queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_products_cost_price ON products(cost_price);

COMMENT ON COLUMN products.cost_price IS 'Internal cost price — visible to admin only for margin tracking';
COMMENT ON COLUMN products.gallery_urls IS 'Array of additional image URLs for product gallery';
