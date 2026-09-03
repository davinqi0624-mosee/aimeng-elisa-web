interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeMB?: number
  outputType?: 'auto' | 'image/jpeg' | 'image/png' | 'image/webp'
}

export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    maxSizeMB = 1,
    outputType: preferredOutputType = 'auto',
  } = options

  // If it's not an image or already small enough, return as-is
  if (!file.type.startsWith('image/')) return file as Blob
  if (file.size <= maxSizeMB * 1024 * 1024 && file.type === 'image/webp') return file as Blob

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Scale down if larger than max dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      const outputType =
        preferredOutputType === 'auto'
          ? file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          : preferredOutputType
      const targetQuality = outputType === 'image/png' ? undefined : quality

      const encode = (encodeQuality?: number) => new Promise<Blob>((encodeResolve, encodeReject) => {
        canvas.toBlob(
          (blob) => blob ? encodeResolve(blob) : encodeReject(new Error('Canvas 转 Blob 失败')),
          outputType,
          encodeQuality
        )
      })

      void (async () => {
        try {
          let blob = await encode(targetQuality)
          const targetBytes = maxSizeMB * 1024 * 1024

          if (outputType !== 'image/png') {
            for (let nextQuality = quality - 0.08; blob.size > targetBytes && nextQuality >= 0.5; nextQuality -= 0.08) {
              blob = await encode(Math.max(0.5, nextQuality))
            }
          }

          resolve(blob)
        } catch (error) {
          reject(error)
        }
      })()
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
