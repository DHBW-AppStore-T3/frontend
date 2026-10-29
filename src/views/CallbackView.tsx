import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { safeReturnUrl } from '@/utils/return-url'
import { thrownMessage } from '@/utils/http-error'

export default function CallbackView() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let redirectTimer: number | undefined

    void (async () => {
      try {
        // Handle OAuth callback
        const returnUrl = await useAuthStore.getState().handleCallback()
        if (cancelled) return
        // Redirect to original destination or dashboard
        navigate(safeReturnUrl(returnUrl, '/dashboard'))
      } catch (err) {
        if (cancelled) return
        console.error('Callback error:', err)
        setError(thrownMessage(err) || 'Authentication failed')
        // Redirect to login after short delay
        redirectTimer = window.setTimeout(() => navigate('/login'), 3000)
      }
    })()

    return () => {
      cancelled = true
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer)
    }
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-center">
        {!error ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-textMuted">Completing authentication...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-danger">
              <p className="font-semibold">Authentication Error</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
            <p className="text-sm text-textMuted">Redirecting to login...</p>
          </div>
        )}
      </div>
    </div>
  )
}
