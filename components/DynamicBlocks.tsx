import Link from 'next/link'

interface BlockStyle {
  top?: number
  left?: number
  width?: number
  height?: number
  fontSize?: number
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right'
  borderRadius?: number
  padding?: number
}

interface Block {
  id: string
  type: 'hero' | 'text' | 'image' | 'features' | 'cta'
  align?: string
  title?: string
  content?: string
  bg_color?: string
  text_color?: string
  // image
  src?: string
  alt?: string
  caption?: string
  // features
  items?: { icon?: string; title: string; description: string; href?: string }[]
  // cta
  button_text?: string
  button_href?: string
}

interface VisualElement {
  id: string
  type: 'text' | 'image' | 'button'
  content?: string
  src?: string
  href?: string
  style: BlockStyle
}

interface VisualContent {
  version: 'visual-1'
  elements: VisualElement[]
}

function VisualCanvas({ elements }: { elements: VisualElement[] }) {
  return (
    <div className="relative w-full bg-white overflow-hidden" style={{ minHeight: 400 }}>
      {elements.map((el) => {
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          top: el.style.top,
          left: el.style.left,
          fontSize: el.style.fontSize,
          color: el.style.color,
          fontWeight: el.style.fontWeight,
          fontStyle: el.style.fontStyle,
          textAlign: el.style.textAlign,
          borderRadius: el.style.borderRadius,
          padding: el.style.padding,
        }
        if (el.style.width) baseStyle.width = el.style.width
        if (el.style.height) baseStyle.height = el.style.height
        if (el.style.backgroundColor) baseStyle.backgroundColor = el.style.backgroundColor

        if (el.type === 'image') {
          return (
            <div key={el.id} style={baseStyle}>
              {el.src ? (
                <img src={el.src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                  图片占位
                </div>
              )}
            </div>
          )
        }

        if (el.type === 'button') {
          return (
            <div key={el.id} style={baseStyle}>
              <Link
                href={el.href || '#'}
                className="w-full h-full flex items-center justify-center"
              >
                {el.content}
              </Link>
            </div>
          )
        }

        return (
          <div key={el.id} style={baseStyle}>
            {el.content}
          </div>
        )
      })}
    </div>
  )
}

export default function DynamicBlocks({
  blocks,
}: {
  blocks: Block[] | VisualContent | null | undefined
}) {
  if (!blocks) return null

  // Visual editor format
  if (
    typeof blocks === 'object' &&
    !Array.isArray(blocks) &&
    'version' in blocks &&
    blocks.version === 'visual-1'
  ) {
    return <VisualCanvas elements={blocks.elements || []} />
  }

  // Block array format
  const blockArray = Array.isArray(blocks) ? blocks : []
  if (blockArray.length === 0) return null

  return (
    <div>
      {blockArray.map((block) => {
        if (block.type === 'hero') {
          return (
            <section
              key={block.id}
              style={{
                backgroundColor: block.bg_color || '#0f172a',
                color: block.text_color || '#ffffff',
              }}
            >
              <div className="max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32 text-center">
                {block.title && (
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1] mb-4">
                    {block.title}
                  </h1>
                )}
                {block.content && (
                  <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
                    {block.content}
                  </p>
                )}
              </div>
            </section>
          )
        }

        if (block.type === 'text') {
          return (
            <section key={block.id} className="bg-white py-16 md:py-24">
              <div
                className={`max-w-4xl mx-auto px-6 md:px-8 ${
                  block.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {block.title && (
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-6">
                    {block.title}
                  </h2>
                )}
                {block.content && (
                  <p className="text-lg text-slate-600 leading-relaxed">
                    {block.content}
                  </p>
                )}
              </div>
            </section>
          )
        }

        if (block.type === 'image') {
          return (
            <section key={block.id} className="bg-white py-16 md:py-24">
              <div className="max-w-5xl mx-auto px-6 md:px-8">
                {block.title && (
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
                    {block.title}
                  </h2>
                )}
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  {block.src ? (
                    <img
                      src={block.src}
                      alt={block.alt || ''}
                      className="w-full h-auto object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 bg-slate-100 flex items-center justify-center text-slate-400">
                      图片占位
                    </div>
                  )}
                </div>
                {block.caption && (
                  <p className="text-sm text-slate-500 mt-3 text-center">{block.caption}</p>
                )}
              </div>
            </section>
          )
        }

        if (block.type === 'features') {
          return (
            <section key={block.id} className="bg-slate-50 py-24 md:py-32">
              <div className="max-w-7xl mx-auto px-6 md:px-8">
                {block.title && (
                  <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">
                      {block.title}
                    </h2>
                    {block.content && (
                      <p className="text-lg text-slate-600 max-w-2xl mx-auto">{block.content}</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {block.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="group bg-white border border-slate-200 rounded-xl p-8 hover:border-slate-300 hover:shadow-lg transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                        {item.icon ? (
                          <span className="text-xl">{item.icon}</span>
                        ) : (
                          <span className="text-xl">✨</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                      {item.href && (
                        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          了解更多 <span>→</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        }

        if (block.type === 'cta') {
          return (
            <section key={block.id} className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-emerald-500 to-purple-500" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
              <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32 text-center">
                {block.title && (
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6">
                    {block.title}
                  </h2>
                )}
                {block.content && (
                  <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
                    {block.content}
                  </p>
                )}
                {block.button_text && (
                  <Link
                    href={block.button_href || '#'}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors"
                  >
                    {block.button_text}
                  </Link>
                )}
              </div>
            </section>
          )
        }

        return null
      })}
    </div>
  )
}
