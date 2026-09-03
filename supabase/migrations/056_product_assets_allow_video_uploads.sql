-- Allow homepage/self-media video uploads in product-assets bucket.
-- Without these MIME types, admin video uploads fail before the file reaches Storage.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-m4v'
  ],
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800)
WHERE id = 'product-assets';
