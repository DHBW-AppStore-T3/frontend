/** Pure text transformations behind the Markdown editor's toolbar. */

export interface EditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

export interface WrapAction {
  prefix: string
  suffix: string
  placeholder: string
}

export interface LinePrefixAction {
  linePrefix: string
  placeholder: string
}

/** Wraps the selection (or the placeholder) in ``prefix``/``suffix``. */
export function wrapSelection(value: string, start: number, end: number, action: WrapAction): EditResult {
  const selected = value.slice(start, end) || action.placeholder
  const next = value.slice(0, start) + action.prefix + selected + action.suffix + value.slice(end)
  const selectionStart = start + action.prefix.length
  return { value: next, selectionStart, selectionEnd: selectionStart + selected.length }
}

/**
 * Prefixes every line touched by the selection. The selection is expanded to
 * full lines so the prefix applies cleanly to a multi-line block.
 */
export function prefixLines(value: string, start: number, end: number, action: LinePrefixAction): EditResult {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  // For a range, the last selected character may be the one before a newline.
  const searchFrom = end === start ? end : end - 1
  const newline = value.indexOf('\n', searchFrom)
  const lineEnd = newline === -1 ? value.length : newline

  const block = value.slice(lineStart, lineEnd) || action.placeholder
  const prefixed = block
    .split('\n')
    .map((line) => `${action.linePrefix}${line}`)
    .join('\n')
  return {
    value: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  }
}

const URL_PLACEHOLDER = 'url'

/** ``[selection](url)`` with the ``url`` placeholder selected for overwriting. */
export function insertLink(value: string, start: number, end: number, textPlaceholder: string): EditResult {
  const selected = value.slice(start, end) || textPlaceholder
  const next = `${value.slice(0, start)}[${selected}](${URL_PLACEHOLDER})${value.slice(end)}`
  const urlStart = start + selected.length + '[]('.length
  return { value: next, selectionStart: urlStart, selectionEnd: urlStart + URL_PLACEHOLDER.length }
}

const FENCE_OPEN = '\n```\n'

/** A fenced code block around the selection, always on its own lines. */
export function insertCodeBlock(value: string, start: number, end: number, placeholder: string): EditResult {
  const selected = value.slice(start, end) || placeholder
  const next = `${value.slice(0, start)}${FENCE_OPEN}${selected}\n\`\`\`\n${value.slice(end)}`
  const codeStart = start + FENCE_OPEN.length
  return { value: next, selectionStart: codeStart, selectionEnd: codeStart + selected.length }
}
