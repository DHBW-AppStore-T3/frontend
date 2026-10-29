import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  IdCard,
  MessageSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Globe,
  Lock,
  Send,
  Info,
} from 'lucide-react'
import MarkdownEditor from '@/components/MarkdownEditor'
import { appApi } from '@/api/app.api'
import { useToast } from '@/composables/useToast'
import { MAX_IMAGE_BYTES } from '@/utils/format'
import { translateHtml } from '@/i18n/html'
import { paths } from '@/router/paths'
import {
  buildCreatePayload,
  createErrorKey,
  emptyAppForm,
  fileToDataUrl,
  isValidGitUrl,
  type AppFormValues,
} from './add-app/appForm'
import FormRow from './add-app/FormRow'
import LogoPicker from './add-app/LogoPicker'
import AppPreviewCard from './add-app/AppPreviewCard'
import Toggle from './add-app/Toggle'

const BYTES_PER_MB = 1024 * 1024
const TEXT_INPUT =
  'flex-1 bg-white rounded py-1.5 px-3 focus:ring-2 focus:ring-primary outline-none text-textMuted shadow-sm mx-2'

export default function AddAppsView() {
  const { t } = useTranslation()
  const nameId = useId()
  const descId = useId()
  const descHintId = useId()
  const repoId = useId()
  const logoLabelId = useId()
  const visibilityLabelId = useId()
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<AppFormValues>(emptyAppForm)
  const [logo, setLogo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const update = (patch: Partial<AppFormValues>) => setForm((f) => ({ ...f, ...patch }))

  // Release the object URL of the previous preview when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const acceptLogo = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('AppsCreateView.messages.onlyImages'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        t('AppsCreateView.messages.imageTooLarge', { size: Math.round(MAX_IMAGE_BYTES / BYTES_PER_MB) }),
      )
      return
    }
    setLogo(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogo(null)
    setPreviewUrl(null)
  }

  const submit = async () => {
    if (!form.name || !form.repoUrl) {
      toast.error(t('AppsCreateView.messages.missingFields'))
      return
    }
    if (!isValidGitUrl(form.repoUrl)) {
      toast.error(t('AppsCreateView.messages.invalidUrl'))
      return
    }

    setIsLoading(true)
    try {
      const image = await fileToDataUrl(logo)
      await appApi.create(buildCreatePayload(form, image))
      toast.success(t('AppsCreateView.messages.success'))
      navigate(paths.apps)
    } catch (error) {
      console.error('API Error:', error)
      const key = createErrorKey(error)
      const statusText = (error as { response?: { statusText?: string } })?.response?.statusText
      toast.error(t(key, { statusText: statusText || 'Unknown' }))
    } finally {
      setIsLoading(false)
    }
  }

  const visibilityButton = (isPrivate: boolean, label: string) => {
    const selected = form.isPrivate === isPrivate
    const Icon = isPrivate ? Lock : Globe
    const activeClass = isPrivate
      ? 'border-purple-600 bg-purple-50 text-purple-800'
      : 'border-primary bg-successTint text-primary'
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => update({ isPrivate })}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
          selected ? activeClass : 'border-borderSubtle bg-white text-textMuted hover:border-textFaint'
        }`}
      >
        <Icon size={16} />
        {label}
      </button>
    )
  }

  const VisibilityIcon = form.isPrivate ? Lock : Globe

  return (
    <div className="app-page wizard-page flex flex-col">
      <h1 className="page-heading mb-8">{t('AppsCreateView.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-16 items-start mb-8">
        <div className="space-y-6">
          <FormRow
            icon={<IdCard className="text-primary" size={28} />}
            label={t('AppsCreateView.form.nameLabel')}
            htmlFor={nameId}
          >
            <input
              id={nameId}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              type="text"
              placeholder={t('AppsCreateView.form.namePlaceholder')}
              className={TEXT_INPUT}
            />
          </FormRow>

          <FormRow
            icon={<MessageSquare className="text-primary" size={28} />}
            label={t('AppsCreateView.form.descLabel')}
            htmlFor={descId}
            align="start"
          >
            <div className="flex-1 min-w-0 mx-2">
              <MarkdownEditor
                id={descId}
                aria-describedby={descHintId}
                value={form.description}
                onChange={(description) => update({ description })}
                placeholder={t('AppsCreateView.form.descPlaceholder')}
                minHeightPx={80}
                maxHeightPx={240}
              />
              <p id={descHintId} className="mt-1 text-xs text-textMuted">
                {t('AppsCreateView.form.descMarkdownHint')}
              </p>
            </div>
          </FormRow>

          <FormRow
            icon={<ImageIcon className="text-primary" size={28} />}
            label={t('AppsCreateView.form.logoLabel')}
            labelId={logoLabelId}
          >
            <LogoPicker file={logo} onFile={acceptLogo} onRemove={removeLogo} labelledBy={logoLabelId} />
          </FormRow>

          <FormRow
            icon={<LinkIcon className="text-primary" size={28} />}
            label={t('AppsCreateView.form.repoLabel')}
            htmlFor={repoId}
          >
            <input
              id={repoId}
              value={form.repoUrl}
              onChange={(e) => update({ repoUrl: e.target.value })}
              type="text"
              placeholder={t('AppsCreateView.form.repoPlaceholder')}
              className={TEXT_INPUT}
            />
          </FormRow>

          {/* Visibility */}
          <FormRow
            icon={<VisibilityIcon className="text-primary" size={28} />}
            label={t('AppsCreateView.form.visibilityLabel')}
            labelId={visibilityLabelId}
            align="start"
          >
            <div className="flex-1 mx-2">
              <div role="group" aria-labelledby={visibilityLabelId} className="flex gap-3">
                {visibilityButton(false, t('AppsCreateView.form.visibilityPublic'))}
                {visibilityButton(true, t('AppsCreateView.form.visibilityPrivate'))}
              </div>
              <p className="mt-2 text-sm text-textMuted">
                {form.isPrivate
                  ? t('AppsCreateView.form.visibilityPrivateHint')
                  : t('AppsCreateView.form.visibilityPublicHint')}
              </p>
            </div>
          </FormRow>

          {/* Submit all versions (public only) */}
          {!form.isPrivate ? (
            <FormRow icon={<Send className="text-primary" size={28} />} label={t('AppsCreateView.form.submitAllLabel')}>
              <div className="flex-1 mx-2 flex items-center justify-between">
                <p className="text-sm text-textMuted">{t('AppsCreateView.form.submitAllHint')}</p>
                <Toggle
                  checked={form.submitAllVersions}
                  onChange={(submitAllVersions) => update({ submitAllVersions })}
                  label={t('AppsCreateView.form.submitAllLabel')}
                />
              </div>
            </FormRow>
          ) : null}
        </div>

        <div className="flex flex-col items-center pt-4">
          <AppPreviewCard name={form.name} description={form.description} imageUrl={previewUrl} />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-16 items-end">
        <div className="bg-infoTint text-blue-900 p-4 rounded-lg text-sm leading-relaxed border border-info/30 flex gap-3 items-start shadow-sm">
          <Info className="shrink-0 mt-0.5 text-blue-700" size={20} />
          <div>
            <span className="font-semibold block mb-1">{t('AppsCreateView.info.important')}</span>
            {/* eslint-disable-next-line no-restricted-syntax -- static translation, no parameters */}
            <span dangerouslySetInnerHTML={{ __html: translateHtml('AppsCreateView.info.inviteText', {}, t) }} />
            <br />
            <a
              href="https://github.com/DHBW-AppStore-T3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline hover:text-info break-all"
            >
              https://github.com/DHBW-AppStore-T3
            </a>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end pb-1">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isLoading}
            className="bg-primaryAction hover:bg-primaryActionHover text-white text-lg px-10 py-3 rounded-full font-medium transition-colors shadow-lg flex items-center justify-center w-full lg:w-auto"
          >
            {isLoading ? t('AppsCreateView.buttons.saving') : t('AppsCreateView.buttons.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
