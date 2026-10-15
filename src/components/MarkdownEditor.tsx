/**
 * MarkdownEditor — textarea + toolbar + preview tab.
 *
 * Lightweight by design: no WYSIWYG. The toolbar wraps the current selection in
 * markdown syntax (select "foo" → click B → ``**foo**``). The cursor lands
 * inside the wrap when the selection was empty, so the user can keep typing.
 * The text transformations themselves live in ``markdown-editor/textEdits``.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Link as LinkIcon,
  Code as CodeIcon,
  Code2,
  Eye,
  Pencil,
} from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import {
  wrapSelection,
  prefixLines,
  insertLink,
  insertCodeBlock,
  type EditResult,
  type WrapAction,
  type LinePrefixAction,
} from './markdown-editor/textEdits'

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Minimum textarea height in px. Auto-resize grows past this. */
  minHeightPx?: number
  /** Hard cap on auto-resize. Scroll kicks in past this. */
  maxHeightPx?: number
}

type Mode = 'edit' | 'preview'

const TOOLBAR_BUTTON = 'p-1 rounded hover:bg-gray-200 text-textMuted'
const ICON_SIZE = 14

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '',
  minHeightPx = 96,
  maxHeightPx = 320,
}: MarkdownEditorProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Selection to restore after the controlled value has been re-rendered.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)

  // Auto-resize between min and max; restore the selection set by a toolbar action.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx)}px`

    const selection = pendingSelection.current
    if (selection) {
      pendingSelection.current = null
      el.focus()
      el.setSelectionRange(selection.start, selection.end)
    }
  }, [value, mode, minHeightPx, maxHeightPx])

  const apply = (edit: (text: string, start: number, end: number) => EditResult) => {
    const el = textareaRef.current
    if (!el) return
    const result = edit(value, el.selectionStart, el.selectionEnd)
    pendingSelection.current = { start: result.selectionStart, end: result.selectionEnd }
    onChange(result.value)
  }

  const wrap = (action: WrapAction) => apply((v, s, e) => wrapSelection(v, s, e, action))
  const prefix = (action: LinePrefixAction) => apply((v, s, e) => prefixLines(v, s, e, action))

  const bold = () => wrap({ prefix: '**', suffix: '**', placeholder: t('markdownEditor.boldPlaceholder') })
  const italic = () => wrap({ prefix: '_', suffix: '_', placeholder: t('markdownEditor.italicPlaceholder') })
  const inlineCode = () => wrap({ prefix: '`', suffix: '`', placeholder: t('markdownEditor.codePlaceholder') })
  const h1 = () => prefix({ linePrefix: '# ', placeholder: t('markdownEditor.headingPlaceholder') })
  const h2 = () => prefix({ linePrefix: '## ', placeholder: t('markdownEditor.headingPlaceholder') })
  const list = () => prefix({ linePrefix: '- ', placeholder: t('markdownEditor.listPlaceholder') })
  const link = () => apply((v, s, e) => insertLink(v, s, e, t('markdownEditor.linkText')))
  const codeBlock = () => apply((v, s, e) => insertCodeBlock(v, s, e, t('markdownEditor.codePlaceholder')))

  // Ctrl/Cmd-B and Ctrl/Cmd-I.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (key === 'b') {
      e.preventDefault()
      bold()
    } else if (key === 'i') {
      e.preventDefault()
      italic()
    }
  }

  const tab = (name: Mode, icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(name)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
        mode === name ? 'border-primary text-primary' : 'border-transparent text-textMuted hover:text-textHeading'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  const tool = (onClick: () => void, title: string, icon: ReactNode) => (
    <button type="button" onClick={onClick} title={title} className={TOOLBAR_BUTTON}>
      {icon}
    </button>
  )

  const separator = <span className="mx-1 h-4 w-px bg-gray-300" />

  return (
    <div className="w-full rounded-lg border border-borderSubtle bg-white shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-borderSubtle bg-surfaceMuted px-2">
        {tab('edit', <Pencil size={12} />, t('markdownEditor.tabEdit'))}
        {tab('preview', <Eye size={12} />, t('markdownEditor.tabPreview'))}

        {/* Toolbar (edit mode only) */}
        {mode === 'edit' ? (
          <div className="ml-auto flex items-center gap-0.5 py-1">
            {tool(bold, t('markdownEditor.toolbar.bold'), <Bold size={ICON_SIZE} />)}
            {tool(italic, t('markdownEditor.toolbar.italic'), <Italic size={ICON_SIZE} />)}
            {separator}
            {tool(h1, t('markdownEditor.toolbar.h1'), <Heading1 size={ICON_SIZE} />)}
            {tool(h2, t('markdownEditor.toolbar.h2'), <Heading2 size={ICON_SIZE} />)}
            {separator}
            {tool(list, t('markdownEditor.toolbar.list'), <List size={ICON_SIZE} />)}
            {tool(link, t('markdownEditor.toolbar.link'), <LinkIcon size={ICON_SIZE} />)}
            {tool(inlineCode, t('markdownEditor.toolbar.code'), <CodeIcon size={ICON_SIZE} />)}
            {tool(codeBlock, t('markdownEditor.toolbar.codeblock'), <Code2 size={ICON_SIZE} />)}
          </div>
        ) : null}
      </div>

      {/* Edit / preview body */}
      <div className="p-2">
        <textarea
          ref={textareaRef}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          hidden={mode !== 'edit'}
          style={{ minHeight: `${minHeightPx}px`, maxHeight: `${maxHeightPx}px` }}
          className="block w-full resize-none rounded-md border border-transparent bg-white px-2 py-1.5 text-sm text-textMuted focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono overflow-y-auto"
        />
        {mode === 'preview' ? (
          <div className="px-2 py-1.5 text-sm" style={{ minHeight: `${minHeightPx}px` }}>
            {value.trim() ? (
              <MarkdownRenderer source={value} variant="full" />
            ) : (
              <p className="text-textFaint italic">{t('markdownEditor.emptyPreview')}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
