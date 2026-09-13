-- Migration 00008: Bulk Matrix Upsert Stored Procedure
-- Allows bulk adding or updating multiple models in the compatibility matrix for a product in a single atomic transaction

CREATE OR REPLACE PROCEDURE sp_bulk_upsert_matrix_items(
  p_product_id UUID,
  p_items JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
  item JSONB;
  v_stock INT;
  v_moq INT;
  v_status TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_stock := COALESCE((item->>'stock_quantity')::INT, 0);
    v_moq := GREATEST(COALESCE((item->>'moq')::INT, 1), 1);
    
    IF v_stock = 0 THEN
      v_status := 'out_of_stock';
    ELSIF v_stock <= 10 THEN
      v_status := 'limited';
    ELSE
      v_status := 'in_stock';
    END IF;

    INSERT INTO product_model_matrix (
      id,
      product_id,
      model_id,
      stock_quantity,
      moq,
      stock_status,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      p_product_id,
      (item->>'model_id')::UUID,
      v_stock,
      v_moq,
      v_status,
      now(),
      now()
    )
    ON CONFLICT (product_id, model_id)
    DO UPDATE SET
      stock_quantity = EXCLUDED.stock_quantity,
      moq = EXCLUDED.moq,
      stock_status = EXCLUDED.stock_status,
      updated_at = now();
  END LOOP;
END;
$$;

-- Stored Procedure to copy matrix from one product to another
CREATE OR REPLACE PROCEDURE sp_copy_product_matrix(
  p_source_product_id UUID,
  p_target_product_id UUID,
  p_override_stock INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO product_model_matrix (
    id,
    product_id,
    model_id,
    stock_quantity,
    moq,
    stock_status,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    p_target_product_id,
    model_id,
    COALESCE(p_override_stock, stock_quantity),
    moq,
    CASE 
      WHEN COALESCE(p_override_stock, stock_quantity) = 0 THEN 'out_of_stock'
      WHEN COALESCE(p_override_stock, stock_quantity) <= 10 THEN 'limited'
      ELSE 'in_stock'
    END,
    now(),
    now()
  FROM product_model_matrix
  WHERE product_id = p_source_product_id
  ON CONFLICT (product_id, model_id)
  DO UPDATE SET
    stock_quantity = EXCLUDED.stock_quantity,
    moq = EXCLUDED.moq,
    stock_status = EXCLUDED.stock_status,
    updated_at = now();
END;
$$;
