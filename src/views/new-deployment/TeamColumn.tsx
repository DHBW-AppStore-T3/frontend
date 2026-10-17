import { useTranslation } from 'react-i18next'
import { GripVertical, UserPlus, Users, X } from 'lucide-react'

export interface TeamColumnProps {
  index: number
  name: string
  studentIds: string[]
  nameOf: (id: string) => string
  isDragOver: boolean
  onRename: (name: string) => void
  onDragStart: (studentId: string, event: React.DragEvent) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onRemove: (studentId: string) => void
}

/** One team: editable name, student count and a drop zone with draggable chips. */
export default function TeamColumn(props: TeamColumnProps) {
  const { index, name, studentIds, nameOf, isDragOver } = props
  const { t } = useTranslation()

  return (
    <div
      className={`flex flex-col bg-white rounded-xl border-2 shadow-lg overflow-hidden transition-all ${
        isDragOver
          ? 'border-primary ring-4 ring-primary/20 shadow-2xl scale-[1.02]'
          : 'border-borderSubtle hover:border-primary/30 hover:shadow-xl'
      }`}
    >
      <div className="bg-white px-4 py-3 border-b-2 border-borderSubtle">
        <input
          type="text"
          value={name}
          onChange={(e) => props.onRename(e.target.value)}
          placeholder={t('deployment.assignment.vmDefaultName', { index: index + 1 })}
          className="w-full bg-surfaceMuted text-textHeading placeholder-gray-400 px-3 py-2 rounded-lg border-2 border-borderSubtle focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold text-center transition-all"
        />
        <div className="mt-2 flex items-center justify-center gap-2 bg-primaryFaint rounded-lg px-3 py-1.5">
          <Users size={16} className="text-primary" />
          <span className="text-sm font-semibold text-primaryDark">
            {t('DeploymentDetailView.deploymentStudentCount', { count: studentIds.length })}
          </span>
        </div>
      </div>

      <div
        className={`flex-grow p-3 min-h-[200px] overflow-y-auto ${isDragOver ? 'bg-primaryFaint' : 'bg-surfaceMuted'}`}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragEnter={props.onDragEnter}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
      >
        {studentIds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-textFaint text-sm italic border-2 border-dashed border-borderSubtle rounded-lg p-4 bg-white">
            <UserPlus size={32} className="mb-2 opacity-50" />
            <p>{t('deployment.assignment.dropZone')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {studentIds.map((studentId) => (
              <div
                key={studentId}
                draggable
                onDragStart={(e) => props.onDragStart(studentId, e)}
                onDragEnd={props.onDragEnd}
                className="group bg-white rounded-lg px-3 py-2.5 border-2 border-borderSubtle cursor-move hover:border-primary hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
              >
                <GripVertical
                  size={16}
                  className="text-textFaint group-hover:text-primary transition-colors flex-shrink-0"
                />
                <span className="font-semibold text-textMuted group-hover:text-textHeading flex-1 text-sm transition-colors">
                  {nameOf(studentId)}
                </span>
                <button
                  type="button"
                  onClick={() => props.onRemove(studentId)}
                  data-testid="btn-remove-student"
                  className="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-dangerTint rounded-lg"
                  title={t('deployment.assignment.removeStudent')}
                >
                  <X size={14} className="text-danger" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
