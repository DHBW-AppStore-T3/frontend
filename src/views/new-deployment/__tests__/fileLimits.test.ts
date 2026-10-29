import { describe, expect, it } from 'vitest'
import {
  DEPLOYMENT_FILES_MAX_BYTES,
  FILE_MAX_BYTES,
  fileExtensionLabel,
  formatFileSize,
  humanizeName,
  validateUpload,
} from '../fileLimits'

const KB = 1024
const MB = 1024 * KB
const file = (name: string, size: number) => ({ name, size })

describe('validateUpload', () => {
  it('accepts a file of the allowed type and size', () => {
    expect(validateUpload({ file: file('a.zip', 640 * KB), extensions: ['zip'], slotCount: 3 })).toEqual({ ok: true })
  })

  it('rejects another type, and names the allowed one', () => {
    expect(validateUpload({ file: file('a.pdf', 10), extensions: ['zip'], slotCount: 1 })).toEqual({
      ok: false,
      code: 'type',
      extensions: ['zip'],
    })
  })

  it('compares extensions regardless of case and a leading dot', () => {
    expect(validateUpload({ file: file('A.ZIP', 10), extensions: ['zip'], slotCount: 1 }).ok).toBe(true)
    expect(validateUpload({ file: file('a.zip', 10), extensions: ['.ZIP'], slotCount: 1 }).ok).toBe(true)
  })

  it('allows any file without a list of extensions', () => {
    expect(validateUpload({ file: file('whatever.bin', 10), extensions: undefined, slotCount: 1 }).ok).toBe(true)
    expect(validateUpload({ file: file('whatever.bin', 10), extensions: [], slotCount: 1 }).ok).toBe(true)
  })

  it('rejects a file without extension when extensions are required', () => {
    expect(validateUpload({ file: file('README', 10), extensions: ['zip'], slotCount: 1 })).toMatchObject({ code: 'type' })
  })

  it('allows exactly the per-file limit and rejects one byte more', () => {
    expect(validateUpload({ file: file('a.zip', FILE_MAX_BYTES), extensions: ['zip'], slotCount: 1 }).ok).toBe(true)
    expect(validateUpload({ file: file('a.zip', FILE_MAX_BYTES + 1), extensions: ['zip'], slotCount: 1 })).toEqual({
      ok: false,
      code: 'size',
    })
  })

  it('rejects when the same file for every slot exceeds the total, and says what would fit', () => {
    const r = validateUpload({ file: file('a.zip', 880 * KB), extensions: ['zip'], slotCount: 12 })
    expect(r).toEqual({
      ok: false,
      code: 'total',
      mode: 'all',
      slotCount: 12,
      total: 12 * 880 * KB,
      fitBytes: Math.floor(DEPLOYMENT_FILES_MAX_BYTES / 12),
    })
  })

  it('allows the total exactly at the limit', () => {
    const each = DEPLOYMENT_FILES_MAX_BYTES / 10
    expect(validateUpload({ file: file('a.zip', each), extensions: ['zip'], slotCount: 10 }).ok).toBe(true)
  })

  it('counts the files of other variables against the total', () => {
    const r = validateUpload({
      file: file('a.zip', 500 * KB),
      extensions: ['zip'],
      slotCount: 10,
      otherBytes: 6 * MB,
    })
    expect(r).toMatchObject({ ok: false, code: 'total', mode: 'all' })
  })

  it('for one slot, adds the other slots and not the file it replaces', () => {
    const base = { file: file('new.zip', 900 * KB), extensions: ['zip'], slotCount: 12 }
    // 9 other slots of 1 MB = 9 MB; +0.9 MB stays below 10 MB
    expect(validateUpload({ ...base, slotBytes: 0, filledBytes: 9 * MB }).ok).toBe(true)
    // 10 other slots of 1 MB = 10 MB: no room
    expect(validateUpload({ ...base, slotBytes: 0, filledBytes: 10 * MB })).toMatchObject({
      ok: false,
      code: 'total',
      mode: 'slot',
    })
    // replacing a 1 MB file in a full 10 MB set with a 900 KB one is fine
    expect(validateUpload({ ...base, slotBytes: 1 * MB, filledBytes: 10 * MB }).ok).toBe(true)
  })

  it('reports the problems in a fixed order: type, size, total', () => {
    expect(validateUpload({ file: file('a.pdf', 5 * MB), extensions: ['zip'], slotCount: 99 })).toMatchObject({ code: 'type' })
    expect(validateUpload({ file: file('a.zip', 5 * MB), extensions: ['zip'], slotCount: 99 })).toMatchObject({ code: 'size' })
  })
})

describe('formatFileSize', () => {
  it('shows KB as whole numbers and MB with one decimal, in German by default', () => {
    expect(formatFileSize(640 * KB)).toBe('640 KB')
    expect(formatFileSize(Math.round(1.9 * MB))).toBe('1,9 MB')
    expect(formatFileSize(10 * MB)).toBe('10 MB')
    expect(formatFileSize(12 * 880 * KB)).toBe('10,3 MB')
  })

  it('uses the decimal separator of the language', () => {
    expect(formatFileSize(Math.round(1.9 * MB), 'en')).toBe('1.9 MB')
  })

  it('shows tiny files in bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })
})

describe('fileExtensionLabel', () => {
  it('names the type when there is exactly one extension', () => {
    expect(fileExtensionLabel(['zip'])).toBe('ZIP')
    expect(fileExtensionLabel(['.tar'])).toBe('TAR')
  })

  it('has no name for none or several', () => {
    expect(fileExtensionLabel([])).toBeNull()
    expect(fileExtensionLabel(undefined)).toBeNull()
    expect(fileExtensionLabel(['zip', 'tar'])).toBeNull()
  })
})

describe('humanizeName', () => {
  it('turns the technical name into a title', () => {
    expect(humanizeName('starter')).toBe('Starter')
    expect(humanizeName('assignments')).toBe('Assignments')
    expect(humanizeName('my-file_name')).toBe('My file name')
  })

  it('keeps an empty name empty', () => {
    expect(humanizeName('')).toBe('')
  })
})
