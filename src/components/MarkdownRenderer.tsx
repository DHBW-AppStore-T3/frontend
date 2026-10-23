/**
 * MarkdownRenderer — sanitised markdown → HTML output.
 *
 * Two visual variants:
 *  - ``full``    — Tailwind's ``prose`` styling, used on the detail page
 *                  where the description owns its own column.
 *  - ``compact`` — collapses headings to ``<strong>`` and code blocks to
 *                  inline code, used inside app cards / inline rows where
 *                  a giant H1 would explode the layout.
 *
 * ``clamp`` limits the content to N lines via inline-style (not a dynamic
 * Tailwind class — JIT can't detect `line-clamp-${n}` at build time).
 *
 * ``expandable`` shows a "Mehr anzeigen" toggle below the content when the
 * text is actually truncated (``scrollHeight > clientHeight``). Only kicks
 * in when ``clamp`` > 0.
 *
 * The HTML is run through DOMPurify before it reaches
 * ``dangerouslySetInnerHTML``, so user markdown like
 * ``<img src=x onerror=alert(1)>`` is neutralised (rules in
 * ``utils/markdown-html.ts``).
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { marked, Renderer } from 'marked'
import { sanitizeMarkdownHtml } from '@/utils/markdown-html'
import { useTranslation } from 'react-i18next'

export interface MarkdownRendererProps {
  /** Raw markdown source. ``null`` / empty renders nothing. */
  source: string | null | undefined
  /** ``full`` for detail views, ``compact`` for cards & inline. */
  variant?: 'full' | 'compact'
  /** Clamp content to N lines via inline-style. 0 = no clamp. */
  clamp?: number
  /** When true and content is actually truncated, render a toggle to
   *  expand the full text. Only meaningful with ``clamp`` > 0. */
  expandable?: boolean
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ``compact`` neutralises block-level constructs that would blow up an
// inline / card layout: headings render as bold, code blocks as inline
// code. In ``marked`` v18 the heading callback only receives
// ``tokens``/``depth`` (no ``text``), so we read the source off the
// token slice ourselves.
function buildRenderer(variant: 'full' | 'compact'): Renderer {
  const r = new Renderer()
  if (variant === 'compact') {
    r.heading = ({ tokens }) => {
      const text = tokens.map((tok) => ('text' in tok ? tok.text : tok.raw)).join('')
      return `<strong>${escapeHtml(text)}</strong> `
    }
    r.code = ({ text }) => `<code>${escapeHtml(text)}</code> `
    r.hr = () => ' · '
  }
  return r
}

export default function MarkdownRenderer({
  source,
  variant = 'full',
  clamp = 0,
  expandable = false,
}: MarkdownRendererProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const contentEl = useRef<HTMLDivElement>(null)

  // Reset the expanded state when the source changes (render-phase update).
  const [lastSource, setLastSource] = useState(source)
  if (lastSource !== source) {
    setLastSource(source)
    setExpanded(false)
  }

  const html = useMemo(() => {
    const raw = (source ?? '').trim()
    if (!raw) return ''
    const parsed = marked.parse(raw, {
      gfm: true,
      breaks: true,
      renderer: buildRenderer(variant),
      async: false,
    }) as string
    return sanitizeMarkdownHtml(parsed, raw)
  }, [source, variant])

  // Truncation can only be measured in the DOM, after layout.
  useLayoutEffect(() => {
    const el = contentEl.current
    if (!el || !expandable || !clamp) {
      setIsTruncated(false)
      return
    }
    // 2px tolerance for sub-pixel rounding across browsers.
    setIsTruncated(el.scrollHeight > el.clientHeight + 2)
  }, [html, expandable, clamp, expanded])

  if (!html) return null

  const contentClass =
    variant === 'full'
      ? [
          'prose prose-sm md:prose-base max-w-none',
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
          'prose-headings:text-textHeading prose-p:text-textMuted',
          'prose-code:text-textHeading prose-code:bg-surfaceMuted prose-code:px-1 prose-code:rounded',
          'prose-pre:bg-gray-900 prose-pre:text-gray-100',
        ].join(' ')
      : [
          'text-textMuted leading-relaxed break-words',
          '[&_a]:text-primary [&_a]:underline',
          '[&_code]:bg-surfaceMuted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_p]:my-0 [&_strong]:font-semibold',
        ].join(' ')

  // Clamp via inline-style — Tailwind JIT can't detect dynamic class names
  // like `line-clamp-${n}` and won't generate the CSS for them.
  const contentStyle: CSSProperties =
    !clamp || (expandable && expanded)
      ? {}
      : {
          display: '-webkit-box',
          WebkitLineClamp: String(clamp),
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }

  const showToggle = expandable && clamp > 0 && (isTruncated || expanded)

  return (
    <div>
      <div
        ref={contentEl}
        className={contentClass}
        style={contentStyle}
        // Sanitised by DOMPurify above.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showToggle ? (
        <button
          type="button"
          className="mt-1 text-xs text-primary hover:underline focus:outline-none"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {expanded ? t('markdownRenderer.less') : t('markdownRenderer.more')}
        </button>
      ) : null}
    </div>
  )
}
