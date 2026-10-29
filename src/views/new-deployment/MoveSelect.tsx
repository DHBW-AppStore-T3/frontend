import { useTranslation } from 'react-i18next'

export interface MoveTarget {
  /** Team index; `null` is the pool of students without a team. */
  index: number | null
  label: string
}

export interface MoveSelectProps {
  studentId: string
  studentName: string
  /** Where the student is now. */
  current: number | null
  targets: MoveTarget[]
  onMove: (studentId: string, target: number | null) => void
}

const keyOf = (index: number | null) => (index === null ? 'pool' : String(index))

/**
 * Keyboard (and screen reader) alternative to dragging a student between teams.
 * A native select, so Tab, arrow keys and typing work as everywhere. It stays out
 * of sight until it has focus: the mouse layout is the drag-and-drop one.
 */
export default function MoveSelect({ studentId, studentName, current, targets, onMove }: MoveSelectProps) {
  const { t } = useTranslation()
  return (
    <select
      data-move-for={studentId}
      aria-label={t('deployment.assignment.moveStudent', { name: studentName })}
      value={keyOf(current)}
      onChange={(e) => {
        const chosen = targets.find((target) => keyOf(target.index) === e.target.value)
        if (chosen) onMove(studentId, chosen.index)
      }}
      className="sr-only focus:not-sr-only focus:ml-auto focus:max-w-[9rem] focus:rounded-lg focus:border-2 focus:border-primary focus:bg-white focus:px-1.5 focus:py-1 focus:text-xs focus:text-textHeading"
    >
      {targets.map((target) => (
        <option key={keyOf(target.index)} value={keyOf(target.index)}>
          {target.label}
        </option>
      ))}
    </select>
  )
}
