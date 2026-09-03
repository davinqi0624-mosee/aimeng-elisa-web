-- Allow admin-managed public download templates in page-assets.
-- The original bucket only allowed images, so uploading .xlsx/.docx from
-- System Settings failed with a storage-level MIME rejection.

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800),
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
WHERE id = 'page-assets';

NOTIFY pgrst, 'reload schema';
