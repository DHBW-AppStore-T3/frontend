import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Layers, BookOpen, FileText, Search, Bell, ChevronRight } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import './HelpView.css'

const REPO = 'https://github.com/DHBW-AppStore-T3'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
      {children}
    </a>
  )
}

export default function HelpView() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  // A section matches when the (translated) text of any of its keys contains
  // the query; subtrees are matched through their JSON dump.
  function matches(keys: string[]) {
    const q = searchQuery.trim().toLocaleLowerCase()
    return keys
      .map((key) => JSON.stringify(t(key, { returnObjects: true })))
      .join(' ')
      .toLocaleLowerCase()
      .includes(q)
  }
  const show = (keys: string[]) => ({ display: matches(keys) ? undefined : 'none' })

  const summary = (icon: React.ReactNode, title: string, description: string) => (
    <summary>
      <span className="help-icon">{icon}</span>
      <span className="help-summary">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <ChevronRight size={18} />
    </summary>
  )

  return (
    <div className="app-page help-page">
      <PageHeader title={t('HelpView.title')} subtitle={t('HelpView.subtitle')} />
      <label className="search-field help-search">
        <Search size={16} aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="search"
          placeholder={t('workspace.searchHelp')}
          aria-label={t('workspace.searchHelp')}
        />
      </label>
      <div className="help-list">
        <details
          className="help-section"
          style={show(['workspace.help.documentation', 'HelpView.docs', 'HelpView.resources'])}
        >
          {summary(
            <FileText size={26} />,
            t('workspace.help.documentation'),
            t('workspace.help.documentationDescription'),
          )}
          <div className="help-body">
            <article className="help-article">
              <div className="flex items-center gap-3 mb-4 text-textHeading">
                <FileText size={20} className="text-info" />
                <h2 className="text-lg font-semibold">{t('HelpView.docs.title')}</h2>
              </div>
              <p className="text-textMuted leading-7 mb-4">{t('HelpView.docs.description')}</p>
              <ul className="list-disc list-inside space-y-3 text-textMuted">
                <li>
                  <ExternalLink href={`${REPO}/deployment/blob/main/README.md`}>
                    {t('HelpView.docs.linkAdmin')}
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO}/.github/blob/main/docs/technologiestack.md`}>
                    {t('HelpView.docs.linkTech')}
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO}/template-app/blob/main/README.md`}>
                    {t('HelpView.docs.linkAppDev')}
                  </ExternalLink>
                </li>
              </ul>
            </article>
            <article className="help-article">
              <div className="flex items-center gap-3 mb-4 text-textHeading">
                <BookOpen size={20} className="text-info" />
                <h2 className="text-lg font-semibold">{t('HelpView.resources.title')}</h2>
              </div>
              <p className="text-textMuted leading-7 mb-4">{t('HelpView.resources.description')}</p>
              <ul className="list-disc list-inside space-y-2 text-textMuted">
                <li>
                  <ExternalLink href={`${REPO}/frontend`}>{t('HelpView.resources.frontendRepo')}</ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO}/backend`}>{t('HelpView.resources.backendRepo')}</ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO}/deployment`}>{t('HelpView.resources.deploymentRepo')}</ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO}/worker`}>{t('HelpView.resources.workerRepo')}</ExternalLink>
                </li>
              </ul>
            </article>
          </div>
        </details>

        <details
          className="help-section"
          style={show([
            'workspace.help.faq',
            'HelpView.troubleshooting',
            'HelpView.quickHelp',
          ])}
        >
          {summary(<HelpCircle size={26} />, t('workspace.help.faq'), t('workspace.help.faqDescription'))}
          <div className="help-body">
            <article className="help-article">
              <div className="flex items-center gap-3 mb-4 text-textHeading">
                <BookOpen size={20} className="text-info" />
                <h2 className="text-lg font-semibold">{t('HelpView.quickHelp.title')}</h2>
              </div>
              <ol className="list-decimal list-inside space-y-3 text-textMuted">
                {[1, 2, 3, 4, 5].map((n) => (
                  <li key={n}>{t(`HelpView.quickHelp.step${n}`)}</li>
                ))}
              </ol>
            </article>
            <article className="help-article">
              <div className="flex items-center gap-3 mb-4 text-textHeading">
                <Layers size={20} className="text-info" />
                <h2 className="text-lg font-semibold">{t('HelpView.troubleshooting.title')}</h2>
              </div>
              <ul className="list-disc list-inside space-y-2 text-textMuted">
                <li>{t('HelpView.troubleshooting.item1')}</li>
                <li>{t('HelpView.troubleshooting.item2')}</li>
              </ul>
            </article>
          </div>
        </details>

        <details
          className="help-section"
          style={show(['workspace.help.support', 'workspace.help.supportDescription'])}
        >
          {summary(<Bell size={26} />, t('workspace.help.support'), t('workspace.help.supportDescription'))}
          <p className="help-body text-textMuted">{t('auth.login.noAccount')}</p>
        </details>
      </div>
    </div>
  )
}
