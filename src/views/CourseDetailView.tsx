import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GraduationCap, ArrowLeft } from 'lucide-react'
import { useCourseStore } from '@/stores/course.store'
import { useToast } from '@/composables/useToast'
import { useRole } from '@/composables/useRole'
import { extractErrorMessage } from '@/utils/http-error'
import { paths } from '@/router/paths'
import type { User } from '@/types'
import CourseNameEditor from './course-detail/CourseNameEditor'
import MembersCard from './course-detail/MembersCard'
import AddMembersModal from './course-detail/AddMembersModal'
import RemoveMemberModal from './course-detail/RemoveMemberModal'

export default function CourseDetailView() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  // Editing the name and managing members is the staff-level capability the
  // backend gates on course-teacher membership; the API still rejects others.
  const { isStaff } = useRole()

  const course = useCourseStore((s) => s.currentCourse)
  const courses = useCourseStore((s) => s.courses)
  const members = useCourseStore((s) => s.currentMembers)
  const isLoading = useCourseStore((s) => s.isLoading)

  // Add-members modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSession, setAddSession] = useState(0)
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  // Member removal
  const [memberToRemove, setMemberToRemove] = useState<User | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = useCourseStore.getState()
      try {
        await store.fetchCourseById(id)
        if (useCourseStore.getState().courses.length === 0) await store.fetchCourses()
      } catch {
        if (cancelled) return
        toast.error(t('CourseDetailView.toasts.loadError'))
        navigate(paths.courses)
      }
    })()
    return () => {
      cancelled = true
    }
    // Reload when the route param changes; toast/t/navigate are stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const saveName = async (name: string) => {
    try {
      await useCourseStore.getState().updateCourse(id, { name })
      toast.success(t('CourseDetailView.toasts.nameUpdated'))
    } catch (error) {
      toast.error(t('CourseDetailView.toasts.nameUpdateError'))
      throw error
    }
  }

  const openAddModal = () => {
    setAddSession((n) => n + 1)
    setShowAddModal(true)
  }

  const addMembers = async (userIds: string[]) => {
    if (userIds.length === 0) return
    setIsAddingMembers(true)
    try {
      await useCourseStore.getState().addMembers(id, userIds)
      toast.success(
        userIds.length === 1
          ? t('CourseDetailView.toasts.membersAddedSingular')
          : t('CourseDetailView.toasts.membersAddedPlural', { count: userIds.length }),
      )
      setShowAddModal(false)
    } catch (err) {
      toast.error(extractErrorMessage(err, t('CourseDetailView.toasts.addError')))
    } finally {
      setIsAddingMembers(false)
    }
  }

  const closeRemoveModal = () => {
    if (removingId) return
    setMemberToRemove(null)
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return
    const user = memberToRemove
    setRemovingId(user.userId)
    try {
      await useCourseStore.getState().removeMember(id, user.userId)
      toast.success(t('CourseDetailView.toasts.memberRemoved'))
      setMemberToRemove(null)
    } catch (err) {
      toast.error(extractErrorMessage(err, t('CourseDetailView.toasts.removeError')))
    } finally {
      setRemovingId(null)
    }
  }

  const memberCountLabel =
    members.length === 1
      ? t('CourseDetailView.memberSingular', { count: members.length })
      : t('CourseDetailView.memberPlural', { count: members.length })

  return (
    <div className="app-page">
      <button
        type="button"
        onClick={() => navigate(paths.courses)}
        className="flex items-center gap-2 text-textMuted hover:text-textHeading mb-4 text-sm"
      >
        <ArrowLeft size={16} />
        {t('CourseDetailView.back')}
      </button>

      {isLoading && !course ? (
        <div className="text-center py-16 text-textFaint">{t('CourseDetailView.loading')}</div>
      ) : course ? (
        <div className="space-y-6">
          <div className="flex items-start gap-5 border-b border-borderSubtle pb-6">
            <div className="w-14 h-14 bg-infoTint rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap size={28} className="text-info" />
            </div>
            <div className="flex-grow">
              <CourseNameEditor name={course.name} canEdit={isStaff} onSave={saveName} />
              <p className="text-textMuted text-sm mt-1">{memberCountLabel}</p>
            </div>
          </div>

          <MembersCard
            members={members}
            canManage={isStaff}
            removingId={removingId}
            onAdd={openAddModal}
            onRemove={setMemberToRemove}
          />
        </div>
      ) : null}

      <AddMembersModal
        show={showAddModal}
        session={addSession}
        courseId={id}
        courses={courses}
        members={members}
        isSubmitting={isAddingMembers}
        onListError={() => toast.error(t('CourseDetailView.toasts.loadUsersError'))}
        onClose={() => setShowAddModal(false)}
        onSubmit={(ids) => void addMembers(ids)}
      />

      <RemoveMemberModal
        member={memberToRemove}
        isRemoving={removingId !== null}
        onClose={closeRemoveModal}
        onConfirm={() => void confirmRemoveMember()}
      />
    </div>
  )
}
