import Toggle from '@/views/add-app/Toggle'

interface Props {
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** One setting as a row: what it is and what it does on the left, the switch on the right. */
export default function NetworkSwitchRow({ label, help, checked, onChange }: Props) {
  return (
    <div className="flex items-start gap-4" data-testid="vm-pods-row">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-textHeading">{label}</h3>
        <p className="mt-0.5 max-w-md text-sm text-textStrong">{help}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
