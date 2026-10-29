import { useTranslation } from 'react-i18next'
import { UserMinus, UserPlus, Loader2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import BaseButton from '@/components/ui/BaseButton'
import { roleLabelKey } from '@/i18n/role-labels'
import type { User } from '@/types'
import { avatarInitial, roleBadgeClass } from './roleBadge'

export interface MembersCardProps {
  members: User[]
  canManage: boolean
  /** Id of the member whose removal is in flight, if any. */
  removingId: string | null
  onAdd: () => void
  onRemove: (user: User) => void
}

export default function MembersCard({ members, canManage, removingId, onAdd, onRemove }: MembersCardProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-textHeading">{t('CourseDetailView.membersTitle')}</h2>
        {canManage ? (
          <BaseButton onClick={onAdd} className="flex items-center gap-2">
            <UserPlus size={16} />
            {t('CourseDetailView.addMemberBtn')}
          </BaseButton>
        ) : null}
      </div>

      {members.length === 0 ? (
        <div className="py-10 text-center text-textFaint text-sm">{t('CourseDetailView.noMembers')}</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.map((user) => (
            <li key={user.userId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surfaceMuted flex items-center justify-center text-textMuted text-sm font-semibold">
                  {avatarInitial(user.username)}
                </div>
                <div>
                  <div className="font-medium text-textHeading">{user.username}</div>
                  <div className="text-xs text-textMuted">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${roleBadgeClass(user.role)}`}>
                  {t(roleLabelKey(user.role))}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => onRemove(user)}
                    disabled={removingId === user.userId}
                    className="p-2 hover:bg-dangerTint rounded-lg transition disabled:opacity-50"
                    title={t('CourseDetailView.removeMemberTitle')}
                  >
                    {removingId === user.userId ? (
                      <Loader2 size={16} className="animate-spin text-danger" />
                    ) : (
                      <UserMinus size={16} className="text-danger" />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
