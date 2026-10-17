// @vitest-environment jsdom
// The preview renders through DOMPurify, which needs a spec-complete DOM.
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import MarkdownEditor from '@/components/MarkdownEditor'
import { keyEchoI18n } from '../../helpers/render'

function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <I18nextProvider i18n={keyEchoI18n()}>
      <MarkdownEditor
        value={value}
        onChange={(v) => {
          setValue(v)
          onChange?.(v)
        }}
        placeholder="Describe"
      />
    </I18nextProvider>
  )
}

const textarea = () => screen.getByPlaceholderText('Describe') as HTMLTextAreaElement

describe('MarkdownEditor', () => {
  it('reports typed text through onChange', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(textarea(), 'hi')

    expect(onChange).toHaveBeenLastCalledWith('hi')
  })

  it('bolds the selected text from the toolbar and keeps it selected', async () => {
    render(<Harness initial="make this bold" />)
    textarea().setSelectionRange(5, 9)

    await userEvent.click(screen.getByTitle('markdownEditor.toolbar.bold'))

    expect(textarea().value).toBe('make **this** bold')
    expect(textarea().value.slice(textarea().selectionStart, textarea().selectionEnd)).toBe('this')
  })

  it('applies a heading prefix to the current line', async () => {
    render(<Harness initial={'a\nb'} />)
    textarea().setSelectionRange(2, 3)

    await userEvent.click(screen.getByTitle('markdownEditor.toolbar.h2'))

    expect(textarea().value).toBe('a\n## b')
  })

  it('supports the Ctrl+B and Ctrl+I shortcuts', async () => {
    render(<Harness initial="word" />)
    textarea().focus()
    textarea().setSelectionRange(0, 4)

    await userEvent.keyboard('{Control>}b{/Control}')
    expect(textarea().value).toBe('**word**')

    textarea().setSelectionRange(0, textarea().value.length)
    await userEvent.keyboard('{Control>}i{/Control}')
    expect(textarea().value).toBe('_**word**_')
  })

  it('inserts a markdown link with the url placeholder', async () => {
    render(<Harness initial="docs" />)
    textarea().setSelectionRange(0, 4)

    await userEvent.click(screen.getByTitle('markdownEditor.toolbar.link'))

    expect(textarea().value).toBe('[docs](url)')
  })

  it('switches to the rendered preview and back', async () => {
    render(<Harness initial="**strong**" />)

    await userEvent.click(screen.getByRole('button', { name: /markdownEditor\.tabPreview/ }))
    expect(document.querySelector('strong')?.textContent).toBe('strong')
    expect(screen.queryByTitle('markdownEditor.toolbar.bold')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /markdownEditor\.tabEdit/ }))
    expect(textarea()).toBeVisible()
  })

  it('shows the empty-preview hint for blank content', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /markdownEditor\.tabPreview/ }))
    expect(screen.getByText('markdownEditor.emptyPreview')).toBeInTheDocument()
  })
})
