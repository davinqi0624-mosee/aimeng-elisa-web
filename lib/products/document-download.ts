export function buildProductDocumentDownloadUrl(fileUrl: string, fileName?: string | null) {
  const params = new URLSearchParams()
  params.set('url', fileUrl)
  if (fileName) params.set('name', fileName)
  return `/api/products/documents/download?${params.toString()}`
}
