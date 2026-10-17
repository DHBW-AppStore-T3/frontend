import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import BaseButton from '@/components/ui/BaseButton'
import './LoginView.css'

export default function LoginView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)

  // Get return URL from query params
  const returnUrl = params.get('returnUrl') || '/dashboard'

  // Redirect to Keycloak login
  const loginWithKeycloak = async () => {
    try {
      await login(returnUrl)
    } catch (err) {
      console.error('Login redirect failed:', err)
    }
  }

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate(returnUrl)
  }, [isAuthenticated, returnUrl, navigate])

  return (
    <div>
      <p className="login-description">{t('auth.login.keycloakInfo')}</p>

      <BaseButton variant="solid" className="login-button" onClick={() => void loginWithKeycloak()}>
        <LogIn aria-hidden="true" />
        {t('auth.login.keycloakButton')}
      </BaseButton>

      <p className="login-help">{t('auth.login.noAccount')}</p>
    </div>
  )
}
