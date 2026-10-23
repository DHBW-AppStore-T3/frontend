import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, User, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { sshCommandFor, rdpCommandFor, userUrlFor } from '@/utils/connection-commands'
import type { enrichTeams } from './helpers'

type EnrichedTeam = ReturnType<typeof enrichTeams>[number]

export interface TeamsCardProps {
  teamCount: number
  teams: EnrichedTeam[]
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}

const PILL = 'flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100'
const PILL_LABEL = 'text-gray-400 font-sans text-[10px] uppercase tracking-wider flex-shrink-0'
const COPY_BTN =
  'text-gray-400 hover:text-amber-600 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0'

/** Teams & members with per-member credentials. */
export default function TeamsCard({
  teamCount,
  teams,
  copiedKey,
  onCopy,
}: TeamsCardProps) {
  const { t } = useTranslation()
  // Password visibility, keyed by account key.
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

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
                  const account = member.account
                  const data = account?.data
                  const vmUrl = team.vm?.url
                  const userUrl = data ? userUrlFor(data, vmUrl) : null

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

                      {account && data ? (
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-600 lg:justify-end">
                          {/* Web-app URL from ``team_vms.<team>.url``, shared by
                              every team member. When set, the SSH pill is
                              dropped and the username shows next to it. */}
                          {vmUrl ? (
                            <div className={PILL}>
                              <span className={PILL_LABEL}>User:</span>
                              <span>{data.username}</span>
                              {copyButton(data.username ?? '', `user-${account.key}`, 'Username kopieren')}
                            </div>
                          ) : null}

                          {/* Ready-to-use RDP command line (opt-in via authtype "rdp"). */}
                          {data.authtype === 'rdp' && data.ip ? (
                            <div className={`${PILL} max-w-full`}>
                              <span className={PILL_LABEL}>RDP:</span>
                              <span className="truncate">{rdpCommandFor(data)}</span>
                              {copyButton(rdpCommandFor(data), `rdp-${account.key}`, 'RDP-Befehl kopieren')}
                            </div>
                          ) : null}

                          {data.ip &&
                          data.port &&
                          data.type !== 'ssh_key' &&
                          data.authtype !== 'ssh' &&
                          data.authtype !== 'rdp' &&
                          data.port !== 22 ? (
                            <div className={`${PILL} max-w-[280px]`}>
                              <span className={PILL_LABEL}>URL:</span>
                              <a
                                href={userUrl ?? ''}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {userUrl?.replace(/^https?:\/\//, '')}
                              </a>
                              {copyButton(userUrl ?? '', `vmurl-${account.key}`, 'URL kopieren')}
                            </div>
                          ) : vmUrl ? (
                            <div className={`${PILL} max-w-[280px]`}>
                              <span className={PILL_LABEL}>URL:</span>
                              <a
                                href={vmUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {vmUrl.replace(/^https?:\/\//, '')}
                              </a>
                              {copyButton(vmUrl, `vmurl-${account.key}`, 'URL kopieren')}
                            </div>
                          ) : null}

                          {/* Ready-to-use SSH command line (username, IP, non-22 port). */}
                          {!vmUrl && data.ip && data.username && (!data.authtype || data.authtype === 'ssh') ? (
                            <div className={`${PILL} max-w-full`}>
                              <span className={PILL_LABEL}>SSH:</span>
                              <span className="truncate">{sshCommandFor(data)}</span>
                              {copyButton(sshCommandFor(data), `ssh-${account.key}`, 'SSH-Befehl kopieren')}
                            </div>
                          ) : null}

                          {data.auth ? (
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
                                  onClick={() =>
                                    setVisiblePasswords((v) => ({ ...v, [account.key]: !v[account.key] }))
                                  }
                                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-200 transition-colors"
                                >
                                  {visiblePasswords[account.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                                {copyButton(data.auth, `auth-${account.key}`, 'Passwort kopieren')}
                              </div>
                            </div>
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
