import { AlertTriangle, Info } from 'lucide-react'
import { LocalizedTextView, useAzHelp } from '@/features/curriculum/az-help'
import type { ContentBlock } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'

/** Renders a lesson's explanation blocks. Pure presentation; no state. */
export function LessonContent({ blocks, className }: { blocks: readonly ContentBlock[]; className?: string }) {
  if (blocks.length === 0) return null
  return (
    <div className={cn('flex flex-col gap-4 text-sm leading-relaxed', className)}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  )
}

function Block({ block }: { block: ContentBlock }) {
  const { enabled: az } = useAzHelp()
  switch (block.type) {
    case 'heading':
      return <h3 className="text-base font-semibold leading-tight">{block.text}</h3>
    case 'paragraph':
      return <LocalizedTextView text={block.text} />
    case 'examples':
      return (
        <div className="flex flex-col gap-2">
          {block.title ? <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{block.title}</p> : null}
          <ul className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
            {block.items.map((item) => (
              <li key={item.en} className="flex flex-col gap-0.5">
                <span lang="en" className="font-medium">
                  {item.en}
                </span>
                {item.note ? <span className="text-xs text-fg-muted">{item.note}</span> : null}
                {az && item.az ? (
                  <span lang="az" className="text-xs text-fg-muted">
                    {item.az}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[20rem] text-sm">
            {block.caption ? <caption className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">{block.caption}</caption> : null}
            <thead className="bg-surface-2 text-left">
              <tr>
                {block.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={cn('px-3 py-2 align-top', c === 0 && 'font-medium')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'tip': {
      const warning = block.tone === 'warning'
      const Icon = warning ? AlertTriangle : Info
      return (
        <div
          className={cn(
            'flex gap-2.5 rounded-lg p-3',
            warning ? 'bg-warning-soft text-warning-soft-fg' : 'bg-info-soft text-info-soft-fg',
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <LocalizedTextView text={block.text} azClassName="bg-surface/70" />
        </div>
      )
    }
    case 'vocabulary':
      return (
        <div className="flex flex-col gap-2">
          {block.title ? <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{block.title}</p> : null}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {block.items.map((item) => (
              <li key={item.term} className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span lang="en" className="font-semibold">
                    {item.term}
                  </span>
                  {item.partOfSpeech ? <span className="text-xs text-fg-subtle">{item.partOfSpeech}</span> : null}
                  {item.pronunciation ? <span className="text-xs text-fg-subtle">/{item.pronunciation}/</span> : null}
                </div>
                <span className="text-fg-muted">{item.definition}</span>
                {item.example ? (
                  <span lang="en" className="text-xs italic text-fg-muted">
                    {item.example}
                  </span>
                ) : null}
                {az && item.translation ? (
                  <span lang="az" className="text-xs font-medium text-primary">
                    {item.translation}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'dialogue':
      return (
        <div className="flex flex-col gap-2">
          {block.title ? <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{block.title}</p> : null}
          <ol className="flex flex-col gap-2">
            {block.lines.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-fg-muted sm:w-24">{line.speaker}</span>
                <span className="flex flex-col">
                  <span lang="en">{line.text}</span>
                  {az && line.az ? (
                    <span lang="az" className="text-xs text-fg-muted">
                      {line.az}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )
    case 'passage':
      return (
        <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-base leading-relaxed">
          {block.title ? <h3 className="text-base font-semibold">{block.title}</h3> : null}
          {block.paragraphs.map((p, i) => (
            <p key={i} lang="en">
              {p}
            </p>
          ))}
        </article>
      )
    default: {
      const never: never = block
      return never
    }
  }
}
