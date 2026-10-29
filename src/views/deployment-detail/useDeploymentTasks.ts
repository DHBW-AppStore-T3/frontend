/**
 * The task list of a deployment and the task opened for its details (issue 146).
 * Members cannot read tasks (the owner-only endpoint 403s), so the list is skipped for them.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { taskApi } from '@/api/task.api'
import { parseTask, parseTaskList } from '@/utils/rest-guards'
import type { Task } from '@/types'
import { permissionsOf } from './access'

export function useDeploymentTasks(deploymentId: string) {
  const { t } = useTranslation()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loadingTaskDetail, setLoadingTaskDetail] = useState(false)

  const loadTasks = useCallback(async (): Promise<Task[]> => {
    // Imperative read, so async flows decide on fresh data.
    if (!permissionsOf(useDeploymentStore.getState().currentDeployment).owner_view) {
      setTasks([])
      return []
    }
    setLoadingTasks(true)
    try {
      const { data } = await taskApi.listByDeployment(deploymentId)
      const list = parseTaskList(data)
      setTasks(list)
      return list
    } catch (err) {
      console.error('Error loading tasks:', err)
      return []
    } finally {
      setLoadingTasks(false)
    }
  }, [deploymentId])

  const selectTask = async (task: Task) => {
    setLoadingTaskDetail(true)
    try {
      const { data } = await taskApi.getById(task.taskId)
      const detail = parseTask(data)
      if (!detail) throw new Error('GET /tasks/{id}: unusable answer')
      setSelectedTask(detail)
    } catch (err) {
      console.error('Error loading task details:', err)
      useToastStore.getState().addToast({ type: 'error', message: t('DeploymentDetailView.taskDetailError') })
    } finally {
      setLoadingTaskDetail(false)
    }
  }
  const deselectTask = () => setSelectedTask(null)

  return { tasks, loadingTasks, loadTasks, selectedTask, loadingTaskDetail, selectTask, deselectTask }
}
