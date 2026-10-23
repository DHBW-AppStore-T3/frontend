import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleArrowLeft, Loader2, Terminal, ChevronDown, AlertCircle, Check, Copy } from 'lucide-react'
import type { Task } from '@/types'
import { formatDateTime } from '@/utils/format'
import { highlightJson, prettyJson } from '@/utils/json-view'
import { getStatusStyles, statusIconColor } from './helpers'

export interface TaskHistoryCardProps {
  isOwnerView: boolean
  isStreamRelevant: boolean
  historyTasks: Task[]
  loadingTasks: boolean
  selectedTask: Task | null
  loadingTaskDetail: boolean
  logCount: number | null
  taskLogsSplit: { headline: string; details: string; isFailure: boolean }
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  onSelectTask: (task: Task) => void
  onDeselectTask: () => void
}

/** History of finished tasks; members get a placeholder card instead. */
export default function TaskHistoryCard({
  isOwnerView,
  isStreamRelevant,
  historyTasks,
  loadingTasks,
  selectedTask,
  loadingTaskDetail,
  logCount,
  taskLogsSplit,
  copiedKey,
  onCopy,
  onSelectTask,
  onDeselectTask,
}: TaskHistoryCardProps) {
  const { t } = useTranslation()
  const [showTrace, setShowTrace] = useState(false)

  if (!isOwnerView) {
    return (
      <div className="detail-surface">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Terminal size={20} className="text-gray-400" />
          </div>
          <span className="text-lg font-semibold text-gray-700">{t('DeploymentDetailView.tasksAndLogs')}</span>
        </div>
        <div className="text-sm text-gray-500 flex items-start gap-2 px-2">
          <AlertCircle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <span>{t('DeploymentDetailView.tasksOwnerOnly')}</span>
        </div>
      </div>
    )
  }

  const CopyIcon = (key: string) => (copiedKey === key ? <Check size={13} /> : <Copy size={13} />)

  return (
    <div className="detail-surface">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Terminal size={20} className="text-gray-600" />
          </div>
          <span className="text-lg font-semibold text-gray-900">
            {isStreamRelevant ? 'Task History' : 'Tasks & Logs'}
          </span>
          {historyTasks.length > 0 ? (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
              {historyTasks.length}
            </span>
          ) : null}
        </div>
        {selectedTask ? (
          <button
            type="button"
            onClick={onDeselectTask}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm"
          >
            <CircleArrowLeft size={16} />
            <span>Back to list</span>
          </button>
        ) : null}
      </div>

      {!selectedTask ? (
        // Task list
        <div>
          {loadingTasks ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : historyTasks.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              {isStreamRelevant ? 'No previous tasks for this deployment.' : 'No tasks found'}
            </div>
          ) : (
            <div className="space-y-2">
              {historyTasks.map((task) => {
                const Icon = getStatusStyles(task.status).icon
                return (
                  <div
                    key={task.taskId}
                    data-testid="task-row"
                    onClick={() => onSelectTask(task)}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200 hover:border-primary/30"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Icon size={18} className={statusIconColor(task.status)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-gray-900 capitalize">{task.type}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize ${
                              getStatusStyles(task.status).badgeClass
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">Created: {formatDateTime(task.created_at)}</div>
                      </div>
                    </div>
                    <ChevronDown size={20} className="text-gray-400 transform -rotate-90" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // Task detail
        <div className="space-y-4">
          {loadingTaskDetail ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</div>
                    <div className="text-sm font-medium text-gray-900 capitalize">{selectedTask.type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize ${
                        getStatusStyles(selectedTask.status).badgeClass
                      }`}
                    >
                      {selectedTask.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Started</div>
                    <div className="text-sm text-gray-700">{formatDateTime(selectedTask.started_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Finished</div>
                    <div className="text-sm text-gray-700">{formatDateTime(selectedTask.finished_at)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Task ID</div>
                    <div className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded">
                      {selectedTask.taskId}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Celery Task ID</div>
                    <div className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded">
                      {selectedTask.celeryTaskId}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Created At</div>
                    <div className="text-sm text-gray-700">{formatDateTime(selectedTask.created_at)}</div>
                  </div>
                </div>
              </div>

              {/* Logs — simple <pre> rendering, same as the state/outputs blocks:
                  pretty-printed JSON is uniform and lets the browser handle search. */}
              {selectedTask.logs ? (
                <div className="mb-4">
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white rounded-md border border-emerald-200">
                          <Terminal size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-semibold text-gray-900">Logs</span>
                        {logCount !== null ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-200">
                            {logCount} entries
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onCopy(prettyJson(selectedTask.logs), 'logs')}
                        title={copiedKey === 'logs' ? 'Copied!' : 'Copy to clipboard'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          copiedKey === 'logs'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {CopyIcon('logs')}
                        {copiedKey === 'logs' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-gray-50 p-4 overflow-y-auto max-h-[500px]">
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        {/* Failure case: split the friendly headline (red) from
                            the technical trace, which hides behind a toggle. */}
                        {taskLogsSplit.isFailure ? (
                          <>
                            <div className="flex items-start gap-2 text-sm text-red-700 mb-3">
                              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                              <div className="font-medium leading-relaxed whitespace-pre-wrap">
                                {taskLogsSplit.headline}
                              </div>
                            </div>
                            {taskLogsSplit.details ? (
                              <button
                                type="button"
                                className="text-xs text-gray-600 hover:text-gray-900 underline mb-2"
                                onClick={() => setShowTrace((v) => !v)}
                              >
                                {showTrace ? 'Technische Details ausblenden' : 'Technische Details anzeigen'}
                              </button>
                            ) : null}
                            {showTrace && taskLogsSplit.details ? (
                              <pre className="text-gray-700 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                {taskLogsSplit.details}
                              </pre>
                            ) : null}
                          </>
                        ) : (
                          <pre
                            className="text-gray-700 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                            // highlightJson escapes its input before wrapping tokens in spans.
                            dangerouslySetInnerHTML={{ __html: highlightJson(prettyJson(selectedTask.logs)) }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-gray-400" />
                        <span className="font-semibold text-gray-700">Logs</span>
                      </div>
                    </div>
                    <div className="text-center py-8 text-gray-500">
                      <Terminal size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No logs available for this task</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
