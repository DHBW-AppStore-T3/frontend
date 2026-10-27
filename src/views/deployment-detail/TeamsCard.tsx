import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, User, Copy, Check, Eye, EyeOff, KeyRound } from 'lucide-react'
import { sshCommandFor, rdpCommandFor } from '@/utils/connection-commands'
import { safeHttpUrl } from '@/utils/safe-url'
import { accessLinkFor, type AccountHit, type enrichTeams } from './helpers'

type EnrichedTeam = ReturnType<typeof enrichTeams>[number]

export interface TeamsCardProps {
  teamCount: number
  teams: EnrichedTeam[]
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  /** The caller may fetch other members' credentials (the operate right). */
  canReveal: boolean
  /** One member's credentials, fetched on request; null when they have none. */
  onReveal: (userId: string) => Promise<AccountHit | null>
}

const PILL = 'flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100'
const PILL_LABEL = 'text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0'
const COPY_BTN =
  'text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0'

/**
 * Teams & members with per-member credentials.
 *
 * A row reads link, login, password, so the login and the password that
 * belong together sit next to each other. Only the caller's own row carries
 * credentials; with the operate right, any other member's are fetched on a
 * click and kept in this card's state only.
 */
export default function TeamsCard({
  teamCount,
  teams,
  copiedKey,
  onCopy,
  canReveal,
  onReveal,
}: TeamsCardProps) {
  const { t } = useTranslation()
  // Password visibility, keyed by account key.
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  // Credentials fetched on request, keyed by user id (null: the member has none).
  const [revealed, setRevealed] = useState<Record<string, AccountHit | null>>({})
  const [revealStatus, setRevealStatus] = useState<Record<string, 'loading' | 'error'>>({})

  const reveal = async (userId: string) => {
    setRevealStatus((s) => ({ ...s, [userId]: 'loading' }))
    try {
      const hit = await onReveal(userId)
      setRevealed((r) => ({ ...r, [userId]: hit }))
      setRevealStatus((s) => {
        const next = { ...s }
        delete next[userId]
        return next
      })
    } catch {
      setRevealStatus((s) => ({ ...s, [userId]: 'error' }))
    }
  }

  const copyButton = (text: string, key: string, titleIdle: string) => (
    <button
      type="button"
      onClick={() => onCopy(text, key)}
      className={COPY_BTN}
      title={copiedKey === key ? 'Kopiert!' : titleIdle}
    >
      {copiedKey === key ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Users size={20} className="text-gray-600" />
        </div>
        <span className="text-lg font-semibold text-gray-900">{t('DeploymentDetailView.teamsAndMembers')}</span>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">{teamCount}</span>
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.teamId} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{team.name}</span>
                <span className="text-xs text-gray-500">·</span>
                <span className="text-xs text-gray-600">
                  {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>

            {team.members.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No members assigned to this team.</div>
            ) : (
              <div>
                {team.members.map((member) => {
                  const revealedHit = revealed[member.userId]
                  const account = member.account ?? revealedHit ?? null
                  const data = account?.data
                  const vmUrl = team.vm?.url
                  const link = accessLinkFor(data, vmUrl, member.workloadUrl)
                  const rowKey = account?.key ?? member.userId
                  const status = revealStatus[member.userId]
                  const canRevealRow = canReveal && !account
                  const hasNothing = member.userId in revealed && revealedHit === null

                  // Ready-to-use SSH command line (username, IP, non-22 port).
                  const showSsh = Boolean(
                    data && !vmUrl && data.ip && data.username && (!data.authtype || data.authtype === 'ssh'),
                  )
                  // The login belongs next to the password. Only the SSH command
                  // carries it already; the RDP command (mstsc) does not.
                  const showUser = Boolean(data?.username && !showSsh)

                  return (
                    <div
                      key={member.userId}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <User size={16} />
                        </div>
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-gray-900 truncate">{member.username}</div>
                          <div className="text-xs text-gray-500 truncate">{member.email}</div>
                        </div>
                      </div>

                      {link || data || canRevealRow ? (
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-600 lg:justify-end">
                          {/* 1. Link: the account's own, the member's workload or the
                              team's (``team_vms.<team>.url``), see ``accessLinkFor``. */}
                          {link ? (
                            <div className={`${PILL} max-w-[280px]`}>
                              <span className={PILL_LABEL}>URL:</span>
                              <a
                                href={safeHttpUrl(link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {link.replace(/^https?:\/\//, '')}
                              </a>
                              {copyButton(link, `vmurl-${rowKey}`, 'URL kopieren')}
                            </div>
                          ) : null}

                          {/* Ready-to-use RDP command line (opt-in via authtype "rdp"). */}
                          {data && data.authtype === 'rdp' && data.ip ? (
                            <div className={`${PILL} max-w-full`}>
                              <span className={PILL_LABEL}>RDP:</span>
                              <span className="truncate">{rdpCommandFor(data)}</span>
                              {copyButton(rdpCommandFor(data), `rdp-${rowKey}`, 'RDP-Befehl kopieren')}
                            </div>
                          ) : null}

                          {data && showSsh ? (
                            <div className={`${PILL} max-w-full`}>
                              <span className={PILL_LABEL}>SSH:</span>
                              <span className="truncate">{sshCommandFor(data)}</span>
                              {copyButton(sshCommandFor(data), `ssh-${rowKey}`, 'SSH-Befehl kopieren')}
                            </div>
                          ) : null}

                          {/* 2. Login. */}
                          {data && showUser ? (
                            <div className={PILL}>
                              <span className={PILL_LABEL}>User:</span>
                              <span>{data.username}</span>
                              {copyButton(data.username ?? '', `user-${rowKey}`, 'Username kopieren')}
                            </div>
                          ) : null}

                          {/* 3. Password. */}
                          {account && data?.auth ? (
                            <div className={`${PILL} min-w-[150px] justify-between`}>
                              <div className="truncate mr-1">
                                <span className="text-gray-400 font-sans text-[10px] uppercase tracking-wider mr-1">
                                  PW:
                                </span>
                                {visiblePasswords[account.key] ? (
                                  data.auth
                                ) : (
                                  <span className="tracking-widest text-gray-400 select-none">••••••••</span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  type="button"
                                  title={visiblePasswords[account.key] ? 'Passwort verbergen' : 'Passwort anzeigen'}
                                  onClick={() =>
                                    setVisiblePasswords((v) => ({ ...v, [account.key]: !v[account.key] }))
                                  }
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-200 transition-colors"
                                >
                                  {visiblePasswords[account.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                                {copyButton(data.auth, `auth-${rowKey}`, 'Passwort kopieren')}
                              </div>
                            </div>
                          ) : null}

                          {/* Other members' credentials: on request, operate right only. */}
                          {canRevealRow && !hasNothing ? (
                            <button
                              type="button"
                              disabled={status === 'loading'}
                              onClick={() => void reveal(member.userId)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 font-sans text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                            >
                              <KeyRound size={12} />
                              {t('DeploymentDetailView.revealCredentials')}
                            </button>
                          ) : null}
                          {canRevealRow && status === 'error' ? (
                            <span role="alert" className="font-sans text-xs text-red-600">
                              {t('DeploymentDetailView.revealFailed')}
                            </span>
                          ) : null}
                          {canRevealRow && hasNothing ? (
                            <span className="font-sans text-xs text-gray-500">
                              {t('DeploymentDetailView.noCredentials')}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
