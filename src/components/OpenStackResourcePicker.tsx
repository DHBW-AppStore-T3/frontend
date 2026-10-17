/**
 * OpenStack resource picker.
 *
 * Rendered in the wizard for variables whose backend response carries an
 * ``osType`` (set only when the variable's ``description`` has an
 * ``@openstack:<type>`` marker). Loads the matching list from the backend and
 * shows a single- or multi-select in a floating panel.
 *
 * Wire format (``value``/``onChange``):
 *  - osMode='id'   → stores the UUID(s); osMode='name' → stores the name(s)
 *  - multi=false   → string; multi=true → string[] (always emitted as array)
 *
 * The UI always shows the display name even when the stored value is a UUID;
 * lookups go through ``composables/useOpenStackResourceCache``.
 *
 * Edge cases: 412 credentials missing → compact hint; 502 OpenStack down →
 * banner + free-text fallback; unknown default value → raw value with an
 * "external" tag; empty list → hint with free-text option; changing subnet
 * filter reloads; the panel flips upwards when there is no room below.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useToast } from '@/composables/useToast'
import type { OsResourceType } from '@/api/openstack-resources.api'
import { getDisplayName, useOpenStackCacheVersion } from '@/composables/useOpenStackResourceCache'
import {
  adaptResource,
  filterAndSort,
  osTypeLabel,
  selectedKeysOf,
  valueOf,
  type PickerMode,
  type ResourceItem,
} from './openstack-picker/resourceItems'
import { useResourceList, type AzService } from './openstack-picker/useResourceList'
import { useFloatingPanel } from './openstack-picker/useFloatingPanel'

export interface OpenStackResourcePickerProps {
  osType: OsResourceType
  osMode?: PickerMode
  multi?: boolean
  value?: string | string[] | null
  onChange: (value: string | string[]) => void
  filterNetworkId?: string | null
  azService?: AzService
  placeholder?: string
  allowFreeText?: boolean
  /**
   * Fired when entering/leaving the ``credentials_missing`` state. The parent
   * renders a single shared banner above the variables grid in response.
   */
  onCredentialsMissing?: (missing: boolean) => void
}

const MODE_LABEL_KEY: Record<PickerMode, string> = {
  id: 'openstackPicker.modeUuid',
  name: 'openstackPicker.modeName',
}

export default function OpenStackResourcePicker(props: OpenStackResourcePickerProps) {
  const {
    osType,
    osMode = 'name',
    multi = false,
    value,
    onChange,
    filterNetworkId,
    azService,
    allowFreeText,
    onCredentialsMissing,
  } = props
  const { t } = useTranslation()
  const toast = useToast()
  useOpenStackCacheVersion() // re-render when the shared display cache changes

  const [searchQuery, setSearchQuery] = useState('')
  const [isFreeTextMode, setIsFreeTextMode] = useState(false)
  const [freeTextValue, setFreeTextValue] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panel = useFloatingPanel(triggerRef, panelRef)

  const list = useResourceList({
    osType,
    filterNetworkId,
    azService,
    enabled: !isFreeTextMode,
    fallbackMessages: {
      osError: t('openstackPicker.osError'),
      loadFailed: 'Resource konnte nicht geladen werden.',
    },
  })

  const items = useMemo<ResourceItem[]>(
    () => list.data.map((raw) => adaptResource(osType, raw as Record<string, unknown>, t)),
    [list.data, osType, t],
  )
  const credentialsMissing = list.error?.reason === 'credentials_missing'
  const modeLabel = t(MODE_LABEL_KEY[osMode])
  const typeLabel = osTypeLabel(osType)

  // Credentials-missing bubble-up (the parent de-duplicates).
  const onMissingRef = useRef(onCredentialsMissing)
  useEffect(() => {
    onMissingRef.current = onCredentialsMissing
  })
  useEffect(() => {
    onMissingRef.current?.(credentialsMissing)
  }, [credentialsMissing])

  // CSV-to-array migration: persisted ``list(string)`` values may arrive as a
  // comma-separated string; normalise once on mount in multi mode.
  useEffect(() => {
    if (multi && typeof value === 'string' && value.trim()) {
      onChange(
        value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
    }
    // Mount-only migration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------ selection
  const selectedKeys = selectedKeysOf(value, multi)
  const isSelected = (item: ResourceItem) => selectedKeys.has(valueOf(item, osMode))

  /** Display list of the selection: loaded items first, then the shared cache, then the raw value. */
  const selectedDisplay = [...selectedKeys].map((key) => {
    const local = items.find((it) => valueOf(it, osMode) === key)
    if (local) return { value: key, displayName: local.name, known: true }
    const cached = getDisplayName(osType, osMode, key)
    return cached
      ? { value: key, displayName: cached.name, known: cached.known }
      : { value: key, displayName: key, known: false }
  })

  const visibleItems = filterAndSort(items, searchQuery, selectedKeys, osMode)

  const toggle = (item: ResourceItem) => {
    const key = valueOf(item, osMode)
    if (multi) {
      // Always an Array: the backend's ``map(list(string))`` HCL type requires it.
      const next = new Set(selectedKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      onChange([...next])
    } else {
      onChange(isSelected(item) ? '' : key)
      panel.close()
    }
  }

  const removeChip = (key: string) => {
    if (!multi) {
      onChange('')
      return
    }
    const next = new Set(selectedKeys)
    next.delete(key)
    onChange([...next])
  }

  // -------------------------------------------------------------- refresh
  // Snapshot of the previously known selection; once the reload settled, warn
  // about entries that disappeared (e.g. a flavor deleted in the project).
  const refreshSnapshot = useRef<Map<string, string> | null>(null)

  const handleRefresh = () => {
    refreshSnapshot.current = new Map(
      selectedDisplay.filter((e) => e.known).map((e) => [e.value, e.displayName] as const),
    )
    void list.refresh()
  }

  useEffect(() => {
    const snapshot = refreshSnapshot.current
    if (!snapshot || list.isLoading) return
    refreshSnapshot.current = null
    if (list.error) return
    const lost = [...snapshot]
      .filter(([key]) => !items.some((it) => valueOf(it, osMode) === key))
      .map(([key, name]) => name || key)
    if (lost.length > 0) toast.warning(t('openstackPicker.toasts.removed', { label: lost.join(', ') }))
    else toast.success(t('openstackPicker.toasts.listRefreshed'))
    // Evaluate exactly when a refresh has settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.isLoading])

  // ------------------------------------------------------------ free text
  const enableFreeText = () => {
    setFreeTextValue(
      multi
        ? Array.isArray(value)
          ? value.join(', ')
          : value || ''
        : typeof value === 'string'
          ? value
          : '',
    )
    setIsFreeTextMode(true)
    panel.close()
  }

  const onFreeTextInput = (text: string) => {
    setFreeTextValue(text)
    // Multi: always emit an Array ("a, b" → ["a", "b"]) to match toggle().
    onChange(multi ? text.split(',').map((s) => s.trim()).filter(Boolean) : text.trim())
  }

  const placeholderText =
    props.placeholder ||
    (multi
      ? t('openstackPicker.selectPlural', { type: typeLabel })
      : t('openstackPicker.selectSingular', { type: typeLabel }))

  const manualHint = allowFreeText ? (
    <button
      type="button"
      onClick={enableFreeText}
      className="mt-2 text-xs text-emerald-700 hover:text-emerald-900 underline"
    >
      {t('openstackPicker.enterManuallyInstead', { mode: modeLabel })}
    </button>
  ) : null

  // ------------------------------------------------------------ rendering
  const triggerContent = (() => {
    if (selectedDisplay.length === 0) return <span className="text-textFaint text-sm">{placeholderText}</span>
    if (!multi) {
      const first = selectedDisplay[0]!
      return (
        <>
          <span
            className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
            title={first.value}
          >
            <Check size={12} className="text-emerald-600 flex-shrink-0" />
            <span className="font-medium text-sm truncate">{first.displayName}</span>
          </span>
          {/* Hint when the value isn't in the loaded list (e.g. a default UUID
              of a deleted resource or not-yet-loaded items). */}
          {!first.known ? (
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surfaceMuted text-textMuted border border-borderSubtle"
              title={t('openstackPicker.notInList')}
            >
              {t('openstackPicker.externalBadge')}
            </span>
          ) : null}
        </>
      )
    }
    return selectedDisplay.map((entry) => (
      <span
        key={entry.value}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
          entry.known
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
        title={entry.value}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate max-w-[160px]">{entry.displayName}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            removeChip(entry.value)
          }}
          className="hover:text-emerald-900"
        >
          <X size={12} />
        </button>
      </span>
    ))
  })()

  const PanelChevron = panel.isOpen ? ChevronUp : ChevronDown

  let panelBody
  if (list.isLoading) {
    panelBody = (
      <div className="p-6 text-center text-textFaint text-sm">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mb-2" />
        <p>{t('openstackPicker.loading', { type: typeLabel })}</p>
      </div>
    )
  } else if (list.error?.reason === 'unavailable') {
    panelBody = (
      <div className="p-4">
        <div className="flex items-start gap-2 text-amber-700 mb-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">{t('openstackPicker.unreachable')}</p>
            <p className="text-xs text-amber-600 mt-1">{list.error.message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          >
            {t('openstackPicker.retry')}
          </button>
          {allowFreeText ? (
            <button
              type="button"
              onClick={enableFreeText}
              className="text-xs px-2 py-1 rounded bg-surfaceMuted text-textMuted hover:bg-gray-200"
            >
              {t('openstackPicker.enterManually')}
            </button>
          ) : null}
        </div>
      </div>
    )
  } else if (visibleItems.length === 0) {
    panelBody = (
      <div className="p-6 text-center text-textMuted text-sm">
        {searchQuery ? (
          <p>{t('openstackPicker.noHits', { query: searchQuery })}</p>
        ) : (
          <>
            <p className="mb-2">{t('openstackPicker.emptyProject', { type: typeLabel })}</p>
            {allowFreeText ? (
              <button
                type="button"
                onClick={enableFreeText}
                className="text-xs text-emerald-700 hover:text-emerald-900 underline inline-flex items-center gap-1"
              >
                <Pencil size={12} /> {t('openstackPicker.enterManually')}
              </button>
            ) : null}
          </>
        )}
      </div>
    )
  } else {
    panelBody = (
      <ul className="flex-grow overflow-y-auto divide-y divide-gray-100">
        {visibleItems.map((item) => {
          const selected = isSelected(item)
          return (
            <li
              key={item.id || item.name}
              onClick={() => toggle(item)}
              className={`flex items-center gap-3 px-3 py-2 hover:bg-emerald-50 cursor-pointer transition ${
                selected ? 'bg-emerald-50' : ''
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                  selected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-borderSubtle'
                }`}
              >
                {selected ? <Check size={12} className="text-white" /> : null}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-textHeading text-sm truncate">
                    {item.name || t('openstackPicker.unnamed')}
                  </span>
                  {item.tertiary ? (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surfaceMuted text-textMuted font-medium flex-shrink-0">
                      {item.tertiary}
                    </span>
                  ) : null}
                </div>
                {item.secondary ? <div className="text-xs text-textMuted truncate">{item.secondary}</div> : null}
                {/* In id-mode the id is a disambiguation hint; the name stays the label. */}
                {osMode === 'id' && item.id ? (
                  <div className="text-[10px] text-textFaint font-mono truncate">{item.id}</div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-2">
      {isFreeTextMode ? (
        // Free-text mode (OpenStack down, or chosen explicitly)
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textMuted flex items-center gap-1">
              <Pencil size={12} />
              {t('openstackPicker.manualLabel', { mode: modeLabel })}
            </span>
            <button
              type="button"
              onClick={() => setIsFreeTextMode(false)}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline"
            >
              {t('openstackPicker.showList')}
            </button>
          </div>
          <input
            value={freeTextValue}
            onChange={(e) => onFreeTextInput(e.target.value)}
            type="text"
            placeholder={
              multi
                ? t('openstackPicker.multiPlaceholder')
                : t('openstackPicker.enterValue', { type: typeLabel, mode: modeLabel })
            }
            className="w-full px-3 py-2 rounded-lg border-2 border-borderSubtle focus:border-emerald-500 outline-none font-mono text-sm"
          />
        </div>
      ) : credentialsMissing ? (
        // Compact per-picker hint; the full banner is rendered once by the parent.
        <div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{t('openstackPicker.credentialsRequired')}</span>
          </div>
          {manualHint}
        </div>
      ) : (
        // Picker (single or multi): trigger button + floating panel
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-grow min-w-0">
              <button
                ref={triggerRef}
                type="button"
                onClick={panel.toggle}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-2 border-borderSubtle bg-white hover:border-emerald-300 transition focus:border-emerald-500 outline-none text-left"
              >
                <div className="flex flex-wrap items-center gap-1.5 flex-grow min-w-0">{triggerContent}</div>
                <PanelChevron size={16} className="text-textFaint flex-shrink-0" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={list.isLoading}
              className="flex-shrink-0 p-2 text-textMuted hover:text-emerald-700 disabled:opacity-50 transition"
              title={t('openstackPicker.refreshList')}
            >
              <RefreshCw size={16} className={list.isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}

      {/* Floating dropdown, portalled to <body> so other wizard fields don't shift. */}
      {panel.isOpen && !isFreeTextMode && !credentialsMissing
        ? createPortal(
            <div
              ref={panelRef}
              style={panel.style}
              className="border-2 border-borderSubtle rounded-lg bg-white shadow-2xl overflow-hidden flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative border-b border-borderSubtle p-2 flex-shrink-0">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-textFaint" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="text"
                  placeholder={t('openstackPicker.searchPlaceholder', { type: typeLabel })}
                  className="w-full pl-7 pr-2 py-1.5 rounded text-sm outline-none border border-transparent focus:border-emerald-300"
                />
              </div>

              {panelBody}

              {/* Footer with mode hint */}
              <div className="border-t border-borderSubtle px-3 py-1.5 bg-surfaceMuted flex items-center justify-between text-[11px] text-textMuted flex-shrink-0">
                <span>
                  {osMode === 'id' ? t('openstackPicker.hints.storesUuid') : t('openstackPicker.hints.storesName')}
                  {multi ? <> · {t('openstackPicker.hints.multiSelect')}</> : null}
                </span>
                {allowFreeText ? (
                  <button
                    type="button"
                    onClick={enableFreeText}
                    className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                  >
                    <Pencil size={10} /> {t('openstackPicker.enterManuallyShort')}
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
