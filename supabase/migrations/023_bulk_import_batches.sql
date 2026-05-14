CREATE TABLE IF NOT EXISTS bulk_import_batches (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('products', 'agents')),
  created_at TIMESTAMPTZ DEFAULT now(),
  product_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'rolled_back')),
  user_id TEXT,
  details JSONB DEFAULT '{}'
);
