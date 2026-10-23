import { Loader2 } from 'lucide-react'
import type { Task } from '@/types'
import type { ConnectionState, LogEntry } from '@/composables/useDeploymentStream'
import { formatDateTime } from '@/utils/format'

export interface ActiveTaskCardProps {
  task: Task
  connectionState: ConnectionState
  progress: number | null
  currentPhase: string | null
  rawPhaseIndex: number | null
  /** Resolved 0-based index of the active stepper dot. */
  currentPhaseIndex: number
  phaseStepCount: number
  phaseLabel: (phase: unknown) => string
  phaseStepLabel: (idx: number) => string
  liveLogs: LogEntry[]
  totalLogCount: number
}

/** Live progress + log tail for the currently running task. */
export default function ActiveTaskCard({
  task,
  connectionState,
  progress,
  currentPhase,
  rawPhaseIndex,
  currentPhaseIndex,
  phaseStepCount,
  phaseLabel,
  phaseStepLabel,
  liveLogs,
  totalLogCount,
}: ActiveTaskCardProps) {
  const connectionClass =
    connectionState === 'live'
      ? 'bg-green-100 text-green-700 border border-green-200'
      : connectionState === 'reconnecting'
        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
        : 'bg-gray-100 text-gray-600 border border-gray-200'

  return (
    <div className="bg-white rounded-xl border border-blue-300 shadow-sm overflow-hidden">
      {/* Header strip: gradient + live indicator + task type/status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 capitalize">{task.type}</span>
                <span className="text-xs font-medium text-gray-500">·</span>
                <span className="text-xs text-gray-600">
                  running since {formatDateTime(task.started_at || task.created_at)}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{task.taskId}</div>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-md font-medium ${connectionClass}`}>
            {connectionState === 'live' ? 'Stream live' : connectionState}
          </span>
        </div>
      </div>

      {/* Body: progress bar + phase stepper + live tail */}
      <div className="p-6 space-y-5">
        {/* "Worker is starting up" covers the first seconds of a fresh task,
            before any phase info (stream or DB seed) is available. */}
        {rawPhaseIndex === null && !currentPhase ? (
          <div className="flex items-center gap-3 py-6 justify-center text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            <span className="text-sm">Worker is starting up…</span>
          </div>
        ) : (
          <>
            {/* Progress headline */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-base font-semibold text-gray-900">
                  {phaseLabel(currentPhase) || 'Starting…'}
                </span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {progress ?? 0}
                  <span className="text-sm text-gray-500 font-medium">%</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
            </div>

            {/* Phase stepper: ``phaseStepCount`` dots; generous ``py-3`` keeps
                the active dot's ring/scale halo from clipping. */}
            <div className="flex items-start gap-1.5 overflow-x-auto py-3">
              {Array.from({ length: phaseStepCount }, (_, i) => (
                <div key={i} className="contents">
                  <div className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[60px]">
                    <div
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        i < currentPhaseIndex
                          ? 'bg-blue-500'
                          : i === currentPhaseIndex
                            ? 'bg-blue-500 ring-4 ring-blue-200 scale-125'
                            : 'bg-gray-200'
                      }`}
                    />
                    <span
                      className={`text-[10px] uppercase tracking-wide font-medium whitespace-nowrap text-center ${
                        i <= currentPhaseIndex ? 'text-blue-700' : 'text-gray-400'
                      }`}
                    >
                      {phaseStepLabel(i)}
                    </span>
                  </div>
                  {i < phaseStepCount - 1 ? (
                    <div
                      className={`flex-1 h-px min-w-[8px] mt-[5px] ${
                        i < currentPhaseIndex ? 'bg-blue-300' : 'bg-gray-200'
                      }`}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Live log tail. ``totalLogCount`` keeps growing past the visible
            buffer (ring buffer of 100), so the user sees the worker is still
            producing output after the box is full. */}
        {liveLogs.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide font-semibold text-gray-600">Live output</span>
              <span className="text-xs text-gray-500">
                {totalLogCount.toLocaleString()} {totalLogCount === 1 ? 'line' : 'lines'}
                {liveLogs.length < totalLogCount ? (
                  <span className="text-gray-400"> · last {liveLogs.length} shown</span>
                ) : null}
              </span>
            </div>
            <div className="bg-gray-900 rounded-md p-3 max-h-72 overflow-y-auto font-mono text-xs">
              {liveLogs.map((log, idx) => (
                <div
                  key={`${log.timestamp}-${idx}`}
                  className={[
                    'text-gray-200 whitespace-pre-wrap break-words',
                    log.level === 'ERROR' ? 'text-red-400' : '',
                    log.level === 'WARNING' ? 'text-yellow-300' : '',
                    log.level === 'SUCCESS' ? 'text-green-400' : '',
                    log.streaming ? 'text-gray-400' : '',
                  ].join(' ')}
                >
                  <span className="text-gray-500 mr-2">{log.timestamp.split('T')[1]?.slice(0, 8) || ''}</span>
                  {log.tool ? <span className="text-blue-400 mr-1">[{log.tool}]</span> : null}
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center text-xs text-gray-500">
            Waiting for first log line…
          </div>
        )}
      </div>
    </div>
  )
}
