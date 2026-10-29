import { describe, it, expect } from 'vitest'
import { wrapSelection, prefixLines, insertLink, insertCodeBlock } from '../textEdits'

describe('wrapSelection', () => {
  it('wraps the selection and keeps it selected', () => {
    const r = wrapSelection('say foo now', 4, 7, { prefix: '**', suffix: '**', placeholder: 'x' })
    expect(r.value).toBe('say **foo** now')
    expect([r.selectionStart, r.selectionEnd]).toEqual([6, 9])
  })

  it('inserts the placeholder for an empty selection and selects it', () => {
    const r = wrapSelection('ab', 1, 1, { prefix: '_', suffix: '_', placeholder: 'it' })
    expect(r.value).toBe('a_it_b')
    expect([r.selectionStart, r.selectionEnd]).toEqual([2, 4])
  })
})

describe('prefixLines', () => {
  it('prefixes the line of a collapsed cursor', () => {
    const r = prefixLines('one\ntwo', 5, 5, { linePrefix: '- ', placeholder: 'item' })
    expect(r.value).toBe('one\n- two')
  })

  it('prefixes every line of a multi-line selection', () => {
    const r = prefixLines('a\nb\nc', 0, 3, { linePrefix: '# ', placeholder: 'h' })
    expect(r.value).toBe('# a\n# b\nc')
  })

  it('uses the placeholder on an empty line', () => {
    const r = prefixLines('', 0, 0, { linePrefix: '## ', placeholder: 'Title' })
    expect(r.value).toBe('## Title')
  })
})

describe('insertLink', () => {
  it('wraps the selection and selects the url placeholder', () => {
    const r = insertLink('see docs', 4, 8, 'text')
    expect(r.value).toBe('see [docs](url)')
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('url')
  })

  it('falls back to the link text placeholder', () => {
    expect(insertLink('', 0, 0, 'Link').value).toBe('[Link](url)')
  })
})

describe('insertCodeBlock', () => {
  it('wraps the selection in a fenced block and selects the code', () => {
    const r = insertCodeBlock('x = 1', 0, 5, 'code')
    expect(r.value).toBe('\n```\nx = 1\n```\n')
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('x = 1')
  })
})
