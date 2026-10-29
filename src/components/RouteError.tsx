import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import { paths } from '@/router/paths'

/**
 * Router `errorElement`: shown when a route fails to render, to load its lazy
 * chunk or to run its loader. Deliberately generic — the error itself goes to
 * the console, never into the page (no message, no stack trace).
 *
 * `fullPage` is for the root route, where no layout is left around it.
 */
export default function RouteError({ fullPage = false }: { fullPage?: boolean }) {
  const { t } = useTranslation()
  const error = useRouteError()

  useEffect(() => {
    console.error('[RouteError]', error)
  }, [error])

  return (
    <div
      role="alert"
      className={`${fullPage ? 'min-h-screen' : 'min-h-[60vh]'} flex items-center justify-center p-6`}
    >
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-dangerTint flex items-center justify-center mb-4">
          <TriangleAlert size={32} className="text-danger" />
        </div>
        <h1 className="text-2xl font-bold text-textHeading mb-2">{t('router.error.title')}</h1>
        <p className="text-textMuted mb-6">{t('router.error.description')}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <BaseButton onClick={() => window.location.reload()}>{t('router.error.reload')}</BaseButton>
          <Link
            to={paths.dashboard}
            className="ui-button ui-button--outline inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
          >
            {t('router.error.backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
