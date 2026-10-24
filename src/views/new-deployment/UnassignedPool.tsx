import { useTranslation } from 'react-i18next'
import { GripVertical, UserPlus } from 'lucide-react'

export interface UnassignedPoolProps {
  studentIds: string[]
  nameOf: (id: string) => string
  isDragOver: boolean
  /** Chips cannot be moved (assignment is fixed by the app). */
  dragDisabled?: boolean
  onDragStart: (studentId: string, event: React.DragEvent) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
}

/** Students without a team; also a drop target to un-assign someone. */
export default function UnassignedPool(props: UnassignedPoolProps) {
  const { studentIds, nameOf, isDragOver, dragDisabled = false } = props
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border-2 border-borderSubtle overflow-hidden shadow-lg">
      <div className="bg-white px-4 py-3 border-b-2 border-borderSubtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus size={20} className="text-textMuted" />
          <h3 className="font-bold text-textHeading">{t('deployment.assignment.unassigned')}</h3>
        </div>
        <span className="px-2.5 py-1 bg-surfaceMuted rounded-full text-xs font-bold text-textMuted border-2 border-borderSubtle">
          {studentIds.length}
        </span>
      </div>

      <div
        className={`flex-grow p-3 overflow-y-auto bg-surfaceMuted ${isDragOver ? 'bg-gray-200 ring-4 ring-gray-400' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragEnter={props.onDragEnter}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
      >
        {studentIds.length === 0 ? (
          <div className="h-full flex items-center justify-center text-textFaint text-sm italic text-center px-4 border-2 border-dashed border-borderSubtle rounded-lg bg-white">
            {t('deployment.assignment.allAssigned')}
          </div>
        ) : (
          <div className="space-y-2">
            {studentIds.map((studentId) => (
              <div
                key={studentId}
                draggable={!dragDisabled}
                onDragStart={(e) => props.onDragStart(studentId, e)}
                onDragEnd={props.onDragEnd}
                className={`group bg-white rounded-lg px-4 py-3 border-2 border-borderSubtle transition-all flex items-center gap-3 ${
                  dragDisabled ? '' : 'cursor-move hover:border-textFaint hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                <GripVertical size={18} className="text-textFaint group-hover:text-textMuted transition-colors" />
                <span className="font-semibold text-textMuted group-hover:text-textHeading flex-1 transition-colors">
                  {nameOf(studentId)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
