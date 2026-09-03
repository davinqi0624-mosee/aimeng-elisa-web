ALTER TABLE serum_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS serum_products_select_active ON serum_products;
CREATE POLICY serum_products_select_active
  ON serum_products
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
