import { useTranslation } from 'react-i18next'
import BaseButton from '@/components/ui/BaseButton'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { previewIconColorClass, previewIconFor } from './appForm'

export interface AppPreviewCardProps {
  name: string
  description: string
  imageUrl: string | null
}

const DESCRIPTION_LINE_CLAMP = 5

/** Live preview of how the app will look in the catalogue. */
export default function AppPreviewCard({ name, description, imageUrl }: AppPreviewCardProps) {
  const { t, i18n } = useTranslation()
  const Icon = previewIconFor(name)

  return (
    <div className="w-full bg-surfaceTint border border-borderSubtle rounded-xl p-6 flex flex-col shadow-sm relative min-h-[250px]">
      <span className="absolute top-3 right-3 text-[10px] text-textFaint uppercase tracking-widest font-bold">
        {t('AppsCreateView.preview.badge')}
      </span>

      <div className="flex items-center gap-4 mb-4 mt-2">
        <div className="bg-white p-3 rounded-lg shadow-sm text-textMuted flex items-center justify-center w-[56px] h-[56px] flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={t('AppsCreateView.preview.logoAlt')} className="w-full h-full object-contain" />
          ) : (
            <Icon size={32} className={previewIconColorClass(name)} />
          )}
        </div>
        <h3 className="font-bold text-xl text-textHeading leading-tight pr-12 text-left">
          {name || t('AppsCreateView.preview.defaultName')}
        </h3>
      </div>

      <div lang={i18n.language} className="text-sm mb-6 flex-grow text-left break-words hyphens-auto">
        {description.trim() ? (
          <MarkdownRenderer source={description} variant="compact" clamp={DESCRIPTION_LINE_CLAMP} />
        ) : (
          <p className="text-textMuted leading-relaxed">{t('AppsCreateView.preview.defaultDesc')}</p>
        )}
      </div>

      {/* Same look as on the app overview; not clickable since it is a preview. */}
      <div className="mt-auto">
        <BaseButton
          variant="secondary"
          className="w-full flex items-center justify-center gap-2 cursor-default opacity-80"
          onClick={(e) => e.preventDefault()}
        >
          {t('AppsView.detailsDeploy')}
        </BaseButton>
      </div>
    </div>
  )
}
