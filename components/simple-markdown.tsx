'use client'

import { Fragment } from 'react'

/**
 * Minimal markdown renderer for AI-generated text.
 * Supports: ## / ### headings, - and * bullets, **bold**, and paragraphs.
 * Intentionally dependency-free.
 */
function renderInline(text: string, keyPrefix: string) {
  // Split on **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-t-${i}`}>{part}</Fragment>
  })
}

function isTableSeparator(line: string): boolean {
  // e.g. |---|:--:|---| or ---|---
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-')
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
        {listItems.map((item, i) => (
          <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    listItems = []
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const line = rawLine.trim()

    // Table detection: a header row followed by a separator row
    if (
      line.includes('|') &&
      idx + 1 < lines.length &&
      isTableSeparator(lines[idx + 1].trim())
    ) {
      flushList(`list-${idx}`)
      const headers = splitRow(line)
      const rows: string[][] = []
      let j = idx + 2
      while (j < lines.length && lines[j].trim().includes('|')) {
        rows.push(splitRow(lines[j].trim()))
        j++
      }
      blocks.push(
        <div key={`tbl-${idx}`} className="overflow-x-auto my-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h, hi) => (
                  <th key={hi} className="text-left font-semibold text-foreground py-1.5 pr-3">
                    {renderInline(h, `th-${idx}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1.5 pr-3 text-muted-foreground align-top">
                      {renderInline(cell, `td-${idx}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      idx = j - 1
      continue
    }

    if (line === '') {
      flushList(`list-${idx}`)
      continue
    }
    if (line.startsWith('### ')) {
      flushList(`list-${idx}`)
      blocks.push(
        <h4 key={`h-${idx}`} className="text-sm font-semibold text-foreground mt-3">
          {renderInline(line.slice(4), `h-${idx}`)}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      flushList(`list-${idx}`)
      blocks.push(
        <h3 key={`h-${idx}`} className="text-base font-semibold text-foreground mt-4 first:mt-0">
          {renderInline(line.slice(3), `h-${idx}`)}
        </h3>,
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
    } else {
      flushList(`list-${idx}`)
      blocks.push(
        <p key={`p-${idx}`} className="text-sm text-muted-foreground leading-relaxed">
          {renderInline(line, `p-${idx}`)}
        </p>,
      )
    }
  }
  flushList('list-final')

  return <div className="space-y-2">{blocks}</div>
}
