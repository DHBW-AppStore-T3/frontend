import { appPresentation } from '@/config/app-catalog'
import './AppLogo.css'

export default function AppLogo({ name, image }: { name: string; image?: string | null }) {
  const presentation = appPresentation(name)
  const Icon = presentation.icon

  let content
  if (image || presentation.fullColor) {
    content = <img src={image || presentation.logo} alt={name} />
  } else if (presentation.logo) {
    content = (
      <span
        className="app-logo-mask"
        style={{ maskImage: `url(${presentation.logo})` }}
        role="img"
        aria-label={name}
      />
    )
  } else {
    content = <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
  }

  return (
    <span className="app-logo" data-tone={image ? undefined : presentation.tone}>
      {content}
    </span>
  )
}
