import { describe, it, expect } from 'vitest'

import { highlightJson, prettyJson } from '@/utils/json-view'

describe('highlightJson', () => {
  it('returns an empty string for empty input', () => {
    expect(highlightJson('')).toBe('')
  })

  // The output is rendered with v-html, so the escaping is load-bearing:
  // a Terraform output is attacker-influenced in the sense that an app
  // author controls it.
  it('escapes HTML before wrapping anything in spans', () => {
    const out = highlightJson('{"x": "<script>alert(1)</script>"}')

    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('escapes ampersands so existing entities are not doubled up', () => {
    expect(highlightJson('{"x": "a & b"}')).toContain('a &amp; b')
  })

  it('distinguishes keys from string values', () => {
    const out = highlightJson('{"key": "value"}')

    // Keys and string values get different classes; assert they differ
    // rather than pinning the exact palette.
    expect(out).toContain('text-blue-500')
    expect(out).toContain('text-emerald-500')
  })

  it('marks booleans, null and numbers distinctly', () => {
    const out = highlightJson('{"a": true, "b": null, "c": -12.5e3}')

    expect(out).toContain('text-purple-500')
    expect(out).toContain('text-gray-500')
    expect(out).toContain('text-cyan-500')
  })
})

describe('prettyJson', () => {
  it('returns an empty string for null and undefined', () => {
    expect(prettyJson(null)).toBe('')
    expect(prettyJson(undefined)).toBe('')
  })

  it('indents an object', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('indents a string that contains JSON', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('indents a string that contains a JSON array', () => {
    expect(prettyJson('[1,2]')).toBe('[\n  1,\n  2\n]')
  })

  it('leaves ordinary log text untouched', () => {
    expect(prettyJson('terraform apply complete')).toBe('terraform apply complete')
  })

  it('returns malformed JSON-looking input verbatim instead of erroring', () => {
    expect(prettyJson('{not valid json}')).toBe('{not valid json}')
  })

  it('does not parse bare scalars that merely look JSON-ish', () => {
    // These do not start with { or [, so the cheap pre-check skips them
    // and they come back as-is rather than as parsed values.
    expect(prettyJson('null')).toBe('null')
    expect(prettyJson('42')).toBe('42')
  })

  it('stringifies other primitives', () => {
    expect(prettyJson(42)).toBe('42')
    expect(prettyJson(true)).toBe('true')
  })
})
