import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Info } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'
import { translateHtml } from '@/i18n/html'
import type { Course, User } from '@/types'
import { useUserSearch } from './useUserSearch'
import { avatarInitial } from './roleBadge'

export interface AddMembersModalProps {
  show: boolean
  /** Changes every time the modal is opened so the user list reloads. */
  session: number
  courseId: string
  courses: Course[]
  members: User[]
  isSubmitting: boolean
  onListError: () => void
  onClose: () => void
  onSubmit: (userIds: string[]) => void
}

/** Pick students (search + checkbox list) to add to the course. */
export default function AddMembersModal(props: AddMembersModalProps) {
  const { show, session, courseId, courses, members, isSubmitting, onListError, onClose, onSubmit } = props
  const { t } = useTranslation()
  const { query, setQuery, users, isSearching } = useUserSearch(show, session, onListError)
  const [selected, setSelected] = useState<Map<string, User>>(new Map())

  // A fresh selection per opening (render-phase reset keyed on the session).
  const [selectionSession, setSelectionSession] = useState(session)
  if (selectionSession !== session) {
    setSelectionSession(session)
    setSelected(new Map())
  }

  const isAlreadyMember = (userId: string) => members.some((m) => m.userId === userId)

  const otherCourseName = (userCourseId: string | undefined | null) => {
    if (!userCourseId || userCourseId === courseId) return null
    return courses.find((c) => c.courseId === userCourseId)?.name ?? t('CourseDetailView.otherCourseFallback')
  }

  const toggle = (user: User) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(user.userId)) next.delete(user.userId)
      else next.set(user.userId, user)
      return next
    })

  const remove = (userId: string) =>
    setSelected((prev) => {
      const next = new Map(prev)
      next.delete(userId)
      return next
    })

  return (
    <Modal
      show={show}
      onClose={onClose}
      header={<h2 className="text-xl font-semibold">{t('CourseDetailView.addModal.title')}</h2>}
      body={
        <div className="space-y-5">
          <div className="bg-infoTint text-blue-800 p-3.5 rounded-lg text-sm flex gap-3 items-start border border-blue-100">
            <Info size={18} className="mt-0.5 flex-shrink-0 text-info" />
            {/* eslint-disable-next-line no-restricted-syntax -- static translation, no parameters */}
            <p dangerouslySetInnerHTML={{ __html: translateHtml('CourseDetailView.addModal.info', {}, t) }} />
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textFaint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder={t('CourseDetailView.addModal.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-borderSubtle rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {selected.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...selected.values()].map((user) => (
                <span
                  key={user.userId}
                  className="flex items-center gap-1 bg-primaryFaint text-primary text-sm px-2 py-1 rounded"
                >
                  {user.username}
                  <button type="button" onClick={() => remove(user.userId)} className="hover:text-primaryDark">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="max-h-64 overflow-y-auto border border-borderSubtle rounded-lg overscroll-contain">
            {isSearching ? (
              <div className="p-4 text-center text-textFaint text-sm">{t('CourseDetailView.addModal.loadingUsers')}</div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-textFaint text-sm">{t('CourseDetailView.addModal.noUsersFound')}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {users.map((user) => {
                  const member = isAlreadyMember(user.userId)
                  const otherCourse = otherCourseName(user.courseId)
                  return (
                    <li key={user.userId}>
                      <label
                        className={`flex items-center justify-between p-3 hover:bg-surfaceMuted transition select-none ${
                          member ? 'opacity-75' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surfaceMuted flex items-center justify-center text-textMuted text-xs font-semibold">
                            {avatarInitial(user.username)}
                          </div>
                          <div>
                            <div className="font-medium text-textHeading text-sm">{user.username}</div>
                            <div className="text-xs text-textMuted">{user.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {member ? (
                            <span className="text-xs text-textFaint">{t('CourseDetailView.addModal.alreadyMember')}</span>
                          ) : (
                            <>
                              {otherCourse ? (
                                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded">
                                  {t('CourseDetailView.addModal.inOtherCourse', { courseName: otherCourse })}
                                </span>
                              ) : null}
                              <input
                                type="checkbox"
                                checked={selected.has(user.userId)}
                                onChange={() => toggle(user)}
                                className="w-4 h-4 text-primary rounded border-borderSubtle focus:ring-primary cursor-pointer"
                              />
                            </>
                          )}
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <BaseButton variant="text" onClick={onClose} disabled={isSubmitting}>
            {t('CourseDetailView.addModal.cancel')}
          </BaseButton>
          <BaseButton
            onClick={() => onSubmit([...selected.keys()])}
            disabled={selected.size === 0 || isSubmitting}
          >
            {isSubmitting
              ? t('CourseDetailView.addModal.adding')
              : t('CourseDetailView.addModal.addCount', { count: selected.size })}
          </BaseButton>
        </div>
      }
    />
  )
}
