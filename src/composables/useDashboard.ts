import { useCallback, useState } from 'react'
import { dashboardApi } from '@/api/dashboard.api'

// ----------------------------------------------------------------
// USE DASHBOARD HOOK
// ----------------------------------------------------------------
export const useDashboard = () => {
  const [stats, setStats] = useState({
    deployments: 0,
    apps: 0,
    courses: 0,
    loading: true,
  })

  const fetchStats = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true }))

    try {
      const { data } = await dashboardApi.stats()
      setStats({
        deployments: data.deployments,
        apps: data.apps,
        courses: data.courses,
        loading: false,
      })
    } catch (err) {
      console.error('Dashboard stats error:', err)
      setStats((s) => ({ ...s, loading: false }))
      throw err
    }
  }, [])

  return { stats, fetchStats }
}
