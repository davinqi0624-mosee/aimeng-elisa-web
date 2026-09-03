function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-700">$1</code>')
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function isTableRow(line: string) {
  return line.includes('|')
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => formatInline(cell.trim()))
}

export function renderChatMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) {
      index += 1
      continue
    }

    if (/^-{3,}$/.test(line)) {
      index += 1
      continue
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableDivider(lines[index + 1].trim())) {
      const header = parseTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length) {
        const nextLine = lines[index].trim()
        if (!nextLine || !isTableRow(nextLine)) break
        rows.push(parseTableRow(nextLine))
        index += 1
      }

      blocks.push(`
        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table class="min-w-full border-collapse text-sm">
            <thead class="bg-slate-50">
              <tr>${header.map((cell) => `<th class="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">${cell}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `<tr class="odd:bg-white even:bg-slate-50/60">${row.map((cell) => `<td class="border-b border-slate-100 px-3 py-2 align-top text-slate-600 last:border-b-0">${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `)
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = formatInline(headingMatch[2])
      const className = level === 1
        ? 'text-lg font-semibold text-slate-900'
        : level === 2
          ? 'text-base font-semibold text-slate-900'
          : 'text-sm font-semibold text-slate-800'
      blocks.push(`<h3 class="${className}">${text}</h3>`)
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(formatInline(lines[index].trim().replace(/^[-*]\s+/, '')))
        index += 1
      }
      blocks.push(`<ul class="space-y-1 pl-5 text-sm leading-7 text-slate-700 list-disc">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(formatInline(lines[index].trim().replace(/^\d+\.\s+/, '')))
        index += 1
      }
      blocks.push(`<ol class="space-y-1 pl-5 text-sm leading-7 text-slate-700 list-decimal">${items.map((item) => `<li>${item}</li>`).join('')}</ol>`)
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (!nextLine || /^#{1,3}\s+/.test(nextLine) || /^[-*]\s+/.test(nextLine) || /^\d+\.\s+/.test(nextLine) || /^-{3,}$/.test(nextLine)) {
        break
      }
      if (isTableRow(nextLine) && index + 1 < lines.length && isTableDivider(lines[index + 1].trim())) {
        break
      }
      paragraphLines.push(formatInline(nextLine))
      index += 1
    }
    blocks.push(`<p class="text-sm leading-7 text-slate-700">${paragraphLines.join('<br />')}</p>`)
  }

  return blocks.join('')
}
