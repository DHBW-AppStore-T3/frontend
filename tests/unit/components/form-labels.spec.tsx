import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn() } }))

import { userApi } from '@/api/user.api'
import BaseInput from '@/components/ui/BaseInput'
import MarkdownEditor from '@/components/MarkdownEditor'
import ReasonModal from '@/views/admin-apps/ReasonModal'
import SubmitVersionModal from '@/views/app-detail/SubmitVersionModal'
import EditAppModal from '@/views/app-detail/EditAppModal'
import AddMembersModal from '@/views/course-detail/AddMembersModal'
import CourseNameEditor from '@/views/course-detail/CourseNameEditor'
import TeamColumn from '@/views/new-deployment/TeamColumn'
import { renderWithProviders } from '../../helpers/render'

// Every form control has a programmatically associated accessible name (#141).
// The specs run against translation keys (key echo), so a name is the key of
// the label that is shown next to the field.

const noop = () => {}

describe('BaseInput', () => {
  it('names the input by a visible label when given one', () => {
    renderWithProviders(<BaseInput label="Kursname" value="" onChange={noop} />)
    const input = screen.getByLabelText('Kursname')
    expect(input).toBe(screen.getByRole('textbox', { name: 'Kursname' }))
    expect(screen.getByText('Kursname').tagName).toBe('LABEL')
  })

  it('gives every labelled input its own id, also when several are rendered', () => {
    renderWithProviders(
      <>
        <BaseInput label="Eins" value="a" onChange={noop} />
        <BaseInput label="Zwei" value="b" onChange={noop} />
      </>,
    )
    const one = screen.getByLabelText('Eins')
    const two = screen.getByLabelText('Zwei')
    expect(one.id).not.toBe('')
    expect(one.id).not.toBe(two.id)
    expect(one).toHaveValue('a')
    expect(two).toHaveValue('b')
  })

  it('keeps an id passed by the caller', () => {
    renderWithProviders(<BaseInput id="course-name" label="Kursname" value="" onChange={noop} />)
    expect(screen.getByLabelText('Kursname')).toHaveAttribute('id', 'course-name')
  })

  it('stays unchanged without a label: no label element, no generated id', () => {
    const { container } = renderWithProviders(<BaseInput aria-label="Suche" value="x" onChange={noop} />)
    expect(container.querySelector('label')).toBeNull()
    const input = screen.getByRole('textbox', { name: 'Suche' })
    expect(input).not.toHaveAttribute('id')
    expect(input).toHaveValue('x')
  })

  it('reports typed text through onChange when labelled', async () => {
    const onChange = vi.fn()
    renderWithProviders(<BaseInput label="Name" value="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Name'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('passes aria-describedby through to the input', () => {
    renderWithProviders(
      <>
        <BaseInput label="Name" aria-describedby="hint" value="" onChange={noop} />
        <p id="hint">Pflichtfeld</p>
      </>,
    )
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Pflichtfeld')
  })
})

describe('MarkdownEditor', () => {
  it('can be named by an external label', () => {
    renderWithProviders(
      <>
        <label htmlFor="desc">Beschreibung</label>
        <MarkdownEditor id="desc" value="" onChange={noop} />
      </>,
    )
    expect(screen.getByLabelText('Beschreibung')).toBe(screen.getByRole('textbox', { name: 'Beschreibung' }))
  })

  it('can be named with aria-label and described by a hint', () => {
    renderWithProviders(
      <>
        <MarkdownEditor aria-label="Beschreibung" aria-describedby="hint" value="" onChange={noop} />
        <p id="hint">Markdown möglich</p>
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Beschreibung' })).toHaveAccessibleDescription('Markdown möglich')
  })
})

describe('ReasonModal', () => {
  const props = {
    show: true,
    title: 'Ablehnen',
    titleClassName: '',
    versionTag: 'v1.0.0',
    reasonLabel: 'Begründung',
    reasonPlaceholder: 'Warum?',
    cancelLabel: 'Abbrechen',
    submitLabel: 'Ablehnen',
    submitVariant: 'destructive' as const,
    focusClassName: '',
    isSubmitting: false,
    onClose: noop,
    onSubmit: noop,
  }

  it('names the reason textarea by its label', () => {
    renderWithProviders(<ReasonModal {...props} />)
    expect(screen.getByRole('textbox', { name: 'Begründung' })).toBeInTheDocument()
  })

  it('still collects the reason and submits it', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<ReasonModal {...props} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('Begründung'), 'Zu unsicher')
    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }))
    expect(onSubmit).toHaveBeenCalledWith('Zu unsicher')
  })

  it('keeps the labels apart when two modals are open', () => {
    renderWithProviders(
      <>
        <ReasonModal {...props} reasonLabel="Grund A" />
        <ReasonModal {...props} reasonLabel="Grund B" />
      </>,
    )
    const a = screen.getByLabelText('Grund A')
    const b = screen.getByLabelText('Grund B')
    expect(a).not.toBe(b)
    expect(a.id).not.toBe(b.id)
  })
})

describe('SubmitVersionModal', () => {
  it('names the notes textarea by its label', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(
      <SubmitVersionModal versionTag="v1.0.0" isSubmitting={false} specErrors={[]} onClose={noop} onSubmit={onSubmit} />,
    )
    const notes = screen.getByRole('textbox', { name: 'AppsDetailView.submitModal.notesLabel' })
    await userEvent.type(notes, 'Fertig')
    expect(notes).toHaveValue('Fertig')
  })
})

// The modal fills its form when `show` turns true, so it is opened by a click.
function EditAppModalHarness(props: Omit<React.ComponentProps<typeof EditAppModal>, 'show'>) {
  const [show, setShow] = useState(false)
  return (
    <>
      <button onClick={() => setShow(true)}>open</button>
      <EditAppModal show={show} {...props} />
    </>
  )
}

async function openEditModal(props: Omit<React.ComponentProps<typeof EditAppModal>, 'show'>) {
  renderWithProviders(<EditAppModalHarness {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
}

describe('EditAppModal', () => {
  const app = { appId: 'a-1', name: 'Alt', description: 'Text', image: '' } as never

  it('names name and description controls', async () => {
    await openEditModal({ app, isSaving: false, onClose: noop, onSave: noop })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'AppsDetailView.editModal.nameLabel' })).toHaveValue('Alt')
    expect(within(dialog).getByRole('textbox', { name: 'AppsDetailView.editModal.descLabel' })).toHaveValue('Text')
  })

  it('describes the description field by its Markdown hint', async () => {
    await openEditModal({ app, isSaving: false, onClose: noop, onSave: noop })
    expect(screen.getByRole('textbox', { name: 'AppsDetailView.editModal.descLabel' })).toHaveAccessibleDescription(
      'AppsCreateView.form.descMarkdownHint',
    )
  })

  it('still saves the edited values', async () => {
    const onSave = vi.fn()
    await openEditModal({ app, isSaving: false, onClose: noop, onSave })
    const name = screen.getByLabelText('AppsDetailView.editModal.nameLabel')
    await userEvent.clear(name)
    await userEvent.type(name, 'Neu')
    await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))
    expect(onSave).toHaveBeenCalledWith({ name: 'Neu', description: 'Text' }, null)
  })
})

describe('AddMembersModal', () => {
  beforeEach(() => {
    vi.mocked(userApi.list).mockResolvedValue({
      data: [{ userId: 'u-1', username: 'ada', email: 'ada@dhbw.de' }],
    } as never)
  })

  const render = () =>
    renderWithProviders(
      <AddMembersModal
        show
        session={1}
        courseId="c-1"
        courses={[]}
        members={[]}
        isSubmitting={false}
        onListError={noop}
        onClose={noop}
        onSubmit={noop}
      />,
    )

  it('names the search field', () => {
    render()
    expect(screen.getByRole('textbox', { name: 'CourseDetailView.addModal.searchPlaceholder' })).toBeInTheDocument()
  })

  it('names each user checkbox by the user', async () => {
    render()
    const box = await screen.findByRole('checkbox', { name: /ada/ })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(box).toBeChecked()
  })

  it('names the remove button of a selected user', async () => {
    render()
    await userEvent.click(await screen.findByRole('checkbox', { name: /ada/ }))
    expect(screen.getByRole('button', { name: /CourseDetailView\.addModal\.removeSelected/ })).toBeInTheDocument()
  })
})

describe('CourseNameEditor', () => {
  it('names the inline input while editing', async () => {
    renderWithProviders(<CourseNameEditor name="WWI23" canEdit onSave={async () => {}} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('textbox', { name: 'CoursesView.createModal.nameLabel' })).toHaveValue('WWI23')
  })
})

describe('TeamColumn', () => {
  it('names the team name input', () => {
    renderWithProviders(
      <TeamColumn
        index={1}
        name="Team A"
        studentIds={[]}
        nameOf={(id) => id}
        isDragOver={false}
        onRename={noop}
        moveTargets={[]}
        onMove={noop}
        onDragStart={noop}
        onDragEnd={noop}
        onDragEnter={noop}
        onDragLeave={noop}
        onDrop={noop}
        onRemove={noop}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'deployment.assignment.vmDefaultName' })).toHaveValue('Team A')
  })
})
